import fs from "fs-extra";
import bcd from "@mdn/browser-compat-data" with {type: "json"};
import {getMissing} from "../lib/coverage.js";
import appVersion from "../lib/app-version.js";

const testsPath = new URL("../tests.json", import.meta.url);
if (!fs.existsSync(testsPath)) {
  throw new Error(
    "The tests must be built using `npm run build:tests` before this script can be run.",
  );
}
const tests = await fs.readJson(testsPath);

const bcdData = getMissing(bcd, tests)[""];
const collectorData = getMissing(bcd, tests, "bcd-from-collector")[""];

const coverageData = {
  bcd: {
    version: bcd.__meta.version,
    counts: {
      all: bcdData.all.all.length,
      covered: bcdData.all.found.length,
      uncovered_percentage: (
        (bcdData.all.found.length / bcdData.all.all.length) *
        100.0
      ).toFixed(2),
      untestable: bcdData.untestable.all.length,
      testable_uncovered: bcdData.testable.missing.length,
      testable_uncovered_percentage: (
        (bcdData.testable.found.length / bcdData.testable.all.length) *
        100.0
      ).toFixed(2),
    },
    lists: {
      all: bcdData.all.all,
      covered: bcdData.all.found,
      untestable: bcdData.untestable.all,
      testable_uncovered: bcdData.testable.missing,
    },
  },
  collector: {
    version: appVersion,
    counts: {
      early_features_not_in_bcd: collectorData.testable.missing.length,
    },
    lists: {
      early_features_not_in_bcd: collectorData.testable.missing,
    },
  },
};

export {coverageData};
