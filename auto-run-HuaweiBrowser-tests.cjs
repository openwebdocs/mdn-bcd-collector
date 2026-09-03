// auto-run-HuaweiBrowser-tests.cjs
// Automation flow:
//   0. Query the board's debug port /json/version to get its Chrome kernel version
//   1. Download the chromedriver-win64.zip matching the first three version segments from npmmirror
//   2. Extract it to D:\Program Files\chromedriver-win64
//   3. Start chromedriver --port=9515
//   4. Run the selenium tests
//   5. Confirm the results were downloaded back into the results folder
//
// Usage:
//   node auto-run-HuaweiBrowser-tests.cjs
//
// For prerequisites, the automation steps, version resolution, the full list of
// environment variables and troubleshooting, see the usage documentation:
//   docs/huawei-browser-Auto_test_usage.md
//
// Most commonly used environment variables (see the doc for the complete list):
//   DEBUGGER_ADDRESS  board debug address, e.g. 192.168.1.124:9222
//                     (if unset, the board IP is auto-detected via `hdc shell ifconfig`)
//   VERSION / SINCE   version/year overrides; if unset, derived from the board
//                     kernel version via <BCD_DIR>/browsers/<BROWSER>.json
//   REPORT_FILTER     only include result files whose name contains this
//                     substring (e.g. huawei-browser) when generating the report
//   START_LOCAL_SERVER=1   start the local results server; by default it is NOT
//                     started because the tests run on the public collector

const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Derive default paths from the script's own location (the script lives inside
// mdn-bcd-collector/, with mdn-bcd-results and browser-compat-data as siblings).
// Environment variables still override these defaults.
const SCRIPT_DIR = path.dirname(__filename); // mdn-bcd-collector
const PROJECT_DIR = process.env.PROJECT_DIR || SCRIPT_DIR;
const RESULTS_DIR = process.env.RESULTS_DIR || path.resolve(SCRIPT_DIR, "..", "mdn-bcd-results");
const BCD_DIR = process.env.BCD_DIR || path.resolve(SCRIPT_DIR, "..", "browser-compat-data");
const BROWSER = process.env.BROWSER || "huaweibrowser_harmonyos";
const SINCE = process.env.SINCE || null;
// The Huawei Browser runs on HarmonyOS, so selenium must be told to test that
// OS. Passing "Windows"/"macOS" (the host PC platform) would make selenium
// filter the Huawei Browser out entirely and run zero tasks.
//
// Note: do NOT read process.env.OS here - on Windows that is a built-in system
// variable whose value is "Windows_NT", which selenium's -o choices reject.
// Use BCD_OS instead when an explicit override is needed.
const OS = ["Windows", "macOS", "Android", "iOS", "HarmonyOS"].includes(
  process.env.BCD_OS,
)
  ? process.env.BCD_OS
  : "HarmonyOS";
const JOBS = process.env.JOBS || "1";
const VERSION = process.env.VERSION || null;
const REPORT_COUNT = parseInt(process.env.REPORT_COUNT || "3", 10) || 3;
const REPORT_FILTER = process.env.REPORT_FILTER || null;
// DEBUGGER_ADDRESS can be set explicitly (e.g. 192.168.1.156:9222).
// If unset, the board IP is auto-detected via `hdc shell ifconfig` and combined with DEBUGGER_PORT.
const DEBUGGER_ADDRESS = process.env.DEBUGGER_ADDRESS || null;
const DEBUGGER_PORT = process.env.DEBUGGER_PORT || "9222";
const CD_PORT = process.env.CHROMEDRIVER_PORT || "9515";
const CD_INSTALL_DIR =
  process.env.CHROMEDRIVER_INSTALL_DIR ||
  `D:\\Program Files\\chromedriver-${process.platform === "win32" && process.arch === "ia32" ? "win32" : process.platform === "win32" && process.arch === "arm64" ? "win-arm64" : "win64"}`;
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
// If these point to E:\BCD\... instead of E:\BCD_original\..., the shell's
// current directory is wrong - results will go to the wrong results folder.
console.log(`[paths] SCRIPT_DIR = ${SCRIPT_DIR}`);
console.log(`[paths] PROJECT_DIR = ${PROJECT_DIR}`);
console.log(`[paths] RESULTS_DIR = ${RESULTS_DIR}`);
console.log(`[paths] BCD_DIR = ${BCD_DIR}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (m) => console.log(`\n=== ${m} ===`);

// Network helpers
function getText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(getText(new URL(res.headers.location, url).toString()));
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function getJson(url) {
  return getText(url).then((txt) => {
    try {
      return JSON.parse(txt);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e.message}\nRaw: ${txt.slice(0, 200)}`);
    }
  });
}

