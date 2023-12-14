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

import sinon from "sinon";

import {build} from "./css.js";

describe("build (CSS)", () => {
  it("valid input", async () => {
    const webrefCSS = {
      "css-fonts": {
        spec: {
          title: "CSS Fonts Fake",
          url: "",
        },
        properties: [{name: "font-family"}, {name: "font-weight"}],
        selectors: [],
      },
      "css-grid": {
        spec: {
          title: "CSS Grid Fake",
          url: "",
        },
        properties: [{name: "grid"}],
        selectors: [],
      },
      selectors: {
        spec: {
          title: "CSS Selectors Fake",
          url: "",
        },
        properties: [],
        selectors: [{name: "+"}, {name: ":nth-of-type()"}],
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
      selectors: {
        "::-webkit-progress-bar": {},
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
      "css.selectors.-webkit-progress-bar": {
        code: 'bcd.testCSSSelector("::-webkit-progress-bar")',
        exposure: ["Window"],
      },
      "css.selectors.next-sibling": {
        code: 'bcd.testCSSSelector("+")',
        exposure: ["Window"],
      },
      "css.selectors.nth-of-type": {
        code: 'bcd.testCSSSelector(":nth-of-type()")',
        exposure: ["Window"],
      },
    });
  });

  it("with custom test", async () => {
    const css = {
      "css-dummy": {
        spec: {
          title: "CSS Dummy",
          url: "",
        },
        properties: [{name: "foo"}],
        selectors: [],
      },
    };

    assert.deepEqual(await build(css, {properties: {}, selectors: {}}), {
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
        spec: {
          title: "CSS Dummy",
          url: "",
        },
        properties: [{name: "foo"}],
        selectors: [],
      },
    };

    await assert.isRejected(
      build(css, {properties: {foo: {}}, selectors: {}}),
      "Custom CSS property already known: foo",
    );
  });

  it("double-defined selector", async () => {
    const css = {
      "css-dummy": {
        spec: {
          title: "CSS Dummy",
          url: "",
        },
        properties: [],
        selectors: [{name: "foo"}],
      },
    };

    await assert.isRejected(
      build(css, {properties: {}, selectors: {foo: {}}}),
      "Custom CSS selector already known: foo",
    );
  });

  it("invalid import", async () => {
    const consoleError = sinon.stub(console, "error");
    const css = {
      "css-dummy": {
        spec: {
          title: "CSS Dummy",
          url: "",
        },
        properties: [{name: "bar"}],
        selectors: [],
      },
    };

    const error =
      "Test is malformed: <%css.properties.foo:a%> is an invalid import reference";

    assert.deepEqual(await build(css, {properties: {}, selectors: {}}), {
      "css.properties.bar": {
        code: `(function () {
  throw "${error}";
})();
`,
        exposure: ["Window"],
      },
    });
    assert.ok(consoleError.calledOnce);

    consoleError.restore();
  });
});
