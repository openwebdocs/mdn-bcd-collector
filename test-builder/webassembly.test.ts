//
// mdn-bcd-collector: test-builder/webassembly.test.ts
// Unittest for the Webassembly-specific test builder functions
//
// © Open Web Docs
// See the LICENSE file for copyright details
//

import chai, {assert} from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);

import {build} from "./webassembly.js";

describe("build (WebAssembly)", () => {
  it("build", async () => {
    const wasmFeatures = {gc: () => {}, memory64: () => {}};

    assert.deepEqual(await build(wasmFeatures), {
      "webassembly.garbage-collection": {
        code: "bcd.testWasmFeature('gc')",
        exposure: ["WebAssembly"],
      },
      "webassembly.memory64": {
        code: "bcd.testWasmFeature('memory64')",
        exposure: ["WebAssembly"],
      },
    });
  });
});
