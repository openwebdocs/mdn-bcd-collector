//
// mdn-bcd-collector: scripts/report-stats.ts
// Script to print statistics about a reports file
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import path from "node:path";
import {Stats} from "node:fs";

import chalk from "chalk-template";
import esMain from "es-main";
import fs from "fs-extra";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {CompatData} from "@mdn/browser-compat-data/types";

import {Report, ReportStats} from "../types/types.js";
import {BCD_DIR} from "../lib/constants.js";
import {parseUA} from "../lib/ua-parser.js";

import {findMissing} from "./find-missing-features.js";

const {default: bcd}: {default: CompatData} = await import(
  `${BCD_DIR}/index.js`
);

const tests = Object.keys(
  await fs.readJson(new URL("../tests.json", import.meta.url)),
);

const statuses = {
  true: {color: "green", name: "Supported"},
  false: {color: "red", name: "Unsupported"},
  null: {color: "yellow", name: "Unknown"},
};

/**
 * Removes duplicate elements from an array.
 * @param array - The array to deduplicate.
 * @returns A new array with duplicate elements removed.
 */
const dedupeArray = (array: any[]): any[] => {
  return array.filter((item, index) => array.indexOf(item) === index);
};

/**
 * Calculates the percentage of a value relative to a total.
 * @param value - The value to calculate the percentage of
 * @param total - The total value
 * @returns The percentage as a string, formatted with two decimal places
 */
const percentage = (value: number, total: number): string => {
  return `${((value / total) * 100).toFixed(2)}%`;
};

/**
 * Loads a JSON file and returns its contents as a Report object.
 * @param file - The path to the JSON file.
 * @returns A Promise that resolves to the Report object if the file is valid, otherwise undefined.
 */
const loadFile = async (file: string): Promise<Report | undefined> => {
  // Check file argument to ensure it's a valid JSON file
  if (!file) {
    console.error(chalk`{red No file has been specified!}`);
    return;
  }

  let fsStats: Stats;

  // Check if path exists
  try {
    fsStats = await fs.stat(file);
  } catch (e) {
    console.error(chalk`{red File {bold ${file}} doesn't exist!}`);
    return;
  }

  // Check if file is a file and ends in .json
  if (!(fsStats.isFile() && path.extname(file) === ".json")) {
    console.error(chalk`{red File {bold ${file}} is not a JSON file!}`);
    return;
  }

  let data: any;

  // Try to read the JSON data from the file
  try {
    data = await fs.readJson(file);
  } catch (e) {
    console.error(chalk`{red Could not parse JSON from {bold ${file}}!}`);
    return;
  }

  // Check to make sure it's a valid report file
  if (!("__version" in data && "results" in data && "userAgent" in data)) {
    console.error(
      chalk`{red File {bold ${file}} does not seem to be a collector report file!  Expected "__version", "results" and "userAgent" keys.}`,
    );
  }

  // Finally, return the data
  return data;
};

/**
 * Retrieves statistics based on the provided report data and feature queries.
 * @param data - The report data
 * @param featureQuery - An array of feature queries
 * @returns An object containing the version, browser, URLs, test results, and queried features
 */
