import path from "node:path";
import {styleText} from "node:util";

import {
  Browser,
  Builder,
  By,
  Capabilities,
  Capability,
  logging,
  until,
  WebDriver,
  WebElement,
} from "selenium-webdriver";
import bcd from "@mdn/browser-compat-data" with {type: "json"};

const bcdBrowsers = bcd.browsers;
import {compare as compareVersions} from "compare-versions";
import esMain from "es-main";
import fs from "fs-extra";
import {Listr, ListrTask, ListrTaskWrapper} from "listr2";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {getResultsDir} from "../lib/constants.js";
import filterVersionsLib from "../lib/filter-versions.js";
import getSecrets from "../lib/secrets.js";

import type {BrowserName} from "@mdn/browser-compat-data";

import "../lib/selenium-keepalive.js";

// The Huawei Browser (ArkWeb) is not yet present in the @mdn/browser-compat-data
// version bundled with this collector, so its versions are read from the local
// browser-compat-data checkout instead.
import huaweiBCD from "../../browser-compat-data/browsers/huaweibrowser_harmonyos.json" with {type: "json"};

/**
 * Returns the testable versions of the Huawei Browser, sourced from the local
 * browser-compat-data checkout (since the bundled BCD lacks this entry).
 * Avoids filterVersions(), which throws for unknown browsers.
 *
 * Mirrors the semantics of filterVersions() for the other browsers:
 *  - keep only releases that BCD considers testable (current/planned/retired),
 *  - then drop the ones released before |since|, so "--since" really limits
 *    the run to versions from that year on.
 *
 * @param since - The date to filter the versions since (or a version string).
 * @param reverse - Whether to reverse the resulting order.
 * @returns An array of filtered Huawei Browser versions.
 */
const getHuaweiVersions = (
  since: string | Date | null,
  reverse: boolean,
): string[] => {
  const releases =
    (huaweiBCD as any).browsers?.huaweibrowser_harmonyos?.releases as Record<
      string,
      {status: string; release_date?: string}
    >;
  let versions = releases
    ? Object.entries(releases)
        .filter(([, r]) => ["current", "planned", "retired"].includes(r.status))
        .map(([v]) => v)
    : [];

  if (typeof since === "string") {
    // Called with a version number (explicit version filtering).
    versions = versions.filter((v) => compareVersions(v, since, ">="));
  } else if (since instanceof Date) {
    // Called with a date (the "--since" year), filter by release_date.
    // Releases without a release_date are kept, so a missing (or future)
    // date never silently removes a version from the run.
    versions = versions.filter((v) => {
      const releaseDate = releases?.[v]?.release_date;
      if (!releaseDate) {
        return true;
      }
      return new Date(releaseDate) >= since;
    });
  }

  return reverse ? [...versions].reverse() : versions;
};

const RESULTS_DIR = getResultsDir();

type Task = ListrTaskWrapper<any, any, any>;

const collectorVersion = (
  await fs.readJson(new URL("../package.json", import.meta.url))
).version;

const secrets = await getSecrets();

// Remote Chrome/Chromium debugger address used to drive a device over the LAN
// (e.g. an RK board running HarmonyOS/ArkWeb). Provide it via the
// --debugger-address CLI flag or the DEBUGGER_ADDRESS environment variable.
let debuggerAddress = process.env.DEBUGGER_ADDRESS || "";

const testenv = process.env.NODE_ENV === "test";
const host = testenv
  ? "http://localhost:8080"
  : "https://collector.openwebdocs.org";

const seleniumUrls = {
  browserstack: "https://${username}:${key}@hub-cloud.browserstack.com/wd/hub",
  saucelabs:
    "https://${username}:${key}@ondemand.${region}.saucelabs.com:443/wd/hub",
  lambdatest: "https://${username}:${key}@hub.lambdatest.com/wd/hub",
};

/**
 * Custom tests that use getUserMedia() make Chrome 25-26, Edge 12-18 and Firefox 34-53 block.
 */
const gumTests = [
  "ImageCapture",
  "MediaStream",
  "MediaStreamAudioSourceNode",
  "MediaStreamTrack",
  "MediaStreamTrackAudioSourceNode",
].map((iface) => `api.${iface}`);

