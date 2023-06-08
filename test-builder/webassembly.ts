//
// mdn-bcd-collector: test-builder/webassembly.ts
// Functions directly related to building all of the WebAssembly tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {compileTest} from './common.js';

const build = (customWasm) => {
  const features = Object.entries(customWasm.features) as any[];

  const tests = {};
  for (const [feature, details] of features) {
    const path = ['webassembly', 'features', feature].join('.');
    tests[path] = compileTest({
      raw: {
        // 'wfd-key' stands for 'wasm-feature-detect key'
        code: `bcd.testWasmFeature('${details['wfd-key']}')`
      },
      exposure: ['Window']
    });
  }
  return tests;
};
export {build};
