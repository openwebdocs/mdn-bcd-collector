import {describe, it} from "node:test";
import assert from "node:assert/strict";

import fs from "fs-extra";

import {Report} from "../types/types.js";

import {getStats} from "./report-stats.js";

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

    assert.equal(stats.version, "1.0.0");
    assert.equal(stats.browser.browser.name, "Chrome");
    assert.equal(stats.testResults.total, 3);
    assert.equal(stats.testResults.supported.length, 1);
    assert.equal(stats.testResults.unsupported.length, 1);
    assert.equal(stats.testResults.unknown.length, 1);
    assert.equal(stats.featuresQueried.length, 3);
  });
});