/**
 * Object that defines the ignored versions of browsers and their corresponding tests.
 * The structure of the object is as follows:
 * {
 *   browserName: {
 *     version: [ignoredTest1, ignoredTest2, ...]
 *   }
 * }
 */
const ignore = {
  chrome: {
    25: gumTests,
    26: gumTests,
  },
  edge: {
    12: gumTests,
    13: gumTests,
    14: gumTests,
    15: gumTests,
    16: gumTests,
    17: gumTests,
    18: gumTests,
  },
  firefox: {
    34: gumTests,
    35: gumTests,
    36: gumTests,
    37: gumTests,
    38: gumTests,
    39: gumTests,
    40: gumTests,
    41: gumTests,
    42: gumTests,
    43: gumTests,
    44: gumTests,
    45: gumTests,
    46: gumTests,
    47: gumTests,
    48: gumTests,
    49: gumTests,
    50: gumTests,
    51: gumTests,
    52: gumTests,
  },
};

/**
 * Object containing the earliest versions of various browsers.
 */
const earliestBrowserVersions = {
  chrome: "15",
  edge: "12",
  firefox: "4",
  safari: "5.1",
  // Only collect recent mobile browsers for now
  chrome_android: "150",
  firefox_android: "150",
  safari_ios: "26.5",
};

/**
 * Returns a formatted string representing the browser name, version, and operating system.
 * @param browser - The browser name.
 * @param version - The browser version.
 * @param os - The operating system.
 * @returns The formatted string.
 */
const prettyName = (
  browser: BrowserName,
  version: string,
  os: string,
): string => {
  // Fall back to the raw browser identifier when the BCD data source does not
  // contain an entry (e.g. huaweibrowser_harmonyos in older BCD snapshots).
  const browserName = bcdBrowsers[browser]?.name ?? browser;
  return `${browserName} ${version} on ${os}`;
};

/**
 * Logs a message for a given task.
 * XXX temporary until https://github.com/SamVerschueren/listr/issues/150 fixed
 * @param task - The task object.
 * @param message - The message to be logged.
 */
const log = (task: Task, message: string) => {
  task.output = task.title + " - " + message;
};

/**
 * Filters the versions of a browser based on a given date and sorting order.
 * @param browser - The name of the browser.
 * @param since - The date since which the versions should be filtered.
 * @param reverse - Specifies whether the versions should be sorted in reverse order.
 * @returns - An array of filtered versions of the browser.
 */
const filterVersions = (
  browser: BrowserName,
  since: Date,
  reverse: boolean,
) => {
  return filterVersionsLib(browser, since, reverse).filter((v) =>
    compareVersions(v, earliestBrowserVersions[browser], ">="),
  );
};

/**
 * Retrieves the browsers to test based on the specified criteria.
 * @param limitBrowsers - An array of browser names to limit the testing to.
 * @param since - The date to filter the versions since.
 * @param reverse - A boolean indicating whether to reverse the order of the versions.
 * @returns An object containing the browsers to test and their corresponding versions.
 */
const getBrowsersToTest = (
  limitBrowsers: BrowserName[],
  since: Date,
  reverse: boolean,
) => {
  // Note: huaweibrowser_harmonyos is not yet in the @mdn/browser-compat-data
  // type definitions shipped with this collector, so it is added as a string
  // key. It requires a BCD data source that includes the Huawei Browser entry.
  let browsersToTest: Record<string, string[]> = {
    chrome: filterVersions("chrome", since, reverse),
    edge: filterVersions("edge", since, reverse),
    firefox: filterVersions("firefox", since, reverse),
    safari: filterVersions("safari", since, reverse),
    chrome_android: filterVersions("chrome_android", since, reverse),
    firefox_android: filterVersions("firefox_android", since, reverse),
    safari_ios: filterVersions("safari_ios", since, reverse),
    huaweibrowser_harmonyos: getHuaweiVersions(since, reverse),
  };

  if (limitBrowsers) {
    browsersToTest = Object.fromEntries(
      Object.entries(browsersToTest).filter(([k]) =>
        limitBrowsers.includes(k as BrowserName),
      ),
    );
  }

  return browsersToTest;
};

/**
 * Returns the corresponding Safari OS version for the given version number.
 * @param version - The version number of Safari.
 * @returns - The corresponding Safari OS version, or undefined if the version is not recognized.
 */
