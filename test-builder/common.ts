//
// mdn-bcd-collector: test-builder/common.ts
// Common functions for generating tests, including obtaining custom test data
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import fs from 'fs-extra';
import prettier from 'prettier';
import * as YAML from 'yaml';

import type {
  Test,
  RawTest,
  RawTestCodeExpr,
  Exposure,
  Resources,
  IDLFiles
} from '../types/types.js';

/* c8 ignore start */
export const customTests = YAML.parse(
  await fs.readFile(
    new URL(
      process.env.NODE_ENV === 'test'
        ? '../unittest/sample/custom-tests.test.yaml'
        : '../custom/tests.yaml',
      import.meta.url
    ),
    'utf8'
  )
);
/* c8 ignore stop */

const getCustomTestData = (name: string, customTestData: any = customTests) => {
  // Get the custom test data for a specified feature identifier by recursively searching
  // through the custom test data to calculate the base code (__base) and specific test
  // (__test) for a given member.
  //
  // This will allow all custom tests to have their own base and test code, which will
  // allow for importing any test of any category much easier.
  //
  // For example, given the following custom-tests YAML:
  //
  // api:
  //   FooBar:
  //     __base: 'hello world';
  //     __test: return 'hello world!';
  //     foo: return 'hi, world!';
  //     bar:
  //       __base: 'goodbye world';
  //       __test: return 'farewell world!';
  //
  // api.FooBar would return: {__base: "'hello world';", __test: "return 'hello world!';"}
  // api.FooBar.foo would return: {__base: "'hello world';", __test: "return 'hi, world!';"}
  // api.FooBar.foo.pear would return {__base: "'hello world';", __test: false}
  // api.FooBar.bar would return: {__base: "'hello world';\n'goodbye world';", __test: "return 'farewell world!';"}
  // api.FooBar.baz would return: {__base: "'hello world';", __test: false}
  // api.FooBar.bar.cinnamon would return: {__base: "'hello world';\n'goodbye world';", __test: false}
  // api.Chocolate would return: {__base: false, __test: false}
  //

  const result: {
    __base: string | false;
    __test: string | false;
    __resources: string[];
  } = {
    __base: false,
    __test: false,
    __resources: []
  };

  const parts = name.split('.');

  const data = customTestData[parts[0]];
  if (!data) {
    // There's no applicable data, and therefore no custom test
    return result;
  }

  if (typeof data === 'string') {
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
  }

  if (parts.length > 1) {
    // We've still got to look through the data
    const subdata = getCustomTestData(parts.slice(1).join('.'), data);

    if (subdata.__base) {
      result.__base =
        (result.__base ? result.__base + '\n' : '') + subdata.__base;
    }

    result.__test = subdata.__test;
    result.__resources.push(...subdata.__resources);
  }

  return result;
};

const getCustomTest = (name: string, exactMatchNeeded = false) => {
  // Get the custom test for a specified feature identifier using getCustomTestData().
  // If exactMatchNeeded is true, a __test must be defined.

  const data = getCustomTestData(name);

  const response: {test: string | false; resources: Resources} = {
    test: false,
    resources: {}
  };

  if (!(data.__base || data.__test)) {
    // If there's no custom test, simply return
    return response;
  }

  if (!data.__test) {
    if (exactMatchNeeded) {
      // We don't have a custom test, so return
      return response;
    }

    // XXX Build me out
  }

  response.test = compileCustomTest((data.__base || '') + (data.__test || ''));

  for (const key of data.__resources) {
    if (Object.keys(customTests.__resources).includes(key)) {
      const r = customTests.__resources[key];
      response.resources[key] =
        r.type == 'instance' ? r : customTests.__resources[key];
    } else {
      throw new Error(
        `Resource ${key} is not defined but referenced in ${name}`
      );
    }
  }

  return response;
};

const compileCustomTest = (code: string, format = true): string => {
  // Import code from other tests
  code = code.replace(
    /<%(\w+(?:\.\w+)*):(\w+)%> ?/g,
    (match, name, instancevar) => {
      const importedTest = getCustomTestData(name);
      if (!importedTest.__base) {
        const errorMsg = `Test is malformed: ${match} is an invalid import reference`;
        console.error(name, errorMsg);
        return `throw '${errorMsg}';`;
      }

      let importcode = compileCustomTest(importedTest.__base, false);
      const callback =
        importcode.match(/callback([(),])/g) ||
        importcode.includes(':callback%>');

      importcode = importcode
        .replace(/var (instance|promise)/g, `var ${instancevar}`)
        .replace(/callback([(),])/g, `${instancevar}$1`)
        .replace(/promise\.then/g, `${instancevar}.then`)
        .replace(/(instance|promise) = /g, `${instancevar} = `);
      if (!(['instance', 'promise'].includes(instancevar) || callback)) {
        importcode += `\n  if (!${instancevar}) {\n    return {result: false, message: '${instancevar} is falsy'};\n  }`;
      }
      return importcode;
    }
  );

  if (format) {
    // Wrap in a function
    code = `(function () {\n  ${code}\n})();`;

    try {
      // Use Prettier to format code
      code = prettier.format(code, {parser: 'babel'});
    } catch (e) {
      if (e instanceof SyntaxError) {
        const errorMsg = `Test is malformed: ${e.message}`;
        console.error(errorMsg);
        return `(function () {\n  throw "${errorMsg}";\n})();`;
      }
      /* c8 ignore next 3 */
      // We should never reach the next line
      throw e;
    }
  }

  return code;
};

const compileTestCode = (test: any): string => {
  if (typeof test === 'string') {
    return test;
  }

  if (Array.isArray(test)) {
    const parts = test.map(compileTestCode);
    return parts.join(` && `);
  }

  const property = test.property.replace(/(Symbol|constructor|@@)\./, '');

  if (test.property.startsWith('constructor')) {
    return `bcd.testConstructor("${property}");`;
  }
  if (test.property.startsWith('Symbol.') || test.property.startsWith('@@')) {
    return `"Symbol" in self && "${property}" in Symbol && "${test.owner.replace(
      '.prototype',
      ''
    )}" in self && ${test.property} in ${test.owner.replace(
      '.prototype',
      ''
    )}.prototype`;
  }
  if (test.inherit) {
    if (test.owner === 'self') {
      return `self.hasOwnProperty("${property}")`;
    }
    return `"${test.owner.replace(
      '.prototype',
      ''
    )}" in self && Object.prototype.hasOwnProperty.call(${
      test.owner
    }, "${property}")`;
  }
  if (test.owner === 'self' || test.owner === 'document.body.style') {
    return `"${property}" in ${test.owner}`;
  }
  return `"${test.owner.replace(
    '.prototype',
    ''
  )}" in self && "${property}" in ${test.owner}`;
};

const compileTest = (test: RawTest): Test => {
  let code;
  if (Array.isArray(test.raw.code)) {
    const parts = test.raw.code.map(compileTestCode);
    code = parts.join(` ${test.raw.combinator || '&&'} `);
  } else {
    code = compileTestCode(test.raw.code);
  }

  const {exposure, resources} = test;
  const newTest: Test = {code, exposure};

  if (resources && Object.keys(resources).length) {
    newTest.resources = resources;
  }

  return newTest;
};

export {
  getCustomTestData,
  getCustomTest,
  compileCustomTest,
  compileTestCode,
  compileTest
};
