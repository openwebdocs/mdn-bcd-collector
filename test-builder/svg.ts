//
// mdn-bcd-collector: test-builder/svg.ts
// Functions directly related to building all of the SVG tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {getCustomTest, compileTest} from "./common.js";

/**
 * Builds tests for SVG global attributes based on the provided customSVG.
 * @param customSVG - The custom SVG data.
 * @returns - The tests for SVG global attributes.
 */
const buildGlobalAttributeTests = async (customSVG) => {
  const tests = {};

  for (const [name, data] of Object.entries(
    customSVG.global_attributes,
  ) as any[]) {
    const values = (data["__values"] ?? []).filter(
      (value) => !value.startsWith("<"),
    );
    const testValue = data["__initial"] ?? data["__example"] ?? "auto";
    const additionalValues =
      "__additional_values" in data ? data["__additional_values"] : {};
    const elementName = data["__element"] || "rect";
    const equivalent = data["__equivalent_values"]
      ? JSON.stringify(data["__equivalent_values"])
      : "undefined";

    const ident = `svg.global_attributes.${name}`;
    const customTest = await getCustomTest(
      ident,
      "svg.global_attributes",
      true,
    );

    // Test for the attribute itself
    tests[ident] = compileTest({
      raw: {
        code:
          customTest.test ||
          `bcd.testSVGAttribute("${name}", "${testValue}", "${elementName}", true, ${equivalent})`,
      },
      exposure: ["Window"],
    });

    if (!(values.length === 1 && values[0] === testValue)) {
      // Tests for values
      for (const value of values) {
        const valueKey = value.replace(/-/g, "-");
        const valueIdent = `${ident}.${valueKey}`;
        const customValueTest = await getCustomTest(
          valueIdent,
          "svg.global_attributes",
          true,
        );
        tests[valueIdent] = compileTest({
          raw: {
            code:
              customValueTest.test ||
              `bcd.testSVGAttribute("${name}", "${value}", "${elementName}", true, ${equivalent})`,
          },
          exposure: ["Window"],
        });
      }
    }

    // Tests for additional values with custom test values
    for (const [key, testValue] of Object.entries(additionalValues)) {
      const valueIdent = `${ident}.${key}`;
      const customValueTest = await getCustomTest(
        valueIdent,
        "svg.global_attributes",
        true,
      );
      tests[valueIdent] = compileTest({
        raw: {
          code:
            customValueTest.test ||
            `bcd.testSVGAttribute("${name}", "${testValue}", "${elementName}", true, ${equivalent})`,
        },
        exposure: ["Window"],
      });
    }

    // Add the additional tests
    for (const [key, code] of Object.entries(customTest.additional)) {
      tests[`${ident}.${key}`] = compileTest({
        raw: {code: code},
        exposure: ["Window"],
      });
    }
  }

  return tests;
};

/**
 * Builds tests for SVG element-specific attributes based on the provided customSVG.
 * @param customSVG - The custom SVG data.
 * @returns - The tests for SVG element attributes.
 */
const buildAttributeTests = async (customSVG) => {
  const tests = {};

  for (const [elementName, elementData] of Object.entries(
    customSVG.attributes,
  ) as any[]) {
    for (const [attrName, attrData] of Object.entries(elementData) as any[]) {
      const values = (attrData["__values"] ?? []).filter(
        (value) => !value.startsWith("<"),
      );
      const testValue =
        attrData["__initial"] ?? attrData["__example"] ?? "auto";
      const additionalValues = attrData["__additional_values"] ?? {};
      const testElement = attrData["__element"] || elementName;
      const equivalent = attrData["__equivalent_values"]
        ? JSON.stringify(attrData["__equivalent_values"])
        : "undefined";

      const ident = `svg.elements.${elementName}.${attrName}`;
      const customTest = await getCustomTest(ident, "svg.attributes", true);

      // Test for the attribute itself
      tests[ident] = compileTest({
        raw: {
          code:
            customTest.test ||
            `bcd.testSVGAttribute("${attrName}", "${testValue}", "${testElement}", true, ${equivalent})`,
        },
        exposure: ["Window"],
      });

      if (!(values.length === 1 && values[0] === testValue)) {
        // Tests for values
        for (const value of values) {
          const valueKey = value.replace(/-/g, "-");
          const valueIdent = `${ident}.${valueKey}`;
          const customValueTest = await getCustomTest(
            valueIdent,
            "svg.attributes",
            true,
          );
          tests[valueIdent] = compileTest({
            raw: {
              code:
                customValueTest.test ||
                `bcd.testSVGAttribute("${attrName}", "${value}", "${testElement}", true, ${equivalent})`,
            },
            exposure: ["Window"],
          });
        }
      }

      // Tests for additional values with custom test values
      for (const [key, testValue] of Object.entries(additionalValues)) {
        const valueIdent = `${ident}.${key}`;
        const customValueTest = await getCustomTest(
          valueIdent,
          "svg.attributes",
          true,
        );
        tests[valueIdent] = compileTest({
          raw: {
            code:
              customValueTest.test ||
              `bcd.testSVGAttribute("${attrName}", "${testValue}", "${testElement}", true, ${equivalent})`,
          },
          exposure: ["Window"],
        });
      }

      // Add the additional tests
      for (const [key, code] of Object.entries(customTest.additional)) {
        tests[`${ident}.${key}`] = compileTest({
          raw: {code: code},
          exposure: ["Window"],
        });
      }
    }
  }

  return tests;
};

/**
 * Builds tests for SVG features based on the provided customSVG.
 * @param customSVG - The custom SVG data.
 * @returns - The tests for SVG features.
 */
const build = async (customSVG) => {
  const tests = {};

  Object.assign(tests, await buildGlobalAttributeTests(customSVG));
  Object.assign(tests, await buildAttributeTests(customSVG));

  return tests;
};

export {build};
