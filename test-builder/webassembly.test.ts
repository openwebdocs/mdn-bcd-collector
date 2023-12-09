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
    /**
     * Represents the features of WebAssembly.
     */
    const wasmFeatures = {
      /**
       * Test whether the WebAssembly garbage collection feature is enabled.
       */
      gc: () => {},
      /**
       * Test whether the WebAssembly 64-bit memory feature is enabled.
       */
      memory64: () => {},
    };

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
