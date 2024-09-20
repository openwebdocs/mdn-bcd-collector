//
// mdn-bcd-collector: test-builder/common.ts
// Common functions for generating tests, including obtaining custom test data
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import fs from "fs-extra";
import prettier from "prettier";
import * as YAML from "yaml";

import replaceAsync from "../lib/replace-async.js";

import type {Test, RawTest} from "../types/types.js";

/* c8 ignore start */
export const customTests = YAML.parse(
  await fs.readFile(
    new URL(
      process.env.NODE_ENV === "test"
        ? "../unittest/custom-tests.test.yaml"
        : "../custom/tests.yaml",
      import.meta.url,
    ),
    "utf8",
  ),
);
/* c8 ignore stop */

export interface CustomTestData {
  __base: string | false;
  __test: string | false;
  __resources: string[];
  __additional: Record<string, string>;
}

export interface CustomTestResult {
  test: string | false;
  resources: string[];
  additional: Record<string, string>;
}

/**
 * Get the custom test data for a specified feature identifier by recursively searching
 * through the custom test data to calculate the base code (__base) and specific test
 * (__test) for a given member.
 *
 * This will allow all custom tests to have their own base and test code, which will
 * allow for importing any test of any category much easier.
 * @param name - The name of the feature identifier.
 * @param customTestData - The custom test data object (optional).
 * @returns The custom test data object for the specified feature identifier.
 */
const getCustomTestData = (name: string, customTestData: any = customTests) => {
  const result: CustomTestData = {
    __base: false,
    __test: false,
    __resources: [],
    __additional: {},
  };

  const parts = name.split(".");

  const data = customTestData[parts[0]];

  if (!data) {
    // There's no applicable data, and therefore no custom test
    return result;
  }

  if (typeof data === "string") {
    if (parts.length > 1) {
      // We can't search deeper if the test is a simple string, so stop here
      return result;
    }
    result.__test = data;
  } else {
    result.__base = data.__base || false;
    result.__test = data.__test || false;

    if (data.__resources) {
      result.__resources.push(...data.__resources);
    }
    if (data.__additional) {
      result.__additional = data.__additional;
    }
  }

  if (parts.length > 1) {
    // We've still got to look through the data
    const subdata = getCustomTestData(parts.slice(1).join("."), data);

    if (subdata.__base) {
      result.__base =
        (result.__base ? result.__base + "\n" : "") + subdata.__base;
    }

    result.__test = subdata.__test;
    result.__resources.push(...subdata.__resources);
    result.__additional = subdata.__additional;
  }

  return result;
};

/**
 * Generates custom test code based on the provided parameters.
 * @param name - The name of the test.
 * @param category - The category of the test.
 * @param exactMatchNeeded - Indicates whether an exact match is needed.
 * @param data - The custom test data.
 * @returns A promise that resolves to an object containing the generated code and resources, or `false` if no custom test is available.
 */
const generateCustomTestCode = async (
  name: string,
  category: string,
  exactMatchNeeded: boolean,
  data: CustomTestData,
): Promise<{code: string; resources: string[]} | false> => {
  let test = data.__test;

  if (!data.__test) {
    if (exactMatchNeeded) {
      // We don't have an exact custom test, so return
      return false;
    }

    if (!data.__base) {
      // If there's no custom test at all, simply return
      return false;
    }

    const promise = data.__base.includes("var promise");
    const callback =
      data.__base.match(/callback([(),])/g) ||
      data.__base.includes(":callback%>");

    const parts = name.replace(`${category}.`, "").split(".");

    if (parts.length > 2) {
      // Grandchildren features must have an exact test match

      // XXX Need to check __additional here
      return false;
    }

    const member =
      parts.length > 1 ? parts[1].replace(/(\w+)_event/, "on$1") : "";

    if (member === parts[0]) {
      // Constructors must have an exact test match
      return false;
    }

    let returnValue = "!!instance";
    if (member) {
      if (member.includes("@@")) {
        // The member is a symbol
        returnValue = `!!instance && ${compileTestCode({
          property: member,
          owner: "instance",
        })}`;
      } else {
        returnValue = `!!instance && "${member}" in instance`;
      }
    }

    test = promise
      ? `if (!promise) {
    return {result: false, message: "Promise variable is falsy"};
  }
  return promise.then(function(instance) {
    return ${returnValue};
  });`
      : callback
        ? `function callback(instance) {
    try {
      success(${returnValue});
    } catch(e) {
      fail(e);
    }
  };
  return "callback";`
        : `return ${returnValue};`;
  }

  return await compileCustomTest((data.__base || "") + test);
};

/**
 * Retrieves the custom test for a specified feature identifier.
 * If exactMatchNeeded is true, a __test must be defined.
 * @param name - The name of the feature identifier.
 * @param category - The category of the feature identifier.
 * @param exactMatchNeeded - Indicates whether an exact match is needed.
 * @returns The custom test result, including the test code, additional tests, and resources.
 */
