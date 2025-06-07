//
// mdn-bcd-collector: scripts/find-missing-reports.ts
// Script to find browser versions that don't have a result file in mdn-bcd-results
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {CompatData} from "@mdn/browser-compat-data/types";

import {Report} from "../types/types.js";

type ReportMap = Record<string, string[]>;

import {
  compare as compareVersions,
  compareVersions as compareVersionsSort,
} from "compare-versions";
import esMain from "es-main";
import fs from "fs-extra";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {BCD_DIR, RESULTS_DIR} from "../lib/constants.js";
import filterVersions from "../lib/filter-versions.js";
import {parseUA} from "../lib/ua-parser.js";

import {loadJsonFiles} from "./update-bcd.js";

import type {BrowserName} from "@mdn/browser-compat-data";

const {default: bcd}: {default: CompatData} = await import(
  `${BCD_DIR}/index.js`
);
const {browsers} = bcd;

const appVersion = (await fs.readJson("./package.json"))?.version;

/**
 * Generates a report map based on the provided filter.
 * @param filter - The filter to apply to the report generation. Can be "all" or a specific year in the format "YYYY".
 * @returns The generated report map.
 */
const generateReportMap = (filter: string) => {
  const result: ReportMap = {};

  for (const browser of Object.keys(browsers)) {
    if (
      filter !== "all" &&
      ["ie", "nodejs", "deno", "oculus"].includes(browser)
    ) {
      continue;
    }

    const releases = filterVersions(
      browser as BrowserName,
      filter === "all" ? null : new Date(`${filter}-01-01`),
      false,
    );
    result[browser] = releases.sort(compareVersionsSort);

    if (filter !== "all") {
      if (browser == "safari") {
        // Ignore super old Safari releases
        result[browser] = result[browser].filter((v) =>
          compareVersions(v, "4", ">="),
        );
      } else if (browser == "opera") {
        // Ignore all Opera versions besides 12.1, 15, and the latest stable
        result[browser] = result[browser].filter(
          (v) =>
            v == "12.1" ||
            v == "15" ||
            v == result[browser][result[browser].length - 1],
        );
      } else if (browser.includes("_android") || browser.includes("_ios")) {
        // Ignore all mobile browser releases besides the most current
        result[browser] = result[browser].filter(
          (v) => v == result[browser][result[browser].length - 1],
        );
      }
    }
  }

  return result;
};

/**
 * Finds missing reports based on the provided parameters.
 * @param reportPaths - The paths to the report files.
 * @param filter - The filter to apply to the reports.
 * @param version - The version to compare the reports against.
 *                           If set to "current", it uses the appVersion.
 *                           If set to "all", it compares against all versions.
 * @returns - The report map containing the missing reports.
 */
const findMissingReports = async (
  reportPaths: string[],
  filter: string,
  version: string,
) => {
  if (version == "current") {
    version = appVersion;
  }

  const reportMap = generateReportMap(filter);
  const data = await loadJsonFiles(reportPaths);

  for (const report of Object.values(data) as Report[]) {
    if (version != "all") {
      if (report.__version != version) {
        continue;
      }
    }

    const ua = parseUA(report.userAgent, browsers);
    const browserKey = ua.browser.id;
    const browserVersion = ua.version;

    if (browserKey in reportMap) {
      if (reportMap[browserKey].includes(browserVersion)) {
        reportMap[browserKey] = reportMap[browserKey].filter(
          (v) => v !== browserVersion,
        );
      }
    }
  }

  return reportMap;
};

/* c8 ignore start */
/**
 * Main function that finds and logs missing reports.
 * @param argv - The command line arguments.
 * @returns - A promise that resolves when the missing reports are found and logged.
 */
const main = async (argv) => {
  const missingReports = await findMissingReports(
    argv.reports,
    argv.all ? "all" : argv.since,
    argv.collectorVersion,
  );

  for (const [browser, releases] of Object.entries(missingReports)) {
    if (releases.length) {
      console.log(`${browsers[browser].name}: ${releases.join(", ")}`);
    }
  }
};

if (esMain(import.meta)) {
  const {argv} = yargs(hideBin(process.argv)).command(
    "$0 [reports..]",
    "Determine gaps in results",
    (yargs) => {
      yargs
        .positional("reports", {
          describe: "The report files to update from (also accepts folders)",
          type: "string",
          array: true,
          default: [RESULTS_DIR],
        })
        .option("collector-version", {
          alias: "c",
          describe: 'Limit the collector version (set to "all" to disable)',
          type: "string",
          default: "current",
        })
        .option("all", {
          describe: "Include all browser versions, including ignored",
          alias: "a",
          type: "boolean",
          nargs: 0,
        })
        .option("since", {
          describe:
            'Limit to browser releases from this year on (ignored by "--all")',
          alias: "s",
          type: "string",
          default: "2020",
          nargs: 1,
        });
    },
  );

  await main(argv);
}
/* c8 ignore stop */

export default findMissingReports;
