import {describe, it, beforeEach} from "node:test";
import assert from "node:assert/strict";

import fs from "fs-extra";

import bcd from "../unittest/bcd.test.js";

import {traverseFeatures, getMissing} from "../lib/coverage.js";

const tests = await fs.readJson(
  new URL("../unittest/tests.test.json", import.meta.url),
);

let mockedLog: any;

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
    beforeEach((t) => {
      mockedLog = t.mock.method(console, "log", () => {});
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
      assert.equal(mockedLog.mock.callCount(), 0);
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

      assert.deepEqual(mockedLog.mock.calls[0].arguments, [
        "Direction 'foo-from-bar' is unknown; defaulting to collector <- bcd",
      ]);
    });
  });
});
