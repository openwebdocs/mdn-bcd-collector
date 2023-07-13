//
// mdn-bcd-collector: unittest/unit/css.test.ts
// Unittest for the CSS-specific test builder functions
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from "chai";
import chaiSubset from "chai-subset";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiSubset).use(chaiAsPromised);

import {build} from "./css.js";

describe("build (CSS)", () => {
  it("valid input", async () => {
    const webrefCSS = {
      "css-fonts": {
        properties: [{name: "font-family"}, {name: "font-weight"}],
      },
      "css-grid": {
        properties: [{name: "grid"}],
      },
    };

    const customCSS = {
      properties: {
        "font-family": {
          __values: ["emoji", "system-ui"],
          __additional_values: {
            historic: ["sans-serif", "serif"],
          },
        },
        zoom: {},
      },
    };

    assert.deepEqual(await build(webrefCSS, customCSS), {
      "css.properties.font-family": {
        code: 'bcd.testCSSProperty("font-family")',
        exposure: ["Window"],
      },
      "css.properties.font-family.emoji": {
        code: 'bcd.testCSSProperty("font-family", "emoji")',
        exposure: ["Window"],
      },
      "css.properties.font-family.historic": {
        code: 'bcd.testCSSProperty("font-family", "sans-serif") && bcd.testCSSProperty("font-family", "serif")',
        exposure: ["Window"],
      },
      "css.properties.font-family.system-ui": {
        code: 'bcd.testCSSProperty("font-family", "system-ui")',
        exposure: ["Window"],
      },
      "css.properties.font-weight": {
        code: 'bcd.testCSSProperty("font-weight")',
        exposure: ["Window"],
      },
      "css.properties.grid": {
        code: 'bcd.testCSSProperty("grid")',
        exposure: ["Window"],
      },
      "css.properties.zoom": {
        code: 'bcd.testCSSProperty("zoom")',
        exposure: ["Window"],
      },
    });
  });

  it("with custom test", async () => {
    const css = {
      "css-dummy": {
        properties: [{name: "foo"}],
      },
    };

    assert.deepEqual(await build(css, {properties: {}}), {
      "css.properties.foo": {
        code: `(function () {
  return 1;
})();
`,
        exposure: ["Window"],
      },
    });
  });

  it("double-defined property", async () => {
    const css = {
      "css-dummy": {
        properties: [{name: "foo"}],
      },
    };

    await assert.isRejected(
      build(css, {properties: {foo: {}}}),
      "Custom CSS property already known: foo",
    );
  });

  it("invalid import", async () => {
    const css = {
      "css-dummy": {
        properties: [{name: "bar"}],
      },
    };

    assert.deepEqual(await build(css, {properties: {}}), {
      "css.properties.bar": {
        code: `(function () {
  throw "Test is malformed: <%css.properties.foo:a%> is an invalid import reference";
})();
`,
        exposure: ["Window"],
      },
    });
  });
});
