//
// mdn-bcd-collector: scripts/report-stats.test.ts
// Unittest for the script to print statistics about a reports file
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {expect} from "chai";
import {Report} from "../types/types.js";
import {getStats} from "./report-stats.js";
import fs from "fs-extra";

describe("getStats", () => {
  it("should return correct stats from report.test.json", async () => {
    const report: Report = await fs.readJson(
      new URL("../unittest/report.test.json", import.meta.url),
      "utf-8",
    );
    const featureQuery = [
      "javascript.builtins.Array.at",
      "javascript.builtins.String.includes",
      "javascript.builtins.Math.random",
    ];
    const stats = getStats(report, featureQuery);

    expect(stats.version).to.equal("1.0.0");
    expect(stats.browser.browser.name).to.equal("Chrome");
    expect(stats.testResults.total).to.equal(3);
    expect(stats.testResults.supported.length).to.equal(1);
    expect(stats.testResults.unsupported.length).to.equal(1);
    expect(stats.testResults.unknown.length).to.equal(1);
    expect(stats.featuresQueried.length).to.equal(3);
  });
});
