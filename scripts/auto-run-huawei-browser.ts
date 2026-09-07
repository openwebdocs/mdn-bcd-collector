/**
 * Automated test runner for the Huawei Browser on a HarmonyOS device ("board").
 *
 * Automation flow:
 *   0. Query the board's debug port /json/version to get its Chrome kernel version
 *   1. Download the chromedriver zip matching the first three version segments from npmmirror
 *   2. Extract it to CHROMEDRIVER_INSTALL_DIR
 *   3. Start chromedriver --port=9515
 *   4. Run the selenium tests
 *   5. Confirm the results were downloaded back into the results folder
 *
 * Usage:
 *   npx tsx scripts/auto-run-huawei-browser.ts
 *
 * For prerequisites, the automation steps, version resolution, the full list of
 * environment variables and troubleshooting, see the usage documentation:
 *   docs/huawei-browser-Auto_test_usage.md
 *
 * Most commonly used environment variables (see the doc for the complete list):
 *   DEBUGGER_ADDRESS  board debug address, e.g. 192.168.1.124:9222
 *                     (if unset, the board IP is auto-detected via `hdc shell ifconfig`)
 *   VERSION / SINCE   version/year overrides; if unset, derived from the board
 *                     kernel version via <BCD_DIR>/browsers/<BROWSER>.json
 *   REPORT_FILTER     only include result files whose name contains this
 *                     substring (e.g. huawei-browser) when generating the report
 *   START_LOCAL_SERVER=1   start the local results server; by default it is NOT
 *                     started because the tests run on the public collector
 */

import {spawn, type ChildProcess} from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import {fileURLToPath} from "node:url";

/**
 * A single release entry of a browser in the BCD browser data.
 */
interface BcdRelease {
  engine_version?: string;
  release_date?: string;
  [key: string]: unknown;
}

// Derive default paths from the script's own location (the script lives inside
// mdn-bcd-collector/scripts/, with mdn-bcd-collector, mdn-bcd-results and
// browser-compat-data as siblings). Environment variables still override these
// defaults.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // mdn-bcd-collector/scripts
const PROJECT_DIR = process.env.PROJECT_DIR || path.resolve(SCRIPT_DIR, "..");
const RESULTS_DIR =
  process.env.RESULTS_DIR || path.resolve(PROJECT_DIR, "..", "mdn-bcd-results");
const BCD_DIR =
  process.env.BCD_DIR || path.resolve(PROJECT_DIR, "..", "browser-compat-data");
const BROWSER = process.env.BROWSER || "huaweibrowser_harmonyos";
const SINCE = process.env.SINCE || null;

// The Huawei Browser runs on HarmonyOS, so selenium must be told to test that
// OS. Passing "Windows"/"macOS" (the host PC platform) would make selenium
// filter the Huawei Browser out entirely and run zero tasks.
//
// Note: do NOT read process.env.OS here - on Windows that is a built-in system
// variable whose value is "Windows_NT", which selenium's -o choices reject.
// Use BCD_OS instead when an explicit override is needed.
const bcdOs = process.env.BCD_OS;
const OS =
  bcdOs && ["Windows", "macOS", "Android", "iOS", "HarmonyOS"].includes(bcdOs)
    ? bcdOs
    : "HarmonyOS";

const JOBS = process.env.JOBS || "1";
const VERSION = process.env.VERSION || null;
const REPORT_COUNT = parseInt(process.env.REPORT_COUNT || "3", 10) || 3;
const REPORT_FILTER = process.env.REPORT_FILTER || null;
// DEBUGGER_ADDRESS can be set explicitly (e.g. 192.168.1.156:9222).
// If unset, the board IP is auto-detected via `hdc shell ifconfig` and combined
// with DEBUGGER_PORT.
const DEBUGGER_ADDRESS = process.env.DEBUGGER_ADDRESS || null;
const DEBUGGER_PORT = process.env.DEBUGGER_PORT || "9222";
const CD_PORT = process.env.CHROMEDRIVER_PORT || "9515";
const CD_INSTALL_DIR =
  process.env.CHROMEDRIVER_INSTALL_DIR ||
  `D:\\Program Files\\chromedriver-${
    process.platform === "win32" && process.arch === "ia32"
      ? "win32"
      : process.platform === "win32" && process.arch === "arm64"
        ? "win-arm64"
        : "win64"
  }`;