const getCustomTest = async (
  name: string,
  category: string,
  exactMatchNeeded = false,
) => {
  // Get the custom test for a specified feature identifier using getCustomTestData().
  // If exactMatchNeeded is true, a __test must be defined.

  const data = getCustomTestData(name);

  const response: CustomTestResult = {
    test: false,
    resources: [],
    additional: {},
  };

  // Compile the additional tests
  for (const [key, code] of Object.entries(data.__additional)) {
    const additionalTest = await generateCustomTestCode(
      `${name}.${key}`,
      category,
      exactMatchNeeded,
      {...data, __test: code},
    );
    if (!additionalTest) {
      continue;
    }
    response.additional[key] = additionalTest.code;
  }

  const customTest = await generateCustomTestCode(
    name,
    category,
    exactMatchNeeded,
    data,
  );

  if (!customTest) {
    return response;
  }

  response.test = customTest.code;
  response.resources = [...data.__resources, ...customTest.resources];

  // Check for bad resources
  for (const key of response.resources) {
    if (!Object.keys(customTests.__resources).includes(key)) {
      throw new Error(
        `Resource ${key} is not defined but referenced in ${name}`,
      );
    }
    if (customTests.__resources[key].dependencies) {
      for (const dKey of customTests.__resources[key].dependencies) {
        response.resources.push(dKey);
        if (!Object.keys(customTests.__resources).includes(dKey)) {
          throw new Error(
            `Resource ${dKey} is not defined but referenced in __resources.${key}`,
          );
        }
      }
    }
  }

  return response;
};

/**
 * Compiles custom test code and returns the compiled code along with any resources used.
 * @param code The custom test code to compile.
 * @param format Indicates whether the compiled code should be formatted using Prettier. Default is true.
 * @returns A promise that resolves to an object containing the compiled code and the resources used.
 */
const compileCustomTest = async (
  code: string,
  format = true,
): Promise<{code: string; resources: string[]}> => {
  const resources: string[] = [];
  // Import code from other tests
  code = await replaceAsync(
    code,
    /<%(\w+(?:\.\w+)*):(\w+)%> ?/g,
    async (match, name, instancevar) => {
      const importedTest = getCustomTestData(name);
      if (!importedTest.__base) {
        const errorMsg = `Test is malformed: ${match} is an invalid import reference`;
        console.error(name, errorMsg);
        return `throw '${errorMsg}';`;
      }

      const {code: importedCode, resources: newResources} =
        await compileCustomTest(importedTest.__base, false);
      resources.push(...newResources, ...importedTest.__resources);
      const callback =
        importedCode.match(/callback([(),])/g) ||
        importedCode.includes(":callback%>");

      let response = importedCode
        .replace(/var (instance|promise)/g, `var ${instancevar}`)
        .replace(/callback([(),])/g, `${instancevar}$1`)
        .replace(/promise\.then/g, `${instancevar}.then`)
        .replace(/(instance|promise) = /g, `${instancevar} = `);
      if (!(["instance", "promise"].includes(instancevar) || callback)) {
        response += `\n  if (!${instancevar}) {\n    return {result: false, message: '${instancevar} is falsy'};\n  }`;
      }
      return response;
    },
  );

  if (format) {
    // Wrap in a function
    code = `(function () {\n  ${code}\n})();`;

    try {
      // Use Prettier to format code
      code = await prettier.format(code, {
        parser: "babel",
        trailingComma: "none",
      });
    } catch (e) {
      if (e instanceof SyntaxError) {
        const errorMsg = `Test is malformed: ${e.message}`;
        console.error(errorMsg);
        return {
          code: `(function () {\n  throw "${errorMsg}";\n})();`,
          resources,
        };
      }
      /* c8 ignore next 3 */
      // We should never reach the next line
      throw e;
    }
  }

  return {code, resources};
};

/**
 * Compiles the test code into a string.
 * @param test - The test code to compile.
 * @returns The compiled test code as a string.
 */
const compileTestCode = (test: any): string => {
  if (typeof test === "string") {
    return test;
  }

  if (Array.isArray(test)) {
    const parts = test.map(compileTestCode);
    return parts.join(` && `);
  }

  const property = test.property.replace(/(Symbol\.|@@)/, "");

  if (test.property.startsWith("Symbol.") || test.property.startsWith("@@")) {
    if (test.owner === "instance") {
      return `"Symbol" in self && "${property}" in Symbol && !!(${test.owner}[Symbol.${property}])`;
    }
    return `"Symbol" in self && "${property}" in Symbol && "${test.owner.replace(
      ".prototype",
      "",
    )}" in self && !!(${test.owner}[Symbol.${property}])`;
  }
  if (test.inherit) {
    if (test.owner === "self") {
      return `self.hasOwnProperty("${property}")`;
    }
    return `"${test.owner.replace(
      ".prototype",
      "",
    )}" in self && Object.prototype.hasOwnProperty.call(${
      test.owner
    }, "${property}")`;
  }
  if (
    test.owner === "self" ||
    test.owner === "document.body.style" ||
    test.skipOwnerCheck
  ) {
    return `"${property}" in ${test.owner}`;
  }
  return `"${test.owner.replace(
    ".prototype",
    "",
  )}" in self && "${property}" in ${test.owner}`;
};

/**
 * Compiles a raw test into a Test object.
 * @param test - The raw test to compile.
 * @returns The compiled Test object.
 */
const compileTest = (test: RawTest): Test => {
  let code;
  if (Array.isArray(test.raw.code)) {
    const parts = test.raw.code.map(compileTestCode);
    code = parts.join(` ${test.raw.combinator || "&&"} `);
  } else {
    code = compileTestCode(test.raw.code);
  }

  const {exposure, resources} = test;
  const newTest: Test = {code, exposure};

  if (resources && resources.length) {
    newTest.resources = resources;
  }

  return newTest;
};

export {
  getCustomTestData,
  getCustomTest,
  compileCustomTest,
  compileTestCode,
  compileTest,
};
