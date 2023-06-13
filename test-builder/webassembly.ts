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
    tests[`webassembly.${feature}`] = compileTest({
      raw: {
        // 'wfd-key' stands for 'wasm-feature-detect key'
        code: `bcd.testWasmFeature('${details['wfd-key']}')`,
      },
      exposure: ['WebAssembly'],
    });
  }
  return tests;
};
export {build};
