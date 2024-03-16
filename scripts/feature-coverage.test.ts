//
// mdn-bcd-collector: unittest/scripts/feature-coverage.test.ts
// Unittest for the feature coverage report script
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import {assert} from "chai";
import sinon from "sinon";
import fs from "fs-extra";

import bcd from "../unittest/bcd.test.js";

import {traverseFeatures, getMissing} from "./feature-coverage.js";

const tests = await fs.readJson(
  new URL("../unittest/tests.test.json", import.meta.url),
);

describe("find-missing-features", () => {
  describe("traverseFeatures", () => {
    it("normal", () => {
      assert.deepEqual(traverseFeatures(bcd, ""), [
        "api.AbortController",
        "api.AbortController.AbortController",
        "api.AbortController.abort",
        "api.AbortController.dummy",
        "api.AbortController.signal",
        "api.AudioContext",
        "api.AudioContext.close",
        "api.DeprecatedInterface",
        "api.DummyAPI",
        "api.DummyAPI.dummy",
        "api.ExperimentalInterface",
        "api.UnflaggedInterface",
        "api.UnprefixedInterface",
        "api.NullAPI",
        "api.RemovedInterface",
        "api.SuperNewInterface",
        "css.properties.font-family",
        "css.properties.font-face",
        "css.properties.font-style",
        "javascript.builtins.Array",
        "javascript.builtins.Date",
      ]);
    });

    it("include aliases", () => {
      assert.deepEqual(traverseFeatures(bcd, "", true), [
        "api.AbortController",
        "api.AbortController.AbortController",
        "api.AbortController.abort",
        "api.AbortController.dummy",
        "api.AbortController.signal",
        "api.AudioContext",
        "api.webkitAudioContext",
        "api.AudioContext.close",
        "api.DeprecatedInterface",
        "api.DummyAPI",
        "api.DummyAPI.dummy",
        "api.ExperimentalInterface",
        "api.TryingOutInterface",
        "api.UnflaggedInterface",
        "api.UnprefixedInterface",
        "api.webkitUnprefixedInterface",
        "api.NullAPI",
        "api.RemovedInterface",
        "api.SuperNewInterface",
        "css.properties.font-family",
        "css.properties.font-face",
        "css.properties.font-style",
        "javascript.builtins.Array",
        "javascript.builtins.Date",
      ]);
    });
  });

  describe("getMissing", () => {
    beforeEach(() => {
      sinon.stub(console, "log");
    });

    it("collector <- bcd", () => {
      const expected = {
        "": {
          all: {
            missing: [
              "api.AbortController.AbortController",
              "api.AbortController.abort",
              "api.AbortController.dummy",
              "api.AudioContext",
              "api.AudioContext.close",
              "api.DeprecatedInterface",
              "api.DummyAPI",
              "api.DummyAPI.dummy",
              "api.ExperimentalInterface",
              "api.UnflaggedInterface",
              "api.UnprefixedInterface",
              "api.NullAPI",
              "api.RemovedInterface",
              "api.SuperNewInterface",
              "css.properties.font-face",
              "css.properties.font-style",
              "javascript.builtins.Date",
            ],
            found: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
            ],
            all: [
              "api.AbortController",
              "api.AbortController.AbortController",
              "api.AbortController.abort",
              "api.AbortController.dummy",
              "api.AbortController.signal",
              "api.AudioContext",
              "api.AudioContext.close",
              "api.DeprecatedInterface",
              "api.DummyAPI",
              "api.DummyAPI.dummy",
              "api.ExperimentalInterface",
              "api.UnflaggedInterface",
              "api.UnprefixedInterface",
              "api.NullAPI",
              "api.RemovedInterface",
              "api.SuperNewInterface",
              "css.properties.font-family",
              "css.properties.font-face",
              "css.properties.font-style",
              "javascript.builtins.Array",
              "javascript.builtins.Date",
            ],
          },
          testable: {
            missing: [
              "api.AbortController.AbortController",
              "api.AbortController.abort",
              "api.AbortController.dummy",
              "api.AudioContext",
              "api.AudioContext.close",
              "api.DeprecatedInterface",
              "api.DummyAPI",
              "api.DummyAPI.dummy",
              "api.ExperimentalInterface",
              "api.UnflaggedInterface",
              "api.UnprefixedInterface",
              "api.NullAPI",
              "api.RemovedInterface",
              "api.SuperNewInterface",
              "css.properties.font-face",
              "css.properties.font-style",
              "javascript.builtins.Date",
            ],
            found: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
            ],
            all: [
              "api.AbortController",
              "api.AbortController.AbortController",
              "api.AbortController.abort",
              "api.AbortController.dummy",
              "api.AbortController.signal",
              "api.AudioContext",
              "api.AudioContext.close",
              "api.DeprecatedInterface",
              "api.DummyAPI",
              "api.DummyAPI.dummy",
              "api.ExperimentalInterface",
              "api.UnflaggedInterface",
              "api.UnprefixedInterface",
              "api.NullAPI",
              "api.RemovedInterface",
              "api.SuperNewInterface",
              "css.properties.font-family",
              "css.properties.font-face",
              "css.properties.font-style",
              "javascript.builtins.Array",
              "javascript.builtins.Date",
            ],
          },
          untestable: {
            all: [],
            found: [],
            missing: [],
          },
        },
      };

      assert.deepEqual(getMissing(bcd as any, tests), expected);

      assert.isTrue((console.log as any).notCalled);

      // Unknown direction defaults to collector <- bcd
      assert.deepEqual(getMissing(bcd as any, tests, "foo-from-bar"), expected);

      assert.isTrue(
        (console.log as any).calledWith(
          "Direction 'foo-from-bar' is unknown; defaulting to collector <- bcd",
        ),
      );
    });

    it("bcd <- collector", () => {
      assert.deepEqual(getMissing(bcd as any, tests, "bcd-from-collector"), {
        "": {
          all: {
            missing: ["javascript.builtins.Error"],
            found: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
            ],
            all: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
              "javascript.builtins.Error",
            ],
          },
          testable: {
            missing: ["javascript.builtins.Error"],
            found: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
            ],
            all: [
              "api.AbortController",
              "api.AbortController.signal",
              "css.properties.font-family",
              "javascript.builtins.Array",
              "javascript.builtins.Error",
            ],
          },
          untestable: {
            all: [],
            found: [],
            missing: [],
          },
        },
      });
    });

    it("filter category", () => {
      assert.deepEqual(
        getMissing(bcd as any, tests, "collector-from-bcd", ["api"]),
        {
          api: {
            all: {
              missing: [
                "api.AbortController.AbortController",
                "api.AbortController.abort",
                "api.AbortController.dummy",
                "api.AudioContext",
                "api.AudioContext.close",
                "api.DeprecatedInterface",
                "api.DummyAPI",
                "api.DummyAPI.dummy",
                "api.ExperimentalInterface",
                "api.UnflaggedInterface",
                "api.UnprefixedInterface",
                "api.NullAPI",
                "api.RemovedInterface",
                "api.SuperNewInterface",
              ],
              found: ["api.AbortController", "api.AbortController.signal"],
              all: [
                "api.AbortController",
                "api.AbortController.AbortController",
                "api.AbortController.abort",
                "api.AbortController.dummy",
                "api.AbortController.signal",
                "api.AudioContext",
                "api.AudioContext.close",
                "api.DeprecatedInterface",
                "api.DummyAPI",
                "api.DummyAPI.dummy",
                "api.ExperimentalInterface",
                "api.UnflaggedInterface",
                "api.UnprefixedInterface",
                "api.NullAPI",
                "api.RemovedInterface",
                "api.SuperNewInterface",
              ],
            },
            testable: {
              missing: [
                "api.AbortController.AbortController",
                "api.AbortController.abort",
                "api.AbortController.dummy",
                "api.AudioContext",
                "api.AudioContext.close",
                "api.DeprecatedInterface",
                "api.DummyAPI",
                "api.DummyAPI.dummy",
                "api.ExperimentalInterface",
                "api.UnflaggedInterface",
                "api.UnprefixedInterface",
                "api.NullAPI",
                "api.RemovedInterface",
                "api.SuperNewInterface",
              ],
              found: ["api.AbortController", "api.AbortController.signal"],
              all: [
                "api.AbortController",
                "api.AbortController.AbortController",
                "api.AbortController.abort",
                "api.AbortController.dummy",
                "api.AbortController.signal",
                "api.AudioContext",
                "api.AudioContext.close",
                "api.DeprecatedInterface",
                "api.DummyAPI",
                "api.DummyAPI.dummy",
                "api.ExperimentalInterface",
                "api.UnflaggedInterface",
                "api.UnprefixedInterface",
                "api.NullAPI",
                "api.RemovedInterface",
                "api.SuperNewInterface",
              ],
            },
            untestable: {
              all: [],
              found: [],
              missing: [],
            },
          },
        },
      );
    });

    it("unknown direction", () => {
      getMissing(bcd as any, tests, "foo-from-bar");
      assert.isTrue(
        (console.log as any).calledWith(
          "Direction 'foo-from-bar' is unknown; defaulting to collector <- bcd",
        ),
      );
    });

    afterEach(() => {
      (console.log as any).restore();
    });
  });
});
