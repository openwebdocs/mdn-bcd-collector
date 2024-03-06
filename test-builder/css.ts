//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

const ignoredSpecs = [
  "https://compat.spec.whatwg.org/", // The Compatibility Standard contains legacy prefixed aliases for properties, ignore
  "https://drafts.csswg.org/css-values-4/", // The CSS Values and Units Module just defines primitive types
];

/**
 * Get the type data from Webref and flatten enumerated types
 * @param specCSS - The specification CSS data.
 * @returns An object of all types and their values
 */
const getCSSTypes = (specCSS) => {
  // Some types are manually defined to mitigate Webref data issues
  const types = {
    "<layout-box>": new Set(["<visual-box>", "margin-box"]),
    "<paint-box>": new Set(["<layout-box>", "fill-box", "stroke-box"]),
    "<coord-box>": new Set(["<paint-box>", "view-box"]),
    "<counter-style>": new Set(["<counter-style-name>"]),
    "<outline-line-style>": new Set(["auto", "<line-style>"]),
    "<offset-path> || <coord-box>": new Set(["<offset-path>", "<coord-box>"]),
    "<track-list> | <auto-track-list>": new Set([
      "<track-list>",
      "<auto-track-list>",
    ]),
  };

  // Get the type data from the spec
  for (const data of Object.values(specCSS) as any[]) {
    if (ignoredSpecs.includes(data.spec.url)) {
      continue;
    }

    for (const val of data.values) {
      if (!(val.name in types)) {
        // Sets are used to automatically de-duplicate entries
        types[val.name] = new Set();
      }

      for (const value of val.values || []) {
        switch (value.type) {
          case "function":
            // Ignore functions for now
            break;
          case "value":
            types[val.name].add(value.value);
            break;
          case "type":
            if (value.values) {
              types[val.name].add(
                ...value.values
                  .filter((v) => v.type === "value")
                  .map((v) => v.value),
              );
            } else if (value.value?.includes(" | ")) {
              for (const v of value.value.split(" | ")) {
                types[val.name].add(v);
              }
            } else {
              types[val.name].add(value.value);
            }
            break;
          default:
            throw new Error(`Unknown value type ${value.type} found!`);
        }
      }
    }
  }

  for (const [type, values] of Object.entries(types) as any[]) {
    // Check for values that reference other types
    for (const value of values) {
      if (value in types) {
        types[type].delete(value);
        for (const v of types[value]) {
          types[type].add(v);
        }
      }
    }

    // Remap sets to arrays
    types[type] = [...types[type]];
  }

  return types;
};

/**
 * Remap the CSS property values from Webref into usable map entries
 * @param input - The value from Webref
 * @param types - The types from webref
 * @param customCSS - The custom CSS data to draw type information from
 * @returns A two-value array to add to a map, or null if no test should be created for the value
 */
const remapPropertyValues = (input, types, customCSS) => {
  if (!input) {
    return [];
  }

  const values = new Map();

  for (const val of input) {
    if (val.name in types) {
      for (const v of types[val.name]) {
        if (val.name.includes("<")) {
          // Skip any unflattened types
          continue;
        }
        values.set(v, v);
      }
    } else {
      // XXX Remove me once all these have been transferred to custom/css.json
      const typeRemappings = {
        "<string>+": ["type_multi_string", "'foo' 'bar'"],
        "auto && <ratio>": ["type_auto_and_ratio", "auto 16/9"],
      };

      if (val.name.includes("<")) {
        // Skip any and all types for now until we're ready to add them
        continue;

        if (
          ["inherit", "initial", "revert", "revert-layer", "unset"].includes(
            val.name,
          )
        ) {
          // Skip generic property values
          continue;
        }

        if (val.name in typeRemappings) {
          values.set(typeRemappings[val.name][0], typeRemappings[val.name][1]);
          continue;
        }

        for (const [type, typedata] of Object.entries(
          customCSS.types,
        ) as any[]) {
          if (
            Array.isArray(typedata.syntax)
              ? typedata.syntax.includes(val.name)
              : val.name === typedata.syntax
          ) {
            values.set("type_" + type, typedata.value);
            continue;
          }
        }

        console.warn(`Type ${val.name} unknown!`);
        continue;
      }

      values.set(
        val.name
          .replace(/ /g, "_")
          .replace("fit-content()", "fit-content_function")
          .replace("()", ""),
        val.value,
      );
    }
  }

  return values;
};

/**
 * Builds tests for CSS properties based on the provided specCSS and customCSS.
 * @param specCSS - The specification CSS data.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS properties.
 */
