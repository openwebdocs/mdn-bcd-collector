//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

/**
 * Builds tests for CSS properties and selectors based on the provided specCSS and customCSS.
 * @param specCSS - The specification CSS data.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS properties and selectors.
 */
const build = async (specCSS, customCSS) => {
  const properties = new Map();
  const selectors = new Map();

  for (const data of Object.values(specCSS) as any[]) {
    if (data.spec.url == "https://compat.spec.whatwg.org/") {
      // The Compatibility Standard contains legacy prefixed aliases for properties, ignore
      continue;
    }

    for (const prop of data.properties) {
      if (
        [
          "-webkit-appearance",
          "-webkit-user-select",
          "grid-gap",
          "grid-column-gap",
          "grid-row-gap",
        ].includes(prop.name)
      ) {
        // Ignore any aliases defined in specs
        continue;
      }

      properties.set(
        prop.name,
        new Map(prop.values?.map((v) => [v.name, v.value])),
      );
    }

    for (const selector of data.selectors) {
      selectors.set(selector.name, new Map());
    }
  }

  for (const [name, data] of Object.entries(customCSS.properties) as any[]) {
    const values = "__values" in data ? data["__values"] : [];
    const additionalValues =
      "__additional_values" in data ? data["__additional_values"] : {};

    const customValues = new Map(Object.entries(additionalValues));
    for (const value of values) {
      if (customValues.has(value)) {
        throw new Error(
          `CSS property value is double-defined in custom CSS: ${name}.${value}`,
        );
      }
      customValues.set(value, value);
    }

    if (properties.has(name)) {
      if (customValues.size === 0) {
        throw new Error(`Custom CSS property already known: ${name}`);
      }

      const knownValues = properties.get(name);
      for (const value of customValues.keys()) {
        if (knownValues.has(value) && value in values) {
          throw new Error(
            `Custom CSS property value already known: ${name}.${value}`,
          );
        }

        knownValues.set(value, customValues.get(value));
      }
    } else {
      properties.set(name, customValues);
    }
  }

  for (const [name] of Object.entries(customCSS.selectors) as any[]) {
    if (selectors.has(name)) {
      throw new Error(`Custom CSS selector already known: ${name}`);
    }
    selectors.set(name, new Map());
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

  for (const selectorSyntax of Array.from(selectors.keys()).sort()) {
    const bcdName = selectorSyntax
      .replaceAll(":", "")
      .replaceAll("()", "")
      .replaceAll("+", "next-sibling")
      .replaceAll("~", "subsequent-sibling")
      .replaceAll(">", "child")
      .replaceAll("&", "nesting")
      .replaceAll("||", "column");

    const ident = `css.selectors.${bcdName}`;
    const customTest = await getCustomTest(ident, "css.selectors", true);

    tests[ident] = compileTest({
      raw: {
        code: customTest.test || `bcd.testCSSSelector("${selectorSyntax}")`,
      },
      exposure: ["Window"],
    });
  }

  return tests;
};

export {build};
