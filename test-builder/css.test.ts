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
      properties: [
        {name: "font-family", href: "https://foo.bar"},
        {
          name: "font-weight",
          href: "https://foo.bar",
          syntax: "<font-weight-absolute> | bolder | lighter",
        },
        {name: "grid", href: "https://foo.bar"},
      ],
      selectors: [
        {name: "+", href: "https://foo.bar"},
        {name: ":nth-of-type()", href: "https://foo.bar"},
      ],
      types: [],
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
      types: {},
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
      "css.properties.font-weight.bolder": {
        code: 'bcd.testCSSProperty("font-weight", "bolder")',
        exposure: ["Window"],
      },
      "css.properties.font-weight.lighter": {
        code: 'bcd.testCSSProperty("font-weight", "lighter")',
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
      properties: [{name: "foo", href: "https://foo.bar"}],
      selectors: [],
      types: [],
    };

    assert.deepEqual(
      await build(css, {properties: {}, selectors: {}, types: {}}),
      {
        "css.properties.foo": {
          code: `(function () {
  return 1;
})();
`,
          exposure: ["Window"],
        },
      },
    );
  });

  it("double-defined property", async () => {
    const css = {
      properties: [{name: "foo", href: "https://foo.bar"}],
      selectors: [],
      types: [],
    };

    await assert.isRejected(
      build(css, {properties: {foo: {}}, selectors: {}}),
      "Custom CSS property already known: foo",
    );
  });

  it("double-defined property value", async () => {
    const css = {
      properties: [
        {
          name: "foo",
          href: "https://foo.bar",
          syntax: "bar",
        },
      ],
      selectors: [],
      types: [],
    };

    await assert.isRejected(
      build(css, {properties: {foo: {_values: ["bar"]}}, selectors: {}}),
      "Custom CSS property already known: foo",
    );

    const customCSS = {
      properties: {
        foo: {
          __values: ["bar"],
          __additional_values: {bar: "bar"},
        },
      },
      selectors: {},
      types: {},
    };

    await assert.isRejected(
      build({properties: [], selectors: [], types: []}, customCSS),
      "CSS property value is double-defined in custom CSS: foo.bar",
    );
  });

  it("double-defined property value", async () => {
    const webrefCSS = {
      properties: [
        {
          name: "foo",
          href: "https://foo.bar",
          syntax: "bar",
        },
      ],
      selectors: [],
      types: [],
    };

    const customCSS = {
      properties: {foo: {_values: ["bar"]}},
      selectors: {},
      types: {},
    };

    await assert.isRejected(
      build(webrefCSS, customCSS),
      "Custom CSS property already known: foo",
    );
  });

  it("__additional_values overwrites spec value", async () => {
    const webrefCSS = {
      properties: [
        {
          name: "one",
          href: "https://foo.bar",
          syntax: "two",
        },
      ],
      selectors: [],
      types: [],
    };

    const customCSS = {
      properties: {one: {__additional_values: {two: "1em two"}}},
      selectors: {},
      types: {},
    };

    assert.deepEqual(await build(webrefCSS, customCSS), {
      "css.properties.one": {
        code: 'bcd.testCSSProperty("one")',
        exposure: ["Window"],
      },
      "css.properties.one.two": {
        code: 'bcd.testCSSProperty("one", "1em two")',
        exposure: ["Window"],
      },
    });
  });

  it("double-defined selector", async () => {
    const css = {
      properties: [],
      selectors: [{name: "foo", href: "https://foo.bar"}],
      types: [],
    };

    await assert.isRejected(
      build(css, {properties: {}, selectors: {foo: {}}}),
      "Custom CSS selector already known: foo",
    );
  });

  it("invalid import", async () => {
    const consoleError = sinon.stub(console, "error");
    const css = {
      properties: [{name: "bar", href: "https://foo.bar"}],
      selectors: [],
      types: [],
    };

    const error =
      "Test is malformed: <%css.properties.foo:a%> is an invalid import reference";

    assert.deepEqual(
      await build(css, {properties: {}, selectors: {}, types: {}}),
      {
        "css.properties.bar": {
          code: `(function () {
  throw "${error}";
})();
`,
          exposure: ["Window"],
        },
      },
    );
    assert.ok(consoleError.calledOnce);

    consoleError.restore();
  });
});
