//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {definitionSyntax as cssSyntaxParser} from "css-tree";

import {getCustomTest, compileTest} from "./common.js";

const ignoredSpecs = [
  "https://compat.spec.whatwg.org/", // The Compatibility Standard contains legacy prefixed aliases for properties, ignore
  "https://drafts.csswg.org/css-values-4/", // The CSS Values and Units Module just defines primitive types
];

const ignoredColorNames = [
  "AccentColor",
  "AccentColorText",
  "ActiveText",
  "ButtonBorder",
  "ButtonFace",
  "ButtonText",
  "Canvas",
  "CanvasText",
  "Field",
  "FieldText",
  "GrayText",
  "Highlight",
  "HighlightText",
  "LinkText",
  "Mark",
  "MarkText",
  "SelectedItem",
  "SelectedItemText",
  "VisitedText",
  "ActiveBorder",
  "ActiveCaption",
  "AppWorkspace",
  "Background",
  "ButtonHighlight",
  "ButtonShadow",
  "CaptionText",
  "InactiveBorder",
  "InactiveCaption",
  "InactiveCaptionText",
  "InfoBackground",
  "InfoText",
  "Menu",
  "MenuText",
  "Scrollbar",
  "ThreeDDarkShadow",
  "ThreeDFace",
  "ThreeDHighlight",
  "ThreeDLightShadow",
  "ThreeDShadow",
  "Window",
  "WindowFrame",
  "WindowText",
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
];

/**
 * Parses a CSS syntax string and extracts keyword and type values.
 * @param syntax - The CSS syntax string to parse.
 * @param properties - The properties from the specification
 * @returns A Set of extracted values from the syntax.
 */
const getValuesFromSyntax = (syntax: string, properties) => {
  const ast = cssSyntaxParser.parse(syntax);
  const values = new Set();
  cssSyntaxParser.walk(ast, (node) => {
    if (node.type === "Keyword") {
      values.add(node.name);
    } else if (node.type === "Type") {
      values.add("<" + node.name + ">");
    } else if (node.type === "Property") {
      const prop = properties.find((p) => p.name == node.name);
      const newValues = getValuesFromSyntax(prop?.syntax || "", properties);
      for (const v of newValues) {
        values.add(v);
      }
    }
  });
  return values;
};

/**
 * Recursively resolves values from types, expanding type references.
 * @param values - The values to resolve.
 * @param types - The map of types to their possible values.
 * @returns An array of resolved values.
 */
const resolveValuesFromTypes = (
  values: string[],
  types: Record<string, string[]>,
): string[] => {
  const resolved: string[] = [];

  for (const value of values) {
    if (value.startsWith("<")) {
      const type = value.replace(/^<(.*)>$/, "$1");
      if (type in types) {
        resolved.push(...resolveValuesFromTypes(types[type], types));
      } else {
        resolved.push(value);
      }
    } else {
      resolved.push(value);
    }
  }

  return resolved;
};

/**
 * Get the type data from Webref and flatten enumerated types
 * @param specCSS - The specification CSS data.
 * @returns An object of all types and their values
 */
const getCSSTypes = (specCSS) => {
  // Some types are manually defined to mitigate Webref data issues
  const types = {
    "layout-box": new Set(["<visual-box>", "margin-box"]),
    "paint-box": new Set(["<layout-box>", "fill-box", "stroke-box"]),
    "coord-box": new Set(["<paint-box>", "view-box"]),
    "counter-style": new Set(["<counter-style-name>"]),
    "outline-line-style": new Set(["auto", "<line-style>"]),
  };

  // Get the type data from the spec
  for (const val of Object.values(specCSS.types) as any[]) {
    if (ignoredSpecs.some((u) => val.href.startsWith(u))) {
      continue;
    }

    if (!(val.name in types)) {
      // Sets are used to automatically de-duplicate entries
      types[val.name] = new Set();
    }

    if ("syntax" in val) {
      for (const value of getValuesFromSyntax(val.syntax, specCSS.properties)) {
        types[val.name].add(value);
      }
    }
  }

  for (const [type, values] of Object.entries(types) as any[]) {
    // Check for values that reference other types
    for (const value of values) {
      if (Object.keys(types).some((t) => t === `<${value}>`)) {
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
 * @returns A two-value array to add to a map, or null if no test should be created for the value
 */
const remapPropertyValues = (input, types) => {
  if (!input) {
    return [];
  }

  const values = new Map();

  for (const val of resolveValuesFromTypes(input, types)) {
    if (
      [
        "inherit",
        "initial",
        "revert",
        "revert-layer",
        "unset",
        ...ignoredColorNames,
      ].includes(val)
    ) {
      // Skip generic property values
      continue;
    }

    if (val.includes("<")) {
      // Skip any and all types for now until we're ready to add them
      continue;
    }

    values.set(val.replace(/ /g, "_").replace("()", "_function"), val);
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

  for (const prop of specCSS.properties) {
    if (ignoredSpecs.some((u) => prop.href.startsWith(u))) {
      continue;
    }

    if (
      [
        "-webkit-appearance",
        "-webkit-user-select",
        "-webkit-line-clamp",
        "grid-gap",
        "grid-column-gap",
        "grid-row-gap",
        "word-wrap",
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
      transform: [
        "matrix",
        "translate",
        "translateX",
        "translateY",
        "rotate",
        "skew",
        "skewX",
        "skewY",
      ],
    };

    const valuesFromSyntax = getValuesFromSyntax(
      prop.syntax || "",
      specCSS.properties,
    );
    const propertyValues = remapPropertyValues(
      Array.from(valuesFromSyntax).filter(
        (v) => !(ignoredValues[prop.name] || []).includes(v),
      ),
      types,
      // customCSS,
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

  for (const selector of specCSS.selectors) {
    if (ignoredSpecs.some((u) => selector.href.startsWith(u))) {
      continue;
    }

    if ([":matches()"].includes(selector.name)) {
      // Ignore legacy aliases
      continue;
    }

    selectors.set(selector.name, {});
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
 * Builds tests for CSS at-rules based on the provided customCSS.
 * @param customCSS - The custom CSS data.
 * @returns - The tests for CSS at-rules.
 */
const buildAtRuleTests = async (customCSS) => {
  const tests = {};

  for (const [atRule, atRuleData] of Object.entries(
    customCSS["at-rules"] || {},
  ) as any[]) {
    for (const [feature] of Object.entries(atRuleData) as any[]) {
      const ident = `css.at-rules.${atRule}.${feature}`;
      const customTest = await getCustomTest(ident, "css.at-rules", true);

      if (customTest.test) {
        tests[ident] = compileTest({
          raw: {
            code: customTest.test,
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
  Object.assign(tests, await buildAtRuleTests(customCSS));

  return tests;
};

export {build};
