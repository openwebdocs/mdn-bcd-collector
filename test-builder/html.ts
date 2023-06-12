//
// mdn-bcd-collector: test-builder/html.ts
// Functions directly related to building all of the HTML element tests
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from './common.js';

const build = (specElements, customHTML) => {
  const tests = {};
  const els = {};

  for (const data of Object.values(specElements) as any[]) {
    for (const el of data.elements) {
      if (el.interface?.startsWith('HTML')) {
        els[el.name] = {
          interfaceName: el.interface,
          attributes: customHTML.elements.attributes[el.name] || [],
        };
      }
    }
  }

  for (const [el, interfaceName] of Object.entries(
    customHTML.elements.custom,
  ) as any[]) {
    els[el] = {
      interfaceName,
      attributes: customHTML.elements.attributes[el.name] || [],
    };
  }

  for (const [el, data] of Object.entries(els).sort((a, b) =>
    a[0].localeCompare(b[0]),
  ) as any[]) {
    const bcdPath = `html.elements.${el}`;

    const customTest = getCustomTest(bcdPath, 'html.elements', true);
    const defaultCode = `(function() {
  var instance = document.createElement('${el}');
  return bcd.testObjectName(instance, '${data.interfaceName || 'HTMLElement'}');
})()`;

    tests[bcdPath] = compileTest({
      raw: {code: customTest.test || defaultCode},
      exposure: ['Window'],
    });

    // Add the additional tests
    for (const [key, code] of Object.entries(customTest.additional)) {
      tests[`${bcdPath}.${key}`] = compileTest({
        raw: {code: code},
        exposure: ['Window'],
      });
    }

    // Add tests for the attributes
    for (const attr of data.attributes || []) {
      let attrName = '';
      let attrProp = '';

      if (typeof attr == 'string') {
        attrName = attr;
        attrProp = attr;
      } else {
        attrName = attr.name;
        attrProp = attr.prop;
      }

      const customAttrTest = getCustomTest(
        `${bcdPath}.${attrName}`,
        'html.elements',
        true,
      );

      const defaultAttrCode = `(function() {
  var instance = document.createElement('${el}');
  return !!instance && '${attrProp}' in instance;
})()`;

      tests[`${bcdPath}.${attrName}`] = compileTest({
        raw: {
          code: customAttrTest.test || defaultAttrCode,
        },
        exposure: ['Window'],
      });

      // Add the additional tests
      for (const [key, code] of Object.entries(customTest.additional)) {
        tests[`${bcdPath}.${attrName}.${key}`] = compileTest({
          raw: {code: code},
          exposure: ['Window'],
        });
      }
    }
  }

  return tests;
};

export {build};
