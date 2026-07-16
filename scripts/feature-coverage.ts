import {styleText} from "node:util";
import fs from "fs-extra";

import esMain from "es-main";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {CompatData} from "@mdn/browser-compat-data/types";
import {Tests} from "../types/types.js";

import {getBCDDir} from "../lib/constants.js";
import {getMissing} from "../lib/coverage.js";

const BCD_DIR = getBCDDir();

/* c8 ignore start */
/**
 * Finds missing entries between BCD and the collector tests.
 * @param bcd - The BCD data.
 * @param tests - The collector tests data.
 */
const main = (bcd: CompatData, tests: Tests) => {
  const {argv}: any = yargs(hideBin(process.argv)).command(
    "$0 [--direction]",
    "Find missing entries between BCD and the collector tests",
    (yargs) => {
      yargs
        .option("include-aliases", {
          alias: "a",
          describe: "Include BCD entries using prefix or alternative_name",
          type: "boolean",
          default: false,
        })
        .option("direction", {
          alias: "d",
          describe:
            'Which direction to find missing entries from ("a-from-b" will check what is missing in a but present in b)',
          choices: ["bcd-from-collector", "collector-from-bcd"],
          nargs: 1,
          type: "string",
          default: "collector-from-bcd",
        })
        .option("list", {
          alias: "l",
          describe: "List all features supported by the collector",
          type: "boolean",
          default: false,
        })
        .option("path", {
          alias: "p",
          describe: "The path(s) to filter for",
          type: "array",
          default: [],
        })
        .option("count-only", {
          alias: "c",
          describe:
            "Only report the count(s), don't list the individual features",
          type: "boolean",
          default: false,
        });
    },
  );

  if (argv.list) {
    Object.keys(tests)
      .filter((p) => !p.startsWith("__"))
      .forEach((key) => console.log(key));
    return;
  }

  const direction = argv.direction.split("-from-");

  if (!argv.countOnly) {
    console.log(
      styleText(
        "yellow",
        `Finding entries that are missing in ${styleText(["red", "bold"], direction[0])} but present in ${styleText(["green", "bold"], direction[1])}\n`,
      ),
    );
  }

  const missingFeatures = getMissing(
    bcd,
    tests,
    argv.direction,
    argv.path,
    argv.includeAliases,
  );

  // We only want to display the full item list the first time
  let firstEntry = true;

  for (const [filter, data] of Object.entries(missingFeatures)) {
    console.log(
      (filter ? `${filter}: ` : "") +
        `${direction[0]} covers ${data.all.found.length} (${(
          (data.testable.found.length / data.testable.all.length) *
          100.0
        ).toFixed(2)}%/${(
          (data.all.found.length / data.all.all.length) *
          100.0
        ).toFixed(
          2,
        )}%)} of ${data.testable.all.length}/${data.all.all.length} entries in ${direction[1]} (${data.testable.missing.length} (${(
          (data.testable.missing.length / data.testable.all.length) *
          100.0
        ).toFixed(2)}%/${(
          (data.all.missing.length / data.all.all.length) *
          100.0
        ).toFixed(2)}%) missing, ${data.untestable.all.length} (${(
          (data.untestable.all.length / data.all.all.length) *
          100.0
        ).toFixed(2)}%) untestable by collector)`,
    );

    if (firstEntry) {
      // Print a newline
      console.log("");

      if (!argv.countOnly) {
        console.log(
          "Missing Features: \n" + data.testable.missing.join("\n") + "\n",
        );
      }
    }

    firstEntry = false;
  }
};

if (esMain(import.meta)) {
  const {default: bcd} = await import(`${BCD_DIR}/index.js`);

  const testsPath = new URL("../tests.json", import.meta.url);
  if (!fs.existsSync(testsPath)) {
    throw new Error(
      "The tests must be built using `npm run build:tests` before this script can be run.",
    );
  }
  const tests = await fs.readJson(testsPath);

  main(bcd, tests);
}
/* c8 ignore stop */
