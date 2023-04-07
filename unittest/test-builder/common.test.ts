//
// mdn-bcd-collector: unittest/test-builder/common.test.ts
// Unittest for the common functions in the test builder script
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);

import type {RawTest} from '../../types/types.js';

import {
  compileTestCode,
  compileTest,
  getCustomTestData,
  getCustomTest,
  CustomTestData,
  CustomTestResult
} from '../../test-builder/common.js';

describe('build (common)', () => {
  describe('getCustomTest(Data)', () => {
    const expectedResults: {
      [k: string]: {
        category: string;
        data: CustomTestData;
        result: CustomTestResult;
      };
    } = {
      'api.FooBar': {
        category: 'api',
        data: {
          __base: "'hello world';",
          __test: "return 'hello world!';",
          __resources: [],
          __additional: {}
        },
        result: {
          test: '(function () {\n  "hello world";\n  return "hello world!";\n})();\n',
          resources: [],
          additional: {}
        }
      },
      'api.FooBar.foo': {
        category: 'api',
        data: {
          __base: "'hello world';",
          __test: "return 'hi, world!';",
          __resources: [],
          __additional: {}
        },
        result: {
          test: '(function () {\n  "hello world";\n  return "hi, world!";\n})();\n',
          resources: [],
          additional: {}
        }
      },
      'api.FooBar.foo.pear': {
        category: 'api',
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {}
        },
        result: {
          test: false,
          resources: [],
          additional: {}
        }
      },
      'api.FooBar.bar': {
        category: 'api',
        data: {
          __base: "'hello world';\n'goodbye world';",
          __test: "return 'farewell world!';",
          __resources: [],
          __additional: {
            cinnamon: "return 'snickerdoodle';"
          }
        },
        result: {
          test: '(function () {\n  "hello world";\n  "goodbye world";\n  return "farewell world!";\n})();\n',
          resources: [],
          additional: {
            cinnamon:
              '(function () {\n  "hello world";\n  "goodbye world";\n  return "snickerdoodle";\n})();\n'
          }
        }
      },
      'api.FooBar.baz': {
        category: 'api',
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {}
        },
        result: {
          test: '(function () {\n  "hello world";\n  return !!instance && "baz" in instance;\n})();\n',
          resources: [],
          additional: {}
        }
      },
      'api.FooBar.FooBar': {
        category: 'api',
        data: {
          __base: "'hello world';",
          __test: false,
          __resources: [],
          __additional: {}
        },
        result: {
          test: false,
          resources: [],
          additional: {}
        }
      },
      'api.nonexistent': {
        category: 'api',
        data: {
          __base: false,
          __test: false,
          __resources: [],
          __additional: {}
        },
        result: {test: false, resources: [], additional: {}}
      },
      'api.audiocontext': {
        category: 'api',
        data: {
          __base: false,
          __test: 'return false;',
          __resources: ['audio-blip'],
          __additional: {}
        },
        result: {
          test: '(function () {\n  return false;\n})();\n',
          resources: ['audio-blip'],
          additional: {}
        }
      },
      'api.WebGLRenderingContext': {
        category: 'api',
        data: {
          __base: 'var instance = reusableInstances.webGL;',
          __test: false,
          __resources: ['webGL'],
          __additional: {}
        },
        result: {
          // XXX Not accurate
          test: '(function () {\n  var instance = reusableInstances.webGL;\n  return !!instance;\n})();\n',
          resources: ['webGL'],
          additional: {}
        }
      }
    };

    for (const [k, v] of Object.entries(expectedResults)) {
      it(k, () => {
        assert.deepEqual(getCustomTestData(k), v.data);
        assert.deepEqual(getCustomTest(k, v.category), v.result);
      });
    }

    it('api.badresource (throw error on bad resource reference)', () => {
      assert.throws(
        () => {
          getCustomTest('api.badresource', 'api');
        },
        Error,
        'Resource bad-resource is not defined but referenced in api.badresource'
      );
    });
  });

  describe('compileTestCode', () => {
    it('string', () => {
      assert.equal(compileTestCode('a string'), 'a string');
    });

    it('constructor', () => {
      const test = {
        property: 'constructor.AudioContext',
        owner: 'AudioContext'
      };
      assert.equal(
        compileTestCode(test),
        'bcd.testConstructor("AudioContext");'
      );
    });

    it('Symbol', () => {
      const test = {property: 'Symbol.iterator', owner: 'DOMMatrixReadOnly'};
      assert.equal(
        compileTestCode(test),
        '"Symbol" in self && "iterator" in Symbol && "DOMMatrixReadOnly" in self && Symbol.iterator in DOMMatrixReadOnly.prototype'
      );
    });

    it('namespace', () => {
      const test = {property: 'log', owner: 'console'};
      assert.equal(
        compileTestCode(test),
        '"console" in self && "log" in console'
      );
    });

    it('constructor', () => {
      const test = {
        property: 'm11',
        owner: 'DOMMatrix.prototype',
        inherit: true
      };
      assert.equal(
        compileTestCode(test),
        '"DOMMatrix" in self && Object.prototype.hasOwnProperty.call(DOMMatrix.prototype, "m11")'
      );
    });
  });

  describe('compileTest', () => {
    it('main', () => {
      const rawTest: RawTest = {
        raw: {
          code: {property: 'body', owner: `Document.prototype`}
        },
        resources: ['audio-blip'],
        exposure: ['Window']
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"Document" in self && "body" in Document.prototype',
        exposure: ['Window'],
        resources: ['audio-blip']
      });
    });

    describe('custom tests', () => {
      it('one item', () => {
        const rawTest: RawTest = {
          raw: {
            code: 'foo',
            combinator: '&&'
          },
          resources: [],
          additional: {},
          exposure: ['Window']
        };

        assert.deepEqual(compileTest(rawTest), {
          code: 'foo',
          exposure: ['Window']
        });
      });

      it('two items', () => {
        const rawTest: RawTest = {
          raw: {
            code: ['foo', 'foo'],
            combinator: '&&'
          },
          resources: [],
          additional: {},
          exposure: ['Window']
        };

        assert.deepEqual(compileTest(rawTest), {
          code: 'foo && foo',
          exposure: ['Window']
        });
      });
    });

    it('no-repeated test code', () => {
      const rawTests: RawTest[] = [
        {
          raw: {
            code: 'true',
            combinator: '&&'
          },
          resources: [],
          additional: {},
          exposure: ['Window']
        },
        {
          raw: {
            code: ['true', 'true'],
            combinator: '||'
          },
          resources: [],
          additional: {},
          exposure: ['Window']
        },
        {
          raw: {
            code: ['true', 'true'],
            combinator: '&&'
          },
          resources: [],
          additional: {},
          exposure: ['Worker']
        }
      ];

      assert.deepEqual(compileTest(rawTests[0]), {
        code: 'true',
        exposure: ['Window']
      });
      assert.deepEqual(compileTest(rawTests[1]), {
        code: 'true || true',
        exposure: ['Window']
      });
      assert.deepEqual(compileTest(rawTests[2]), {
        code: 'true && true',
        exposure: ['Worker']
      });
    });

    it('CSS', () => {
      const rawTest: RawTest = {
        raw: {
          code: [
            {property: 'fontFamily', owner: 'document.body.style'},
            {property: 'font-family', owner: 'document.body.style'}
          ],
          combinator: '||'
        },
        resources: [],
        exposure: ['Window']
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"fontFamily" in document.body.style || "font-family" in document.body.style',
        exposure: ['Window']
      });
    });
  });
});
