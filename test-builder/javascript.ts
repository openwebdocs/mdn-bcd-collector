//
// mdn-bcd-collector: test-builder/javascript.ts
// Functions directly related to building all of the JavaScript tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileCustomTest, compileTest} from './common.js';

import type {RawTestCodeExpr} from '../types/types.js';

const build = (customJS) => {
  const tests = {};

  for (const [path, extras] of Object.entries(customJS.builtins) as any[]) {
    const parts = path.split('.');

    const bcdPath = [
      'javascript',
      'builtins',
      // The "prototype" part is not part of the BCD paths.
      ...parts.filter((p) => p != 'prototype'),
    ].join('.');

    let expr: string | RawTestCodeExpr | (string | RawTestCodeExpr)[] = '';

    let category = 'javascript.builtins';
    const isInSubcategory =
      parts.length > 1 &&
      ['Intl', 'WebAssembly', 'Temporal'].includes(parts[0]);

    if (isInSubcategory) {
      category += '.' + parts[0];
    }

    // We should be looking for an exact match if we're checking for a subfeature not
    // defined on the object prototype (in other words, static members and functions)
    const exactMatchNeeded =
      bcdPath.replace(category, '').split('.').length > 2 &&
      !path.includes('.prototype');

    const customTest = getCustomTest(bcdPath, category, exactMatchNeeded);

    if (customTest.test) {
      tests[bcdPath] = compileTest({
        raw: {code: customTest.test},
        exposure: ['Window'],
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

      if (isInSubcategory) {
        if (`"${parts[1]}"` !== property) {
          expr.unshift({property: parts[1], owner: parts[0]});
        }
        expr.unshift({property: parts[0], owner: 'self'});
      }

      tests[bcdPath] = compileTest({
        raw: {code: expr},
        exposure: ['Window'],
      });
    }

    // Constructors
    if ('ctor_args' in extras) {
      const ctorPath = [
        'javascript',
        'builtins',
        ...parts,
        // Repeat the last part of the path
        parts[parts.length - 1],
      ].join('.');

      const customTest = getCustomTest(ctorPath, category, true);

      if (customTest.test) {
        tests[ctorPath] = compileTest({
          raw: {code: customTest.test},
          exposure: ['Window'],
        });
      } else {
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

        tests[ctorPath] = compileTest({
          raw: {code: compileCustomTest(rawCode).code},
          exposure: ['Window'],
        });
      }
    }

    // Add the additional tests
    for (const [key, code] of Object.entries(customTest.additional)) {
      tests[`${path}.${key}`] = compileTest({
        raw: {code: code},
        exposure: ['Window'],
      });
    }
  }

  return tests;
};

export {build};
