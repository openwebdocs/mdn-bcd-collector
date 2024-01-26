//
// mdn-bcd-collector: unittest/unit/javascript.test.ts
// Unittest for the JavaScript-specific test builder functions
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);

import {build} from "./javascript.js";

describe("build (JavaScript)", () => {
  it("build", async () => {
    const specJS = [
      {
        type: "class",
        name: "Object",
        id: "sec-object-objects",
        global: true,
        extends: "null",
        ctor: {
          type: "constructor",
          name: "Object()",
          id: "sec-object-constructor",
          parameters: {
            required: 0,
            optional: 1,
            rest: false,
          },
          usage: "different",
        },
        staticProperties: [
          {
            type: "data-property",
            name: "Object.prototype",
            id: "sec-object.prototype",
            attributes: "",
          },
        ],
        staticMethods: [
          {
            type: "method",
            name: "Object.assign()",
            id: "sec-object.assign",
            parameters: {
              required: 1,
              optional: 0,
              rest: true,
            },
            length: 2,
          },
          {
            type: "method",
            name: "Object.create()",
            id: "sec-object.create",
            parameters: {
              required: 2,
              optional: 0,
              rest: false,
            },
          },
        ],
        prototypeProperties: [
          {
            type: "data-property",
            name: "Object.prototype.constructor",
            id: "sec-object.prototype.constructor",
            attributes: "wc",
          },
          {
            type: "accessor-property",
            name: "Object.prototype.__proto__",
            id: "sec-object.prototype.__proto__",
            attributes: "gsc",
          },
        ],
        instanceMethods: [
          {
            type: "method",
            name: "Object.prototype.hasOwnProperty()",
            id: "sec-object.prototype.hasownproperty",
            parameters: {
              required: 1,
              optional: 0,
              rest: false,
            },
          },
          {
            type: "method",
            name: "Object.prototype.__defineGetter__()",
            id: "sec-object.prototype.__defineGetter__",
            parameters: {
              required: 2,
              optional: 0,
              rest: false,
            },
          },
        ],
        instanceProperties: [],
      },
    ];

    const customJS = {
      builtins: {
        AggregateError: {
          ctor: {},
        },
        Array: {
          ctor: {},
          members: {static: ["@@species"], instance: ["at", "@@iterator"]},
        },
        Atomics: {
          members: {static: ["add"]},
        },
        BigInt: {
          ctor: {
            no_new: true,
          },
        },
      },
      operators: {
        addition: "var x = 1 + 1;",
      },
      statements: {
        var: "var x = 1;",
      },
    };

    assert.deepEqual(await build(specJS, customJS), {
      "javascript.builtins.Object": {
        code: '"Object" in self',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.Object": {
        code: '(function () {\n  if (!("Object" in self)) {\n    return { result: false, message: "Object is not defined" };\n  }\n  return bcd.testConstructor("Object", false);\n})();\n',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.assign": {
        code: '"Object" in self && "assign" in Object',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.create": {
        code: '"Object" in self && "create" in Object',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.proto": {
        code: '"Object" in self && "proto" in Object.prototype',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.hasOwnProperty": {
        code: '"Object" in self && "hasOwnProperty" in Object.prototype',
        exposure: ["Window"],
      },
      "javascript.builtins.Object.defineGetter": {
        code: '"Object" in self && "defineGetter" in Object.prototype',
        exposure: ["Window"],
      },
      "javascript.builtins.AggregateError": {
        code: '"AggregateError" in self',
        exposure: ["Window"],
      },
      "javascript.builtins.AggregateError.AggregateError": {
        code: `(function () {
  if (!("AggregateError" in self)) {
    return { result: false, message: "AggregateError is not defined" };
  }
  return bcd.testConstructor("AggregateError", false);
})();
`,
        exposure: ["Window"],
      },
      "javascript.builtins.Array": {
        code: '"Array" in self',
        exposure: ["Window"],
      },
      "javascript.builtins.Array.@@iterator": {
        code: '"Symbol" in self && "iterator" in Symbol && "Array" in self && !!(Array.prototype[Symbol.iterator])',
        exposure: ["Window"],
      },
      "javascript.builtins.Array.@@species": {
        code: '"Symbol" in self && "species" in Symbol && "Array" in self && !!(Array[Symbol.species])',
        exposure: ["Window"],
      },
      "javascript.builtins.Array.Array": {
        code: `(function () {
  if (!("Array" in self)) {
    return { result: false, message: "Array is not defined" };
  }
  return bcd.testConstructor("Array", false);
})();
`,
        exposure: ["Window"],
      },
      "javascript.builtins.Array.at": {
        code: '"Array" in self && "at" in Array.prototype',
        exposure: ["Window"],
      },
      "javascript.builtins.Atomics": {
        code: '"Atomics" in self',
        exposure: ["Window"],
      },
      "javascript.builtins.Atomics.add": {
        code: '"Atomics" in self && "add" in Atomics',
        exposure: ["Window"],
      },
      "javascript.builtins.BigInt": {
        code: '"BigInt" in self',
        exposure: ["Window"],
      },
      "javascript.builtins.BigInt.BigInt": {
        code: `(function () {
  if (!("BigInt" in self)) {
    return { result: false, message: "BigInt is not defined" };
  }
  return bcd.testConstructor("BigInt", true);
})();
`,
        exposure: ["Window"],
      },
      "javascript.operators.addition": {
        code: `(function() {
  try {
    var x = 1 + 1;
    return true;
  } catch(e) {
    return {result: false, message: e.message};
  }
})();`,
        exposure: ["Window"],
      },
      "javascript.statements.var": {
        code: `(function() {
  try {
    var x = 1;
    return true;
  } catch(e) {
    return {result: false, message: e.message};
  }
})();`,
        exposure: ["Window"],
      },
    });
  });
});