const MIRROR_BASE =
  process.env.MIRROR_BASE ||
  "https://registry.npmmirror.com/-/binary/chrome-for-testing";
const KEEP_CD = process.env.KEEP_CHROMEDRIVER === "1";
const SKIP_DOWNLOAD = process.env.SKIP_DRIVER_DOWNLOAD === "1";
const CD_VERBOSE = process.env.CHROMEDRIVER_VERBOSE === "1";
const APP_PORT = parseInt(process.env.APP_PORT || "8080", 10) || 8080;
// The Huawei Browser run executes the tests on the public collector
// (https://collector.openwebdocs.org) and downloads the results from there, so
// the local results server (node app.js) is NOT needed and is skipped by
// default. Enable it only for local/testenv runs (selenium then talks to
// http://localhost:APP_PORT instead of the public collector).
const START_LOCAL_SERVER = process.env.START_LOCAL_SERVER === "1";

// Startup self-diagnostic: print the resolved paths so the active environment
// (script dir / project dir / results dir) is obvious on every run.
console.log(`[paths] SCRIPT_DIR = ${SCRIPT_DIR}`);
console.log(`[paths] PROJECT_DIR = ${PROJECT_DIR}`);
console.log(`[paths] RESULTS_DIR = ${RESULTS_DIR}`);
console.log(`[paths] BCD_DIR = ${BCD_DIR}`);

/**
 * Wait for the given number of milliseconds.
 * @param ms - Milliseconds to wait
 * @returns Resolves after the delay
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Print a step separator to the console.
 * @param m - The step description
 */
const step = (m: string): void => {
  console.log(`\n=== ${m} ===`);
};

/**
 * Fetch a URL as text, following redirects.
 * @param url - The URL to fetch
 * @param redirects - Internal counter to bound redirect recursion
 * @returns The response body as text
 */
const getText = (url: string, redirects = 0): Promise<string> =>
  new Promise((resolve, reject) => {
    if (redirects > 10) {
      reject(new Error(`Too many redirects (>= 10) while fetching ${url}`));
      return;
    }
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          resolve(
            getText(
              new URL(res.headers.location, url).toString(),
              redirects + 1,
            ),
          );
          return;
        }
        if (status >= 400) {
          let body = "";
          res.on("data", (c) => {
            body += c.toString("utf8");
          });
          res.on("end", () =>
            reject(
              new Error(
                `HTTP ${status} while fetching ${url}\n${body.slice(0, 200)}`,
              ),
            ),
          );
          return;
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString("utf8");
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });

/**
 * Fetch a URL and parse the response body as JSON.
 * @param url - The URL to fetch
 * @returns The parsed JSON value
 */
