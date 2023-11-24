//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

const build = async (specCSS, customCSS) => {
  const properties = new Map();
  const selectors = new Map();

  for (const data of Object.values(specCSS) as any[]) {
    if (data.spec.url == "https://compat.spec.whatwg.org/") {
      // The Compatibility Standard contains legacy prefixed aliases for properties, ignore
      continue;
    }

    for (const prop of data.properties) {
      if (["-webkit-appearance", "-webkit-user-select"].includes(prop.name)) {
        // CSS Basic User Interface Module Level 4 defines prefixed aliases for two properties, ignore them
        continue;
      }
      properties.set(prop.name, new Map());
    }

    for (const selector of data.selectors) {
      selectors.set(selector.name, new Map());
    }
  }

  for (const [name, data] of Object.entries(customCSS.properties) as any[]) {
    const values = "__values" in data ? data["__values"] : [];
    const additionalValues =
      "__additional_values" in data ? data["__additional_values"] : {};

    const mergedValues = new Map(Object.entries(additionalValues));
    for (const value of values) {
      if (mergedValues.has(value)) {
        throw new Error(`CSS property value already known: ${value}`);
      }
      mergedValues.set(value, value);
    }

    if (properties.has(name) && mergedValues.size === 0) {
      throw new Error(`Custom CSS property already known: ${name}`);
    }

    properties.set(name, mergedValues);
  }

  const tests = {};

  for (const name of Array.from(properties.keys()).sort()) {
    const ident = `css.properties.${name}`;
    const customTest = await getCustomTest(ident, "css.properties", true);

    // Test for the property itself
    tests[ident] = compileTest({
      raw: {code: customTest.test || `bcd.testCSSProperty("${name}")`},
      exposure: ["Window"],
    });

    // Tests for values
    for (const [key, value] of Array.from(
      properties.get(name).entries(),
    ).sort() as any[]) {
      const valueIdent = `${ident}.${key}`;
      const customValueTest = await getCustomTest(
        valueIdent,
        "css.properties",
        true,
      );
      const values = Array.isArray(value) ? value : [value];
      const code = values
        .map((value) => `bcd.testCSSProperty("${name}", "${value}")`)
        .join(" && ");
      tests[valueIdent] = compileTest({
        raw: {code: customValueTest.test || code},
        exposure: ["Window"],
      });
    }

    // Add the additional tests
    for (const [key, code] of Object.entries(customTest.additional)) {
      tests[`${ident}.${key}`] = compileTest({
        raw: {code: code},
        exposure: ["Window"],
      });
    }
  }

  for (const name of Array.from(selectors.keys()).sort()) {
    const bcdName = name
      .replaceAll(":", "")
      .replace("()", "")
      .replace("+", "next-sibling")
      .replace("~", "subsequent-sibling")
      .replace(">", "child")
      .replace("&", "nesting")
      .replace("||", "column");

    const ident = `css.selectors.${bcdName}`;
    const customTest = await getCustomTest(ident, "css.selectors", true);

    tests[ident] = compileTest({
      raw: {code: customTest.test || `bcd.testCSSSelector("${name}")`},
      exposure: ["Window"],
    });
  }

  return tests;
};

export {build};
