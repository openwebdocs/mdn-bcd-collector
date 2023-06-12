//
// mdn-bcd-collector: test-builder/elements.ts
// Functions directly related to building all of the HTML, SVG and MathML element tests
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from './common.js';

const categories = {
  html: {
    default: 'HTMLElement',
    startsWith: 'HTML',
  },
  svg: {
    namespace: 'http://www.w3.org/2000/svg',
    default: 'SVGElement',
    startsWith: 'SVG',
  },
  mathml: {
    namespace: 'http://www.w3.org/1998/Math/MathML',
    default: 'MathMLElement',
    startsWith: 'MathML',
  },
};

const build = (specElements, customElements) => {
  const tests = {};
  const els = customElements.elements.custom || {};

  for (const data of Object.values(specElements) as any[]) {
    for (const el of data.elements) {
      // Get category of element
      let category = 'html';
      for (const [cat, catData] of Object.entries(categories)) {
        if (el.interface?.startsWith(catData.startsWith)) {
          category = cat;
          break;
        }
      }

      els[el.name] = {
        category,
        interfaceName: el.interface,
        attributes: customElements.elements.attributes[el.name] || [],
      };
    }
  }

  for (const [el, data] of Object.entries(els).sort((a, b) =>
    a[0].localeCompare(b[0]),
  ) as any[]) {
    const bcdPath = `${data.category}.elements.${el}`;
    const namespace = categories[data.category].namespace || '';

    const customTest = getCustomTest(
      bcdPath,
      '${data.category}.elements',
      true,
    );
    const defaultConstructCode = namespace
      ? `document.createElementNS('${namespace}', '${el}')`
      : `document.createElement('${el}')`;
    const defaultCode = `(function() {
  var instance = ${defaultConstructCode};
  return bcd.testObjectName(instance, '${
    data.interfaceName || categories[data.category].default
  }');
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
        '${data.category}.elements',
        true,
      );

      const defaultAttrCode = `(function() {
  var instance = ${defaultConstructCode};
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
