//
// mdn-bcd-collector: test-builder/elements.ts
// Functions directly related to building all of the HTML, SVG and MathML element tests
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

const categories: Record<
  string,
  {
    namespace?: string;
    default?: string;
    startsWith: string;
  }
> = {
  html: {
    default: "HTMLElement",
    startsWith: "HTML",
  },
  svg: {
    namespace: "http://www.w3.org/2000/svg",
    startsWith: "SVG",
  },
  mathml: {
    namespace: "http://www.w3.org/1998/Math/MathML",
    default: "MathMLElement",
    startsWith: "MathML",
  },
};

/**
 * Builds tests for spec elements and custom elements.
 * @param specElements - The spec elements.
 * @param customElements - The custom elements.
 * @returns The tests.
 */
const build = async (specElements, customElements) => {
  const tests = {};
  const els = {
    html: customElements.elements.custom.html || {},
    svg: customElements.elements.custom.svg || {},
    mathml: customElements.elements.custom.mathml || {},
  };

  for (const data of Object.values(specElements) as any[]) {
    for (const el of data.elements) {
      if (el.obsolete !== true) {
        // Get category of element
        let category = "html";
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
  }

  for (const [category, categoryData] of Object.entries(categories)) {
    if (category === "mathml") {
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

      const customTest = await getCustomTest(
        bcdPath,
        "${category}.elements",
        true,
      );
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
        exposure: ["Window"],
      });

      // Add the additional tests
      for (const [key, code] of Object.entries(customTest.additional)) {
        tests[`${bcdPath}.${key}`] = compileTest({
          raw: {code: code},
          exposure: ["Window"],
        });
      }

      // Add tests for the attributes
      if (data.attributes) {
        const attributes = Array.isArray(data.attributes)
          ? [
              ...data.attributes.filter((a) => typeof a == "object"),
              ...data.attributes
                .filter((a) => typeof a == "string")
                .map((a) => ({[a]: a})),
            ].reduce((acc, cv) => ({...acc, ...cv}), {})
          : data.attributes;

        for (const [attrName, attrProp] of Object.entries(attributes)) {
          const customAttrTest = await getCustomTest(
            `${bcdPath}.${attrName}`,
            "${category}.elements",
            true,
          );

          let attrCode = `(function() {
            var instance = ${defaultConstructCode};
            return !!instance && '${attrProp}' in instance;
          })()`;

          // SVG attributes need some tweaks
          if (category === "svg") {
            // Certain SVG attributes are reflected differently in SVGOM
            if (attrProp === "in") {
              attrCode = attrCode.replace("'in'", "'in1'");
            }
            if (attrProp === "kernelUnitLength") {
              attrCode = attrCode.replace(
                "kernelUnitLength",
                "kernelUnitLengthX",
              );
            }
            if (attrProp === "order") {
              attrCode = attrCode.replace("order", "orderX");
            }
            if (attrProp === "stdDeviation") {
              attrCode = attrCode.replace("stdDeviation", "stdDeviationX");
            }
            if (attrProp === "radius") {
              attrCode = attrCode.replace("radius", "radiusX");
            }
            if (attrProp === "baseFrequency") {
              attrCode = attrCode.replace("baseFrequency", "baseFrequencyX");
            }
            // All xlink:href attributes need special handling
            if (attrProp === "xlink_href") {
              attrCode = `(function() {
                var instance = ${defaultConstructCode};
                instance.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'test');
                return !!instance && instance.getAttributeNS('http://www.w3.org/1999/xlink', 'href') === 'test'
              })()`;
            }
          }

          tests[`${bcdPath}.${attrName}`] = compileTest({
            raw: {
              code: customAttrTest.test || attrCode,
            },
            exposure: ["Window"],
          });

          // Add the additional tests
          for (const [key, code] of Object.entries(customTest.additional)) {
            tests[`${bcdPath}.${attrName}.${key}`] = compileTest({
              raw: {code: code},
              exposure: ["Window"],
            });
          }
        }
      }
    }
  }

  return tests;
};

export {build};
