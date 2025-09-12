//
// mdn-bcd-collector: test-builder/javascript.ts
// Functions directly related to building all of the JavaScript tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileCustomTest, compileTest} from "./common.js";

import type {RawTestCodeExpr} from "../types/types.js";

export const namespaces = ["Intl", "Temporal"];

/**
 * Strips attribute name by performing various replacements.
 * @param name - The attribute name to be stripped.
 * @param featureName - The feature name used in replacements.
 * @returns - The stripped attribute name.
 */
const stripAttrName = (name, featureName) =>
  name
    .replace(/%(\w+)Prototype%/g, "$1")
    .replace(`%${featureName}%`, featureName)
    .replace(`${featureName}.prototype.`, "")
    .replace(`${featureName}.`, "")
    .replace("()", "")
    .replace(`${featureName}[`, "prototype[")
    .replace(/prototype\[@@(\w+)\]/g, "@@$1")
    .replace(/__(\w+)__/g, "$1");

/**
 * Determines whether an attribute should be ignored based on the feature name and attribute name.
 * @param featureName - The name of the feature.
 * @param attrName - The name of the attribute.
 * @returns True if the attribute should be ignored, false otherwise.
 */
const shouldIgnoreAttr = (featureName: string, attrName: string): boolean => {
  const ignoreList: string[] = [
    "String.prototype.trimLeft()",
    "String.prototype.trimRight()",
  ];

  if (ignoreList.includes(attrName)) {
    return true;
  }

  if (attrName === `${featureName}.prototype`) {
    // Skip the prototype itself
    return true;
  }

  if (attrName.endsWith(".constructor")) {
    // Skip all constructor properties; it can be assumed all objects have this
    return true;
  }

  if (attrName.endsWith("[@@toStringTag]")) {
    // Skip all @@toStringTag Symbols properties; they aren't recorded.
    return true;
  }

  if (attrName.endsWith("BYTES_PER_ELEMENT")) {
    // BYTES_PER_ELEMENT is only documented once on TypedArray; ignore it
    return true;
  }

  if (
    (attrName.endsWith(".message") || attrName.endsWith(".name")) &&
    featureName.endsWith("Error")
  ) {
    // The .message and .name properties are not documented for on Error subclasses
    return true;
  }

  return false;
};

/**
 * Builds a test list based on the provided specJS and customJS data.
 * @param specJS - The spec data.
 * @param customJS - The custom data.
 * @returns - The built test list.
 */
const buildBuiltinsTestList = (specJS, customJS) => {
  const features = {};

  // Iterate through the spec data
  // XXX use proper typedef instead of any[] once the package is used
  for (const feat of specJS.sort((f) => f.name) as any[]) {
    const featureName = feat.name
      .replace("()", "")
      .replace(/%(\w+)Prototype%/g, "$1");

    if (["function", "global-property"].includes(feat.type)) {
      // Functions and global properties will not have members or any other data we need to pull
      features[featureName] = {};
      continue;
    }

    // %TypedArray% is an abstract class and there is no constructor
    if (feat.name === "TypedArray") {
      delete feat.ctor;
    }

    features[featureName] = {members: {static: [], instance: []}};

    // If there is a constructor, determine parameters
    if (feat.type === "class" && feat.ctor) {
      features[featureName].ctor = {
        no_new: feat.ctor.usage === "call",
        optional_args: feat.ctor.parameters.required === 0,
      };
    }

    // Collect static attributes
    const staticAttrs = [
      ...(feat.staticProperties || []),
      ...(feat.staticMethods || []),
    ];

    // Collect instance attributes
    const instanceAttrs = [
      ...(feat.prototypeProperties || []),
      ...(feat.instanceMethods || []),
      ...(feat.instanceProperties || []),
    ];

    // Collect names of all attributes
    for (const attr of [
      ...staticAttrs.map((a) => ({...a, static: true})),
      ...instanceAttrs,
    ]) {
      if (shouldIgnoreAttr(featureName, attr.name)) {
        continue;
      }

      features[featureName].members[attr.static ? "static" : "instance"].push(
        stripAttrName(attr.name, featureName),
      );
    }
  }

  for (const [feat, data] of Object.entries(customJS.builtins) as any[]) {
    if (!(feat in features)) {
      features[feat] = data;
      continue;
    }

    if (data.ctor) {
      if (!("ctor" in features[feat])) {
        features[feat].ctor = data.ctor;
      } else {
        Object.assign(features[feat].ctor, data.ctor);
      }
    }

    if (data.members) {
      features[feat].members.static = [
        ...new Set([
          ...features[feat].members.static,
          ...(data.members.static || []),
        ]),
      ];

      features[feat].members.instance = [
        ...new Set([
          ...features[feat].members.instance,
          ...(data.members.instance || []),
        ]),
      ];
    }
  }

  return features;
};