const getSafariOS = (version: string): string | undefined => {
  // Sauce Labs differentiates 10.0 vs. 10.1 in the OS version. This
  // function sets the appropriate OS version accordingly.

  switch (version) {
    case "10":
      return "OS X 10.11";
    case "11":
      return "macOS 10.12";
    case "12":
      return "macOS 10.14";
    case "13":
      return "macOS 10.13";
    default:
      return undefined;
  }
};

/**
 * Retrieves the list of operating systems to test based on the provided service and OS.
 * @param service - The name of the service (e.g., "saucelabs", "lambdatest", "browserstack").
 * @param os - The name of the operating system (e.g., "Windows", "macOS").
 * @returns - The list of operating systems to test, represented as an array of tuples where each tuple contains the name of the operating system and its version.
 * @throws {Error} - If the provided OS is unknown or unsupported.
 */
const getOsesToTest = (service: string, os: string): [string, string][] => {
  let osesToTest: [string, string][];

  switch (os) {
    case "Windows":
      osesToTest = [
        ["Windows", "11"],
        ["Windows", "10"],
        ["Windows", "8.1"],
        ["Windows", "8"],
        ["Windows", "7"],
        ["Windows", "XP"],
      ];
      break;
    case "macOS":
      switch (service) {
        case "saucelabs":
          osesToTest = [
            ["macOS", "15"],
            ["macOS", "13"],
            ["macOS", "10.14"],
          ];
          break;
        case "lambdatest":
          osesToTest = [
            ["macOS", "Sequoia"],
            ["macOS", "Sonoma"],
            ["macOS", "Ventura"],
            ["macOS", "Monterey"],
            ["macOS", "Big Sur"],
            ["macOS", "Mojave"],
            ["OS X", "El Capitan"],
          ];
          break;
        default:
          // BrowserStack
          osesToTest = [
            ["OS X", "Tahoe"],
            ["OS X", "Sequoia"],
            ["OS X", "Sonoma"],
            ["OS X", "Ventura"],
            ["OS X", "Monterey"],
            ["OS X", "Big Sur"],
            ["OS X", "Mojave"],
            ["OS X", "El Capitan"],
          ];
      }
      break;
    case "HarmonyOS":
      // HarmonyOS devices (e.g. boards running ArkWeb) are driven as a single
      // target; there is no per-version OS matrix to iterate over.
      osesToTest = [["HarmonyOS", "5.0"]];
      break;
    case "Android":
      osesToTest = [["Android", "17"]];
      break;
    case "iOS":
      osesToTest = [["iOS", "26.5"]];
      break;
    default:
      throw new Error(`Unknown/unsupported OS: ${os}`);
  }

  return osesToTest;
};

/**
 * Retrieves the Selenium URL based on the provided service and credentials.
 * @param service - The name of the service.
 * @param credentials - The credentials for the service. If it's a string, it will be treated as the URL.
 * @returns - The Selenium URL.
 * @throws {Error} - If the service is unknown and URL is not specified, or if there are missing required variables in the URL.
 */
const getSeleniumUrl = (service: string, credentials: any): string => {
  // If credentials object is just a string, treat it as the URL
  if (typeof credentials === "string") {
    return credentials;
  }

  if (!(service in seleniumUrls)) {
    if ("url" in credentials) {
      seleniumUrls[service] = credentials.url;
    } else {
      throw new Error(
        `Couldn't compile Selenium URL for ${service}: service is unknown and URL not specified`,
      );
    }
  }

  const re = /\${([^}]+)?}/g;
  const missingVars: string[] = [];

  // Replace variables in pre-defined Selenium URLs
  const seleniumUrl = seleniumUrls[service].replace(re, ($1, $2) => {
    if ($2 in credentials) {
      return credentials[$2];
    }
    missingVars.push($2);
    return $1;
  });

  // Check for any unfilled variables
  if (missingVars.length) {
    throw new Error(
      `Couldn't compile Selenium URL for ${service}: missing required variables: ${missingVars.join(
        ", ",
      )}`,
    );
  }

  return seleniumUrl;
};

/**
 * Builds a Selenium driver for the specified browser, version, and operating system.
 * @param browser - The browser name.
 * @param version - The browser version.
 * @param os - The operating system.
 * @returns - The built Selenium driver and related information.
 */
