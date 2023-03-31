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

import * as WebIDL2 from 'webidl2';
import sinon from 'sinon';

import {
  compileTestCode,
  compileTest,
  getCustomTestData,
  getCustomTest
} from '../../test-builder/common.js';

import type {RawTest} from '../../types/types.js';

describe('build (common)', () => {
  describe('getCustomTest(Data)', () => {
    const expectedResults = {
      'api.FooBar': [
        {
          __base: "'hello world';",
          __test: "return 'hello world!';",
          __resources: []
        },
        {
          test: '(function () {\n  "hello world";\n  return "hello world!";\n})();\n',
          resources: {}
        }
      ],
      'api.FooBar.foo': [
        {
          __base: "'hello world';",
          __test: "return 'hi, world!';",
          __resources: []
        },
        {
          test: '(function () {\n  "hello world";\n  return "hi, world!";\n})();\n',
          resources: {}
        }
      ],
      'api.FooBar.foo.pear': [
        {
          __base: "'hello world';",
          __test: false,
          __resources: []
        },
        // XXX Not accurate
        {test: '(function () {\n  "hello world";\n})();\n', resources: {}}
      ],
      'api.FooBar.bar': [
        {
          __base: "'hello world';\n'goodbye world';",
          __test: "return 'farewell world!';",
          __resources: []
        },
        {
          test: '(function () {\n  "hello world";\n  "goodbye world";\n  return "farewell world!";\n})();\n',
          resources: {}
        }
      ],
      'api.FooBar.bar.cinnamon': [
        {
          __base: "'hello world';\n'goodbye world';",
          __test: false,
          __resources: []
        },
        // XXX Not accurate
        {
          test: '(function () {\n  "hello world";\n  "goodbye world";\n})();\n',
          resources: {}
        }
      ],
      'api.FooBar.baz': [
        {
          __base: "'hello world';",
          __test: false,
          __resources: []
        },
        // XXX Not accurate
        {test: '(function () {\n  "hello world";\n})();\n', resources: {}}
      ],
      'api.Chocolate': [
        {
          __base: false,
          __test: false,
          __resources: []
        },
        {test: false, resources: {}}
      ],
      'api.audiocontext': [
        {
          __base: false,
          __test: 'return false;',
          __resources: ['audio-blip']
        },
        {
          test: '(function () {\n  return false;\n})();\n',
          resources: {
            'audio-blip': {
              type: 'audio',
              src: ['/media/blip.mp3', '/media/blip.ogg']
            }
          }
        }
      ],
      'api.WebGLRenderingContext': [
        {
          __base: 'return reusableInstances.webGL;',
          __test: false,
          __resources: ['webGL']
        },
        {
          // XXX Not accurate
          test: '(function () {\n  return reusableInstances.webGL;\n})();\n',
          resources: {
            webGL: {
              type: 'instance',
              src: `var canvas = document.createElement('canvas');
if (!canvas) {
  return false;
};
return canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');`
            }
          }
        }
      ]
    };

    for (const [k, v] of Object.entries(expectedResults)) {
      it(k, () => {
        assert.deepEqual(getCustomTestData(k), v[0]);
        assert.deepEqual(getCustomTest(k), v[1]);
      });
    }

    it('api.badresource (throw error on bad resource reference)', () => {
      assert.throws(
        () => {
          getCustomTest('api.badresource');
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
        resources: {
          'audio-blip': {
            type: 'audio',
            src: ['/media/blip.mp3', '/media/blip.ogg']
          }
        },
        exposure: ['Window']
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"Document" in self && "body" in Document.prototype',
        exposure: ['Window'],
        resources: {
          'audio-blip': {
            type: 'audio',
            src: ['/media/blip.mp3', '/media/blip.ogg']
          }
        }
      });
    });

    describe('custom tests', () => {
      it('one item', () => {
        const rawTest: RawTest = {
          raw: {
            code: 'foo',
            combinator: '&&'
          },
          resources: {},
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
          resources: {},
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
          resources: {},
          exposure: ['Window']
        },
        {
          raw: {
            code: ['true', 'true'],
            combinator: '||'
          },
          resources: {},
          exposure: ['Window']
        },
        {
          raw: {
            code: ['true', 'true'],
            combinator: '&&'
          },
          resources: {},
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
        resources: {},
        exposure: ['Window']
      };

      assert.deepEqual(compileTest(rawTest), {
        code: '"fontFamily" in document.body.style || "font-family" in document.body.style',
        exposure: ['Window']
      });
    });
  });
});