// Auto-detect the board IP via hdc
function getBoardIp() {
  return new Promise((resolve, reject) => {
    // Run hdc shell ifconfig
    const ps = spawn("hdc", ["shell", "ifconfig"]);
    let out = "";
    ps.stdout.on("data", (d) => (out += d.toString()));
    ps.stderr.on("data", (d) => (out += d.toString()));
    ps.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`hdc shell ifconfig failed (exit ${code})`));
      }
      // Match IPv4 addresses, skip loopback (127.0.0.1)
      const ips = (out.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])
        .filter((ip) => ip !== "127.0.0.1")
        .filter((ip) => !ip.startsWith("127."));
      if (!ips.length) {
        return reject(
          new Error(`No non-loopback IPv4 found in hdc ifconfig output:\n${out.slice(0, 500)}`)
        );
      }
      // Prefer an address that looks like a LAN address (192.168/10./172.16-31)
      const lan = ips.find(
        (ip) =>
          ip.startsWith("192.168.") ||
          ip.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      );
      resolve(lan || ips[0]);
    });
  });
}

// Query the board's kernel version
async function getBoardChromeVersion(addr) {
  const [host, port] = addr.split(":");
  const url = `http://${host}:${port}/json/version`;
  step(`Query board kernel version: ${url}`);
  const text = await getText(url);
  const m = text.match(/"Browser"\s*:\s*"([^"]*)"/);
  if (!m) {
    throw new Error(`Could not parse Browser field from /json/version. Response:\n${text.slice(0, 500)}`);
  }
  const browserStr = m[1];
  console.log(`Board Browser: ${browserStr}`);
  const cm = browserStr.match(/Chrome\/(\d+\.\d+\.\d+)\./);
  if (!cm) {
    throw new Error(`No Chrome/x.y.z version found in Browser field: ${browserStr}`);
  }
  const full = cm[1]; // e.g. 144.0.7559.59
  const prefix = full.split(".").slice(0, 3).join("."); // 144.0.7559
  // Prefer the dedicated User-Agent field; some boards only carry the UA inside
  // the "Browser" field, so fall back to that.
  let ua = null;
  try {
    const parsed = JSON.parse(text);
    ua = parsed["User-Agent"] || null;
  } catch {
    // ignore, fall back to browserStr below
  }
  if (!ua) ua = browserStr;
  console.log(`✓ Board Chrome version: ${full} (first three segments ${prefix})`);
  return { full, prefix, ua };
}

// Extract the Huawei Browser version from a board User-Agent string.
// e.g. "... ArkWeb/7.0.0.37 Mobile HuaweiBrowser/6.1.3.352" -> "6.1.3.352"
function extractUaBrowserVersion(ua) {
  if (!ua || typeof ua !== "string") return null;
  const m = ua.match(/HuaweiBrowser\/([\d.]+)/i);
  return m ? m[1] : null;
}

