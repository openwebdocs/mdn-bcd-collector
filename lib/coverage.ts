import fs from "fs-extra";
import jsonc from "jsonc-parser";

import {Tests} from "../types/types.js";

import {
  CompatData,
  CompatStatement,
  SimpleSupportStatement,
} from "@mdn/browser-compat-data/types";

interface FeatureListSet {
  missing: string[];
  found: string[];
  all: string[];
}

interface FeatureList {
  all: FeatureListSet;
  testable: FeatureListSet;
  untestable: FeatureListSet;
}

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

      features.push(featureIdent);

      if (includeAliases) {
        const aliases = new Set();
        for (const _statements of Object.values(compat.support)) {
          const statements: SimpleSupportStatement[] = Array.isArray(
            _statements,
          )
            ? _statements
            : [_statements];
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
 * Indicates whether a feature identifier is untestable, based upon a curated list.
 * @param ident - The identifier to check.
 * @returns A boolean on whether the feature identifier is a known untestable feature.
 */
const isUntestable = (ident: string) => {
  return (
    untestableFeatures.features.includes(ident) ||
    untestableFeatures.categories.some((c) => ident.startsWith(c + "."))
  );
};

/**
 * Finds the missing entries in the given array of entries compared to the array of all entries.
 * @param entries - The array of entries to check against.
 * @param allEntries - The array of all entries.
 * @returns An object containing the missing entries and the total number of entries.
 */
const findMissing = (entries: string[], allEntries: string[]): FeatureList => {
  const found: string[] = [];
  const missing: string[] = [];

  for (const entry of allEntries) {
    (entries.includes(entry) ? found : missing).push(entry);
  }

  return {
    all: {
      missing,
      found,
      all: allEntries,
    },
    testable: {
      missing: missing.filter((f) => !isUntestable(f)),
      found: found.filter((f) => !isUntestable(f)),
      all: allEntries.filter((f) => !isUntestable(f)),
    },
    untestable: {
      missing: missing.filter((f) => isUntestable(f)),
      found: found.filter((f) => isUntestable(f)),
      all: allEntries.filter((f) => isUntestable(f)),
    },
  };
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
): Record<string, FeatureList> => {
  const bcdEntries = traverseFeatures(bcd, "", includeAliases);
  const collectorEntries = Object.keys(tests).filter(
    (p) => !p.startsWith("__"),
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
    const allFilteredMissing: FeatureList = {
      all: {
        missing: [],
        found: [],
        all: [],
      },
      testable: {
        missing: [],
        found: [],
        all: [],
      },
      untestable: {
        missing: [],
        found: [],
        all: [],
      },
    };

    const filteredMissing = pathFilter.reduce((a, filter) => {
      const filteredResult: any = {};

      for (const k1 of Object.keys(allFilteredMissing)) {
        filteredResult[k1] = {};
        for (const k2 of Object.keys(allFilteredMissing[k1])) {
          const list = missingFeatures[k1][k2].filter(
            (item) => item === filter || item.startsWith(`${filter}.`),
          );
          allFilteredMissing[k1][k2].push(...list);
          filteredResult[k1][k2] = list;
        }
      }

      return {
        ...a,
        [filter]: filteredResult as FeatureList,
      };
    }, {});

    if (pathFilter.length > 1) {
      return {[pathFilter.join(", ")]: allFilteredMissing, ...filteredMissing};
    }

    return filteredMissing;
  }

  return {"": missingFeatures};
};

export {traverseFeatures, findMissing, getMissing};
