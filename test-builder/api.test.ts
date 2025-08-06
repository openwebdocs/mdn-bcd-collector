//
// mdn-bcd-collector: unittest/unit/api.test.ts
// Unittest for the web API-specific test builder functions
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);

import * as WebIDL2 from "webidl2";
// import sinon from 'sinon';

import {
  flattenIDL,
  getExposureSet,
  validateIDL,
  buildIDLTests,
  build,
} from "./api.js";

describe("build (API)", () => {
  it("build", async () => {
    const specIDLs = {
      first: WebIDL2.parse(
        `[Global=Window, Exposed=Window] interface Window {};
        [Exposed=Window] interface DOMError {};`,
      ),
      second: WebIDL2.parse(`[Exposed=Window] interface XSLTProcessor {};`),
    };

    const customIDLs = {
      second: WebIDL2.parse(
        `partial interface XSLTProcessor { undefined reset(); };`,
      ),
    };

    const tests = await build(specIDLs, customIDLs);
    assert.containsAllKeys(tests, ["api.XSLTProcessor.reset"]);
  });

  describe("flattenIDL", () => {
    const customIDLs = {
      first: WebIDL2.parse(`[Exposed=Window] interface DOMError {};`),
      second: WebIDL2.parse(`[Exposed=Window] interface XSLTProcessor {};`),
    };

    it("interface + mixin", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=Window]
             interface DummyError : Error {
               readonly attribute boolean imadumdum;
             };`,
        ),
        second: WebIDL2.parse(
          `[Exposed=Window]
             interface mixin DummyErrorHelper {
               DummyError geterror();
             };

             DummyError includes DummyErrorHelper;`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);

      const interfaces = ast.filter(
        (dfn) => dfn.type === "interface",
      ) as WebIDL2.InterfaceType[];
      assert.lengthOf(interfaces, 3);

      assert.equal(interfaces[0].name, "DummyError");
      assert.lengthOf(interfaces[0].members, 2);
      (assert as any).containSubset(interfaces[0].members[0], {
        type: "attribute",
        name: "imadumdum",
      });
      (assert as any).containSubset(interfaces[0].members[1], {
        type: "operation",
        name: "geterror",
      });

      assert.equal(interfaces[1].name, "DOMError");
      assert.equal(interfaces[2].name, "XSLTProcessor");
    });

    it("namespace + partial namespace", () => {
      const specIDLs = {
        cssom: WebIDL2.parse(
          `[Exposed=Window]
             namespace CSS {
               boolean supports();
             };`,
        ),
        paint: WebIDL2.parse(
          `partial namespace CSS {
               readonly attribute any paintWorklet;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);

      const namespaces = ast.filter(
        (dfn) => dfn.type === "namespace",
      ) as WebIDL2.NamespaceType[];
      assert.lengthOf(namespaces, 1);
      const [namespace] = namespaces;
      assert.equal(namespace.name, "CSS");
      assert.lengthOf(namespace.members, 2);
      (assert as any).containSubset(namespace.members[0], {
        type: "operation",
        name: "supports",
      });
      (assert as any).containSubset(namespace.members[1], {
        type: "attribute",
        name: "paintWorklet",
      });

      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      assert.lengthOf(interfaces, 2);
    });

    it("WindowOrWorkerGlobalScope remains separate", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=Window]
             interface Window {
               readonly attribute boolean imadumdum;
             };`,
        ),
        second: WebIDL2.parse(
          `[Exposed=Window]
             interface mixin WindowOrWorkerGlobalScope {
               undefined atob();
             };

             Window includes WindowOrWorkerGlobalScope;`,
        ),
      };
      const {ast, globals} = flattenIDL(specIDLs, customIDLs) as {
        ast: WebIDL2.InterfaceType[];
        globals: WebIDL2.InterfaceType[];
      };
      assert.lengthOf(ast, 3);
      assert.lengthOf(globals, 1);

      // Window shouldn't include any of WindowOrWorkerGlobalScope's members
      // in this case; WindowOrWorkerGlobalScope remaps to _globals
      assert.lengthOf(ast[0].members, 1);

      assert.equal(globals[0].name, "WindowOrWorkerGlobalScope");
      assert.lengthOf(globals[0].members, 1);
      (assert as any).containSubset(globals[0].members[0], {
        type: "operation",
        name: "atob",
      });
    });

    it("mixin missing", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `interface mixin DummyErrorHelper {
               DummyError geterror();
             };`,
        ),
        secnd: WebIDL2.parse(`DummyError includes DummyErrorHelper;`),
      };

      assert.throws(() => {
        flattenIDL(specIDLs, customIDLs);
      }, "Target DummyError not found for interface mixin DummyErrorHelper");
    });

    it("interface missing", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=Window]
             interface DummyError : Error {
               readonly attribute boolean imadumdum;
             };`,
        ),
        secnd: WebIDL2.parse(`DummyError includes DummyErrorHelper;`),
      };

      assert.throws(() => {
        flattenIDL(specIDLs, customIDLs);
      }, "Interface mixin DummyErrorHelper not found for target DummyError");
    });

    it("Operation overloading", () => {
      const specIDLs = {
        cssom: WebIDL2.parse(
          `[Exposed=Window]
             namespace CSS {
               boolean supports();
             };`,
        ),
        paint: WebIDL2.parse(
          `partial namespace CSS {
               readonly attribute any paintWorklet;
             };`,
        ),
        paint2: WebIDL2.parse(
          `partial namespace CSS {
               boolean supports();
             };`,
        ),
      };
      assert.throws(() => {
        flattenIDL(specIDLs, customIDLs);
      }, "Duplicate definition of CSS.supports");
    });

    it("Partial missing main", () => {
      const specIDLs = {
        paint: WebIDL2.parse(
          `partial namespace CSS {
               readonly attribute any paintWorklet;
             };`,
        ),
      };
      assert.throws(() => {
        flattenIDL(specIDLs, customIDLs);
      }, "Original definition not found for partial namespace CSS");
    });
  });

  describe("getExposureSet", () => {
    // Combining spec and custom IDL is not important to these tests.
    const customIDLs = {};
    const scopes = new Set([
      "Window",
      "Worker",
      "SharedWorker",
      "ServiceWorker",
      "AudioWorklet",
      "RTCIdentityProvider",
    ]);

    it("no defined exposure set", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      assert.throws(
        () => {
          getExposureSet(interfaces[0], scopes);
        },
        Error,
        "Exposed extended attribute not found on interface Dummy",
      );
    });

    it("invalid exposure set", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=40]
          interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      assert.throws(
        () => {
          getExposureSet(interfaces[0], []);
        },
        Error,
        'Unexpected RHS "integer" for Exposed extended attribute',
      );
    });

    it("single exposure", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=Worker]
             interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      const exposureSet = getExposureSet(interfaces[0], scopes);
      assert.hasAllKeys(exposureSet, ["Worker"]);
    });

    it("multiple exposure", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=(Window,Worker)]
             interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      const exposureSet = getExposureSet(interfaces[0], scopes);
      assert.hasAllKeys(exposureSet, ["Window", "Worker"]);
    });

    it("wildcard exposure", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=*]
             interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      const exposureSet = getExposureSet(interfaces[0], scopes);
      assert.hasAllKeys(exposureSet, [...scopes]);
    });

    it("DedicatedWorker remaps to Worker", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=DedicatedWorker]
             interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      const exposureSet = getExposureSet(interfaces[0], scopes);
      assert.hasAllKeys(exposureSet, ["Worker"]);
    });

    it("invalid exposure", () => {
      const specIDLs = {
        first: WebIDL2.parse(
          `[Exposed=SomeWrongScope]
          interface Dummy {
               readonly attribute boolean imadumdum;
             };`,
        ),
      };
      const {ast} = flattenIDL(specIDLs, customIDLs);
      const interfaces = ast.filter((dfn) => dfn.type === "interface");
      assert.throws(
        () => {
          getExposureSet(interfaces[0], scopes);
        },
        Error,
        "interface Dummy is exposed on SomeWrongScope but SomeWrongScope is not a valid scope",
      );
    });
  });

  describe("buildIDLTests", () => {
    const scopes = new Set([
      "Window",
      "Worker",
      "SharedWorker",
      "ServiceWorker",
      "AudioWorklet",
    ]);

    it("interface with attribute", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Attr {
             attribute any name;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Attr": {
          code: '"Attr" in self',
          exposure: ["Window"],
        },
        "api.Attr.name": {
          code: '"Attr" in self && "name" in Attr.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("interface with method", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Node {
             boolean contains(Node? other);
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Node": {
          code: '"Node" in self',
          exposure: ["Window"],
        },
        "api.Node.contains": {
          code: '"Node" in self && "contains" in Node.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("interface with static method", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface MediaSource {
             static boolean isTypeSupported(DOMString type);
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.MediaSource": {
          code: '"MediaSource" in self',
          exposure: ["Window"],
        },
        "api.MediaSource.isTypeSupported_static": {
          code: '"MediaSource" in self && "isTypeSupported" in MediaSource',
          exposure: ["Window"],
        },
      });
    });

    it("interface with const", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Window {
             const boolean isWindow = true;
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Window": {
          code: '"Window" in self',
          exposure: ["Window"],
        },
      });
    });

    it("interface with event handler", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Foo {
             attribute EventHandler onadd;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Foo": {
          code: '"Foo" in self',
          exposure: ["Window"],
        },
        // XXX Event handlers are currently disabled
        // "api.Foo.add_event": {
        //   code: '"Foo" in self && "onadd" in Foo.prototype',
        //   exposure: ["Window"],
        // },
      });
    });

    it("interface with custom test", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface ANGLE_instanced_arrays {
            undefined drawArraysInstancedANGLE(
              GLenum mode,
              GLint first,
              GLsizei count,
              GLsizei primcount);

            undefined drawElementsInstancedANGLE(
              GLenum mode,
              GLsizei count,
              GLenum type,
              GLintptr offset,
              GLsizei primcount);
          };

          [Exposed=Window]
          interface Document {
            readonly attribute boolean loaded;
            readonly attribute DOMString? characterSet;
          };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.ANGLE_instanced_arrays": {
          code: `(function () {
  var canvas = document.createElement("canvas");
  var gl = canvas.getContext("webgl");
  var instance = gl.getExtension("ANGLE_instanced_arrays");
  return !!instance;
})();
`,
          exposure: ["Window"],
        },
        "api.ANGLE_instanced_arrays.drawArraysInstancedANGLE": {
          code: `(function () {
  var canvas = document.createElement("canvas");
  var gl = canvas.getContext("webgl");
  var instance = gl.getExtension("ANGLE_instanced_arrays");
  return true && instance && "drawArraysInstancedANGLE" in instance;
})();
`,
          exposure: ["Window"],
        },
        "api.ANGLE_instanced_arrays.drawElementsInstancedANGLE": {
          code: `(function () {
  var canvas = document.createElement("canvas");
  var gl = canvas.getContext("webgl");
  var instance = gl.getExtension("ANGLE_instanced_arrays");
  return !!instance && "drawElementsInstancedANGLE" in instance;
})();
`,
          exposure: ["Window"],
        },
        "api.Document": {
          code: '"Document" in self',
          exposure: ["Window"],
        },
        "api.Document.characterSet": {
          code: `(function () {
  return document.characterSet == "UTF-8";
})();
`,
          exposure: ["Window"],
        },
        "api.Document.loaded": {
          code: '"Document" in self && "loaded" in Document.prototype',
          exposure: ["Window"],
        },
        "api.Document.loaded.loaded_is_boolean": {
          code: `(function () {
  return typeof document.loaded === "boolean";
})();
`,
          exposure: ["Window"],
        },
      });
    });

    it("interface with legacy namespace", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window, LegacyNamespace=Thing]
           interface Legacy {
             readonly attribute string foo;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Thing.Legacy": {
          code: '"Thing" in self && "Legacy" in Thing',
          exposure: ["Window"],
        },
        "api.Thing.Legacy.foo": {
          code: '"Thing" in self && "Legacy" in Thing && "foo" in Thing.Legacy.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("interface with WebAssembly namespace", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window, LegacyNamespace=WebAssembly]
           interface Exception {
             readonly attribute string stack;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "webassembly.api.Exception": {
          code: '"WebAssembly" in self && "Exception" in WebAssembly',
          exposure: ["Window"],
        },
        "webassembly.api.Exception.stack": {
          code: '"WebAssembly" in self && "Exception" in WebAssembly && "stack" in WebAssembly.Exception.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("global interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Worker, Global=Worker]
           interface WorkerGlobalScope {
             attribute boolean isLoaded;
             const boolean active = true;
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.WorkerGlobalScope": {
          code: '"WorkerGlobalScope" in self',
          exposure: ["Worker"],
        },
        "api.WorkerGlobalScope.isLoaded": {
          code: '"isLoaded" in self',
          exposure: ["Worker"],
        },
      });
    });

    it("interface with constructor operation", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Number {
             constructor(optional any value);
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Number": {
          code: '"Number" in self',
          exposure: ["Window"],
        },
        "api.Number.Number": {
          code: "bcd.testConstructor('Number')",
          exposure: ["Window"],
        },
      });
    });

    it("iterable interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface DoubleList {
             iterable<double>;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.DoubleList": {
          code: '"DoubleList" in self',
          exposure: ["Window"],
        },
        "api.DoubleList.@@iterator": {
          code: '"Symbol" in self && "iterator" in Symbol && "DoubleList" in self && !!(DoubleList.prototype[Symbol.iterator])',
          exposure: ["Window"],
        },
        "api.DoubleList.entries": {
          code: '"DoubleList" in self && "entries" in DoubleList.prototype',
          exposure: ["Window"],
        },
        "api.DoubleList.forEach": {
          code: '"DoubleList" in self && "forEach" in DoubleList.prototype',
          exposure: ["Window"],
        },
        "api.DoubleList.keys": {
          code: '"DoubleList" in self && "keys" in DoubleList.prototype',
          exposure: ["Window"],
        },
        "api.DoubleList.values": {
          code: '"DoubleList" in self && "values" in DoubleList.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("async iterable interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface ReadableStream {
             async_iterable<any>;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.ReadableStream": {
          code: '"ReadableStream" in self',
          exposure: ["Window"],
        },
        "api.ReadableStream.@@asyncIterator": {
          code: '"Symbol" in self && "asyncIterator" in Symbol && "ReadableStream" in self && !!(ReadableStream.prototype[Symbol.asyncIterator])',
          exposure: ["Window"],
        },
        "api.ReadableStream.values": {
          code: '"ReadableStream" in self && "values" in ReadableStream.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("pair async iterable interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface AsyncMap {
             async_iterable<DOMString, any>;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.AsyncMap": {
          code: '"AsyncMap" in self',
          exposure: ["Window"],
        },
        "api.AsyncMap.@@asyncIterator": {
          code: '"Symbol" in self && "asyncIterator" in Symbol && "AsyncMap" in self && !!(AsyncMap.prototype[Symbol.asyncIterator])',
          exposure: ["Window"],
        },
        "api.AsyncMap.values": {
          code: '"AsyncMap" in self && "values" in AsyncMap.prototype',
          exposure: ["Window"],
        },
        "api.AsyncMap.entries": {
          code: '"AsyncMap" in self && "entries" in AsyncMap.prototype',
          exposure: ["Window"],
        },
        "api.AsyncMap.keys": {
          code: '"AsyncMap" in self && "keys" in AsyncMap.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("maplike interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface DoubleMap {
             maplike<DOMString, double>;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.DoubleMap": {
          code: '"DoubleMap" in self',
          exposure: ["Window"],
        },
        "api.DoubleMap.@@iterator": {
          code: '"Symbol" in self && "iterator" in Symbol && "DoubleMap" in self && !!(DoubleMap.prototype[Symbol.iterator])',
          exposure: ["Window"],
        },
        "api.DoubleMap.clear": {
          code: '"DoubleMap" in self && "clear" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.delete": {
          code: '"DoubleMap" in self && "delete" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.entries": {
          code: '"DoubleMap" in self && "entries" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.forEach": {
          code: '"DoubleMap" in self && "forEach" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.get": {
          code: '"DoubleMap" in self && "get" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.has": {
          code: '"DoubleMap" in self && "has" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.keys": {
          code: '"DoubleMap" in self && "keys" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.set": {
          code: '"DoubleMap" in self && "set" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.size": {
          code: '"DoubleMap" in self && "size" in DoubleMap.prototype',
          exposure: ["Window"],
        },
        "api.DoubleMap.values": {
          code: '"DoubleMap" in self && "values" in DoubleMap.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("setlike interface", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface DoubleSet {
             setlike<double>;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.DoubleSet": {
          code: '"DoubleSet" in self',
          exposure: ["Window"],
        },
        "api.DoubleSet.@@iterator": {
          code: '"Symbol" in self && "iterator" in Symbol && "DoubleSet" in self && !!(DoubleSet.prototype[Symbol.iterator])',
          exposure: ["Window"],
        },
        "api.DoubleSet.add": {
          code: '"DoubleSet" in self && "add" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.clear": {
          code: '"DoubleSet" in self && "clear" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.delete": {
          code: '"DoubleSet" in self && "delete" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.entries": {
          code: '"DoubleSet" in self && "entries" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.forEach": {
          code: '"DoubleSet" in self && "forEach" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.has": {
          code: '"DoubleSet" in self && "has" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.keys": {
          code: '"DoubleSet" in self && "keys" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.size": {
          code: '"DoubleSet" in self && "size" in DoubleSet.prototype',
          exposure: ["Window"],
        },
        "api.DoubleSet.values": {
          code: '"DoubleSet" in self && "values" in DoubleSet.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("interface with getter/setter", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface GetMe {
             getter GetMe (unsigned long index);
             setter undefined (GetMe data, optional unsigned long index);
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.GetMe": {
          code: '"GetMe" in self',
          exposure: ["Window"],
        },
      });
    });

    it("varied exposure", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window] interface Worker {};
           [Exposed=Worker] interface WorkerSync {};
           [Exposed=(Window,Worker)] interface MessageChannel {};
           [Exposed=Window] namespace console {
             undefined log(any... data);
           };
           [Exposed=Window] namespace GPUBufferUsage {};`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.console": {
          code: '"console" in self',
          exposure: ["Window"],
        },
        "api.console.log_static": {
          code: '"console" in self && "log" in console',
          exposure: ["Window"],
        },
        "api.MessageChannel": {
          code: '"MessageChannel" in self',
          exposure: ["Window", "Worker"],
        },
        "api.Worker": {
          code: '"Worker" in self',
          exposure: ["Window"],
        },
        "api.WorkerSync": {
          code: '"WorkerSync" in self',
          exposure: ["Worker"],
        },
      });
    });

    it("interface with stringifier", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Number {
             stringifier DOMString();
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Number": {
          code: '"Number" in self',
          exposure: ["Window"],
        },
        "api.Number.toString": {
          code: '"Number" in self && "toString" in Number.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("interface with named stringifier", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface HTMLAreaElement {
             stringifier readonly attribute USVString href;
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.HTMLAreaElement": {
          code: '"HTMLAreaElement" in self',
          exposure: ["Window"],
        },
        "api.HTMLAreaElement.href": {
          code: '"HTMLAreaElement" in self && "href" in HTMLAreaElement.prototype',
          exposure: ["Window"],
        },
        "api.HTMLAreaElement.toString": {
          code: '"HTMLAreaElement" in self && "toString" in HTMLAreaElement.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("operator variations", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface AudioNode : EventTarget {
             undefined disconnect ();
             undefined disconnect (unsigned long output);
             undefined disconnect (AudioNode destinationNode);
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.AudioNode": {
          code: '"AudioNode" in self',
          exposure: ["Window"],
        },
        "api.AudioNode.disconnect": {
          code: '"AudioNode" in self && "disconnect" in AudioNode.prototype',
          exposure: ["Window"],
        },
      });
    });

    it("namespace with attribute", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           namespace CSS {
             readonly attribute any paintWorklet;
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.CSS": {
          code: '"CSS" in self',
          exposure: ["Window"],
        },
        "api.CSS.paintWorklet_static": {
          code: '"CSS" in self && "paintWorklet" in CSS',
          exposure: ["Window"],
        },
      });
    });

    it("namespace with method", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           namespace CSS {
             boolean supports(CSSOMString property, CSSOMString value);
           };`,
      );
      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.CSS": {
          code: '"CSS" in self',
          exposure: ["Window"],
        },
        "api.CSS.supports_static": {
          code: '"CSS" in self && "supports" in CSS',
          exposure: ["Window"],
        },
      });
    });

    it("namespace with custom test", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           namespace Scope {
             readonly attribute any specialWorklet;
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.Scope": {
          code: `(function () {
  var scope = Scope;
  return !!scope;
})();
`,
          exposure: ["Window"],
        },
        "api.Scope.specialWorklet_static": {
          code: `"Scope" in self && "specialWorklet" in Scope`,
          exposure: ["Window"],
        },
      });
    });

    it("interface with legacy factory function", async () => {
      const ast = WebIDL2.parse(
        `[
             Exposed=Window,
             LegacyFactoryFunction=Image(DOMString src)
           ]
           interface HTMLImageElement {};`,
      );

      assert.deepEqual(await buildIDLTests(ast, [], scopes), {
        "api.HTMLImageElement": {
          code: '"HTMLImageElement" in self',
          exposure: ["Window"],
        },
        "api.HTMLImageElement.Image": {
          code: "bcd.testConstructor('Image')",
          exposure: ["Window"],
        },
      });
    });

    it("Globals", async () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Dummy {
             readonly attribute boolean imadumdum;
           };`,
      );
      const globals = WebIDL2.parse(
        `[Exposed=Window]
           interface mixin WindowOrWorkerGlobalScope {
             undefined atob();
           };`,
      );

      assert.deepEqual(await buildIDLTests(ast, globals, scopes), {
        "api.Dummy": {
          code: '"Dummy" in self',
          exposure: ["Window"],
        },
        "api.Dummy.imadumdum": {
          code: '"Dummy" in self && "imadumdum" in Dummy.prototype',
          exposure: ["Window"],
        },
        "api.atob": {
          code: '"atob" in self',
          exposure: ["Window", "Worker"],
        },
      });
    });
  });

  describe("validateIDL", () => {
    it("valid idl", () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Node {
             boolean contains(Node otherNode);
           };`,
      );
      assert.doesNotThrow(() => {
        validateIDL(ast);
      });
    });

    it("invalid idl", () => {
      const ast = WebIDL2.parse(`interface Invalid {};`);
      assert.throws(
        () => {
          validateIDL(ast);
        },
        `Web IDL validation failed:
Validation error at line 1, inside \`interface Invalid\`:
interface Invalid {};
          ^ Interfaces must have \`[Exposed]\` extended attribute. To fix, add, for example, \`[Exposed=Window]\`. Please also consider carefully if your interface should also be exposed in a Worker scope. Refer to the [WebIDL spec section on Exposed](https://heycam.github.io/webidl/#Exposed) for more information. [require-exposed]`,
      );
    });

    it("unknown types", () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Dummy {
             attribute Dumdum imadumdum;
           };`,
      );
      assert.throws(() => {
        validateIDL(ast);
      }, "Unknown type Dumdum");
    });

    it("ignored unknown types", () => {
      const ast = WebIDL2.parse(
        `[Exposed=Window]
           interface Dummy {
             attribute CSSOMString style;
           };`,
      );
      assert.doesNotThrow(() => {
        validateIDL(ast);
      });
    });

    it("allow LegacyNoInterfaceObject", () => {
      const ast = WebIDL2.parse(
        `[Exposed=(Window,Worker), LegacyNoInterfaceObject]
           interface ANGLE_instanced_arrays {};`,
      );
      assert.doesNotThrow(() => {
        validateIDL(ast);
      });
    });
  });
});
