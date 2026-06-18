import fs from "fs-extra";
import {getBCDDir} from "../lib/constants.js";
const BCD_DIR = getBCDDir();
const {default: bcd} = await import(`${BCD_DIR}/index.js`);
import {getMissing} from "../lib/coverage.js";

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
    total: bcdData.all.all.length,
    covered: bcdData.all.found.length,
    uncoveredPercentage: (
      (bcdData.all.found.length / bcdData.all.all.length) *
      100.0
    ).toFixed(2),
    untestable: bcdData.untestable.all.length,
    testableUncovered: bcdData.testable.missing.length,
    missingList: bcdData.testable.missing,
    percentage: (
      (bcdData.testable.found.length / bcdData.testable.all.length) *
      100.0
    ).toFixed(2),
  },
  collector: {
    total: collectorData.testable.missing.length,
    missingList: collectorData.testable.missing,
  },
};

export {coverageData};