const getJson = async (url: string): Promise<unknown> => {
  const txt = await getText(url);
  try {
    return JSON.parse(txt);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${(error as Error).message}\nRaw: ${txt.slice(0, 200)}`,
      {cause: error},
    );
  }
};

/**
 * Auto-detect the board IP via `hdc shell ifconfig`.
 * @returns The detected (preferably LAN) IPv4 address of the board
 */
const getBoardIp = (): Promise<string> =>
  new Promise((resolve, reject) => {
    // Run hdc shell ifconfig
    const ps = spawn("hdc", ["shell", "ifconfig"]);
    let out = "";
    ps.stdout.on("data", (d) => {
      out += d.toString();
    });
    ps.stderr.on("data", (d) => {
      out += d.toString();
    });
    ps.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`hdc shell ifconfig failed (exit ${code})`));
        return;
      }
      // Match IPv4 addresses, skip loopback (127.0.0.1)
      const ips = (out.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])
        .filter((ip) => ip !== "127.0.0.1")
        .filter((ip) => !ip.startsWith("127."));
      if (!ips.length) {
        reject(
          new Error(
            `No non-loopback IPv4 found in hdc ifconfig output:\n${out.slice(0, 500)}`,
          ),
        );
        return;
      }
      // Prefer an address that looks like a LAN address (192.168/10./172.16-31)
      const lan = ips.find(
        (ip) =>
          ip.startsWith("192.168.") ||
          ip.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
      );
      resolve(lan || ips[0]);
    });
  });

/**
 * Query the board's Chrome kernel version via its /json/version endpoint.
 * @param addr - The board debug address in host:port form
 * @returns The full kernel version, its first three segments and the board UA
 */
const getBoardChromeVersion = async (
  addr: string,
): Promise<{full: string; prefix: string; ua: string}> => {
  const [host, port] = addr.split(":");
  const url = `http://${host}:${port}/json/version`;
  step(`Query board kernel version: ${url}`);
  const text = await getText(url);
  const m = text.match(/"Browser"\s*:\s*"([^"]*)"/);
  if (!m) {
    throw new Error(
      `Could not parse Browser field from /json/version. Response:\n${text.slice(0, 500)}`,
    );
  }
  const browserStr = m[1];
  console.log(`Board Browser: ${browserStr}`);
  const cm = browserStr.match(/(?:Headless)?Chrome\/([\d.]+)/i);
  if (!cm) {
    throw new Error(
      `No Chrome/x.y.z version found in Browser field: ${browserStr}`,
    );
  }
  const full = cm[1]; // e.g. 144.0.7559.59
  const prefix = full.split(".").slice(0, 3).join("."); // 144.0.7559

  // Prefer the dedicated User-Agent field; some boards only carry the UA inside
  // the "Browser" field, so fall back to that.
  let ua: string | null = null;
  try {
    const parsed = JSON.parse(text) as {"User-Agent"?: string};
    ua = parsed["User-Agent"] || null;
  } catch {
    // ignore, fall back to browserStr below
  }
  if (!ua) {
    ua = browserStr;
  }
  console.log(
    `✓ Board Chrome version: ${full} (first three segments ${prefix})`,
  );
  return {full, prefix, ua};
};

/**
 * Extract the Huawei Browser version from a board User-Agent string.
 * e.g. "... ArkWeb/7.0.0.37 Mobile HuaweiBrowser/6.1.3.352" -> "6.1.3.352"
 * @param ua - The User-Agent string
 * @returns The browser version, or null when it cannot be determined
 */
const extractUaBrowserVersion = (ua: string | null): string | null => {
  const m = ua?.match(/HuaweiBrowser\/([\d.]+)/i);
  return m ? m[1] : null;
};

/**
 * Derive version/since from the board kernel version via the BCD json.
 * The board's Chrome kernel major version (e.g. 144) is matched against each
 * release's "engine_version" field. The matching release's key becomes
 * --version, and its release year becomes --since. When several releases share
 * the same kernel, the board's User-Agent browser version is used to
 * disambiguate.
 * @param engineMajor - The board kernel major version, e.g. "144"
 * @param uaString - The board User-Agent, used to disambiguate releases
 * @returns The resolved version and since year
 */