const buildPropertyTests = async (specCSS, customCSS) => {
  const properties = new Map();
  const tests = {};

  const types = getCSSTypes(specCSS);

  for (const data of Object.values(specCSS) as any[]) {
    if (ignoredSpecs.includes(data.spec.url)) {
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

      const additionalPropTypeValues = {
        display: [
          "<display-outside>",
          "<display-inside>",
          "<display-listitem>",
          "<display-internal>",
          "<display-box>",
          "<display-legacy>",
        ],
        "border-style": ["<line-style>"],
        "outline-style": ["<outline-line-style>"],
      };

      // XXX Webref does not include these types, so we have to add them ourselves
      // We don't have capabilities to parse types in custom/css.json
      if (prop.name in additionalPropTypeValues) {
        if (!prop.values) {
          prop.values = [];
        }
        prop.values.push(
          ...additionalPropTypeValues[prop.name].map((n) => ({
            name: n,
            value: n,
            type: "type",
          })),
        );
      }

      const ignoredValues = {
        "font-size-adjust": [
          "ex-height | cap-height | ch-width | ic-width | ic-height",
        ],
        "text-justify": ["distribute"],
        "text-orientation": ["sideways-right"],
        overflow: ["overlay"],
        "overflow-x": ["overlay"],
        "overflow-y": ["overlay"],
      };

      const propertyValues = remapPropertyValues(
        prop.values?.filter(
          (v) => !(ignoredValues[prop] || []).includes(v.name),
        ),
        types,
        customCSS,
      );

      if (properties.has(prop.name)) {
        properties.set(
          prop.name,
          new Map([...properties.get(prop.name), ...propertyValues]),
        );
      } else {
        properties.set(prop.name, new Map(propertyValues));
      }
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
        if (knownValues.has(value) && values.includes(value)) {
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

  for (const name of Array.from(properties.keys()).sort()) {
    const ident = `css.properties.${name}`;
    const customTest = await getCustomTest(ident, "css.properties", true);

    // Test for the property itself
    tests[ident] = compileTest({
      raw: {code: customTest.test || `bcd.testCSSProperty("${name}")`},
      exposure: ["Window"],
    });

    // Tests for values
    for (const [key, value] of properties.get(name).entries() as any[]) {
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

  return tests;
};

/**
 * Builds tests for CSS selectors based on the provided specCSS and customCSS.
 * @param specCSS - The specification CSS data.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS selectors.
 */
const buildSelectorTests = async (specCSS, customCSS) => {
  const selectors = new Map();
  const tests = {};

  for (const data of Object.values(specCSS) as any[]) {
    if (data.spec.url == "https://compat.spec.whatwg.org/") {
      // The Compatibility Standard contains legacy prefixed aliases for properties, ignore
      continue;
    }

    for (const selector of data.selectors) {
      selectors.set(selector.name, {});
    }
  }

  for (const [name, value] of Object.entries(customCSS.selectors) as any[]) {
    if (selectors.has(name)) {
      throw new Error(`Custom CSS selector already known: ${name}`);
    }
    selectors.set(name, value);
  }

  for (const [selector, selectorData] of selectors.entries()) {
    const bcdName = selector
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
        code:
          customTest.test ||
          `bcd.testCSSSelector("${selectorData.syntax || selector}")`,
      },
      exposure: ["Window"],
    });
  }

  return tests;
};

/**
 * Builds tests for CSS types based on the provided customCSS.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS types.
 */
const buildTypeTests = async (customCSS) => {
  const tests = {};

  for (const [type, typeData] of Object.entries(customCSS.types) as any[]) {
    const ident = `css.types.${type}`;
    const customTest = await getCustomTest(ident, "css.types", true);

    if (customTest.test || (typeData.property && typeData.value)) {
      tests[ident] = compileTest({
        raw: {
          code:
            customTest.test ||
            `bcd.testCSSProperty("${typeData.property}", "${typeData.value}")`,
        },
        exposure: ["Window"],
      });
    }

    for (const [valueName, value] of Object.entries(
      typeData.additionalValues || {},
    ) as any[]) {
      const valueIdent = `css.types.${type}.${valueName}`;
      const customValueTest = await getCustomTest(
        valueIdent,
        "css.types",
        true,
      );

      if (customValueTest.test || (typeData.property && value)) {
        tests[valueIdent] = compileTest({
          raw: {
            code:
              customValueTest.test ||
              `bcd.testCSSProperty("${typeData.property}", "${value}")`,
          },
          exposure: ["Window"],
        });
      }
    }
  }

  return tests;
};

/**
 * Builds tests for CSS features based on the provided specCSS and customCSS.
 * @param specCSS - The specification CSS data.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS features.
 */
const build = async (specCSS, customCSS) => {
  const tests = {};

  Object.assign(tests, await buildPropertyTests(specCSS, customCSS));
  Object.assign(tests, await buildSelectorTests(specCSS, customCSS));
  Object.assign(tests, await buildTypeTests(customCSS));

  return tests;
};

export {build};
