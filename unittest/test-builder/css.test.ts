//
// mdn-bcd-collector: unittest/unit/css.test.ts
// Unittest for the CSS-specific test builder functions
//
// © Gooborg Studios, Google LLC, Apple Inc
// See the LICENSE file for copyright details
//

import chai, {assert} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);

import {build} from '../../test-builder/css.js';

describe('build (CSS)', () => {
  it('valid input', () => {
    const webrefCSS = {
      'css-fonts': {
        properties: [{name: 'font-family'}, {name: 'font-weight'}]
      },
      'css-grid': {
        properties: [{name: 'grid'}]
      }
    };

    const customCSS = {
      properties: {
        'font-family': {
          __values: ['emoji', 'system-ui'],
          __additional_values: {
            historic: ['sans-serif', 'serif']
          }
        },
        zoom: {}
      }
    };

    assert.deepEqual(build(webrefCSS, customCSS), {
      'css.properties.font-family': {
        code: 'bcd.testCSSProperty("font-family")',
        exposure: ['Window']
      },
      'css.properties.font-family.emoji': {
        code: 'bcd.testCSSProperty("font-family", "emoji")',
        exposure: ['Window']
      },
      'css.properties.font-family.historic': {
        code: 'bcd.testCSSProperty("font-family", "sans-serif") || bcd.testCSSProperty("font-family", "serif")',
        exposure: ['Window']
      },
      'css.properties.font-family.system-ui': {
        code: 'bcd.testCSSProperty("font-family", "system-ui")',
        exposure: ['Window']
      },
      'css.properties.font-weight': {
        code: 'bcd.testCSSProperty("font-weight")',
        exposure: ['Window']
      },
      'css.properties.grid': {
        code: 'bcd.testCSSProperty("grid")',
        exposure: ['Window']
      },
      'css.properties.zoom': {
        code: 'bcd.testCSSProperty("zoom")',
        exposure: ['Window']
      }
    });
  });

  it('with custom test', () => {
    const css = {
      'css-dummy': {
        properties: [{name: 'foo'}]
      }
    };

    assert.deepEqual(build(css, {properties: {}}), {
      'css.properties.foo': {
        code: `(function () {
  return 1;
})();
`,
        exposure: ['Window']
      }
    });
  });

  it('double-defined property', () => {
    const css = {
      'css-dummy': {
        properties: [{name: 'foo'}]
      }
    };

    assert.throws(() => {
      build(css, {properties: {foo: {}}});
    }, 'Custom CSS property already known: foo');
  });

  it('invalid import', () => {
    const css = {
      'css-dummy': {
        properties: [{name: 'bar'}]
      }
    };

    assert.deepEqual(build(css, {properties: {}}), {
      'css.properties.bar': {
        code: `(function () {
  throw "Test is malformed: <%css.properties.foo:a%> is an invalid import reference";
})();
`,
        exposure: ['Window']
      }
    });
  });
});
