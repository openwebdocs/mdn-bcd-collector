//
// mdn-bcd-collector: test-builder/javascript.ts
// Functions directly related to building all of the JavaScript tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import fs from 'fs-extra';
import prettier from 'prettier';

import {
  customTests,
  getCustomTestData,
  getCustomTest,
  compileCustomTest,
  compileTest,
  compileTestCode
} from './common.js';

import type {
  Test,
  RawTest,
  RawTestCodeExpr,
  Exposure,
  Resources,
  IDLFiles
} from '../types/types.js';

const getCustomTestJS = (
  name: string,
  member?: string,
  defaultCode?: any
): string | false => {
  // XXX Deprecated; use getCustomTest() instead
  const testData = customTests.javascript.builtins[name];
  if (!testData) {
    return false;
  }

  const test =
    (testData.__base || '') +
    (testData[member || '__test'] || compileTestCode(defaultCode));

  return compileCustomTest(test);
};

const build = async (customJS) => {
  const tests = {};

  for (const [path, extras] of Object.entries(customJS.builtins) as any[]) {
    const parts = path.split('.');

    const bcdPath = [
      'javascript',
      'builtins',
      // The "prototype" part is not part of the BCD paths.
      ...parts.filter((p) => p != 'prototype')
    ].join('.');

    let expr: string | RawTestCodeExpr | (string | RawTestCodeExpr)[] = '';

    if ('code' in extras) {
      // Custom test code, nothing is generated.
      tests[bcdPath] = compileTest({
        raw: {code: extras.code},
        exposure: ['Window']
      });
    } else {
      // Get the last part as the property and everything else as the expression
      // we should test for existence in, or "self" if there's just one part.
      let property = parts[parts.length - 1];

      if (property.startsWith('@@')) {
        property = `Symbol.${property.substr(2)}`;
      }

      const owner =
        parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : 'self';

      expr = [{property, owner, inherit: true}];

      if (
        owner.startsWith('Intl') ||
        owner.startsWith('WebAssembly') ||
        owner.startsWith('Temporal')
      ) {
        if (`"${parts[1]}"` !== property) {
          expr.unshift({property: parts[1], owner: parts[0]});
        }
        expr.unshift({property: parts[0], owner: 'self'});
      }

      const customTest = getCustomTestJS(parts[0], parts[1], expr);

      tests[bcdPath] = compileTest({
        raw: {code: customTest || expr},
        exposure: ['Window']
      });
    }

    // Constructors
    if ('ctor_args' in extras) {
      const ctorPath = [
        'javascript',
        'builtins',
        ...parts,
        // Repeat the last part of the path
        parts[parts.length - 1]
      ].join('.');
      const expr = `${path}(${extras.ctor_args})`;
      const maybeNew = extras.ctor_new !== false ? 'new' : '';

      let rawCode = `var instance = ${maybeNew} ${expr};
    return !!instance;`;

      if (path.startsWith('Intl')) {
        rawCode =
          `if (!("${parts[1]}" in Intl)) {
      return {result: false, message: 'Intl.${parts[1]} is not defined'};
    }
    ` + rawCode;
      } else if (path.startsWith('WebAssembly')) {
        rawCode =
          `if (!("${parts[1]}" in WebAssembly)) {
      return {result: false, message: 'WebAssembly.${parts[1]} is not defined'};
    }
    ` + rawCode;
      }

      rawCode =
        `if (!("${parts[0]}" in self)) {
      return {result: false, message: '${parts[0]} is not defined'};
    }
    ` + rawCode;

      const customTest = getCustomTestJS(parts[0], undefined, rawCode);

      tests[ctorPath] = compileTest({
        raw: {code: customTest || compileCustomTest(rawCode)},
        exposure: ['Window']
      });
    }
  }

  return tests;
};

export {build};
