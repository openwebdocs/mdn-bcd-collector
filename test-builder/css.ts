//
// mdn-bcd-collector: test-builder/css.ts
// Functions directly related to building all of the CSS tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from './common.js';

const build = (specCSS, customCSS) => {
  const properties = new Map();

  for (const data of Object.values(specCSS) as any[]) {
    for (const prop of data.properties) {
      properties.set(prop.name, new Map());
    }
  }

  for (const [name, data] of Object.entries(customCSS.properties) as any[]) {
    const values = '__values' in data ? data['__values'] : [];
    const additionalValues =
      '__additional_values' in data ? data['__additional_values'] : {};

    const mergedValues = new Map(Object.entries(additionalValues));
    for (const value of values) {
      if (mergedValues.has(value)) {
        throw new Error(`CSS property value already known: ${value}`);
      }
      mergedValues.set(value, value);
    }

    if (properties.has(name) && mergedValues.size === 0) {
      throw new Error(`Custom CSS property already known: ${name}`);
    }

    properties.set(name, mergedValues);
  }

  const tests = {};

  for (const name of Array.from(properties.keys()).sort()) {
    const ident = `css.properties.${name}`;
    const customTest = getCustomTest(ident, true);

    // Test for the property itself
    tests[ident] = compileTest({
      raw: {code: customTest.test || `bcd.testCSSProperty("${name}")`},
      exposure: ['Window']
    });

    // Tests for values
    for (const [key, value] of Array.from(
      properties.get(name).entries()
    ).sort() as any[]) {
      const valueIdent = `${ident}.${key}`;
      const customValueTest = getCustomTest(valueIdent, true);
      const values = Array.isArray(value) ? value : [value];
      const code = values
        .map((value) => `bcd.testCSSProperty("${name}", "${value}")`)
        .join(' || ');
      tests[valueIdent] = compileTest({
        raw: {code: customValueTest.test || code},
        exposure: ['Window']
      });
    }
  }

  return tests;
};

export {build};