const buildDriver = async (
  browser: BrowserName,
  version: string,
  os: string,
) => {
  for (const [service, credentials] of Object.entries(secrets.selenium)) {
    if (service === "browserstack") {
      if (browser === "edge" && ["12", "13", "14"].includes(version)) {
        // BrowserStack remaps Edge 12-14 as Edge 15
        continue;
      }

      if (
        browser === "safari" &&
        compareVersions(version, "10", ">=") &&
        version.split(".")[0] == version
      ) {
        // BrowserStack doesn't support the Safari x.0 versions
        continue;
      }
    } else if (service === "saucelabs") {
      if (browser === "edge" && version === "79") {
        // SauceLabs has issues with Edge 79
        continue;
      }
    }

    for (const [osName, osVersion] of getOsesToTest(service, os)) {
      const capabilities = new Capabilities();

      const commonConfig = {
        name: `mdn-bcd-collector: ${prettyName(browser, version, os)}`,
        build: `mdn-bcd-collector v${collectorVersion}`,
        project: "mdn-bcd-collector",
      };

      // Set test name (vendor-specific, only for cloud testing providers)
      if (["browserstack", "saucelabs", "lambdatest"].includes(service)) {
        capabilities.set("name", commonConfig.name);
        capabilities.set("build", commonConfig.build);
        capabilities.set("project", commonConfig.project);
      }

      const webdriverBrowserName = browser
        .replace("_android", "")
        .replace("_ios", "")
        .toUpperCase();

      // Browser (ArkWeb) is Chromium-based but has no dedicated
      // Selenium browser constant; map it to "chrome" so a Chromium-compatible
      // driver (e.g. local chromedriver / Appium on a HarmonyOS device) can drive it.
      // Other browsers keep the base behavior (Browser[webdriverBrowserName]).
      const browserNameForSelenium =
        (browser as string) === "huaweibrowser_harmonyos"
          ? "chrome"
          : Browser[webdriverBrowserName];
      capabilities.set(Capability.BROWSER_NAME, browserNameForSelenium);
      // Cloud testing providers need explicit version; local ChromeDriver uses installed Chrome
      if (["browserstack", "saucelabs", "lambdatest"].includes(service)) {
        capabilities.set(Capability.BROWSER_VERSION, version.split(".")[0]);
      }

      if (service === "browserstack") {
        const osCaps: any = {os: osName};
        if (browser !== "safari") {
          osCaps.osVersion = osVersion;
        }
        if (os === "Android") {
          osCaps.deviceName = "Pixel 9";
          osCaps.realMobile = true;
        }

        if (os === "iOS") {
          osCaps.deviceName = "iPhone 17 Pro";
          osCaps.realMobile = true;
        }

        capabilities.set("bstack:options", osCaps);
      } else {
        // Remap target OS for Safari x.0 vs. x.1 on SauceLabs
        // Local ChromeDriver rejects platformName mismatch (e.g. "Windows 10" vs "windows"), so only set it for cloud providers
        if (service === "saucelabs" || service === "lambdatest") {
          if (browser === "safari") {
            capabilities.set("platformName", getSafariOS(version));
          } else {
            capabilities.set("platformName", `${osName} ${osVersion}`);
          }
        }

        if (service === "saucelabs") {
          capabilities.set("sauce:options", commonConfig);
        } else if (service === "lambdatest") {
          capabilities.set("LT:options", {
            ...commonConfig,
            platformName: capabilities.get("platformName"),
            w3c: true,
            plugin: "node_js-webdriverio",
          });
        }
      }

      // Allow mic, camera, geolocation and notifications permissions
      if (
        browser === "chrome" ||
        (browser as string) === "huaweibrowser_harmonyos" ||
        (browser === "edge" && compareVersions(version, "79", ">="))
      ) {
        capabilities.set("goog:chromeOptions", {
          // Only the HarmonyOS device attached over the LAN is driven through
          // debuggerAddress, and only for the local "custom" service. Cloud
          // providers (BrowserStack/SauceLabs/LambdaTest) launch their own
          // browser instances, so sending a local debugger address would make
          // the session fail or attach to the wrong target.
          ...(service === "custom" &&
          (browser as string) === "huaweibrowser_harmonyos"
            ? {debuggerAddress}
            : {}),
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--fake-variations-channel=stable",
          ],
          prefs: {
            "profile.managed_default_content_settings.geolocation": 1,
            "profile.managed_default_content_settings.notifications": 1,
          },
        });
      } else if (browser === "firefox") {
        let firefoxPrefs: Record<string, any> = {
          "media.navigator.streams.fake": true,
        };
        if (compareVersions(version, "53", ">=")) {
          firefoxPrefs = {
            ...firefoxPrefs,
            "media.navigator.permission.disabled": 1,
            "permissions.default.camera": 1,
            "permissions.default.microphone": 1,
            "permissions.default.geo": 1,
          };
        }
        if (compareVersions(version, "54", ">=")) {
          firefoxPrefs["permissions.default.desktop-notification"] = 1;
        }

        capabilities.set("moz:firefoxOptions", {
          prefs: firefoxPrefs,
        });
      }

      // Get console errors from browser
      const loggingPrefs = new logging.Preferences();
      loggingPrefs.setLevel(logging.Type.BROWSER, logging.Level.SEVERE);
      capabilities.setLoggingPrefs(loggingPrefs);
      if (service === "browserstack") {
        capabilities.set("browserstack.console", "errors");
      }

      try {
        const seleniumUrl = getSeleniumUrl(service, credentials);

        // Build Selenium driver
        const driverBuilder = new Builder()
          .usingServer(seleniumUrl)
          .withCapabilities(capabilities);
        // console.log(capabilities);
        const driver = await driverBuilder.build();

        return {driver, service, osName, osVersion};
      } catch (e) {
        const messages = [
          "Misconfigured -- Unsupported",
          "OS/Browser combination invalid",
          "Browser/Browser_Version not supported",
          "The Browser/Os combination is not supported",
          "Couldn't compile Selenium URL",
          "Unsupported platform",
        ];
        if (messages.some((m) => (e as Error).message.includes(m))) {
          // If unsupported config, continue to the next grid configuration
          continue;
        } else {
          throw e;
        }
      }
    }
  }

  return {driver: undefined};
};

