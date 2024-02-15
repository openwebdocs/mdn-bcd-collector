//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

/**
 * Remap the CSS property values from Webref into usable map entries
 * @param input - The value from Webref
 * @returns A two-value array to add to a map, or null if no test should be created for the value
 */
const remapCSSPropertyValue = (input, customCSS) => {
  // XXX Remove me once all these have been transferred to custom/css.json
  const typeRemappings = {
    "<string>+": ["type_multi_string", "'foo' 'bar'"],
    "auto && <ratio>": ["type_auto_and_ratio", "auto 16/9"],
    "<absolute-size>": [
      "type_absolute_size",
      [
        "xx-small",
        "x-small",
        "small",
        "medium",
        "large",
        "x-large",
        "xx-large",
      ],
    ],
    "<relative-size>": ["type_relative_size", ["larger", "smaller"]],
    "<visual-box>": [
      "type_visual_box",
      ["content-box", "padding-box", "border-box"],
    ],
    "<layout-box>": [
      "type_layout_box",
      ["content-box", "padding-box", "border-box", "margin-box"],
    ],
    "<paint-box>": [
      "type_paint_box",
      [
        "content-box",
        "padding-box",
        "border-box",
        "margin-box",
        "fill-box",
        "stroke-box",
      ],
    ],
    "<coord-box>": [
      "type_coord_box",
      [
        "content-box",
        "padding-box",
        "border-box",
        "margin-box",
        "fill-box",
        "stroke-box",
        "view-box",
      ],
    ],
    "<autospace>": ["type_autospace", "insert"],
    "<spacing-trim>": [
      "type_spacing-trim",
      [
        "space-all",
        "normal",
        "trim-auto",
        "trim-start",
        "space-first",
        "trim-all",
      ],
    ],
  };

  if (input.name.includes("<")) {
    // Skip any and all types for now until we're ready to add them
    return null;

    if (input.name in typeRemappings) {
      return typeRemappings[input.name];
    }

    for (const [type, typedata] of Object.entries(customCSS.types)) {
      if (
        Array.isArray(typedata.syntax)
          ? typedata.syntax.includes(input.name)
          : input.name === typedata.syntax
      ) {
        return ["type_" + type, typedata.value];
      }
    }

    console.warn(`Type ${input.name} unknown!`);
    return null;
  }

  if (
    ["inherit", "initial", "revert", "revert-layer", "unset"].includes(
      input.name,
    )
  ) {
    // Skip generic property values
    return null;
  }

  return [input.name.replace(/ /g, "_").replace("()", ""), input.value];
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

      const ignoredProps = [
        "<custom-ident>",
        "<bottom>",
        "<left>",
        "<right>",
        "<top>",
        "<content-list>",
        "<inset-area-span>",
        "<keyframes-name>",
        "<feature-tag-value>",
        "<counter-style>",
        "/ [ <string> | <counter> ]+",
        "/ [ <string> | <counter> | <attr()> ]+",
        "<inset-area-span> [ / <inset-area-span> ]?",
        "<offset-path> || <coord-box>",
        "ex-height | cap-height | ch-width | ic-width | ic-height",
        "<track-list> | <auto-track-list>",
        "<family-name>",
        "<semitones>",
        "<'flex-basis'>",
        "<'flex-grow'>",
        "<'flex-shrink'>",
        "oblique <angle [-90deg,90deg]>?",
        "<'grid-template-rows'> / [ auto-flow && dense? ] <'grid-auto-columns'>?",
        "[ auto-flow && dense? ] <'grid-auto-rows'>? / <'grid-template-columns'>",
        "<'grid-template-rows'> / <'grid-template-columns'>",
        "[ <line-names>? <string> <track-size>? <line-names>? ]+ [ / <explicit-track-list> ]?",
        "subgrid <line-name-list>?",
        "<integer [1,∞]> <block-ellipsis>?'",
        "<timeline-range-name> <length-percentage>?",
        "1st <length>",
        "2nd <length>",
      ];

      const propertyValues =
        prop.values
          ?.filter((v) => v.type === "value")
          .filter((v) => !ignoredProps.includes(v.name))
          .map((v) => remapCSSPropertyValue(v, customCSS))
          .filter((v) => !!v) || [];
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
 * Builds tests for CSS types based on the provided  customCSS.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS types.
 */
const buildTypeTests = async (customCSS) => {
  const tests = {};

  for (const [type, typeData] of Object.entries(customCSS.types) as any[]) {
    const ident = `css.types.${type}`;
    const customTest = await getCustomTest(ident, "css.types", true);

    if (!(customTest.test || (typeData.property && typeData.value))) {
      const errorMsg = `CSS type ${type} does not have both a property and value to test set!`;
      console.warn(errorMsg);
      tests[ident] = compileTest({
        raw: {
          code: `throw new Error("${errorMsg}");`,
        },
        exposure: ["Window"],
      });
    } else {
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

      if (!(customValueTest.test || (typeData.property && value))) {
        const errorMsg = `CSS type ${type} (${valueName} value) does not have both a property and value to test set!`;
        console.warn(errorMsg);
        tests[valueIdent] = compileTest({
          raw: {
            code: `throw new Error("${errorMsg}");`,
          },
          exposure: ["Window"],
        });
        continue;
      }

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
