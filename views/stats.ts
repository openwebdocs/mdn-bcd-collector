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
      all_keys_count: bcdData.all.all.length,

      covered_keys_count: bcdData.all.found.length,
      covered_keys_ratio: +(
        bcdData.all.found.length / bcdData.all.all.length
      ).toFixed(4),

      not_covered_keys_count: bcdData.all.missing.length,
      not_covered_keys_ratio: +(
        bcdData.all.missing.length / bcdData.all.all.length
      ).toFixed(4),

      testable_keys_count: bcdData.testable.all.length,
      testable_keys_ratio: +(
        bcdData.testable.all.length / bcdData.all.all.length
      ).toFixed(4),

      not_testable_keys_count: bcdData.untestable.all.length,
      not_testable_keys_ratio: +(
        bcdData.untestable.all.length / bcdData.all.all.length
      ).toFixed(4),

      testable_covered_keys_count: bcdData.testable.found.length,
      testable_covered_keys_ratio: +(
        bcdData.testable.found.length / bcdData.testable.all.length
      ).toFixed(4),

      testable_not_covered_keys_count: bcdData.testable.missing.length,
      testable_not_covered_keys_ratio: +(
        bcdData.testable.missing.length / bcdData.testable.all.length
      ).toFixed(4),
    },
    lists: {
      all_keys: bcdData.all.all,
      covered_keys: bcdData.all.found,
      not_testable_keys: bcdData.untestable.all,
      testable_not_covered_keys: bcdData.testable.missing,
    },
  },
  collector: {
    version: appVersion,
    summary: {
      all_keys_count: collectorData.all.all.length,

      keys_not_in_bcd_count: collectorData.testable.missing.length,
      keys_not_in_bcd_ratio: +(
        collectorData.testable.missing.length /
        collectorData.testable.all.length
      ).toFixed(4),
    },
    lists: {
      keys_not_in_bcd: collectorData.testable.missing,
    },
  },
};

export {coverageData};