/**
 * Changes the protocol of a given page URL based on the browser and its version.
 * @param browser - The name of the browser.
 * @param version - The version of the browser.
 * @param page - The URL of the page.
 * @returns - The modified page URL with the updated protocol.
 */
const changeProtocol = (
  browser: BrowserName,
  version: string,
  page: string,
): string => {
  let useHttp = false;
  switch (browser) {
    case "chrome":
      useHttp = compareVersions(version, "15", "<=");
      break;
    case "firefox":
      useHttp = compareVersions(version, "4", "<=");
      break;
  }

  if (
    (browser === "edge" && compareVersions(version, "18", "<=")) ||
    (browser === "firefox" && compareVersions(version, "52", "<="))
  ) {
    page = page.replace(/,/g, "%2C");
  }

  if (useHttp) {
    return page.replace("https://", "http://");
  }

  return page;
};

/**
 * Waits for the page to be fully loaded and ready.
 * @param driver - The WebDriver instance.
 * @returns - A promise that resolves when the page is ready.
 */
const awaitPageReady = async (driver: WebDriver) => {
  await driver.wait(async () => {
    const readyState = await driver.executeScript("return document.readyState");
    return readyState === "complete";
  }, 30000);
  await driver.executeScript("return document.readyState");
};

/**
 * Waits for the page to navigate to the specified URL and ensures that the page is ready.
 * @param driver - The WebDriver instance.
 * @param browser - The name of the browser.
 * @param version - The version of the browser.
 * @param page - The URL of the page to navigate to.
 * @returns - A promise that resolves when the page is ready.
 */
const awaitPage = async (
  driver: WebDriver,
  browser: BrowserName,
  version: string,
  page: string,
) => {
  await driver.wait(until.urlIs(changeProtocol(browser, version, page)), 30000);
  await awaitPageReady(driver);
};

/**
 * Navigates the driver to the specified page for the given browser and version.
 * @param driver - The WebDriver instance.
 * @param browser - The name of the browser.
 * @param version - The version of the browser.
 * @param page - The URL of the page to navigate to.
 * @returns - A promise that resolves when the page navigation is complete.
 */
const goToPage = async (
  driver: WebDriver,
  browser: BrowserName,
  version: string,
  page: string,
) => {
  await (driver as any).get(changeProtocol(browser, version, page), 30000);
  await awaitPageReady(driver);
};

