//
// mdn-bcd-collector: scripts/feature-coverage.ts
// Script to find features that are in the collector or BCD but not the other
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import {CompatData, CompatStatement} from "@mdn/browser-compat-data/types";
import chalk from "chalk-template";
import esMain from "es-main";
import fs from "fs-extra";
import jsonc from "jsonc-parser";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {Tests} from "../types/types.js";
import {BCD_DIR} from "../lib/constants.js";

const untestableFeatures = jsonc.parse(
  await fs.readFile(
    new URL("../untestable-features.jsonc", import.meta.url),
    "utf8",
  ),
);

/**
 * Traverses the features object and returns an array of feature paths.
 * @param obj - The features object to traverse.
 * @param path - The current path of the traversal.
 * @param [includeAliases] - Whether to include aliases in the result.
 * @returns An array of feature paths.
 */
const traverseFeatures = (
  obj: any,
  path: string,
  includeAliases?: boolean,
): string[] => {
  const features: string[] = [];

  for (const id of Object.keys(obj)) {
    if (!obj[id] || typeof obj[id] !== "object") {
      continue;
    }

    const compat: CompatStatement = obj[id].__compat;
    if (compat) {
      const featureIdent = `${path}${id}`;

      if (untestableFeatures.includes(featureIdent)) {
        // Skip any untestable features
        continue;
      }

      features.push(featureIdent);

      if (includeAliases) {
        const aliases = new Set();
        for (let statements of Object.values(compat.support)) {
          if (!Array.isArray(statements)) {
            statements = [statements];
          }
          for (const statement of statements) {
            if (statement.flags) {
              continue;
            }
            if (statement.alternative_name) {
              aliases.add(statement.alternative_name);
            }
            if (statement.prefix) {
              let name = id;
              if (path.startsWith("api.")) {
                name = name[0].toUpperCase() + name.substring(1);
              }
              aliases.add(statement.prefix + name);
            }
          }
        }

        for (const alias of aliases) {
          features.push(`${path}${alias}`);
        }
      }
    }

    features.push(
      ...traverseFeatures(obj[id], path + id + ".", includeAliases),
    );
  }

  return features;
};

/**
 * Finds the missing entries in the given array of entries compared to the array of all entries.
 * @param entries - The array of entries to check against.
 * @param allEntries - The array of all entries.
 * @returns An object containing the missing entries and the total number of entries.
 */
const findMissing = (
  entries: string[],
  allEntries: string[],
): {missing: string[]; all: string[]} => {
  const missing: string[] = [];

  for (const entry of allEntries) {
    if (!entries.includes(entry)) {
      missing.push(entry);
    }
  }

  return {missing, all: allEntries};
};

/**
 * Retrieves the missing entries between the BCD (Browser Compatibility Data) and the collector.
 * @param bcd - The BCD data.
 * @param tests - The collector data.
 * @param direction - The direction of comparison. Defaults to "collector-from-bcd".
 * @param pathFilter - An optional array of paths to filter the entries.
 * @param includeAliases - Specifies whether to include aliases in the comparison. Default is false.
 * @returns The missing entries based on the specified direction.
 */
const getMissing = (
  bcd: CompatData,
  tests: Tests,
  direction = "collector-from-bcd",
  pathFilter: string[] = [],
  includeAliases = false,
): Record<string, {missing: string[]; all: string[]}> => {
  const bcdEntries = traverseFeatures(bcd, "", includeAliases);
  const collectorEntries = Object.keys(tests).filter(
    (p) => p !== "__resources",
  );

  let from: string[];
  let all: string[];

  switch (direction) {
    case "bcd-from-collector":
      from = bcdEntries;
      all = collectorEntries;
      break;
    default:
      console.log(
        `Direction '${direction}' is unknown; defaulting to collector <- bcd`,
      );
    // eslint-disable-next-line no-fallthrough
    case "collector-from-bcd":
      from = collectorEntries;
      all = bcdEntries;
      break;
  }

  const missingFeatures = findMissing(from, all);

  if (pathFilter.length) {
    const allFilteredMissing: {missing: string[]; all: string[]} = {
      missing: [],
      all: [],
    };

    const filteredMissing = pathFilter.reduce((a, filter) => {
      const missing = missingFeatures.missing.filter(
        (item) => item === filter || item.startsWith(`${filter}.`),
      );
      const all = missingFeatures.all.filter(
        (item) => item === filter || item.startsWith(`${filter}.`),
      );

      allFilteredMissing.missing.push(...missing);
      allFilteredMissing.all.push(...all);

      return {
        ...a,
        [filter]: {
          missing,
          all,
        },
      };
    }, {});

    if (pathFilter.length > 1) {
      return {[pathFilter.join(", ")]: allFilteredMissing, ...filteredMissing};
    }

    return filteredMissing;
  }

  return {"": missingFeatures};
};

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

  const direction = argv.direction.split("-from-");

  if (!argv.countOnly) {
    console.log(
      chalk`{yellow Finding entries that are missing in {red.bold ${direction[0]}} but present in {green.bold ${direction[1]}}...}\n`,
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
    const foundFeatures = data.all.length - data.missing.length;

    console.log(
      (filter ? chalk`{blue ${filter}}: ` : "") +
        chalk`{green.bold ${direction[0]}} covers {green ${foundFeatures} (${(
          (foundFeatures / data.all.length) *
          100.0
        ).toFixed(
          2,
        )}%)} of {cyan ${data.all.length}} entries tracked in {red.bold ${direction[1]}} ({red ${data.missing.length} (${(
          (data.missing.length / data.all.length) *
          100.0
        ).toFixed(2)}%)} missing)`,
    );

    if (firstEntry) {
      // Print a newline
      console.log("");

      if (!argv.countOnly) {
        console.log(
          chalk`{red Missing Features:}\n` + data.missing.join("\n") + "\n",
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

export {traverseFeatures, findMissing, getMissing};
