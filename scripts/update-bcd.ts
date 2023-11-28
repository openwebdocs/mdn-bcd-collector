//
// mdn-bcd-collector: scripts/update-bcd.ts
// Script to update the BCD data using collected results
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

// Base eslint no-unused-vars misunderstands typescript function types as having
// unused variables. Replace with @typescript-eslint/no-unused-vars for this file.
/* eslint no-unused-vars: "off", @typescript-eslint/no-unused-vars: "error" */

import {
  Browsers,
  SimpleSupportStatement,
  Identifier,
  BrowserName,
} from "@mdn/browser-compat-data/types";
import {
  Report,
  TestResultValue,
  SupportMatrix,
  BrowserSupportMap,
  Overrides,
  InternalSupportStatement,
  OverrideTuple,
  SupportMap,
} from "../types/types.js";

import assert from "node:assert";
import path from "node:path";

import {
  compare as compareVersions,
  compareVersions as compareVersionsSort,
} from "compare-versions";
import esMain from "es-main";
import fs from "fs-extra";
import {fdir} from "fdir";
import {Minimatch} from "minimatch";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {BCD_DIR} from "../lib/constants.js";
import logger from "../lib/logger.js";
import {parseUA} from "../lib/ua-parser.js";

const {default: mirror} = await import(`${BCD_DIR}/scripts/release/mirror.js`);

