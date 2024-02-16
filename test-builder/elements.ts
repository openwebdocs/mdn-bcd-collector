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

  // Get the elements
  const els = {
    html: new Map(),
    svg: new Map(),
    mathml: new Map(),
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

        els[category].set(el.name, {
          interfaceName: el.interface,
          attributes: new Map(),
        });
      }
    }
  }

  // Add the attributes and any additional elements
  for (const category of Object.keys(els)) {
    for (const [name, data] of Object.entries(
      customElements[category],
    ) as any[]) {
      const normalAttrs =
        data.attributes?.filter((a) => typeof a === "string") || [];
      const customAttrs =
        data.attributes
          ?.filter((a) => typeof a === "object")
          .reduce((all, a) => ({...all, ...a}), {}) || {};

      const attrs = new Map(Object.entries(customAttrs));

      for (const value of normalAttrs) {
        if (attrs.has(value)) {
          throw new Error(
            `Element attribute is double-defined in custom elements: ${category}.${name}.${value}`,
          );
        }
        attrs.set(value, value);
      }

      if (els[category].has(name)) {
        if (attrs.size === 0) {
          throw new Error(`Element already known: ${category}.${name}`);
        }

        const el = els[category].get(name);
        for (const value of attrs.keys()) {
          if (el.attributes.has(value) && value in normalAttrs) {
            throw new Error(
              `Element attribute already known: ${category}.${name}.${value}`,
            );
          }

          el.attributes.set(value, attrs.get(value));
        }
      } else {
        els[category].set(name, {
          interfaceName: data.interfaceName,
          attributes: attrs,
        });
      }
    }
  }

  // Build the tests

  for (const [category, categoryData] of Object.entries(categories)) {
    const namespace = categoryData.namespace;

    for (const [el, data] of (
      Array.from(els[category].entries()) as any[]
    ).sort((a, b) => a[0].localeCompare(b[0]))) {
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
      const defaultCode =
        category === "mathml"
          ? `(function () {
  throw new Error('MathML elements require custom tests');
})()`
          : `(function() {
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
        for (const [attrName, attrProp] of data.attributes.entries() as [
          string,
          string,
        ][]) {
          const customAttrTest = await getCustomTest(
            `${bcdPath}.${attrName}`,
            "${category}.elements",
            true,
          );

          let attrCode = `(function() {
  var instance = ${defaultConstructCode};
  return !!instance && '${attrProp}' in instance;
})()`;

          // All xlink attributes need special handling
          if (attrProp.startsWith("xlink_")) {
            const xlinkAttr = attrProp.replace("xlink_", "");
            attrCode = `(function() {
  var instance = ${defaultConstructCode};
  instance.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:${xlinkAttr}', 'test');
  return !!instance && bcd.testObjectName(instance, '${data.interfaceName}').result && instance.getAttributeNS('http://www.w3.org/1999/xlink', '${xlinkAttr}') === 'test';
})()`;
          }

          tests[`${bcdPath}.${attrName}`] = compileTest({
            raw: {
              code: customAttrTest.test || attrCode,
            },
            exposure: ["Window"],
          });

          // Add the additional tests
          for (const [key, code] of Object.entries(customAttrTest.additional)) {
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
