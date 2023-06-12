//
// mdn-bcd-collector: test-builder/elements.ts
// Functions directly related to building all of the HTML, SVG and MathML element tests
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from './common.js';

const categories: {
  [name: string]: {
    namespace?: string;
    default?: string;
    startsWith: string;
  };
} = {
  html: {
    default: 'HTMLElement',
    startsWith: 'HTML',
  },
  svg: {
    namespace: 'http://www.w3.org/2000/svg',
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
  const els = {
    html: customElements.elements.custom.html || {},
    svg: customElements.elements.custom.svg || {},
    mathml: customElements.elements.custom.mathml || {},
  };

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

      els[category][el.name] = {
        interfaceName: el.interface,
        attributes:
          (customElements.elements.attributes[category] || {})[el.name] || [],
      };
    }
  }

  for (const [category, categoryData] of Object.entries(categories)) {
    if (category === 'mathml') {
      // XXX MathML needs to be specially tested, skip for now
      // Base code on https://github.com/web-platform-tests/wpt/blob/master/mathml/support/feature-detection.js?
      continue;
    }

    const namespace = categoryData.namespace;

    for (const [el, data] of Object.entries(els[category]).sort((a, b) =>
      a[0].localeCompare(b[0]),
    ) as any[]) {
      const bcdPath = `${category}.elements.${el}`;

      const interfaceName = data.interfaceName || categoryData.default;
      if (!interfaceName) {
        throw new Error(`${bcdPath} is missing an interface name`);
      }

      const customTest = getCustomTest(bcdPath, '${category}.elements', true);
      const defaultConstructCode = namespace
        ? `document.createElementNS('${namespace}', '${el}')`
        : `document.createElement('${el}')`;
      const defaultCode = `(function() {
  var instance = ${defaultConstructCode};
  return bcd.testObjectName(instance, '${
    data.interfaceName || categoryData.default
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
          '${category}.elements',
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
  }

  return tests;
};

export {build};