/**
 * Gets the category for a given path.
 * @param pathParts - An array of path parts.
 * @returns The category for the given path.
 */
const getCategory = (pathParts: string[]) => {
  let category = "javascript.builtins";
  const isInSubcategory =
    pathParts.length > 1 && namespaces.includes(pathParts[0]);

  if (isInSubcategory) {
    category += "." + pathParts[0];
  }

  return category;
};

/**
 * Builds a test for a given path in the JavaScript BCD data.
 * @param tests - The object to store the compiled tests.
 * @param path - The path to the feature in the BCD data.
 * @param data - Additional data for the test (optional).
 * @param data.static - Indicates if the test is for a static feature (optional).
 * @returns - A Promise that resolves when the test is built.
 */
const buildBuiltinsTest = async (
  tests,
  path: string,
  data: {static?: boolean} = {},
) => {
  const basePath = "javascript.builtins";
  const parts = path.replace(`${basePath}.`, "").split(".");
  const category = getCategory(parts);
  const isInSubcategory = category !== basePath;

  let expr: string | RawTestCodeExpr | (string | RawTestCodeExpr)[] = "";

  // We should be looking for an exact match if we're checking for a subfeature not
  // defined on the object prototype (in other words, static members and functions)
  const exactMatchNeeded =
    path.replace(category, "").split(".").length < 2 || data.static;

  const customTest = await getCustomTest(path, category, exactMatchNeeded);

  if (customTest.test) {
    tests[path] = compileTest({
      raw: {code: customTest.test},
      exposure: ["Window"],
    });
  } else {
    // Get the last part as the property and everything else as the expression
    // we should test for existence in, or "self" if there's just one part.
    let property = parts[parts.length - 1];

    if (property.startsWith("@@")) {
      property = `Symbol.${property.substring(2)}`;
    }

    const owner =
      parts.length > 1
        ? parts.slice(0, parts.length - 1).join(".") +
          (data.static === false ? ".prototype" : "")
        : "self";

    expr = [{property, owner, skipOwnerCheck: isInSubcategory}];

    if (isInSubcategory) {
      if (parts[1] !== property) {
        expr.unshift({property: parts[1], owner: parts[0]});
      } else if (parts[0] !== property) {
        expr.unshift({property: parts[0], owner: "self"});
      }
    }

    tests[path] = compileTest({
      raw: {code: expr},
      exposure: ["Window"],
    });
  }

  // Add the additional tests
  for (const [key, code] of Object.entries(customTest.additional)) {
    tests[`${path}.${key}`] = compileTest({
      raw: {code: code},
      exposure: ["Window"],
    });
  }
};

/**
 * Builds constructor tests for a given path.
 * @param tests - The tests object to store the compiled tests.
 * @param path - The path to the constructor.
 * @param data - Additional data for the tests (optional).
 * @returns - A promise that resolves when the tests are built.
 */