const getHuaweiParams = async (
  engineMajor: string,
  uaString: string,
): Promise<{version: string; since: string}> => {
  const jsonPath = path.join(BCD_DIR, "browsers", `${BROWSER}.json`);
  step(
    `Derive --version/--since from board kernel ${engineMajor} via ${jsonPath}`,
  );
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`BCD browser json not found: ${jsonPath}`);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    browsers?: Record<string, {releases?: Record<string, BcdRelease>}>;
  };
  const releases = data?.browsers?.[BROWSER]?.releases;
  if (!releases || typeof releases !== "object") {
    throw new Error(`No "releases" found for ${BROWSER} in ${jsonPath}`);
  }

  // Find ALL releases whose engine_version matches the board kernel major
  // version. Several browser releases can share one kernel major (e.g. 6.0 and
  // 6.1 both use engine 132), so we cannot just take the first match.
  const matches = Object.entries(releases).filter(
    ([, rel]) =>
      String(rel.engine_version || "").split(".")[0] === String(engineMajor),
  );
  if (matches.length === 0) {
    throw new Error(
      `No release with engine_version matching kernel ${engineMajor} in ${jsonPath}. ` +
        `Available engine_versions: ${Object.values(releases)
          .map((r) => r.engine_version)
          .join(", ")}`,
    );
  }

  let matchKey: string;
  if (matches.length === 1) {
    // Unambiguous: a single release uses this kernel.
    matchKey = matches[0][0];
  } else {
    // Ambiguous: fall back to the browser version reported by the board's own
    // User-Agent (e.g. "HuaweiBrowser/6.1.3.352" -> "6.1"), which identifies
    // the installed browser precisely. If the UA is unavailable or does not
    // match any candidate, keep the previous behaviour (first match).
    const candidateKeys = matches.map(([k]) => k);
    console.warn(
      `⚠ kernel ${engineMajor} matches multiple releases: ${candidateKeys.join(", ")}`,
    );
    const uaVersion = extractUaBrowserVersion(uaString);
    if (uaVersion) {
      // Compare on the major.minor level so "6.1.3.352" resolves to "6.1".
      const uaMajorMinor = uaVersion.split(".").slice(0, 2).join(".");
      const hit = candidateKeys.find((k) => k === uaMajorMinor);
      if (hit) {
        console.log(
          `✓ resolved ambiguity via board UA (${uaVersion}): using release "${hit}" instead of "${candidateKeys[0]}"`,
        );
        matchKey = hit;
      } else {
        console.warn(
          `⚠ UA version "${uaVersion}" does not match any candidate (${candidateKeys.join(", ")}); using "${candidateKeys[0]}"`,
        );
        matchKey = candidateKeys[0];
      }
    } else {
      console.warn(
        `⚠ board UA browser version unavailable; using "${candidateKeys[0]}"`,
      );
      matchKey = candidateKeys[0];
    }
  }

  const matchRelease = releases[matchKey];
  const version = matchKey; // e.g. "7.0"
  const sinceMatch = String(matchRelease.release_date || "").match(/^(\d{4})/);
  // Fallback to current-year-derived default if the release has no release_date,
  // so the run can continue instead of failing on a missing field.
  const since = sinceMatch ? sinceMatch[1] : "2020"; // e.g. "2026" or fallback
  if (!sinceMatch) {
    console.warn(
      `⚠ release "${version}" has no valid release_date in ${jsonPath}; ` +
        `falling back --since to ${since}`,
    );
  }
  console.log(
    `✓ Board kernel ${engineMajor} -> release "${version}" -> --since=${since}`,
  );
  return {version, since};
};

/**
 * Download a URL to a local file, following redirects.
 * @param url - The URL to download
 * @param zipPath - The destination file path
 * @param redirects - Internal counter to bound redirect recursion
 * @returns Resolves once the download finished
 */
