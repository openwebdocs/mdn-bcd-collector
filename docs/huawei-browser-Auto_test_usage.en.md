# Automated testing tool for Huawei Browser

This tool runs MDN BCD compatibility tests automatically on a HarmonyOS device
("the board"), and writes the results into the `mdn-bcd-results` directory and
generates a report.

The entry point of the automated test is
[`auto-run-HuaweiBrowser-tests.cjs`](../auto-run-HuaweiBrowser-tests.cjs),
which chains the steps "query board kernel version → prepare chromedriver → run
selenium → generate report" into a single command.

## Prerequisites

- **A specific test demo must be installed on the board** (the browser is a demo
  build, not an official release)
- The board (HarmonyOS device) and the PC are on the same LAN and reachable via
  `hdc`
- The board has remote debugging enabled, and the debug port (default `9222`) is
  forwarded to the PC via `hdc fport`
- A local [browser-compat-data](https://github.com/mdn/browser-compat-data)
  checkout exists, and its `browsers/huaweibrowser_harmonyos.json` contains the
  Huawei browser data
- The `mdn-bcd-results` directory exists (the script relies on it to store
  results)

### Directory layout

The four directories `mdn-bcd-collector`, `browser-compat-data`,
`mdn-bcd-results`, and `ua-parser-js` must all be placed at the **same level**.
The script locates them via relative paths `../browser-compat-data` and
`../mdn-bcd-results` (see [Configuration](#configuration)).

Using `E:\BCD_original` as an example:

```
E:\BCD_original\
├── browser-compat-data\      # local BCD checkout, provides Huawei browser version data
├── mdn-bcd-collector\        # directory of this tool
├── mdn-bcd-results\          # directory for result JSON files
└── ua-parser-js\             # UA parsing library
```

> [!NOTE]
> `browser-compat-data` must contain
> `browsers/huaweibrowser_harmonyos.json`, because the npm package
> `@mdn/browser-compat-data` does not yet include `huaweibrowser_harmonyos`; this
> file is the **only source** of the Huawei browser version data.

> [!WARNING]
> The test demo installed on the board may have a browser version number
> (`HuaweiBrowser/x.y.z`) in its User-Agent that differs from the official
> release. Therefore, version resolution gives priority to the `engine_version`
> field in `browser-compat-data`. See
> [Version Resolution](#version-resolution).

## Quick Start

On first use, install dependencies and build (the build produces artifacts such
as `app.js`, `tests.json`; the automation script starts `node app.js` as the
local results server):

```sh
# Windows (PowerShell)
set PUPPETEER_SKIP_DOWNLOAD=true && npm install --legacy-peer-deps
npm run build

# macOS / Linux
PUPPETEER_SKIP_DOWNLOAD=true npm install --legacy-peer-deps
npm run build
```

`PUPPETEER_SKIP_DOWNLOAD=true` skips Puppeteer's bundled Chromium download
(this flow uses the browser on the board, so it is not needed), which
significantly speeds up installation.

Then run the automated test:

```sh
# Run from inside the mdn-bcd-collector directory
node auto-run-HuaweiBrowser-tests.cjs
```

By default the board IP is auto-detected (via `hdc shell ifconfig`) and combined
with `DEBUGGER_PORT`. If auto-detection fails, specify the debug address
explicitly (example):

```sh
# Windows (PowerShell)
$env:DEBUGGER_ADDRESS = "192.168.1.145:9222"
node auto-run-HuaweiBrowser-tests.cjs

# macOS / Linux
DEBUGGER_ADDRESS=192.168.1.145:9222 node auto-run-HuaweiBrowser-tests.cjs
```

### Run selenium manually

You can also skip the automation script and invoke selenium directly (useful for
debugging a single step). Note that the browser name uses the BCD ID
`huaweibrowser_harmonyos`, not the display name `HuaweiBrowser` from the UA:

```sh
npm run selenium -- huaweibrowser_harmonyos --since=2026 -v 7.0 -o HarmonyOS -j 1 -d 192.168.1.145:9222
```

Parameter explanation:

| Parameter | Meaning |
| - | - |
| `huaweibrowser_harmonyos` | Browser ID (positional, required) |
| `--since=2026` | Only run versions released in 2026 or later |
| `-v 7.0` | Only run the specified browser version (explicit value recommended, see [Version Resolution](#version-resolution)) |
| `-o HarmonyOS` | Target OS; Huawei is fixed to `HarmonyOS` (other values cause zero tasks) |
| `-j 1` | Number of concurrent jobs |
| `-d <host:port>` | Board debug address, required; must be `host:port` format, without `http://` |

> [!IMPORTANT]
> The `--` after `npm run` is **required**; otherwise npm will consume
> `--since`, `-o`, `-j` as its own arguments, and they will never reach selenium.

You can also run it directly with `npx tsx` for the same effect:

```sh
npx tsx scripts/selenium.ts huaweibrowser_harmonyos --since=2026 -v 7.0 -o HarmonyOS -j 1 -d 192.168.1.145:9222
```

## What the Script Does

The script runs the following steps in order, printing `=== ... ===` delimited
logs for each:

| Step | Description |
| - | - |
| 0 | Access the board's `http://<addr>/json/version` to get the Chrome kernel version |
| 1 | Download the `chromedriver` matching the kernel version from npmmirror |
| 2 | Extract to `CHROMEDRIVER_INSTALL_DIR` (default `D:\Program Files\chromedriver-win64`) |
| 3 | Start `chromedriver --port=9515` |
| 4 | Run `scripts/selenium.ts` to drive the Huawei browser on the board to run tests |
| 5 | Confirm the results are downloaded into `mdn-bcd-results`, and generate a report |

## Version Resolution

The script derives two parameters to pass to selenium: `--version` (browser
version) and `--since` (year).

The resolution priority is as follows:

1. **`VERSION` / `SINCE` environment variables** —— highest priority; once set,
   auto-resolution is skipped
2. **Board kernel version derivation** —— use the kernel major version (e.g.
   `144`) to match the `engine_version` of each release in
   `browser-compat-data/browsers/huaweibrowser_harmonyos.json`; the matched
   release key becomes the version (e.g. `7.0`), and its `release_date` year
   becomes `since`

Example:

```sh
Board kernel 144 -> release "7.0" -> --since=2026
```

> [!NOTE]
> When one kernel version maps to multiple releases (e.g. kernel `132` maps to
> both `6.0` and `6.1`), the script uses the `HuaweiBrowser/<version>` from the
> board's UA to disambiguate; if the UA is unavailable or does not match, it
> falls back to the first match and prints a `⚠` warning.

> [!WARNING]
> When specifying `VERSION` manually, make sure it matches the browser actually
> installed on the board. The specified value is only used to **filter which
> tasks to run**, and cannot change the actual browser being driven —— there is
> always only one browser instance on the board. The report file name is
> determined by the board's real UA and is unrelated to `VERSION`.

## Configuration

### Common environment variables

| Variable | Default | Description |
| - | - | - |
| `DEBUGGER_ADDRESS` | auto-detect | Board debug address, e.g. `192.168.1.145:9222` |
| `DEBUGGER_PORT` | `9222` | Only takes effect when auto-detecting the board IP |
| `VERSION` | auto-derived | Browser version, e.g. `7.0`; highest priority |
| `SINCE` | auto-derived | Start year, e.g. `2027` |
| `BROWSER` | `huaweibrowser_harmonyos` | Browser to test |
| `JOBS` | `1` | Number of concurrent jobs |
| `BCD_OS` | `HarmonyOS` | The `-o` argument passed to selenium |

### Path-related

| Variable | Default | Description |
| - | - | - |
| `PROJECT_DIR` | script directory | the `mdn-bcd-collector` directory |
| `RESULTS_DIR` | `../mdn-bcd-results` | directory for result JSON files |
| `BCD_DIR` | `../browser-compat-data` | local BCD checkout |
| `CHROMEDRIVER_INSTALL_DIR` | `D:\Program Files\chromedriver-win64` | chromedriver install location |
| `CHROMEDRIVER_PORT` | `9515` | chromedriver listening port |

### Report-related

| Variable | Default | Description |
| - | - | - |
| `REPORT_COUNT` | `3` | number of latest result files to include in the report |
| `REPORT_FILTER` | none | only keep results whose file name contains this substring, e.g. `huawei-browser` |
| `START_LOCAL_SERVER` | none (not started by default) | set to `1` to start the local results server (`npm start`). Off by default because the Huawei test runs on the public collector and downloads results from there |
| `APP_PORT` | `8080` | local results server port, only used when `START_LOCAL_SERVER=1` |

> [!TIP]
> The Huawei test **does not need the local results server by default**. Only
> when `NODE_ENV=test` makes selenium talk to the local collector (instead of the
> public one) do you need to set `START_LOCAL_SERVER=1`.

> [!IMPORTANT]
> It is recommended to set `REPORT_FILTER=huawei-browser`. Otherwise
> `REPORT_COUNT=3` takes the **latest 3** files under `mdn-bcd-results`, and if
> other browsers were run recently, non-Huawei results will be mixed into the
> report.

### Debug-related

| Variable | Description |
| - | - |
| `SKIP_DRIVER_DOWNLOAD=1` | skip download, use an existing chromedriver |
| `KEEP_CHROMEDRIVER=1` | keep the chromedriver process after the test finishes |
| `CHROMEDRIVER_VERBOSE=1` | pass `--verbose` to chromedriver, for diagnosing renderer issues |
| `MIRROR_BASE` | chromedriver download source, defaults to npmmirror |

## Results

After the test completes, the result JSON is written to `mdn-bcd-results`, with
a file name like:

```sh
10.20.8-huawei-browser-6.1.3.352-openharmony-7.0-5a54320dc3.json
```

The script then uses `scripts/report-viewer.ts` to generate a report based on the
latest few results.

### Generate a report separately

A report can also be generated independently of the automated test, by appending
**result file names** or a **result folder path** as arguments.

Specify several reports (for cross-version comparison):

```sh
npx tsx scripts/report-viewer.ts "../mdn-bcd-results/10.20.8-huawei-browser-7.0.3.352-openharmony-7.0-a3e91cc924.json" "../mdn-bcd-results/10.20.8-huawei-browser-7.0.3.352-openharmony-7.0-dad5577e2d.json"
```

Specify an entire results directory (generate reports for all results under it):

```sh
npx tsx scripts/report-viewer.ts "../mdn-bcd-results"
```

With no arguments, it reads all results under `../mdn-bcd-results` by default:

```sh
npx tsx scripts/report-viewer.ts
```

> [!NOTE]
> - The report is output as `report.html`: if an argument contains a **folder**,
>   it is written into that folder; otherwise it is written into the directory of
>   the first result file.
> - Multiple reports are sorted ascending by system version, and within the same
>   version from oldest to newest by generation time; you can switch/compare them
>   via the dropdown at the top-right of the page.

> [!NOTE]
> The test runs on
> [collector.openwebdocs.org](https://collector.openwebdocs.org) and the results
> are downloaded back locally by selenium; the local `app.ts` is only involved in
> `--testenv` mode. Therefore browser identification in the report depends on the
> BCD data of the public collector.

## Updating `browser-compat-data`

To write the test results back into the local BCD, run:

```sh
npm run update-bcd -- -b huaweibrowser_harmonyos <results-file>...
```

See [update-bcd.md](./update-bcd.md) for more details.

> [!NOTE]
> `update-bcd` uses the local `browser-compat-data` directly, so before first
> use make sure that directory has its dependencies installed (run `npm
> install`).

## Troubleshooting

### Board connection failed

Make sure the board IP and port are reachable (example):

```sh
curl http://192.168.1.145:9222/json/version
```

### Corrupted result file (JSON parse failure)

If the download is interrupted and the server ignores the resume request, the
result file may end up with two JSONs concatenated, which manifests as a JSON
parse error from `npm run report` or `update-bcd`.

Find the corrupted file:

```sh
cd ../mdn-bcd-results
node -e "const fs=require('fs');for(const f of fs.readdirSync('.').filter(x=>x.endsWith('.json'))){try{JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){console.log('corrupt:',f)}}"
```

Delete the corrupted file and rerun.

### Tests did not run / non-zero exit code

Check the log for `Board kernel ... -> release ...`. If missing, it means the
board's `/json/version` was not reachable, or the BCD has no release matching
the `engine_version`.