export const findEntry = (
  bcd: Identifier,
  ident: string,
): Identifier | null => {
  if (!ident) {
    return null;
  }
  const keys: string[] = ident.split(".");
  let entry: any = bcd;
  while (entry && keys.length) {
    entry = entry[keys.shift() as string];
  }
  return entry;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const combineResults = (results: TestResultValue[]): TestResultValue => {
  let supported: TestResultValue = null;
  for (const result of results) {
    if (result === true) {
      // If any result is true, the flattened support should be true. There
      // can be contradictory results with multiple exposure scopes, but here
      // we treat support in any scope as support of the feature.
      return true;
    } else if (result === false) {
      // This may yet be overruled by a later result (above).
      supported = false;
    } else if (result === null) {
      // Leave supported as it is.
    } else {
      throw new Error(`result not true/false/null; got ${result}`);
    }
  }
  return supported;
};

// Create a string representation of a version range, optimized for human
// legibility.
const joinRange = (lower: string, upper: string) =>
  lower === "0" ? `≤${upper}` : `${lower}> ≤${upper}`;

// Parse a version range string produced by `joinRange` into a lower and upper
// boundary.
export const splitRange = (range: string) => {
  const match = range.match(/(?:(.*)> )?(?:≤(.*))/);
  if (!match) {
    throw new Error(`Unrecognized version range value: "${range}"`);
  }
  return {lower: match[1] || "0", upper: match[2]};
};

// Get support map from BCD path to test result (null/true/false) for a single
// report.
export const getSupportMap = (report: Report): BrowserSupportMap => {
  // Transform `report` to map from test name (BCD path) to array of results.
  const testMap = new Map();
  for (const tests of Object.values(report.results)) {
    for (const test of tests) {
      // TODO: If test.exposure.endsWith('Worker'), then map this to a
      // worker_support feature.
      const tests = testMap.get(test.name) || [];
      tests.push(test.result);
      testMap.set(test.name, tests);
    }
  }

  if (testMap.size === 0) {
    throw new Error(`Report for "${report.userAgent}" has no results!`);
  }

  // Transform `testMap` to map from test name (BCD path) to flattened support.
  const supportMap = new Map();
  for (const [name, results] of testMap.entries()) {
    let supported = combineResults(results);

    if (supported === null) {
      // If the parent feature support is false, copy that.
      // TODO: This  assumes that the parent feature came first when iterating
      // the report, which isn't guaranteed. Move this to a second phase.
      const parentName = name.split(".").slice(0, -1).join(".");
      const parentSupport = supportMap.get(parentName);
      if (parentSupport === false) {
        supported = false;
      }
    }

    supportMap.set(name, supported);
  }
  return supportMap;
};

// Load all reports and build a map from BCD path to browser + version
// and test result (null/true/false) for that version.
export const getSupportMatrix = (
  reports: Report[],
  browsers: Browsers,
  overrides: OverrideTuple[],
): SupportMatrix => {
  const supportMatrix = new Map();

  for (const report of reports) {
    const {browser, version, inBcd} = parseUA(report.userAgent, browsers);
    if (!inBcd) {
      if (inBcd === false) {
        logger.warn(
          `Ignoring unknown ${browser.name} version ${version} (${report.userAgent})`,
        );
      } else if (browser.name) {
        logger.warn(
          `Ignoring unknown browser ${browser.name} ${version} (${report.userAgent})`,
        );
      } else {
        logger.warn(`Unable to parse browser from UA ${report.userAgent}`);
      }

      continue;
    }

    const supportMap = getSupportMap(report);

    // Merge `supportMap` into `supportMatrix`.
    for (const [name, supported] of supportMap.entries()) {
      let browserMap = supportMatrix.get(name);
      if (!browserMap) {
        browserMap = new Map();
        supportMatrix.set(name, browserMap);
      }
      let versionMap = browserMap.get(browser.id);
      if (!versionMap) {
        versionMap = new Map();
        for (const browserVersion of Object.keys(
          browsers[browser.id].releases,
        )) {
          versionMap.set(browserVersion, null);
        }
        browserMap.set(browser.id, versionMap);
      }
      assert(versionMap.has(version), `${browser.id} ${version} missing`);

      // In case of multiple reports for a single version it's possible we
      // already have (non-null) support information. Combine results to deal
      // with this possibility.
      const combined = combineResults([supported, versionMap.get(version)]);
      versionMap.set(version, combined);
    }
  }

  // apply manual overrides
  for (const [path, browser, version, supported] of overrides) {
    const browserMap = supportMatrix.get(path);
    if (!browserMap) {
      continue;
    }
    const versionMap = browserMap.get(browser);
    if (!versionMap) {
      continue;
    }

    if (version === "*") {
      // All versions of a browser
      for (const v of versionMap.keys()) {
        versionMap.set(v, supported);
      }
    } else if (version.includes("+")) {
      // Browser versions from x onwards (inclusive)
      for (const v of versionMap.keys()) {
        if (compareVersions(version.replace("+", ""), v, "<=")) {
          versionMap.set(v, supported);
        }
      }
    } else if (version.includes("-")) {
      // Browser versions between x and y (inclusive)
      const versions = version.split("-");
      for (const v of versionMap.keys()) {
        if (
          compareVersions(versions[0], v, "<=") &&
          compareVersions(versions[1], v, ">=")
        ) {
          versionMap.set(v, supported);
        }
      }
    } else {
      // Single browser versions
      versionMap.set(version, supported);
    }
  }

  return supportMatrix;
};

export const inferSupportStatements = (
  versionMap: BrowserSupportMap,
): SimpleSupportStatement[] => {
  const versions = Array.from(versionMap.keys()).sort(compareVersionsSort);

  const statements: SimpleSupportStatement[] = [];
  const lastKnown: {version: string; support: TestResultValue} = {
    version: "0",
    support: null,
  };
  let lastWasNull = false;

  for (const version of versions) {
    const supported = versionMap.get(version);
    const lastStatement = statements[statements.length - 1];

    if (supported === true) {
      if (!lastStatement) {
        statements.push({
          version_added:
            lastWasNull || lastKnown.support === false
              ? joinRange(lastKnown.version, version)
              : version,
        });
      } else if (!lastStatement.version_added) {
        lastStatement.version_added = lastWasNull
          ? joinRange(lastKnown.version, version)
          : version;
      } else if (lastStatement.version_removed) {
        // added back again
        statements.push({
          version_added: version,
        });
      }

      lastKnown.version = version;
      lastKnown.support = true;
      lastWasNull = false;
    } else if (supported === false) {
      if (
        lastStatement &&
        lastStatement.version_added &&
        !lastStatement.version_removed
      ) {
        lastStatement.version_removed = lastWasNull
          ? joinRange(lastKnown.version, version)
          : version;
      } else if (!lastStatement) {
        statements.push({version_added: false});
      }

      lastKnown.version = version;
      lastKnown.support = false;
      lastWasNull = false;
    } else if (supported === null) {
      lastWasNull = true;
      // TODO
    } else {
      throw new Error(`result not true/false/null; got ${supported}`);
    }
  }

  return statements;
};

/** Values that can be logged for further analysis. */
interface UpdateLog {
  allStatements: SimpleSupportStatement[];
  browser: BrowserName;
  defaultStatements: SimpleSupportStatement[];
  inferredStatements: SimpleSupportStatement[];
  path: string;
  statements: SimpleSupportStatement[];
  reason: Reason;
}

/** Values available in operations. */
interface UpdateState extends UpdateLog {
  shared: UpdateShared;
}

/** Internal values restricted to expand() and update(). */
interface UpdateInternal extends UpdateState {
  debug: UpdateDebug;
}

type CompatSupport = Exclude<Identifier["__compat"], undefined>["support"];

/** Values shared by multiple updates or too large to log. */
interface UpdateShared {
  bcd: Identifier;
  browserMap: SupportMap;
  unmodifiedSupport: CompatSupport;
  entry: Identifier;
  support: CompatSupport;
  versionMap: BrowserSupportMap;
}

interface UpdateDebug {
  stack: {step: string; result: UpdateYield}[];
}

type UpdateYield = Partial<UpdateLog> & {
  shared?: Partial<UpdateShared>;
};

interface Reason {
  step?: string;
  message?: string;
  skip?: boolean;
  quiet?: boolean;
}

interface ReasonMessageFactory {
  (value: UpdateState): string;
}

interface ReasonFactory {
  (value: UpdateState): Reason;
}

const reason = (
  message: ReasonMessageFactory,
  args: Omit<Reason, "message"> = {},
): ReasonFactory => {
  return (value) => ({message: message(value), skip: true, ...args});
};

const isReasonFactory = (
  maybeFactory: unknown,
): maybeFactory is ReasonFactory => typeof maybeFactory === "function";

const handleReasonable = (
  factory: string | Reason | ReasonFactory,
  value: UpdateState,
): Reason => {
  if (typeof factory === "string") {
    return reason(() => factory)(value);
  } else if (isReasonFactory(factory)) {
    return factory(value);
  }
  return factory;
};

const compose = (...funcs: any[]) =>
  funcs.reduce(
    (last, next, index, array) => {
      if (!last) {
        throw new Error(
          `[${array.indexOf(next)}] last undefined: ${String(last)}`,
        );
      }
      return next(last);
    },
    function* () {
      yield {};
    },
  ) as () => Generator<UpdateInternal>;

const expand = (
  step: string,
  generator: (value: UpdateState) => Generator<UpdateYield | void>,
) => {
  return (last: () => Generator<UpdateInternal>) =>
    function* (): Generator<UpdateInternal> {
      for (const value of last()) {
        if (value === undefined) {
          continue;
        }
        if (value.reason?.skip) {
          yield value;
          continue;
        }

        for (const props of generator(value)) {
          if (props) {
            const {shared: propsShared, ...propsPicked} = props;
            yield {
              ...value,
              ...propsPicked,
              debug: {
                stack: [
                  ...(value.debug?.stack ?? []),
                  {step, result: propsPicked},
                ],
              },
              shared: {...value.shared, ...propsShared},
            } as UpdateInternal;
          } else {
            yield value;
          }
        }
      }
    };
};

const map = (step: string, op: (value: UpdateState) => UpdateYield | void) =>
  expand(step, function* (value: UpdateState): Generator<UpdateYield | void> {
    yield op(value);
  });

const passthrough = map("passthrough", () => {});

const provide = <S extends keyof UpdateState>(
  key: S,
  op: (value: UpdateState) => UpdateState[S],
) => map(`provide_${key}`, (value) => ({[key]: op(value)}));

const provideShared = <S extends keyof UpdateShared>(
  key: S,
  op: (value: UpdateState) => UpdateShared[S],
) => map(`provide_shared_${key}`, (value) => ({shared: {[key]: op(value)}}));

const provideStatements = (
  step: string,
  op: (
    value: UpdateState,
  ) =>
    | [UpdateState["statements"] | undefined, string | Reason | ReasonFactory]
    | void,
) =>
  map(`provide_statements_${step}`, (value) => {
    const result = op(value);
    if (result) {
      const [statements, reason] = result;
      return {
        statements,
        reason: {
          step: `provide_statements_${step}`,
          ...handleReasonable(reason, value),
        },
      };
    }
  });

const provideReason = (
  step: string,
  op: (value: UpdateState) => string | Reason | ReasonFactory | void,
) =>
  map(`reason_${step}`, (value) => {
    const reason = op(value);
    if (reason) {
      return {
        reason: {step: `reason_${step}`, ...handleReasonable(reason, value)},
      };
    }
  });

const skip = (
  step: string,
  condition: (value: UpdateState) => string | Reason | ReasonFactory | void,
) => provideReason(`skip_${step}`, condition);

const skipPathMismatch = (pathFilter: Minimatch | string) => {
  if (
    typeof pathFilter === "object" &&
    pathFilter !== null &&
    pathFilter.constructor === Minimatch
  ) {
    return skip("pathMatchesPattern", ({path}) => {
      if (!pathFilter.match(path)) {
        return reason(({path}) => `${path} does not match path pattern`, {
          quiet: true,
        });
      }
    });
  } else if (pathFilter) {
    return skip("pathMatchesPrefix", ({path}) => {
      if (path !== pathFilter && !path.startsWith(`${pathFilter}.`)) {
        return reason(({path}) => `${path} does not match path prefix`, {
          quiet: true,
        });
      }
    });
  }
  return passthrough;
};

const skipBrowserMismatch = (browserFilter: BrowserName[]) =>
  browserFilter?.length
    ? skip("browserMatchesFilter", ({browser}) => {
        if (!browserFilter.includes(browser)) {
          return reason(
            ({browser, path}) =>
              `${path} skipped for ${browser} does not match browser filter`,
            {
              quiet: true,
            },
          );
        }
      })
    : passthrough;

const skipReleaseMismatch = (releaseFilter: string | false) => {
  if (releaseFilter || releaseFilter === false) {
    const releaseFilterMatch =
      releaseFilter && releaseFilter.match(/([\d.]+)-([\d.]+)/);
    if (releaseFilterMatch) {
      return skip("release", ({inferredStatements: [inferredStatement]}) => {
        if (typeof inferredStatement.version_added !== "string") {
          return reason(
            ({browser, path}) =>
              `${path} skipped for ${browser} due to non string inferred version`,
            {quiet: true},
          );
        }
        const inferredAdded = inferredStatement.version_added.replace(
          /(([\d.]+)> )?≤/,
          "",
        );
        if (
          compareVersions(inferredAdded, releaseFilterMatch[1], "<") ||
          compareVersions(inferredAdded, releaseFilterMatch[2], ">")
        ) {
          return reason(
            ({browser, path}) =>
              `${path} skipped for ${browser} due to inferred added outside release range`,
            {quiet: true},
          );
        }
        if (typeof inferredStatement.version_removed === "string") {
          const inferredRemoved = inferredStatement.version_removed.replace(
            /(([\d.]+)> )?≤/,
            "",
          );
          if (
            compareVersions(inferredRemoved, releaseFilterMatch[1], "<") ||
            compareVersions(inferredRemoved, releaseFilterMatch[2], ">")
          ) {
            return reason(
              ({browser, path}) =>
                `${path} skipped for ${browser} due to inferred removed outside release range`,
              {quiet: true},
            );
          }
        }
      });
    }
    return skip("inferredReleaseNotEqualFilter", ({
      inferredStatements: [inferredStatement],
    }) => {
      if (releaseFilter !== inferredStatement.version_added) {
        return reason(
          ({browser, path}) =>
            `${path} skipped for ${browser} inferred added version does not exactly match release filter`,
          {quiet: true},
        );
      } else if (
        inferredStatement.version_removed &&
        releaseFilter !== inferredStatement.version_removed
      ) {
        return reason(
          ({browser, path}) =>
            `${path} skipped for ${browser} inferred removed version does not exactly match release filter`,
          {quiet: true},
        );
      }
    });
  }
  return passthrough;
};

const clearNonExact = (exactOnly: boolean) =>
  exactOnly
    ? provideStatements("exactOnly", ({statements}) => {
        if (
          statements.every(
            (statement) =>
              (typeof statement.version_added === "string" &&
                statement.version_added.includes("≤")) ||
              (typeof statement.version_removed === "string" &&
                statement.version_removed.includes("≤")),
          )
        ) {
          return [
            // Overwrite the current statements
            undefined,
            reason(
              ({path, browser}) =>
                `${path} skipped for ${browser} because exact only filter is set`,
            ),
          ];
        }
      })
    : passthrough;

const persistNonDefault = provideStatements(
  "nonDefault",
  ({
    inferredStatements: [inferredStatement],
    allStatements,
    defaultStatements,
  }) => {
    if (defaultStatements.length === 0) {
      return [
        [
          inferredStatement,
          ...allStatements.filter((statement) => !("flags" in statement)),
        ],
        reason(
          ({path, browser}) =>
            `${path} applied for ${browser} because there is no default statement`,
          {skip: true},
        ),
      ];
    }
  },
);

const skipCurrentBeforeSupport = skip("currentBeforeSupport", ({
  shared: {versionMap},
  defaultStatements: [simpleStatement],
  inferredStatements: [inferredStatement],
}) => {
  if (
    inferredStatement.version_added === false &&
    typeof simpleStatement.version_added === "string"
  ) {
    const latestNonNullVersion = Array.from(versionMap.entries())
      .filter(([, result]) => result !== null)
      .reduceRight(
        (latest, [version]) =>
          !latest || compareVersions(version, latest, ">") ? version : latest,
        "",
      );
    if (
      simpleStatement.version_added === "preview" ||
      compareVersions(
        latestNonNullVersion,
        simpleStatement.version_added.replace("≤", ""),
        "<",
      )
    ) {
      return reason(
        ({path, browser}) =>
          `${path} skipped for ${browser}; BCD says support was added in a version newer than there are results for`,
      );
    }
  }
});

const persistInferredRange = provideStatements(
  "inferredRange",
  ({
    inferredStatements: [inferredStatement],
    defaultStatements: [simpleStatement],
    allStatements,
  }) => {
    if (
      typeof simpleStatement.version_added === "string" &&
      typeof inferredStatement.version_added === "string" &&
      inferredStatement.version_added.includes("≤")
    ) {
      const {lower, upper} = splitRange(inferredStatement.version_added);
      const simpleAdded = simpleStatement.version_added.replace("≤", "");
      if (
        simpleStatement.version_added === "preview" ||
        compareVersions(simpleAdded, lower, "<=") ||
        compareVersions(simpleAdded, upper, ">")
      ) {
        simpleStatement.version_added = inferredStatement.version_added;
        return [
          allStatements,
          reason(
            ({browser, path}) =>
              `${path} applied for ${browser} inferred range in place of preview, lower version than range or higher version than range`,
            {skip: false},
          ),
        ];
      }
    }
  },
);

const persistAddedOverPartial = provideStatements(
  "addedOverPartial",
  ({
    defaultStatements: [simpleStatement],
    inferredStatements: [inferredStatement],
  }) => {
    if (
      !(
        typeof simpleStatement.version_added === "string" &&
        typeof inferredStatement.version_added === "string" &&
        inferredStatement.version_added.includes("≤")
      ) &&
      !(
        typeof simpleStatement.version_added === "string" &&
        inferredStatement.version_added === true
      ) &&
      simpleStatement.version_added !== inferredStatement.version_added
    ) {
      // When a "mirrored" statement will be replaced with a statement
      // documenting lack of support, notes describing partial implementation
      // status are no longer relevant.
      if (
        !inferredStatement.version_added &&
        simpleStatement.partial_implementation
      ) {
        return [
          [{version_added: false}],
          reason(
            ({browser, path}) =>
              `${path} applied for ${browser} with false in place of partial implementation`,
            {skip: false},
          ),
        ];
      }
    }
  },
);

const persistAddedOver = provideStatements(
  "addedOver",
  ({
    defaultStatements: [simpleStatement],
    inferredStatements: [inferredStatement],
    allStatements,
  }) => {
    if (
      !(
        typeof simpleStatement.version_added === "string" &&
        typeof inferredStatement.version_added === "string" &&
        inferredStatement.version_added.includes("≤")
      ) &&
      !(
        typeof simpleStatement.version_added === "string" &&
        inferredStatement.version_added === true
      ) &&
      simpleStatement.version_added !== inferredStatement.version_added &&
      !(
        !inferredStatement.version_added &&
        simpleStatement.partial_implementation
      )
    ) {
      // Positive test results do not conclusively indicate that a partial
      // implementation has been completed.
      if (!simpleStatement.partial_implementation) {
        simpleStatement.version_added = inferredStatement.version_added;
        return [
          allStatements,
          reason(
            ({browser, path}) =>
              `${path} applied for ${browser} inferred ${inferredStatement.version_added} in place of not partial implementation`,
            {skip: false},
          ),
        ];
      }
    }
  },
);

const persistRemoved = provideStatements(
  "removed",
  ({
    inferredStatements: [inferredStatement],
    defaultStatements: [simpleStatement],
    allStatements,
  }) => {
    if (typeof inferredStatement.version_removed === "string") {
      simpleStatement.version_removed = inferredStatement.version_removed;
      return [
        allStatements,
        reason(
          ({browser, path}) =>
            `${path} applied for ${browser} replacing removed with ${inferredStatement.version_removed}`,
          {skip: false},
        ),
      ];
    }
  },
);

const provideAllStatements = provide(
  "allStatements",
  ({browser, shared: {unmodifiedSupport, support}}) => {
    const allStatements =
      (support[browser] as InternalSupportStatement) === "mirror"
        ? mirror(browser, unmodifiedSupport)
        : // Although non-mirrored support data could be modified in-place,
          // working with a cloned version forces the subsequent code to
          // explicitly assign it back to the originating data structure.
          // This reduces the likelihood of inconsistencies in the handling
          // of mirrored and non-mirrored support data.
          clone(support[browser] || null);

    if (!allStatements) {
      return [];
    } else if (!Array.isArray(allStatements)) {
      return [allStatements];
    }
    return allStatements;
  },
);

const provideDefaultStatements = provide(
  "defaultStatements",
  ({allStatements}) => {
    // Filter to the statements representing the feature being enabled by
    // default under the default name and no flags.
    return allStatements.filter((statement) => {
      if ("flags" in statement) {
        return false;
      }
      if ("prefix" in statement || "alternative_name" in statement) {
        // TODO: map the results for aliases to these statements.
        return false;
      }
      return true;
    });
  },
);

const pickLog = <T extends UpdateLog>({
  allStatements,
  browser,
  defaultStatements,
  inferredStatements,
  path,
  reason,
  statements,
}: T): UpdateLog => {
  return {
    allStatements,
    browser,
    defaultStatements,
    inferredStatements,
    path,
    reason,
    statements,
  };
};

export const walkEntries = function* (
  prefix: string,
  entry: Identifier,
): Generator<[string, Identifier]> {
  for (const key in entry) {
    if (key === "__compat") {
      yield [prefix.slice(0, -1), entry];
    } else if (typeof entry[key] === "object") {
      yield* walkEntries(`${prefix}${key}.`, entry[key]);
    }
  }
};

export const update = (
  bcd: Identifier,
  supportMatrix: SupportMatrix,
  options: any,
): boolean => {
  const changes: UpdateLog[] = [];
  for (const state of compose(
    expand("entry", function* () {
      for (const [path, entry] of walkEntries("", bcd)) {
        yield {path, shared: {bcd, entry}};
      }
    }),
    skipPathMismatch(options.path),
    provideShared("browserMap", ({path, shared: {browserMap}}) => {
      return supportMatrix.get(path) ?? browserMap;
    }),
    skip("noBrowserMap", ({shared: {browserMap}}) => {
      if (!browserMap) {
        return reason(
          ({path}) => `${path} skipped due to no results in reports`,
          {quiet: true},
        );
      }
    }),
    provideShared(
      "support",
      ({shared: {entry, support}}) => entry.__compat?.support ?? support,
    ),
    provideShared("unmodifiedSupport", ({shared: {support}}) => clone(support)),
    expand("browser", function* ({shared: {browserMap}}) {
      for (const [browser, versionMap] of browserMap.entries()) {
        yield {browser, shared: {versionMap}};
      }
    }),
    skipBrowserMismatch(options.browser),
    provide("inferredStatements", ({shared: {versionMap}}) =>
      inferSupportStatements(versionMap),
    ),
    skip("tooManyInferredStatements", ({inferredStatements}) => {
      if (inferredStatements.length !== 1) {
        return reason(
          ({path, browser}) =>
            `${path} skipped for ${browser} due to multiple inferred statements`,
        );
      }
    }),
    skipReleaseMismatch(options.release),
    provideAllStatements,
    provideDefaultStatements,
    skip("zeroDefaultStatements", ({
      inferredStatements: [inferredStatement],
      defaultStatements,
    }) => {
      if (
        defaultStatements.length === 0 &&
        inferredStatement.version_added === false
      ) {
        return reason(
          ({browser, path}) =>
            `${path} skipped for ${browser} has no default statement or inferred statement`,
          {quiet: true},
        );
      }
    }),
    persistNonDefault,
    skip("tooManyDefaultStatements", ({defaultStatements}) => {
      if (defaultStatements.length !== 1) {
        return reason(
          ({path, browser}) =>
            `${path} skipped for ${browser} due to multiple default statements`,
        );
      }
    }),
    skip("defaultRemoved", ({defaultStatements: [simpleStatement]}) => {
      if (simpleStatement.version_removed) {
        return reason(
          ({path, browser}) =>
            `${path} skipped for ${browser} due to added+removed statement`,
        );
      }
    }),
    skipCurrentBeforeSupport,
    persistInferredRange,
    persistAddedOverPartial,
    persistAddedOver,
    persistRemoved,
    clearNonExact(options.exactOnly),
    skip("noStatement", ({statements}) => {
      if (!statements?.length) {
        return reason(
          ({browser, path}) =>
            `${path} skipped for ${browser}: no reason identified`,
          {
            quiet: true,
          },
        );
      }
    }),
  )()) {
    changes.push(pickLog(state));
    if (state.statements) {
      state.shared.support[state.browser] =
        state.statements.length === 1 ? state.statements[0] : state.statements;
    }
    if (state.reason && !state.reason.quiet) {
      logger.warn(state.reason.message);
    }
  }
  // TODO: Serialize changes to a file
  return changes.some(({statements}) => Boolean(statements));
};

// |paths| can be files or directories. Returns an object mapping
// from (absolute) path to the parsed file content.
/* c8 ignore start */
export const loadJsonFiles = async (
  paths: string[],
): Promise<{[filename: string]: any}> => {
  const jsonCrawler = new fdir()
    .withFullPaths()
    .filter((item) => {
      // Ignores .DS_Store, .git, etc.
      const basename = path.basename(item);
      return basename === "." || basename[0] !== ".";
    })
    .filter((item) => item.endsWith(".json"));

  const jsonFiles: string[] = [];

  for (const p of paths) {
    for (const item of await jsonCrawler.crawl(p).withPromise()) {
      jsonFiles.push(item);
    }
  }

  const entries = await Promise.all(
    jsonFiles.map(async (file) => {
      const data = await fs.readJson(file);
      return [file, data];
    }),
  );

  return Object.fromEntries(entries);
};

export const main = async (
  reportPaths: string[],
  filter: any,
  browsers: Browsers,
  overrides: Overrides,
): Promise<void> => {
  // Replace filter.path with a minimatch object.
  if (filter.path && filter.path.includes("*")) {
    filter.path = new Minimatch(filter.path);
  }

  if (filter.release === "false") {
    filter.release = false;
  }

  const bcdFiles = (await loadJsonFiles(
    filter.addNewFeatures
      ? [path.join(BCD_DIR, "__missing")]
      : [
          "api",
          "browsers",
          "css",
          "html",
          "http",
          "javascript",
          "mathml",
          "svg",
          "webassembly",
          "webdriver",
          "webextensions",
        ].map((cat) => path.join(BCD_DIR, ...cat.split("."))),
  )) as {[key: string]: Identifier};

  const reports = Object.values(await loadJsonFiles(reportPaths)) as Report[];
  const supportMatrix = getSupportMatrix(
    reports,
    browsers,
    overrides.filter(Array.isArray as (item: unknown) => item is OverrideTuple),
  );

  // Should match https://github.com/mdn/browser-compat-data/blob/f10bf2cc7d1b001a390e70b7854cab9435ffb443/test/linter/test-style.js#L63
  // TODO: https://github.com/mdn/browser-compat-data/issues/3617
  for (const [file, data] of Object.entries(bcdFiles)) {
    const modified = update(data, supportMatrix, filter);
    if (!modified) {
      continue;
    }
    logger.info(`Updating ${path.relative(BCD_DIR, file)}`);
    const json = JSON.stringify(data, null, "  ") + "\n";
    await fs.writeFile(file, json);
  }
};

if (esMain(import.meta)) {
  const {
    default: {browsers},
  } = await import(`${BCD_DIR}/index.js`);
  const overrides = await fs.readJson(
    new URL("../custom/overrides.json", import.meta.url),
  );

  const {argv}: {argv: any} = yargs(hideBin(process.argv)).command(
    "$0 [reports..]",
    "Update BCD from a specified set of report files",
    (yargs) => {
      yargs
        .positional("reports", {
          describe: "The report files to update from (also accepts folders)",
          type: "string",
          array: true,
          default: ["../mdn-bcd-results/"],
        })
        .option("path", {
          alias: "p",
          describe:
            'The BCD path to update (includes children, ex. "api.Document" will also update "api.Document.body")',
          type: "string",
          default: null,
        })
        .option("browser", {
          alias: "b",
          describe: "The browser to update",
          type: "array",
          choices: Object.keys(browsers),
          default: [],
        })
        .option("release", {
          alias: "r",
          describe:
            "Only update when version_added or version_removed is set to the given value (can be an inclusive range, ex. xx-yy, or `false` for changes that set no support)",
          type: "string",
          default: null,
        })
        .option("exact-only", {
          alias: "e",
          describe:
            'Only update when versions are a specific number (or "false"), disallowing ranges',
          type: "boolean",
          default: false,
        });
    },
  );

  await main(argv.reports, argv, browsers, overrides);
}
/* c8 ignore stop */
