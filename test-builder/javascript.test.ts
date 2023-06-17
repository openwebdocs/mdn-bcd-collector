//
// mdn-bcd-collector: unittest/unit/javascript.test.ts
// Unittest for the JavaScript-specific test builder functions
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);

import {build} from './javascript.js';

describe('build (JavaScript)', () => {
  it('build', () => {
    const customJS = {
      builtins: {
        AggregateError: {
          ctor_args: "[new Error('message')]",
        },
        Array: {
          ctor_args: '2',
        },
        'Array.prototype.at': {},
        'Array.prototype.@@iterator': {},
        'Array.@@species': {},
        Atomics: {},
        'Atomics.add': {},
        BigInt: {
          ctor_args: '1',
          ctor_new: false,
        },
      },
    };
    assert.deepEqual(build(customJS), {
      'javascript.builtins.AggregateError': {
        code: '"AggregateError" in self',
        exposure: ['Window'],
      },
      'javascript.builtins.AggregateError.AggregateError': {
        code: `(function () {
  if (!("AggregateError" in self)) {
    return { result: false, message: "AggregateError is not defined" };
  }
  return bcd.testConstructor("AggregateError");
})();
`,
        exposure: ['Window'],
      },
      'javascript.builtins.Array': {
        code: '"Array" in self',
        exposure: ['Window'],
      },
      'javascript.builtins.Array.@@iterator': {
        code: '"Symbol" in self && "iterator" in Symbol && "Array" in self && !!(Array.prototype[Symbol.iterator])',
        exposure: ['Window'],
      },
      'javascript.builtins.Array.@@species': {
        code: '"Symbol" in self && "species" in Symbol && "Array" in self && !!(Array[Symbol.species])',
        exposure: ['Window'],
      },
      'javascript.builtins.Array.Array': {
        code: `(function () {
  if (!("Array" in self)) {
    return { result: false, message: "Array is not defined" };
  }
  return bcd.testConstructor("Array");
})();
`,
        exposure: ['Window'],
      },
      'javascript.builtins.Array.at': {
        code: '"Array" in self && "at" in Array.prototype',
        exposure: ['Window'],
      },
      'javascript.builtins.Atomics': {
        code: '"Atomics" in self',
        exposure: ['Window'],
      },
      'javascript.builtins.Atomics.add': {
        code: '"Atomics" in self && "add" in Atomics',
        exposure: ['Window'],
      },
      'javascript.builtins.BigInt': {
        code: '"BigInt" in self',
        exposure: ['Window'],
      },
      'javascript.builtins.BigInt.BigInt': {
        code: `(function () {
  if (!("BigInt" in self)) {
    return { result: false, message: "BigInt is not defined" };
  }
  return bcd.testConstructor("BigInt");
})();
`,
        exposure: ['Window'],
      },
    });
  });
});