/**
 * Clicks on an element identified by its ID using the specified driver and browser.
 * @param driver - The WebDriver instance.
 * @param browser - The browser name.
 * @param elementId - The ID of the element to click.
 * @returns - A promise that resolves when the click operation is completed.
 */
const click = async (
  driver: WebDriver,
  browser: BrowserName,
  elementId: string,
  timeout = 60000,
) => {
  if (browser === "safari") {
    // Slow devices (e.g. RK board) may not have rendered the element yet,
    // so wait for it before clicking.
    await driver.wait(until.elementLocated(By.id(elementId)), timeout);
    await driver.executeScript(
      `document.getElementById('${elementId}').click()`,
    );
  } else {
    const el = await driver.wait(
      until.elementLocated(By.id(elementId)),
      timeout,
    );
    await el.click();
  }
};

/**
 * Runs the test for the specified browser, version, and operating system.
 * @param browser - The browser to test.
 * @param version - The version of the browser.
 * @param os - The operating system to test on.
 * @param ctx - The context object.
 * @param task - The task object.
 * @returns - A promise that resolves when the test is complete.
 * @throws {Error} - If the browser/OS configuration is unsupported or if there is an error during the test.
 */
const run = async (
  browser: BrowserName,
  version: string,
  os: string,
  ctx: any,
  task: Task,
) => {
  log(task, "Starting...");

  const {driver, ...service} = await buildDriver(browser, version, os);

  if (!driver) {
    throw new Error(task.title + " - " + "Browser/OS config unsupported");
  }

  log(
    task,
    `Selected ${service.service} on ${service.osName} ${service.osVersion}`,
  );

  let statusEl: WebElement;

  const ignorelist = ignore[browser] && ignore[browser][version];
  const getvars = `?selenium=true${
    ignorelist ? `&ignore=${ignorelist.join(",")}` : ""
  }`;

  try {
    log(task, "Loading homepage...");
    await goToPage(driver, browser, version, `${host}/${getvars}`);
    await click(driver, browser, "start", 60000);

    log(task, "Loading test page...");
    await awaitPage(driver, browser, version, `${host}/tests/${getvars}`);

    log(task, "Running tests...");
    await driver.wait(until.elementLocated(By.id("run")), 60000);
    await click(driver, browser, "run", 60000);

    statusEl = await driver.findElement(By.id("status"));
    try {
      // Slow devices (e.g. RK board) can take many minutes to run the full
      // suite, so poll the status instead of a short fixed timeout and log
      // progress periodically.
      const uploadTimeout = 30 * 60 * 1000; // 30 minutes
      const pollInterval = 30 * 1000; // 30 seconds
      const start = Date.now();
      let uploaded = false;
      while (Date.now() - start < uploadTimeout) {
        const text = await statusEl.getText();
        if (text.includes("upload")) {
          uploaded = true;
          break;
        }
        log(
          task,
          `Still running tests... (${
            Math.round((Date.now() - start) / 1000)
          }s elapsed) status: ${text}`,
        );
        await driver.sleep(pollInterval);
      }
      if (!uploaded) {
        throw new Error(
          task.title + " - " + "Timed out waiting for results to upload",
        );
      }
    } catch (e) {
      if ((e as Error).name == "TimeoutError") {
        throw new Error(
          task.title + " - " + "Timed out waiting for results to upload",
          {cause: e},
        );
      }

      throw e;
    }

    const statusText = await statusEl.getText();

    if (statusText.includes("Failed")) {
      throw new Error(task.title + " - " + statusText);
    }

    log(task, "Exporting results...");
    await goToPage(driver, browser, version, `${host}/export`);
    const downloadEl = await driver.findElement(By.id("download"));
    const downloadUrl = (await downloadEl.getAttribute("href")) || "";

    if (!ctx.testenv) {
      const filename = path.basename(new URL(downloadUrl).pathname);
      const destPath = path.join(RESULTS_DIR, filename);
      log(task, `Downloading ${filename} ...`);

      const https = await import("node:https");
      const agent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 1,
      });

      const downloadResumable = async (url: string, maxTries = 8) => {
        let start = 0;
        if (await fs.pathExists(destPath)) {
          start = (await fs.stat(destPath)).size; 
        }
        for (let attempt = 1; attempt <= maxTries; attempt++) {
          try {
            const headers: Record<string, string> = {
              Connection: "keep-alive",
            };
            if (start > 0) {
              headers.Range = `bytes=${start}-`;
            }
            const res = await (fetch as any)(url, {
              agent,
              headers,
              signal: AbortSignal.timeout(120000),
            });
            if (![200, 206].includes(res.status)) {
              throw new Error(`HTTP ${res.status}`);
            }
            const buf = Buffer.from(await res.arrayBuffer());
            // A 206 (Partial Content) response honors the Range request and
            // contains only the remaining bytes, so it must be appended.
            // A 200 response means the server ignored the Range header and
            // returned the FULL body; appending it would duplicate the content
            // and corrupt the JSON, so overwrite the file instead.
            if (res.status === 206) {
              await fs.appendFile(destPath, buf);
            } else {
              await fs.writeFile(destPath, buf);
            }
            return;
          } catch (err) {
            log(
              task,
              `Download attempt ${attempt} failed: ${(err as Error).message}`,
            );
            
            if (await fs.pathExists(destPath)) {
              start = (await fs.stat(destPath)).size;
            }
            if (attempt === maxTries) {
              throw err;
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      };

      await downloadResumable(downloadUrl);
    }
  } finally {
    driver.quit().catch(() => {});
  }
};

/**
 * Runs all the tests for the specified browsers, versions, and operating systems.
 * @param limitBrowsers - The browsers to limit the tests to.
 * @param limitVersion - The versions to limit the tests to.
 * @param oses - The operating systems to run the tests on.
 * @param concurrent - The number of tests to run concurrently.
 * @param reverse - Whether to reverse the order of the tests.
 * @returns - A boolean indicating whether the tests were successfully run.
 */
const runAll = async (
  limitBrowsers: BrowserName[],
  limitVersion: Date,
  oses: string[],
  concurrent: boolean,
  reverse: boolean,
  limitVersions: string[] = [],
) => {
  if (!Object.keys(secrets.selenium).length) {
    console.error(
      styleText(
        ["red", "bold"],
        "A Selenium remote WebDriver URL is not defined in secrets.json. Please define your Selenium remote(s).",
      ),
    );
    return false;
  }

  if (testenv) {
    console.warn(
      styleText(["yellow", "bold"], "Test mode: results are not saved."),
    );
  }

  const browsersToTest = getBrowsersToTest(
    limitBrowsers,
    limitVersion,
    reverse,
  );

  // Filter to only the explicitly requested versions, if any were provided.
  // Normalize versions so that "7" and "7.0" are treated as equivalent.
  const normalizeVersion = (v: string) =>
    v
      .split(".")
      .filter((part, i, arr) => !(i > 0 && part === "0" && i === arr.length - 1))
      .join(".");
  const requestedVersions = limitVersions.map(normalizeVersion);
  const filteredBrowsersToTest: Record<string, string[]> = {};
  for (const [browser, versions] of Object.entries(browsersToTest)) {
    const kept =
      limitVersions.length > 0
        ? versions.filter((v) => requestedVersions.includes(normalizeVersion(v)))
        : versions;
    if (kept.length > 0) {
      filteredBrowsersToTest[browser] = kept;
    }
  }

  const tasks: ListrTask[] = [];

  if (Object.keys(filteredBrowsersToTest).length === 0) {
    console.warn(
      "No browser versions matched the requested filters " +
        `(browsers=${JSON.stringify(limitBrowsers)}, version=${JSON.stringify(
          limitVersions,
        )}, since=${limitVersion.toISOString().slice(0, 10)}). ` +
        "Nothing to test.",
    );
    return false;
  }

  for (const [browser, versions] of Object.entries(filteredBrowsersToTest) as [
    BrowserName,
    string[],
  ][]) {
    const browsertasks: ListrTask[] = [];

    const browserOsMap = {
      chrome: ["macOS", "Windows"],
      chrome_android: ["Android"],
      edge: ["macOS", "Windows"],
      firefox: ["macOS", "Windows"],
      firefox_android: ["Android"],
      huaweibrowser_harmonyos: ["HarmonyOS"],
      safari_ios: ["iOS"],
      safari: ["macOS"],
    };

    for (const version of versions) {
      for (const os of oses) {
        const supportedOs = browserOsMap[browser];
        if (supportedOs && !supportedOs.includes(os)) {
          continue;
        }

        // Don't test EdgeHTML on macOS
        if (
          os === "macOS" &&
          browser === "edge" &&
          compareVersions(version, "18", "<=")
        ) {
          continue;
        }

        browsertasks.push({
          title: prettyName(browser, version, os),
          /**
           * Task function to run the tests for a specific browser, version, and operating system.
           * @param ctx - The context object.
           * @param task - The task object.
           * @returns - A promise that resolves when the tests are completed.
           */
          task: (ctx, task) => run(browser, version, os, ctx, task),
          retry: 3,
        });
      }
    }

    tasks.push({
      title: bcdBrowsers[browser]?.name ?? (browser as string),
      /**
       * Task function to run the tests for a specific browser.
       * @returns - A promise that resolves when the tests are completed.
       */
      task: () =>
        new Listr(browsertasks, {
          concurrent,
          exitOnError: false,
        }),
    });
  }

  // TODO remove verbose when https://github.com/SamVerschueren/listr/issues/150 fixed
  const taskrun = new Listr(tasks, {
    exitOnError: false,
    renderer: "verbose",
    rendererOptions: {
      collapseSkips: false,
      collapseErrors: false,
    } as any,
  });

  await taskrun.run({testenv});
};

if (esMain(import.meta)) {
  const {argv}: {argv: any} = yargs(hideBin(process.argv))
    .version(false)
    .command(
    "$0 [browser..]",
    "Run Selenium on several browser versions",
    (yargs) => {
      (yargs as any)
        .positional("browser", {
          describe: "Limit the browser(s) to test",
          alias: "b",
          type: "string",
          choices: [
            "chrome",
            "edge",
            "firefox",
            "safari",
            "chrome_android",
            "firefox_android",
            "safari_ios",
            "huaweibrowser_harmonyos"
          ],
        })
        .option("since", {
          describe: "Limit to browser releases from this year on",
          alias: "s",
          type: "string",
          default: "2023",
          nargs: 1,
        })
        .option("os", {
          describe: "Specify OS to test",
          alias: "o",
          type: "array",
          choices: ["Windows", "macOS", "Android", "iOS", "HarmonyOS"],
          default: ["Windows", "macOS", "Android", "iOS", "HarmonyOS"],
        })
        .option("concurrent", {
          describe: "Define the number of concurrent jobs to run",
          alias: "j",
          type: "integer",
          nargs: 1,
          default: 5,
        })
        .option("reverse", {
          describe: "Run browser versions oldest-to-newest",
          alias: "r",
          type: "boolean",
          nargs: 0,
        })
        .option("version", {
          describe: "Only test the specified browser version(s)",
          alias: "v",
          type: "array",
          nargs: 1,
          coerce: (v: unknown) =>
            ([] as unknown[])
              .concat(v ?? [])
              .map((x) => String(x)),
        })
        .option("debugger-address", {
          describe:
            "Remote Chrome/Chromium debugger address (host:port) for driving a device over the LAN, e.g. 192.168.1.156:9222",
          alias: "d",
          type: "string",
          nargs: 1,
        });
    },
  );

  if (argv["debugger-address"]) {
    debuggerAddress = String(argv["debugger-address"]);
  }

  // The remote debugger address is only required when the HarmonyOS device is
  // driven locally (through the "custom" service). When running against cloud
  // providers, they launch their own browser instances and must NOT receive a
  // local debugger address.
  const requestedBrowsers = ([] as string[]).concat(
    (argv.browser as string | string[] | undefined) ?? [],
  );
  const usesLocalCustomService = "custom" in secrets.selenium;
  const needsDebuggerAddress =
    usesLocalCustomService &&
    (requestedBrowsers.length === 0 ||
      requestedBrowsers.includes("huaweibrowser_harmonyos"));

  if (needsDebuggerAddress && !debuggerAddress) {
    throw new Error(
      "No debugger address provided. Set DEBUGGER_ADDRESS or pass --debugger-address <host:port>."
    );
  }

  const versions = ([] as string[])
    .concat(argv.version ?? [])
    .flatMap((v) => String(v).split(",").map((s) => s.trim()))
    .filter((v) => v.length > 0);

  await runAll(
    argv.browser,
    new Date(`${argv.since}-01-01`),
    argv.os,
    argv.concurrent,
    argv.reverse,
    versions,
  );
}
