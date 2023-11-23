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

const buildTestList = (specJS, customJS) => {
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
      const prototypeString = `${featureName}.prototype`;
      if (attr.name === prototypeString) {
        // Skip the prototype itself
        continue;
      }

      if (
        feat.name === "Atomics" &&
        ["WaiterRecord", "WaiterListRecords"].includes(attr.name)
      ) {
        // The spec defines WaiterRecord/WaiterListRecords as if they were members of Atomics
        continue;
      }

      if (attr.name.endsWith(".constructor")) {
        // Skip all constructor properties; it can be assumed all objects have this
        continue;
      }

      if (attr.name.endsWith("[@@toStringTag]")) {
        // Skip all @@toStringTag Symbols properties; they aren't recorded.
        continue;
      }
      
      if (attr.name.endsWith("BYTES_PER_ELEMENT")) {
        // BYTES_PER_ELEMENT is only documented once on TypedArray; ignore it
        continue;
      }

      if (
        (attr.name.endsWith(".message") || attr.name.endsWith(".name")) &&
        feat.name.endsWith("Error")
      ) {
        // The .message and .name properties are not documented for on Error subclasses
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

const getCategory = (pathParts: string[]) => {
  let category = "javascript.builtins";
  const isInSubcategory =
    pathParts.length > 1 && namespaces.includes(pathParts[0]);

  if (isInSubcategory) {
    category += "." + pathParts[0];
  }

  return category;
};

const buildTest = async (
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
      property = `Symbol.${property.substr(2)}`;
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

  if (!data.no_new) {
    tests[`${path}.new_required`] = compileTest({
      raw: {
        code: (
          await compileCustomTest(
            baseCode + `return bcd.testConstructorNewRequired("${iface}")`,
          )
        ).code,
      },
      exposure: ["Window"],
    });
  }

  if (data.optional_args) {
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

  // Add the additional tests
  for (const [key, code] of Object.entries(customTest.additional)) {
    tests[`${path}.${key}`] = compileTest({
      raw: {code: code},
      exposure: ["Window"],
    });
  }
};

const build = async (specJS, customJS) => {
  const tests = {};

  const features = buildTestList(specJS, customJS);

  for (const [featureName, featureData] of Object.entries(features) as any[]) {
    const bcdPath = ["javascript", "builtins", featureName].join(".");
    await buildTest(tests, bcdPath);

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
        await buildTest(tests, `${bcdPath}.${sm}`, {static: true});
      }

      for (const im of featureData.members.instance || []) {
        await buildTest(tests, `${bcdPath}.${im}`, {static: false});
      }
    }
  }

  return tests;
};

export {build};
