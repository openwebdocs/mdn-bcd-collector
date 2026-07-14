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
    summary: {
      key_count: bcdData.all.all.length,
      covered_keys_count: bcdData.all.found.length,
      uncovered_keys_ratio: (
        bcdData.all.found.length / bcdData.all.all.length
      ).toFixed(4),
      untestable_keys_count: bcdData.untestable.all.length,
      testable_uncovered_keys_count: bcdData.testable.missing.length,
      testable_uncovered_keys_ratio: (
        bcdData.testable.found.length / bcdData.testable.all.length
      ).toFixed(4),
    },
    lists: {
      all_keys: bcdData.all.all,
      covered_keys: bcdData.all.found,
      untestable_keys: bcdData.untestable.all,
      testable_uncovered_keys: bcdData.testable.missing,
    },
  },
  collector: {
    version: appVersion,
    summary: {
      early_keys_not_in_bcd: collectorData.testable.missing.length,
    },
    lists: {
      early_keys_not_in_bcd: collectorData.testable.missing,
    },
  },
};

export {coverageData};