const buildConstructorTests = async (tests, path: string, data: any = {}) => {
  const parts = path.split(".");
  const category = getCategory(parts);
  const iface = parts.slice(2, parts.length - 1).join(".");

  const customTest = await getCustomTest(path, category, true);

  let baseCode = "";

  baseCode += `if (!("${parts[2]}" in self)) {
    return {result: false, message: '${parts[2]} is not defined'};
  }
  `;

  if (namespaces.includes(parts[2])) {
    baseCode += `if (!("${parts[3]}" in ${parts[2]})) {
    return {result: false, message: '${parts[2]}.${parts[3]} is not defined'};
  }
  `;
  }

  if (customTest.test) {
    tests[path] = compileTest({
      raw: {code: customTest.test},
      exposure: ["Window"],
    });
  } else {
    tests[path] = compileTest({
      raw: {
        code: (
          await compileCustomTest(
            baseCode +
              `return bcd.testConstructor("${iface}", ${!!data.no_new})`,
          )
        ).code,
      },
      exposure: ["Window"],
    });
  }

  if (data.optional_args) {
    const relevantCtors = [
      "Float32Array",
      "Float64Array",
      "Int16Array",
      "Int32Array",
      "Int8Array",
      "TypedArray",
      "Uint16Array",
      "Uint32Array",
      "Uint8Array",
      "Uint8ClampedArray",
    ];
    if (relevantCtors.includes(iface)) {
      tests[`${path}.constructor_without_parameters`] = compileTest({
        raw: {
          code: (
            await compileCustomTest(
              baseCode +
                `try {
            new ${iface}();
            return true;
          } catch(e) {
            return {result: false, message: e.message};
          }`,
            )
          ).code,
        },
        exposure: ["Window"],
      });
    }
  }

  // Add the additional tests
  for (const [key, code] of Object.entries(customTest.additional)) {
    tests[`${path}.${key}`] = compileTest({
      raw: {code: code},
      exposure: ["Window"],
    });
  }
};

/**
 * Builds the tests for JavaScript builtins
 * @param specJS - The JavaScript features scraped from spec
 * @param customJS - Custom JavaScript features
 * @returns - The JavaScript builtins tests
 */
const buildBuiltins = async (specJS, customJS) => {
  const tests = {};

  const features = buildBuiltinsTestList(specJS, customJS);

  for (const [featureName, featureData] of Object.entries(features) as any[]) {
    const bcdPath = ["javascript", "builtins", featureName].join(".");
    await buildBuiltinsTest(tests, bcdPath);

    if (featureData.ctor) {
      const pathParts = bcdPath.split(".");
      await buildConstructorTests(
        tests,
        `${bcdPath}.${pathParts[pathParts.length - 1]}`,
        featureData.ctor,
      );
    }

    if (featureData.members) {
      for (const sm of featureData.members.static || []) {
        await buildBuiltinsTest(tests, `${bcdPath}.${sm}`, {static: true});
      }

      for (const im of featureData.members.instance || []) {
        await buildBuiltinsTest(tests, `${bcdPath}.${im}`, {static: false});
      }
    }
  }

  return tests;
};

/**
 * Builds the tests for JavaScript syntax-based features
 * @param customJS - Custom JavaScript features
 * @returns - The JavaScript syntax-based features tests
 */
const buildSyntax = async (customJS) => {
  const tests = {};

  for (const subcategory of [
    "classes",
    "functions",
    "grammar",
    "operators",
    "regular_expressions",
    "statements",
  ]) {
    for (const [name, code] of Object.entries(customJS[subcategory]) as any[]) {
      const category = `javascript.${subcategory}`;
      const path = `${category}.${name}`;

      const customTest = await getCustomTest(path, category, true);

      tests[name === "__base" ? category : path] = compileTest({
        raw: {
          code:
            customTest.test ||
            `(function() {
  try {
    ${code.replaceAll("\n", "\n    ")}${code.endsWith(";") || code.endsWith("}") || code.endsWith("*/") ? "" : ";"}
    return true;
  } catch(e) {
    return {result: false, message: e.message};
  }
})();`,
        },
        exposure: ["Window"],
      });
    }
  }

  return tests;
};

/**
 * Builds all of the JavaScript tests.
 * @param specJS - The JavaScript features scraped from spec
 * @param customJS - Custom JavaScript features
 * @returns - The JavaScript tests
 */
const build = async (specJS, customJS) => {
  return {
    ...(await buildBuiltins(specJS, customJS)),
    ...(await buildSyntax(customJS)),
  };
};

export {build};
