//
// mdn-bcd-collector: scripts/selenium.ts
// Script to collect results from various browsers using Selenium webdriver
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import path from "node:path";

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
import bcd from "@mdn/browser-compat-data" assert {type: "json"};

const bcdBrowsers = bcd.browsers;
import {compare as compareVersions} from "compare-versions";
import fetch from "node-fetch";
import esMain from "es-main";
import fs from "fs-extra";
import chalk from "chalk-template";
import {Listr, ListrTask, ListrTaskWrapper} from "listr2";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {RESULTS_DIR} from "../lib/constants.js";
import filterVersionsLib from "../lib/filter-versions.js";
import getSecrets from "../lib/secrets.js";

import type {BrowserName, BrowserStatement} from "@mdn/browser-compat-data";

import "../lib/selenium-keepalive.js";

type Task = ListrTaskWrapper<any, any, any>;

const secrets = await getSecrets();

const testenv = process.env.NODE_ENV === "test";
const host = testenv
  ? "http://localhost:8080"
  : "https://mdn-bcd-collector.gooborg.com";

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
    15: ["api.SecurityPolicyViolationEvent", ...gumTests],
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
};

const isBeta = (browser: BrowserName, version: string): boolean => {
  return (bcdBrowsers[browser] as BrowserStatement).releases[version]?.status === 'beta';
}

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
  if (isBeta(browser, version)) {
    version = `${version}-beta`;
  };
  return `${bcdBrowsers[browser].name} ${version} on ${os}`;
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
  let browsersToTest: Partial<Record<BrowserName, string[]>> = {
    chrome: filterVersions("chrome", since, reverse),
    // edge: filterVersions("edge", since, reverse),
    firefox: filterVersions("firefox", since, reverse),
    safari: filterVersions("safari", since, reverse).filter((v) =>
      // CIs don't have good coverage of Safari 15 and above
      compareVersions(v, "16", "<"),
    ),
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
  let osesToTest: [string, string][] = [];

  switch (os) {
    case "Windows":
      osesToTest = [
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
            ["macOS", "13"],
            ["macOS", "10.14"],
          ];
          break;
        case "lambdatest":
          osesToTest = [
            ["macOS", "Monterey"],
            ["macOS", "Big Sur"],
            ["macOS", "Mojave"],
            ["OS X", "El Capitan"],
          ];
          break;
        default:
          // BrowserStack
          osesToTest = [
            ["OS X", "Monterey"],
            ["OS X", "Big Sur"],
            ["OS X", "Mojave"],
            ["OS X", "El Capitan"],
          ];
      }
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

    // eslint-disable-next-line guard-for-in
    for (const [osName, osVersion] of getOsesToTest(service, os)) {
      const capabilities = new Capabilities();

      // Set test name
      const testName = `mdn-bcd-collector: ${prettyName(browser, version, os)}`;
      capabilities.set("name", testName);
      if (service === "saucelabs") {
        capabilities.set("sauce:options", {
          name: testName,
        });
      }

      capabilities.set(Capability.BROWSER_NAME, Browser[browser.toUpperCase()]);
      capabilities.set(Capability.BROWSER_VERSION, version.split(".")[0]);

      if (service === "browserstack") {
        const osCaps: any = {os: osName};
        if (browser !== "safari") {
          osCaps.osVersion = osVersion;
        }
        capabilities.set("bstack:options", osCaps);
      } else if (service === "saucelabs") {
        // Remap target OS for Safari x.0 vs. x.1 on SauceLabs
        if (browser === "safari") {
          capabilities.set("platformName", getSafariOS(version));
        } else {
          capabilities.set("platformName", `${osName} ${osVersion}`);
        }
      } else {
        // LambdaTest
        capabilities.set("LT:Options", {
          name: testName,
          platformName: `${osName} ${osVersion}`,
        });
      }

      // Allow mic, camera, geolocation and notifications permissions
      if (
        browser === "chrome" ||
        (browser === "edge" && compareVersions(version, "79", ">="))
      ) {
        capabilities.set("goog:chromeOptions", {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
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
) => {
  if (browser === "safari") {
    await driver.executeScript(
      `document.getElementById('${elementId}').click()`,
    );
  } else {
    await driver.findElement(By.id(elementId)).click();
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
    await click(driver, browser, "start");

    log(task, "Loading test page...");
    await awaitPage(driver, browser, version, `${host}/tests/${getvars}`);

    log(task, "Running tests...");
    await driver.wait(until.elementLocated(By.id("status")), 30000);
    statusEl = await driver.findElement(By.id("status"));
    try {
      await driver.wait(until.elementTextContains(statusEl, "upload"), 90000);
    } catch (e) {
      if ((e as Error).name == "TimeoutError") {
        throw new Error(
          task.title + " - " + "Timed out waiting for results to upload",
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
    const downloadUrl = await downloadEl.getAttribute("href");

    if (!ctx.testenv) {
      let filename = path.basename(new URL(downloadUrl).pathname);
      if (isBeta(browser, version)) {
        filename.replace(browser, `${browser}-beta`);
      }
      log(task, `Downloading ${filename} ...`);
      const report = await (await fetch(downloadUrl)).buffer();
      await fs.writeFile(path.join(RESULTS_DIR, filename), report);
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
) => {
  if (!Object.keys(secrets.selenium).length) {
    console.error(
      chalk`{red.bold A Selenium remote WebDriver URL is not defined in secrets.json.  Please define your Selenium remote(s).}`,
    );
    return false;
  }

  if (testenv) {
    console.warn(chalk`{yellow.bold Test mode: results are not saved.}`);
  }

  const browsersToTest = getBrowsersToTest(
    limitBrowsers,
    limitVersion,
    reverse,
  );
  const tasks: ListrTask[] = [];

  // eslint-disable-next-line guard-for-in
  for (const [browser, versions] of Object.entries(browsersToTest) as [
    BrowserName,
    string[],
  ][]) {
    const browsertasks: ListrTask[] = [];

    for (const version of versions) {
      for (const os of oses) {
        if (
          os === "macOS" &&
          browser === "edge" &&
          compareVersions(version, "18", "<=")
        ) {
          // Don't test EdgeHTML on macOS
          continue;
        }

        if (os === "Windows" && browser === "safari") {
          // Don't test Safari on Windows
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
      title: bcdBrowsers[browser].name,
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
  const {argv}: {argv: any} = yargs(hideBin(process.argv)).command(
    "$0 [browser..]",
    "Run Selenium on several browser versions",
    (yargs) => {
      (yargs as any)
        .positional("browser", {
          describe: "Limit the browser(s) to test",
          alias: "b",
          type: "string",
          choices: ["chrome", "firefox", "safari"],
        })
        .option("since", {
          describe: "Limit to browser releases from this year on",
          alias: "s",
          type: "string",
          default: "2020",
          nargs: 1,
        })
        .option("os", {
          describe: "Specify OS to test",
          alias: "o",
          type: "array",
          choices: ["Windows", "macOS"],
          default: ["Windows", "macOS"],
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
        });
    },
  );

  await runAll(
    argv.browser,
    new Date(`${argv.since}-01-01`),
    argv.os,
    argv.concurrent,
    argv.reverse,
  );
}