const downloadToFile = (
  url: string,
  zipPath: string,
  redirects = 0,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (redirects > 10) {
      reject(new Error(`Too many redirects (>= 10) while downloading ${url}`));
      return;
    }
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(zipPath);
    /**
     * Abort the download: close and remove the partial file, then reject.
     * @param e - The error that caused the failure
     */
    const fail = (e: Error): void => {
      file.close();
      try {
        fs.unlinkSync(zipPath);
      } catch {
        // file may not exist yet
      }
      reject(e);
    };
    lib
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(zipPath);
          } catch {
            // ignore
          }
          resolve(
            downloadToFile(
              new URL(res.headers.location, url).toString(),
              zipPath,
              redirects + 1,
            ),
          );
          return;
        }
        if (status >= 400) {
          fail(new Error(`HTTP ${status} while downloading ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", fail);
  });

/**
 * Recursively search for chromedriver.exe inside a directory.
 * @param dir - The directory to search
 * @returns The path to chromedriver.exe, or null when not found
 */
const findChromedriverExe = (dir: string): string | null => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findChromedriverExe(p);
      if (nested) {
        return nested;
      }
    } else if (entry.name.toLowerCase() === "chromedriver.exe") {
      return p;
    }
  }
  return null;
};

/**
 * Map the current host OS/arch to the chromedriver platform folder name used by
 * chrome-for-testing.
 * e.g. win32+x64 -> win64, win32+ia32 -> win32, win32+arm64 -> win-arm64,
 * darwin+arm64 -> mac-arm64
 * @returns The chromedriver platform folder name
 */
const chromedriverPlatform = (): string => {
  const arch = process.arch;
  if (process.platform === "win32") {
    if (arch === "ia32") {
      return "win32";
    }
    if (arch === "arm64") {
      return "win-arm64";
    }
    return "win64"; // x64 (and fallback)
  }
  if (process.platform === "darwin") {
    return arch === "arm64" ? "mac-arm64" : "mac-x64";
  }
  if (process.platform === "linux") {
    if (arch === "arm64") {
      return "linux-arm64";
    }
    if (arch === "arm") {
      return "linux-arm";
    }
    return "linux64";
  }
  throw new Error(`Unsupported platform/arch: ${process.platform}/${arch}`);
};

/**
 * Look up, download and extract the chromedriver matching the kernel prefix.
 * @param prefix - The first three kernel version segments, e.g. "144.0.7559"
 * @returns The path to the extracted chromedriver executable
 */
const downloadChromeDriver = async (prefix: string): Promise<string> => {
  step(
    `Look up chromedriver versions on mirror with first three segments = ${prefix}`,
  );
  const list = (await getJson(`${MIRROR_BASE}/`)) as {name?: string}[];
  const matched = list
    .map((e) => String(e.name || "").replace(/\/$/, ""))
    .filter((v) => v.split(".").slice(0, 3).join(".") === prefix)
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 4; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da !== db) {
          return da - db;
        }
      }
      return 0;
    });
  if (!matched.length) {
    throw new Error(
      `No chromedriver version with first three segments ${prefix} found on mirror`,
    );
  }
  const target = matched[matched.length - 1]; // latest build
  console.log(`✓ Selected chromedriver version: ${target}`);

  // Detect the chromedriver platform suffix from the current OS/arch
  // (avoids hardcoding win64, which is wrong on win32/arm64 hosts)
  const cdPlatform = chromedriverPlatform();
  console.log(`Detected chromedriver platform: ${cdPlatform}`);
  const zipUrl = `${MIRROR_BASE}/${target}/${cdPlatform}/chromedriver-${cdPlatform}.zip`;
  const zipPath = path.join(PROJECT_DIR, `chromedriver-${cdPlatform}.zip`);
  console.log(`Download: ${zipUrl}`);
  await downloadToFile(zipUrl, zipPath);

  // Extract to a temp dir (the zip contains a top-level chromedriver-<platform>/
  // folder), then pick out the exe
  const tmpDir = `${CD_INSTALL_DIR}.tmp`;
  console.log(`Extract to: ${tmpDir}`);
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
  if (fs.existsSync(CD_INSTALL_DIR)) {
    fs.rmSync(CD_INSTALL_DIR, {recursive: true, force: true});
  }
  fs.mkdirSync(path.dirname(CD_INSTALL_DIR), {recursive: true});
  await new Promise<void>((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force`,
    ]);
    ps.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Expand-Archive failed, exit code ${code}`));
      }
    });
  });
  fs.unlinkSync(zipPath);

  const found = findChromedriverExe(tmpDir);
  if (!found) {
    throw new Error(
      `chromedriver.exe not found after extraction (content at ${tmpDir})`,
    );
  }

  // Move the found exe and its sibling files into the final directory
  fs.mkdirSync(CD_INSTALL_DIR, {recursive: true});
  const srcDir = path.dirname(found);
  for (const e of fs.readdirSync(srcDir)) {
    fs.renameSync(path.join(srcDir, e), path.join(CD_INSTALL_DIR, e));
  }
  fs.rmSync(tmpDir, {recursive: true, force: true});

  const exe = path.join(CD_INSTALL_DIR, "chromedriver.exe");
  if (!fs.existsSync(exe)) {
    throw new Error(`chromedriver.exe not found after move: ${exe}`);
  }
  console.log(`✓ chromedriver.exe ready: ${exe}`);
  return exe;
};

/**
 * Poll the chromedriver log until it reports a successful start.
 * @param logFile - Path to the chromedriver log file
 * @returns True when chromedriver started within the timeout
 */
const waitForChromeDriver = async (logFile: string): Promise<boolean> => {
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    let content = "";
    try {
      content = fs.readFileSync(logFile, "utf8");
    } catch {
      // the log file may not exist yet during the first iterations
    }
    if (
      content.includes(
        `ChromeDriver was started successfully on port ${CD_PORT}`,
      ) ||
      (content.includes("started successfully") &&
        content.includes(`port ${CD_PORT}`)) ||
      (content.includes("Only local connections are allowed") &&
        content.includes(CD_PORT))
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Start the local results server (npm start -> node app.js, listens on APP_PORT).
 * @returns The spawned server process
 */
const startLocalServer = (): ChildProcess => {
  const serverProc = spawn(process.execPath, ["app.js"], {
    cwd: PROJECT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: {...process.env, PORT: String(APP_PORT)},
  });
  serverProc.stdout?.on("data", (d) => process.stdout.write(`[app.js] ${d}`));
  serverProc.stderr?.on("data", (d) => process.stderr.write(`[app.js] ${d}`));
  return serverProc;
};

/**
 * Check whether a service is already answering on APP_PORT, so an existing
 * server can be reused instead of starting a second instance that would fail
 * with EADDRINUSE.
 * @returns True when the local server responds
 */
const isLocalServerUp = async (): Promise<boolean> => {
  try {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = http.get(
        {host: "localhost", port: APP_PORT, path: "/"},
        (r) => resolve(r.statusCode),
      );
      req.on("error", reject);
      req.setTimeout(1000, () => req.destroy(new Error("timeout")));
    });
    return Boolean(status);
  } catch {
    return false;
  }
};

/**
 * Wait until the local results server answers on APP_PORT.
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns True when the server became ready in time
 */
const waitForLocalServer = async (timeoutMs = 60000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLocalServerUp()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
};

/**
 * Run the whole automation flow.
 * @returns Resolves when the flow finished
 */
const main = async (): Promise<void> => {
  let cdExe: string;
  let serverProc: ChildProcess | null = null;

  // The local results server is only used when selenium runs in testenv mode
  // (NODE_ENV=test), where it talks to http://localhost:APP_PORT instead of the
  // public collector. For the normal Huawei Browser flow the tests run on
  // https://collector.openwebdocs.org and the results are downloaded from
  // there, so the local server is skipped unless START_LOCAL_SERVER=1.
  if (START_LOCAL_SERVER) {
    if (await isLocalServerUp()) {
      step(`Local results server (port ${APP_PORT})`);
      console.log(
        `✓ Reusing existing local server at http://localhost:${APP_PORT} (already responding; skipping npm start to avoid EADDRINUSE)`,
      );
      serverProc = null; // nothing to kill at cleanup
    } else {
      step(`Start local results server (npm start, port ${APP_PORT})`);
      serverProc = startLocalServer();
      const up = await waitForLocalServer();
      if (up) {
        console.log(`✓ Local server is up: http://localhost:${APP_PORT}`);
      } else {
        console.error(
          `✗ Local server did not become ready within 60s. Continuing anyway, but result download may fail.`,
        );
      }
    }
  } else {
    console.log(
      "Skipping local results server (tests run on the public collector). Set START_LOCAL_SERVER=1 to enable it.",
    );
  }

  // Resolve the debugger address: use explicit DEBUGGER_ADDRESS, otherwise
  // auto-detect the board IP via hdc.
  let debuggerAddress = DEBUGGER_ADDRESS;
  if (!debuggerAddress) {
    step(`Auto-detect board IP via hdc shell ifconfig`);
    const ip = await getBoardIp();
    debuggerAddress = `${ip}:${DEBUGGER_PORT}`;
    console.log(
      `✓ Board IP detected: ${ip} (debugger address ${debuggerAddress})`,
    );
  } else {
    console.log(`Use explicit debugger address: ${debuggerAddress}`);
  }

  // Query the board's /json/version at most once and cache the result, so we
  // don't hit the endpoint twice (once for the chromedriver prefix, once for
  // version/since derivation).
  let cachedBoardInfo: {full: string; prefix: string; ua: string} | null = null;
  /**
   * Return the board's Chrome version info, fetching /json/version at most once.
   * @returns The board Chrome `full` version, the `prefix` (first three
   *   segments, used to pick the chromedriver build) and the raw `ua` string.
   */
  const getBoardInfo = async (): Promise<{
    full: string;
    prefix: string;
    ua: string;
  }> => {
    if (!cachedBoardInfo) {
      cachedBoardInfo = await getBoardChromeVersion(debuggerAddress);
    }
    return cachedBoardInfo;
  };

  if (SKIP_DOWNLOAD) {
    cdExe = path.join(CD_INSTALL_DIR, "chromedriver.exe");
    if (!fs.existsSync(cdExe)) {
      console.error(`SKIP_DRIVER_DOWNLOAD=1 but ${cdExe} not found`);
      process.exit(1);
    }
    console.log(`Skip download, use existing: ${cdExe}`);
  } else {
    const {prefix} = await getBoardInfo();
    cdExe = await downloadChromeDriver(prefix);
  }

  // Derive --version/--since from the board kernel major version via the BCD
  // json. Only when they are not explicitly set via env (VERSION/SINCE).
  let versionResolved = VERSION;
  let sinceResolved = SINCE;
  if (!versionResolved || !sinceResolved) {
    try {
      const {full, ua} = await getBoardInfo();
      const engineMajor = full.split(".")[0]; // e.g. "144"
      const hp = await getHuaweiParams(engineMajor, ua);
      if (!versionResolved) {
        versionResolved = hp.version;
      }
      if (!sinceResolved) {
        sinceResolved = hp.since;
      }
    } catch (error) {
      console.warn(
        `⚠ Could not derive version/since from board: ${(error as Error).message}`,
      );
    }
  }
  if (!versionResolved) {
    console.error(
      "✗ --version could not be resolved (set VERSION env to override)",
    );
    process.exit(1);
  }
  if (!sinceResolved) {
    console.error(
      "✗ --since could not be resolved (set SINCE env to override)",
    );
    process.exit(1);
  }
  console.log(
    `✓ Resolved selenium params: --version=${versionResolved} --since=${sinceResolved}`,
  );

  // Start chromedriver
  step(`Start chromedriver (port ${CD_PORT}): ${cdExe}`);
  const cdLog = path.join(PROJECT_DIR, "chromedriver.log");
  if (fs.existsSync(cdLog)) {
    fs.unlinkSync(cdLog);
  }
  const cdArgs = [`--port=${CD_PORT}`];
  if (CD_VERBOSE) {
    cdArgs.push("--verbose");
  }
  const cdProc = spawn(cdExe, cdArgs, {
    cwd: PROJECT_DIR,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const cdOut = fs.createWriteStream(cdLog, {flags: "a"});
  cdProc.stdout?.on("data", (d) => {
    process.stdout.write(`[chromedriver] ${d}`);
    cdOut.write(d);
  });
  cdProc.stderr?.on("data", (d) => {
    process.stderr.write(`[chromedriver] ${d}`);
    cdOut.write(d);
  });

  const ready = await waitForChromeDriver(cdLog);
  if (!ready) {
    console.error(
      `✗ chromedriver did not start successfully within 60s. Last log:`,
    );
    try {
      console.error(fs.readFileSync(cdLog, "utf8"));
    } catch {
      // the log file may be missing entirely; nothing more to print
    }
    try {
      cdProc.kill("SIGKILL");
    } catch {
      // the process may have already exited
    }
    process.exit(1);
  }
  console.log(`✓ chromedriver started and listening on port ${CD_PORT}`);

  // Run selenium
  step(`Run selenium tests (browser=${BROWSER}, debugger=${debuggerAddress})`);
  const selArgs = [
    path.join(PROJECT_DIR, "node_modules", "tsx", "dist", "cli.mjs"),
    "scripts/selenium.ts",
    BROWSER,
    `--since=${sinceResolved}`,
    "-o",
    OS,
    "-j",
    JOBS,
    "--version",
    versionResolved,
    "-d",
    debuggerAddress,
  ];
  const selProc = spawn(process.execPath, selArgs, {
    cwd: PROJECT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const selStart = Date.now();
  let downloadLine: string | null = null;
  selProc.stdout?.on("data", (d) => {
    const t = d.toString();
    process.stdout.write(t);
    const m = t.match(/Downloading .* \.\.\./);
    if (m && !downloadLine) {
      downloadLine = m[0];
    }
  });
  selProc.stderr?.on("data", (d) => process.stderr.write(d.toString()));
  const code = await new Promise<number>((resolve) => {
    selProc.on("close", (c) => resolve(c ?? 1));
  });

  // Confirm results were downloaded back from the collector
  step("Confirm results download");
  if (downloadLine) {
    console.log(`✓ Detected result download log: ${downloadLine}`);
  } else {
    console.log(
      "⚠ 'Downloading ...' log not detected. The page status may be Failed or the result download was skipped.",
    );
  }

  const files = fs.existsSync(RESULTS_DIR)
    ? fs
        .readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({f, t: fs.statSync(path.join(RESULTS_DIR, f)).mtimeMs}))
        .sort((a, b) => b.t - a.t)
    : [];
  if (files.length) {
    console.log(
      `✓ Latest file in results dir: ${path.join(RESULTS_DIR, files[0].f)}`,
    );
  } else {
    console.log("⚠ No json file found in results dir");
  }

  // Auto-generate a report from the latest result files (default: latest 3,
  // fewer if not enough). Only generate when selenium actually succeeded and
  // downloaded results - otherwise a report built from stale files (e.g. old
  // safari runs) would be misleading.
  //
  // The "Downloading ..." log line (downloadLine) is emitted by listr's
  // task.output, which is NOT reliably written to stdout under piped/non-TTY
  // output (this script spawns selenium with a pipe), so it is only a
  // nice-to-have signal and must not be required. As the real proof of success
  // we also accept a freshly produced result file: a file is "fresh" (produced
  // by THIS run) when its mtime is at/after the selenium process started
  // (selStart), which avoids both a fixed time window (fails for long runs) and
  // treating stale files as success.
  const newestFresh = files.length > 0 && files[0].t >= selStart - 5000;
  if (code !== 0 || (!downloadLine && !newestFresh)) {
    console.error(
      `✗ Selenium exited with code ${code}${
        downloadLine ? "" : " and no result download was detected"
      }. Skipping report generation to avoid a misleading report from stale files.`,
    );
  } else {
    step("Generate report from latest results");
    if (files.length === 0) {
      console.log("⚠ Skipped report generation: no result json found.");
    } else {
      // Apply optional name filter (e.g. only huawei-browser reports).
      const candidates = REPORT_FILTER
        ? files.filter((x) => x.f.includes(REPORT_FILTER))
        : files;
      if (candidates.length === 0) {
        console.log(
          `⚠ Skipped report generation: no file matches REPORT_FILTER="${REPORT_FILTER}".`,
        );
      } else {
        const picked = candidates.slice(0, REPORT_COUNT);
        const pickedPaths = picked.map((x) => path.join(RESULTS_DIR, x.f));
        console.log(
          `✓ Generating report from ${picked.length} latest file(s)` +
            (REPORT_FILTER ? ` (filtered by "${REPORT_FILTER}")` : "") +
            `: ${picked.map((x) => x.f).join(", ")}`,
        );
        const {status: rvCode} = await new Promise<{status: number}>(
          (resolve) => {
            const rv = spawn(
              process.execPath,
              [
                path.join(
                  PROJECT_DIR,
                  "node_modules",
                  "tsx",
                  "dist",
                  "cli.mjs",
                ),
                "scripts/report-viewer.ts",
                ...pickedPaths,
              ],
              {cwd: PROJECT_DIR, stdio: "inherit"},
            );
            rv.on("close", (c) => resolve({status: c || 0}));
          },
        );
        if (rvCode === 0) {
          console.log(
            `✓ Report generated: ${path.join(RESULTS_DIR, "report.html")}`,
          );
        } else {
          console.log(
            `⚠ report-viewer exited with code ${rvCode}; report may be incomplete.`,
          );
        }
      }
    }
  }

  // Cleanup
  if (serverProc) {
    console.log(`\nStop local results server (PID ${serverProc.pid}) ...`);
    try {
      serverProc.kill("SIGKILL");
    } catch {
      // the process may already have exited; nothing to do
    }
    console.log("✓ local server stopped");
  }

  if (!KEEP_CD) {
    console.log(`\nStop chromedriver process (PID ${cdProc.pid}) ...`);
    try {
      cdProc.kill("SIGKILL");
    } catch {
      // the process may already have exited; nothing to do
    }
    console.log("✓ chromedriver stopped");
  } else {
    console.log(
      `\n-KEEP_CHROMEDRIVER=1, chromedriver keeps running (PID ${cdProc.pid})`,
    );
  }

  console.log(
    "\nAutomation finished." +
      (code === 0 ? "" : ` (selenium exit code ${code})`),
  );
  process.exit(code === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("\n✗ Automation failed:", (error as Error).message);
  process.exit(1);
});
