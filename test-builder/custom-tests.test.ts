import fs from "fs-extra";
import * as YAML from "yaml";
import {describe, it} from "node:test";
import assert from "node:assert/strict";

const trailingZeroDisplayValues = ["auto", "stripIfInteger"];

describe("custom tests", () => {
  it("uses valid trailingZeroDisplay values", async () => {
    const customTests = YAML.parse(
      await fs.readFile(
        new URL("../custom/tests.yaml", import.meta.url),
        "utf8",
      ),
    );

    const tests = [
      [
        "Intl.NumberFormat",
        customTests.javascript.builtins.Intl.NumberFormat.NumberFormat,
      ],
      [
        "Intl.PluralRules",
        customTests.javascript.builtins.Intl.PluralRules.PluralRules,
      ],
    ];

    for (const [name, test] of tests) {
      const code =
        test.__additional[
          "options_parameter.options_trailingZeroDisplay_parameter"
        ];
      const value = code.match(/'trailingZeroDisplay', '([^']+)'/)?.[1];

      assert.ok(
        value && trailingZeroDisplayValues.includes(value),
        `${name} uses an invalid trailingZeroDisplay value`,
      );
    }
  });
});
