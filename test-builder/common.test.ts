//
// mdn-bcd-collector: unittest/test-builder/common.test.ts
// Unittest for the common functions in the test builder script
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from "chai";
import chaiSubset from "chai-subset";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiSubset).use(chaiAsPromised);

import sinon from "sinon";

import {
  compileTestCode,
  compileTest,
  getCustomTestData,
  getCustomTest,
  CustomTestData,
  CustomTestResult,
} from "./common.js";

import type {RawTest} from "./types/types.js";

describe("build (common)", () => {
  describe("getCustomTest(Data)", () => {
    const expectedResults: Record<
      string,
      {
        category: string;
        data: CustomTestData;
        result: CustomTestResult;
      }
    > = {
      "api.FooBar": {
        category: "api",
        data: {
          __base: "'hello world';",
          __test: "return 'hello world!';",
          __resources: [],
          __additional: {},
        },
        result: {
          test: '(function () {\n  "hello world";\n  return "hello world!";\n})();\n',
          resources: [],
          additional: {},
        },
      },
      "api.FooBar.foo": {
        category: "api",
        data: {
          __base: "'hello world';",
          __test: "return 'hi, world!';",
          __resources: [],
          __additional: {},
        },
        result: {
          test: '(function () {\n  "hello world";\n  return "hi, world!";\n})();\n',
          resources: [],
          additional: {},
        },
      },
      "api.FooBar.foo.pear": {
        category: "api",
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {
          test: false,
          resources: [],
          additional: {},
        },
      },
      "api.FooBar.bar": {
        category: "api",
        data: {
          __base: "'hello world';\n'goodbye world';",
          __test: "return 'farewell world!';",
          __resources: [],
          __additional: {
            cinnamon: "return 'snickerdoodle';",
          },
        },
        result: {
          test: '(function () {\n  "hello world";\n  "goodbye world";\n  return "farewell world!";\n})();\n',
          resources: [],
          additional: {
            cinnamon:
              '(function () {\n  "hello world";\n  "goodbye world";\n  return "snickerdoodle";\n})();\n',
          },
        },
      },
      "api.FooBar.baz": {
        category: "api",
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {
          test: '(function () {\n  "hello world";\n  return !!instance && "baz" in instance;\n})();\n',
          resources: [],
          additional: {},
        },
      },
      "api.FooBar.FooBar": {
        category: "api",
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {
          test: false,
          resources: [],
          additional: {},
        },
      },
      "api.nonexistent": {
        category: "api",
        data: {
          __base: false,
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {test: false, resources: [], additional: {}},
      },
      "api.audiocontext": {
        category: "api",
        data: {
          __base: false,
          __test: "return false;",
          __resources: ["audio-blip"],
          __additional: {},
        },
        result: {
          test: "(function () {\n  return false;\n})();\n",
          resources: ["audio-blip"],
          additional: {},
        },
      },
      "api.createImageBitmap": {
        category: "api",
        data: {
          __base:
            "if (!('createImageBitmap' in self)) {\n  return {result: false, message: 'createImageBitmap is not defined'};\n}\nfunction create(options) {\n  return createImageBitmap(document.getElementById('resource-image-black'), options);\n}",
          __test: "return true;",
          __resources: ["image-black"],
          __additional: {
            options_colorSpaceConversion_parameter:
              "return bcd.testOptionParam(create, null, 'colorSpaceConversion', 'default');",
          },
        },
        result: {
          test: '(function () {\n  if (!("createImageBitmap" in self)) {\n    return { result: false, message: "createImageBitmap is not defined" };\n  }\n  function create(options) {\n    return createImageBitmap(\n      document.getElementById("resource-image-black"),\n      options\n    );\n  }\n  return true;\n})();\n',
          resources: ["image-black"],
          additional: {
            options_colorSpaceConversion_parameter:
              '(function () {\n  if (!("createImageBitmap" in self)) {\n    return { result: false, message: "createImageBitmap is not defined" };\n  }\n  function create(options) {\n    return createImageBitmap(\n      document.getElementById("resource-image-black"),\n      options\n    );\n  }\n  return bcd.testOptionParam(create, null, "colorSpaceConversion", "default");\n})();\n',
          },
        },
      },
      "api.WebGLRenderingContext": {
        category: "api",
        data: {
          __base: "var instance = reusableInstances.webGL;",
          __test: false,
          __resources: ["webGL"],
          __additional: {},
        },
        result: {
          // XXX Not accurate
          test: "(function () {\n  var instance = reusableInstances.webGL;\n  return !!instance;\n})();\n",
          resources: ["webGL"],
          additional: {},
        },
      },
      "api.import1": {
        category: "api",
        data: {
          __base: "<%api.foo:a%>\nvar instance = a;",
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {
          test: '(function () {\n  var a = 1;\n  if (!a) {\n    return { result: false, message: "a is falsy" };\n  }\n  var instance = a;\n  return !!instance;\n})();\n',
          resources: [],
          additional: {},
        },
      },
      "api.import2": {
        category: "api",
        data: {
          __base: "<%api.import1:b%>\nvar instance = b;",
          __test: false,
          __resources: [],
          __additional: {},
        },
        result: {
          test: '(function () {\n  var a = 1;\n  if (!a) {\n    return { result: false, message: "a is falsy" };\n  }\n  var b = a;\n  if (!b) {\n    return { result: false, message: "b is falsy" };\n  }\n  var instance = b;\n  return !!instance;\n})();\n',
          resources: [],
          additional: {},
        },
      },
    };

    for (const [k, v] of Object.entries(expectedResults)) {
      it(k, async () => {
        assert.deepEqual(getCustomTestData(k), v.data);
        assert.deepEqual(await getCustomTest(k, v.category), v.result);
      });
    }

    it("api.invalid (disable test if code is malformed)", async () => {
      const consoleError = sinon.stub(console, "error");
      const customTest = await getCustomTest("api.invalid", "api");
      assert.ok(
        customTest.test &&
          customTest.test.startsWith(
            '(function () {\n  throw "Test is malformed:',
          ),
      );
      assert.ok(consoleError.calledOnce);
      consoleError.restore();
    });

    it("api.badresource (throw error on bad resource reference)", async () => {
      await assert.isRejected(
        getCustomTest("api.badresource", "api"),
        "Resource bad-resource is not defined but referenced in api.badresource",
      );
    });

    it("api.otherbadresource (throw error on bad resource reference)", async () => {
      await assert.isRejected(
        getCustomTest("api.otherbadresource", "api"),
        "Resource bad-resource is not defined but referenced in __resources.other-bad-resource",
      );
    });
  });

  describe("compileTestCode", () => {
    it("string", () => {
      assert.equal(compileTestCode("a string"), "a string");
    });

    it("Array of tests", () => {
      assert.equal(
        compileTestCode(["true", {property: "userAgent", owner: "navigator"}]),
        'true && "navigator" in self && "userAgent" in navigator',
      );
    });

    it("Symbol (global owner)", () => {
      const test = {property: "Symbol.iterator", owner: "DOMMatrixReadOnly"};
      assert.equal(
        compileTestCode(test),
        '"Symbol" in self && "iterator" in Symbol && "DOMMatrixReadOnly" in self && !!(DOMMatrixReadOnly[Symbol.iterator])',
      );
    });

    it("Symbol (owner is instance)", () => {
      const test = {property: "Symbol.iterator", owner: "instance"};
      assert.equal(
        compileTestCode(test),
        '"Symbol" in self && "iterator" in Symbol && !!(instance[Symbol.iterator])',
      );
    });

    it("namespace", () => {
      const test = {property: "log", owner: "console"};
      assert.equal(
        compileTestCode(test),
        '"console" in self && "log" in console',
      );
    });

    it("inherited property on global scope", () => {
      const test = {property: "fetch", owner: "self", inherit: true};
      assert.equal(compileTestCode(test), 'self.hasOwnProperty("fetch")');
    });

    it("constructor", () => {
      const test = {
        property: "m11",
        owner: "DOMMatrix.prototype",
        inherit: true,
      };
      assert.equal(
        compileTestCode(test),
        '"DOMMatrix" in self && Object.prototype.hasOwnProperty.call(DOMMatrix.prototype, "m11")',
      );
    });
  });

  describe("compileTest", () => {
    it("main", () => {
      const rawTest: RawTest = {
        raw: {
          code: {property: "body", owner: `Document.prototype`},
        },
        resources: ["audio-blip"],
        exposure: ["Window"],
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"Document" in self && "body" in Document.prototype',
        exposure: ["Window"],
        resources: ["audio-blip"],
      });
    });

    describe("custom tests", () => {
      it("one item", () => {
        const rawTest: RawTest = {
          raw: {
            code: "foo",
            combinator: "&&",
          },
          resources: [],
          additional: {},
          exposure: ["Window"],
        };

        assert.deepEqual(compileTest(rawTest), {
          code: "foo",
          exposure: ["Window"],
        });
      });

      it("two items", () => {
        const rawTest: RawTest = {
          raw: {
            code: ["foo", "foo"],
            combinator: "&&",
          },
          resources: [],
          additional: {},
          exposure: ["Window"],
        };

        assert.deepEqual(compileTest(rawTest), {
          code: "foo && foo",
          exposure: ["Window"],
        });
      });
    });

    it("no-repeated test code", () => {
      const rawTests: RawTest[] = [
        {
          raw: {
            code: "true",
            combinator: "&&",
          },
          resources: [],
          additional: {},
          exposure: ["Window"],
        },
        {
          raw: {
            code: ["true", "true"],
            combinator: "||",
          },
          resources: [],
          additional: {},
          exposure: ["Window"],
        },
        {
          raw: {
            code: ["true", "true"],
            combinator: "&&",
          },
          resources: [],
          additional: {},
          exposure: ["Worker"],
        },
      ];

      assert.deepEqual(compileTest(rawTests[0]), {
        code: "true",
        exposure: ["Window"],
      });
      assert.deepEqual(compileTest(rawTests[1]), {
        code: "true || true",
        exposure: ["Window"],
      });
      assert.deepEqual(compileTest(rawTests[2]), {
        code: "true && true",
        exposure: ["Worker"],
      });
    });

    it("CSS", () => {
      const rawTest: RawTest = {
        raw: {
          code: [
            {property: "fontFamily", owner: "document.body.style"},
            {property: "font-family", owner: "document.body.style"},
          ],
          combinator: "||",
        },
        resources: [],
        exposure: ["Window"],
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"fontFamily" in document.body.style || "font-family" in document.body.style',
        exposure: ["Window"],
      });
    });
  });
});