export const getStats = (data: Report, featureQuery: string[]): ReportStats => {
  const testResults = Object.values(data.results).flat();
  const testedFeatures = dedupeArray(testResults.map((r) => r.name));

  const supportedFeatures = dedupeArray(
    testResults.filter((r) => r.result).map((r) => r.name),
  );
  const unsupportedFeatures = dedupeArray(
    testResults.filter((r) => r.result === false).map((r) => r.name),
  );
  const unknownFeatures = dedupeArray(
    testResults.filter((r) => r.result === null).map((r) => r.name),
  );

  const featuresQueried: any[] = [];

  if (featureQuery) {
    for (const f of featureQuery) {
      const featuresFound = testResults.filter(
        (r) => r.name === f || r.name.startsWith(`${f}.`),
      );
      featuresQueried.push(
        ...featuresFound.sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }

  return {
    version: data.__version,
    browser: parseUA(data.userAgent, bcd.browsers),
    urls: Object.keys(data.results),
    testResults: {
      total: testedFeatures.length,
      supported: supportedFeatures,
      unsupported: unsupportedFeatures,
      unknown: unknownFeatures,
      missing: findMissing(testedFeatures, tests).missingEntries,
    },
    featuresQueried,
  };
};

/**
 * Prints the statistics.
 * @param stats - The statistics
 * @param verboseNull - Whether to print the list of features with unknown support
 */
const printStats = (stats: ReportStats, verboseNull: boolean): void => {
  console.log(
    chalk` -=- Statistics for {bold ${stats.browser.browser.name} ${stats.browser.version}} (${stats.browser.os.name} ${stats.browser.os.version}) -=-`,
  );

  if (!stats.browser.inBcd) {
    if (stats.browser.inBcd === false) {
      console.log(chalk`{red Warning: browser version is {bold not} in BCD.}`);
    } else {
      console.log(chalk`{red Warning: browser is {bold not} in BCD.}`);
    }
  }

  if (stats.urls.length == 0) {
    console.log(chalk`{yellow Report file has no results!}\n`);
    return;
  }

  console.log(
    chalk`{bold URLs Run:}\n${stats.urls.map((u) => ` - ${u}`).join("\n")}`,
  );

  const totalTests = stats.testResults.total;
  console.log(chalk`Tests Run: {bold ${totalTests}}`);

  for (const {name, color} of Object.values(statuses)) {
    const status = name.toLowerCase();
    const testResults = stats.testResults[status].length;
    console.log(
      chalk` - {${color} ${name}: {bold ${testResults}} features ({bold ${percentage(
        testResults,
        totalTests,
      )}} of tested / {bold ${percentage(
        testResults,
        tests.length,
      )}} of total)}`,
    );
  }

  if (verboseNull) {
    for (const f of stats.testResults.unknown) {
      console.log(chalk`   - {yellow ${f}}`);
    }
  }

  console.log(
    chalk` - {gray Missing: {bold ${
      stats.testResults.missing.length
    }} features ({bold ${percentage(
      stats.testResults.missing.length,
      tests.length,
    )}})}`,
  );

  if (stats.featuresQueried.length) {
    console.log("Feature Query:");
    for (const feature of stats.featuresQueried) {
      const status = statuses[JSON.stringify(feature.result)] || statuses.null;
      console.log(
        chalk` - ${feature.name} ({bold ${feature.exposure}} exposure): {${
          status.color || "bold"
        } ${status.name}}` + (feature.message ? ` - ${feature.message}` : ""),
      );
    }
  }

  console.log("\n");
};

/**
 * The main function.
 * @param files - The report files
 * @param features - The feature queries
 * @param verboseNull - Whether to print the list of features with unknown support
 * @returns A Promise that resolves when the function is complete
 */
const main = async (
  files: string[],
  features: string[],
  verboseNull: boolean,
): Promise<void> => {
  for (const file of files) {
    const data = await loadFile(file);
    if (!data) {
      continue;
    }

    const stats = getStats(data, features);
    printStats(stats, verboseNull);
  }
};

/* c8 ignore start */
if (esMain(import.meta)) {
  const {argv}: {argv: any} = yargs(hideBin(process.argv)).command(
    "$0 <files..>",
    "",
    (yargs) => {
      yargs
        .positional("files", {
          describe: "The report file(s) to generate statistics for",
          type: "string",
          array: true,
        })
        .option("feature", {
          alias: "f",
          describe: "A specific feature identifier to query support for",
          type: "string",
          array: true,
        })
        .option("null", {
          alias: "n",
          describe:
            "Enable this flag to print the list of features with unknown support",
          type: "boolean",
        });
    },
  );

  await main(argv.files, argv.feature, argv.null);
}
/* c8 ignore stop */