// Derive version/since from the board kernel version via the BCD json 
// The board's Chrome kernel major version (e.g. 144) is matched against each release's
// "engine_version" field. The matching release's key becomes --version, and its release year
// becomes --since. When several releases share the same kernel, the board's User-Agent
// browser version is used to disambiguate.
async function getHuaweiParams(engineMajor, uaString) {
  const jsonPath = path.join(BCD_DIR, "browsers", `${BROWSER}.json`);
  step(`Derive --version/--since from board kernel ${engineMajor} via ${jsonPath}`);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`BCD browser json not found: ${jsonPath}`);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
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
          .join(", ")}`
    );
  }

  let matchKey;
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
        `falling back --since to ${since}`
    );
  }
  console.log(`✓ Board kernel ${engineMajor} -> release "${version}" -> --since=${since}`);
  return { version, since };
}

// Download the matching chromedriver
function downloadToFile(url, zipPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(zipPath);
    lib
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(zipPath);
          return resolve(
            downloadToFile(new URL(res.headers.location, url).toString(), zipPath)
          );
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (e) => {
        file.close();
        fs.unlinkSync(zipPath);
        reject(e);
      });
  });
}

// Map the current host OS/arch to the chromedriver platform folder name used by chrome-for-testing.
// e.g. win32+x64 -> win64, win32+ia32 -> win32, win32+arm64 -> win-arm64, darwin+arm64 -> mac-arm64
function chromedriverPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "win32") {
    if (arch === "ia32") return "win32";
    if (arch === "arm64") return "win-arm64";
    return "win64"; // x64 (and fallback)
  }
  if (platform === "darwin") {
    return arch === "arm64" ? "mac-arm64" : "mac-x64";
  }
  if (platform === "linux") {
    if (arch === "arm64") return "linux-arm64";
    if (arch === "arm") return "linux-arm";
    return "linux64";
  }
  throw new Error(`Unsupported platform/arch: ${platform}/${arch}`);
}

async function downloadChromeDriver(prefix) {
  step(`Look up chromedriver versions on mirror with first three segments = ${prefix}`);
  const list = await getJson(`${MIRROR_BASE}/`);
  const matched = list
    .map((e) => String(e.name || "").replace(/\/$/, ""))
    .filter((v) => v.split(".").slice(0, 3).join(".") === prefix)
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 4; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da !== db) return da - db;
      }
      return 0;
    });
  if (!matched.length) {
    throw new Error(`No chromedriver version with first three segments ${prefix} found on mirror`);
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

  // Extract to a temp dir (the zip contains a top-level chromedriver-win64/ folder), then pick out the exe
  const tmpDir = `${CD_INSTALL_DIR}.tmp`;
  console.log(`Extract to: ${tmpDir}`);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(CD_INSTALL_DIR)) {
    fs.rmSync(CD_INSTALL_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(CD_INSTALL_DIR), { recursive: true });
  await new Promise((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force`,
    ]);
    ps.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Expand-Archive failed, exit code ${code}`))
    );
  });
  fs.unlinkSync(zipPath);

  // Recursively find chromedriver.exe inside the extracted result
  let found = null;
  const walk = (d) => {
    if (found) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase() === "chromedriver.exe") found = p;
    }
  };
  walk(tmpDir);
  if (!found) {
    throw new Error(`chromedriver.exe not found after extraction (content at ${tmpDir})`);
  }
  // Move the found exe and its sibling files into the final directory
  fs.mkdirSync(CD_INSTALL_DIR, { recursive: true });
  const srcDir = path.dirname(found);
  for (const e of fs.readdirSync(srcDir)) {
    fs.renameSync(path.join(srcDir, e), path.join(CD_INSTALL_DIR, e));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const exe = path.join(CD_INSTALL_DIR, "chromedriver.exe");
  if (!fs.existsSync(exe)) {
    throw new Error(`chromedriver.exe not found after move: ${exe}`);
  }
  console.log(`✓ chromedriver.exe ready: ${exe}`);
  return exe;
}

// Start chromedriver
async function waitForChromeDriver(logFile) {
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    let content = "";
    try {
      content = fs.readFileSync(logFile, "utf8");
    } catch {}
    if (
      content.includes(`ChromeDriver was started successfully on port ${CD_PORT}`) ||
      (content.includes("started successfully") && content.includes(`port ${CD_PORT}`)) ||
      (content.includes("Only local connections are allowed") && content.includes(CD_PORT))
    ) {
      return true;
    }
  }
  return false;
}

// Start the local results server (npm start -> node app.js, listens on APP_PORT)
function startLocalServer() {
  const serverProc = spawn(process.execPath, ["app.js"], {
    cwd: PROJECT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(APP_PORT) },
  });
  serverProc.stdout.on("data", (d) => process.stdout.write(`[app.js] ${d}`));
  serverProc.stderr.on("data", (d) => process.stderr.write(`[app.js] ${d}`));
  return serverProc;
}

// Returns true if a service is already answering on APP_PORT (so we can reuse it
// instead of starting a second instance that would fail with EADDRINUSE).
async function isLocalServerUp() {
  try {
    const res = await new Promise((resolve, reject) => {
      const req = http.get({ host: "localhost", port: APP_PORT, path: "/" }, (r) =>
        resolve(r.statusCode)
      );
      req.on("error", reject);
      req.setTimeout(1000, () => req.destroy(new Error("timeout")));
    });
    return Boolean(res);
  } catch {
    return false;
  }
}

async function waitForLocalServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLocalServerUp()) return true;
    await sleep(1000);
  }
  return false;
}

// ---------- Main flow ----------
(async () => {
  let cdExe;
  let serverProc = null;

  // The local results server is only used when selenium runs in testenv mode
  // (NODE_ENV=test), where it talks to http://localhost:APP_PORT instead of the
  // public collector. For the normal Huawei Browser flow the tests run on
  // https://collector.openwebdocs.org and the results are downloaded from
  // there, so the local server is skipped unless START_LOCAL_SERVER=1.
  if (START_LOCAL_SERVER) {
    if (await isLocalServerUp()) {
      step(`Local results server (port ${APP_PORT})`);
      console.log(
        `✓ Reusing existing local server at http://localhost:${APP_PORT} (already responding; skipping npm start to avoid EADDRINUSE)`
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
          `✗ Local server did not become ready within 60s. Continuing anyway, but result download may fail.`
        );
      }
    }
  } else {
    console.log(
      "Skipping local results server (tests run on the public collector). Set START_LOCAL_SERVER=1 to enable it."
    );
  }

  // Resolve the debugger address: use explicit DEBUGGER_ADDRESS, otherwise auto-detect board IP via hdc
  let DEBUGGER_ADDRESS_RESOLVED = DEBUGGER_ADDRESS;
  if (!DEBUGGER_ADDRESS_RESOLVED) {
    step(`Auto-detect board IP via hdc shell ifconfig`);
    const ip = await getBoardIp();
    DEBUGGER_ADDRESS_RESOLVED = `${ip}:${DEBUGGER_PORT}`;
    console.log(`✓ Board IP detected: ${ip} (debugger address ${DEBUGGER_ADDRESS_RESOLVED})`);
  } else {
    console.log(`Use explicit debugger address: ${DEBUGGER_ADDRESS_RESOLVED}`);
  }

  if (SKIP_DOWNLOAD) {
    cdExe = path.join(CD_INSTALL_DIR, "chromedriver.exe");
    if (!fs.existsSync(cdExe)) {
      console.error(`SKIP_DRIVER_DOWNLOAD=1 but ${cdExe} not found`);
      process.exit(1);
    }
    console.log(`Skip download, use existing: ${cdExe}`);
  } else {
    const { prefix } = await getBoardChromeVersion(DEBUGGER_ADDRESS_RESOLVED);
    cdExe = await downloadChromeDriver(prefix);
  }

  // Derive --version/--since from the board kernel major version via the BCD json.
  // Only when they are not explicitly set via env (VERSION/SINCE).
  let VERSION_RESOLVED = VERSION;
  let SINCE_RESOLVED = SINCE;
  if (!VERSION_RESOLVED || !SINCE_RESOLVED) {
    try {
      const { full, ua } = await getBoardChromeVersion(
        DEBUGGER_ADDRESS_RESOLVED,
      );
      const engineMajor = full.split(".")[0]; // e.g. "144"
      const hp = await getHuaweiParams(engineMajor, ua);
      if (!VERSION_RESOLVED) VERSION_RESOLVED = hp.version;
      if (!SINCE_RESOLVED) SINCE_RESOLVED = hp.since;
    } catch (e) {
      console.warn(`⚠ Could not derive version/since from board: ${e.message}`);
    }
  }
  if (!VERSION_RESOLVED) {
    console.error("✗ --version could not be resolved (set VERSION env to override)");
    process.exit(1);
  }
  if (!SINCE_RESOLVED) {
    console.error("✗ --since could not be resolved (set SINCE env to override)");
    process.exit(1);
  }
  console.log(`✓ Resolved selenium params: --version=${VERSION_RESOLVED} --since=${SINCE_RESOLVED}`);

  // Start chromedriver
  step(`Start chromedriver (port ${CD_PORT}): ${cdExe}`);
  const cdLog = path.join(PROJECT_DIR, "chromedriver.log");
  if (fs.existsSync(cdLog)) fs.unlinkSync(cdLog);
  const cdArgs = [`--port=${CD_PORT}`];
  if (CD_VERBOSE) cdArgs.push("--verbose");
  const cdProc = spawn(cdExe, cdArgs, {
    cwd: PROJECT_DIR,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const cdOut = fs.createWriteStream(cdLog, { flags: "a" });
  cdProc.stdout.on("data", (d) => {
    process.stdout.write(`[chromedriver] ${d}`);
    cdOut.write(d);
  });
  cdProc.stderr.on("data", (d) => {
    process.stderr.write(`[chromedriver] ${d}`);
    cdOut.write(d);
  });

  const ready = await waitForChromeDriver(cdLog);
  if (!ready) {
    console.error(`✗ chromedriver did not start successfully within 60s. Last log:`);
    try {
      console.error(fs.readFileSync(cdLog, "utf8"));
    } catch {}
    process.exit(1);
  }
  console.log(`✓ chromedriver started and listening on port ${CD_PORT}`);

  // Run selenium
  step(`Run selenium tests (browser=${BROWSER}, debugger=${DEBUGGER_ADDRESS_RESOLVED})`);
  const selArgs = [
    path.join(PROJECT_DIR, "node_modules", "tsx", "dist", "cli.mjs"),
    "scripts/selenium.ts",
    BROWSER,
    `--since=${SINCE_RESOLVED}`,
    "-o",
    OS,
    "-j",
    JOBS,
    "--version",
    VERSION_RESOLVED,
    "-d",
    DEBUGGER_ADDRESS_RESOLVED,
  ];
  const selProc = spawn(process.execPath, selArgs, {
    cwd: PROJECT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const selStart = Date.now();
  let downloadLine = null;
  selProc.stdout.on("data", (d) => {
    const t = d.toString();
    process.stdout.write(t);
    const m = t.match(/Downloading .* \.\.\./);
    if (m && !downloadLine) downloadLine = m[0];
  });
  selProc.stderr.on("data", (d) => process.stderr.write(d.toString()));
  const code = await new Promise((resolve) => selProc.on("close", resolve));

  // Confirm results were downloaded back from the collector
  step("Confirm results download");
  if (downloadLine) console.log(`✓ Detected result download log: ${downloadLine}`);
  else
    console.log(
      "⚠ 'Downloading ...' log not detected. The page status may be Failed or the result download was skipped."
    );

  const files = fs.existsSync(RESULTS_DIR)
    ? fs
        .readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ f, t: fs.statSync(path.join(RESULTS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
    : [];
  if (files.length)
    console.log(`✓ Latest file in results dir: ${path.join(RESULTS_DIR, files[0].f)}`);
  else console.log("⚠ No json file found in results dir");

  // Auto-generate a report from the latest result files (default: latest 3, fewer if not enough).
  // Only generate when selenium actually succeeded and downloaded results - otherwise a report
  // built from stale files (e.g. old safari runs) would be misleading.
  //
  // The "Downloading ..." log line (downloadLine) is emitted by listr's task.output, which is NOT
  // reliably written to stdout under piped/non-TTY output (this script spawns selenium with a pipe),
  // so it is only a nice-to-have signal and must not be required. As the real proof of success we
  // also accept a freshly produced result file: a file is "fresh" (produced by THIS run) when its
  // mtime is at/after the selenium process started (selStart), which avoids both a fixed time
  // window (fails for long runs) and treating stale files as success.
  const newestFresh = files.length > 0 && files[0].t >= selStart - 5000;
  if (code !== 0 || (!downloadLine && !newestFresh)) {
    console.error(
      `✗ Selenium exited with code ${code}${
        downloadLine ? "" : " and no result download was detected"
      }. Skipping report generation to avoid a misleading report from stale files.`
    );
  } else {
    step("Generate report from latest results");
    if (files.length === 0) {
      console.log("⚠ Skipped report generation: no result json found.");
    } else {
      // Apply optional name filter (e.g. only huawei-browser reports).
      let candidates = REPORT_FILTER
        ? files.filter((x) => x.f.includes(REPORT_FILTER))
        : files;
      if (candidates.length === 0) {
        console.log(
          `⚠ Skipped report generation: no file matches REPORT_FILTER="${REPORT_FILTER}".`
        );
      } else {
        const picked = candidates.slice(0, REPORT_COUNT);
        const pickedPaths = picked.map((x) => path.join(RESULTS_DIR, x.f));
        console.log(
          `✓ Generating report from ${picked.length} latest file(s)` +
            (REPORT_FILTER ? ` (filtered by "${REPORT_FILTER}")` : "") +
            `: ${picked.map((x) => x.f).join(", ")}`
        );
        const { status: rvCode } = await new Promise((resolve) => {
          const rv = spawn(
            process.execPath,
            [
              path.join(PROJECT_DIR, "node_modules", "tsx", "dist", "cli.mjs"),
              "scripts/report-viewer.ts",
              ...pickedPaths,
            ],
            { cwd: PROJECT_DIR, stdio: "inherit" }
          );
          rv.on("close", (c) => resolve({ status: c || 0 }));
        });
        if (rvCode === 0) {
          console.log(`✓ Report generated: ${path.join(RESULTS_DIR, "report.html")}`);
        } else {
          console.log(`⚠ report-viewer exited with code ${rvCode}; report may be incomplete.`);
        }
      }
    }
  }

  // Cleanup
  if (serverProc) {
    console.log(`\nStop local results server (PID ${serverProc.pid}) ...`);
    try {
      serverProc.kill("SIGKILL");
    } catch {}
    console.log("✓ local server stopped");
  }

  if (!KEEP_CD) {
    console.log(`\nStop chromedriver process (PID ${cdProc.pid}) ...`);
    try {
      cdProc.kill("SIGKILL");
    } catch {}
    console.log("✓ chromedriver stopped");
  } else {
    console.log(
      `\n-KEEP_CHROMEDRIVER=1, chromedriver keeps running (PID ${cdProc.pid})`
    );
  }

  console.log("\nAutomation finished." + (code === 0 ? "" : ` (selenium exit code ${code})`));
  process.exit(code === 0 ? 0 : 1);
})().catch((e) => {
  console.error("\n✗ Automation failed:", e.message);
  process.exit(1);
});
