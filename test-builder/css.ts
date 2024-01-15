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
const remapCSSPropertyValue = (input) => {
  const typeRemappings = {
    "<string>": ["type_string", "'foo'"],
    "<string>+": ["type_multi_string", "'foo' 'bar'"],
    "<url>": ["type_url", "url('https://mdn-bcd-collector.gooborg.com')"],
    "<uri>": ["type_url", "url('https://mdn-bcd-collector.gooborg.com')"],
    "<image>": ["type_image", "url('https://mdn-bcd-collector.gooborg.com')"],
    "<color>": ["type_color", "red"],
    "<angle>": ["type_angle", "90deg"],
    "<length>": ["type_length", "4em"],
    "<length [0,∞]>": ["type_length", "4em"],
    "<percentage>": ["type_percentage", "80%"],
    "<percentage [0,∞]>": ["type_percentage", "80%"],
    "<length-percentage>": ["type_length_or_percentage", ["4em", "80%"]],
    "<length-percentage [0,∞]>": ["type_length_or_percentage", ["4em", "80%"]],
    "<flex>": ["type_flex", "2fr"],
    "<flex [0,∞]>": ["type_flex", "2fr"],
    "<time>": ["type_time", "10s"],
    "<time [0s,∞]>": ["type_time", "10s"],
    "<number>": ["type_number", "5"],
    "<number [0,∞]>": ["type_number", "5"],
    "<number [1,∞]>": ["type_number", "5"],
    "<number [1,1000]>": ["type_number", "5"],
    "<integer>": ["type_number", "5"],
    "<integer [1,∞]>": ["type_number", "5"],
    "<dashed-ident>": ["type_dashed-ident", "--foo"],
    "<dashed-ident>#": ["type_dashed-ident", "--foo"],
    "<ratio>": ["type_ratio", "16 / 9"],
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
    "<resolution>": ["type_resolution", "144dpi"],
    "<position>": ["type_position", "left"],
    "<basic-shape>": ["type_basic_shape", "rect(10px 20px 30px 40px)"],
    "<basic-shape-rect>": ["type_basic_shape", "rect(10px 20px 30px 40px)"],
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
    "<ray()>": ["type_ray", "ray(45deg closest-side)"],
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
    "<frequency>": ["type_frequency", "100Hz"],
    "<decibel>": ["type_decibel", "12dB"],
  };

  if (input.name in typeRemappings || input.name.includes("<")) {
    // Skip any and all types for now until we're ready to add them
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

  return (
    typeRemappings[input.name] || [
      input.name.replace(/ /g, "_").replace("()", ""),
      input.value,
    ]
  );
};

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
          .map(remapCSSPropertyValue)
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
