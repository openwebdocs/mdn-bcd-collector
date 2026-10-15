import {describe, it} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import fs from "fs-extra";
import * as YAML from "yaml";

const customTests = YAML.parse(
  await fs.readFile(new URL("../custom/tests.yaml", import.meta.url), "utf8"),
);

const mediaTests = customTests.css["at-rules"].media.scan;

describe("custom CSS media tests", () => {
  const cases = [
    {
      name: "progressive active value",
      feature: "progressive",
      activeQuery: "(scan: progressive)",
      expected: true,
    },
    {
      name: "progressive inactive value",
      feature: "progressive",
      activeQuery: "(scan: interlace)",
      expected: true,
    },
    {
      name: "progressive unknown feature",
      feature: "progressive",
      activeQuery: null,
      expected: false,
    },
    {
      name: "interlace active value",
      feature: "interlace",
      activeQuery: "(scan: interlace)",
      expected: true,
    },
    {
      name: "interlace inactive value",
      feature: "interlace",
      activeQuery: "(scan: progressive)",
      expected: true,
    },
    {
      name: "interlace unknown feature",
      feature: "interlace",
      activeQuery: null,
      expected: false,
    },
  ];

  for (const {name, feature, activeQuery, expected} of cases) {
    it(`recognizes ${name}`, () => {
      const query = `(scan: ${feature})`;
      const test = vm.runInNewContext(
        `(function (window) {${mediaTests[feature]}})`,
      );
      const queries = new Map([
        [query, {matches: activeQuery === query}],
        [
          `not ${query}`,
          {matches: activeQuery !== query && activeQuery !== null},
        ],
      ]);
      const result = test({matchMedia: queries.get.bind(queries)});

      assert.strictEqual(result, expected);
    });
  }
});
