//
// mdn-bcd-collector: test-builder/webassembly.ts
// Functions directly related to building all of the WebAssembly tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import {compileTest} from "./common.js";

const build = async (wasmFeatures) => {
  const features = Object.keys(wasmFeatures) as any[];

  // BCD doesn't use the same keys as the wasm-feature-detect package
  // Map known keys to BCD keys and use keys from the package otherwise

  const wasmBCDMap = new Map([
    ["bigInt", "BigInt-to-i64-integration"],
    ["exceptions", "exception-handling"],
    ["extendedConst", "extended-constant-expressions"],
    ["gc", "garbage-collection"],
    ["multiValue", "multi-value"],
    ["mutableGlobals", "mutable-globals"],
    ["referenceTypes", "reference-types"],
    ["relaxedSimd", "relaxed-SIMD"],
    ["saturatedFloatToInt", "non-trapping-float-to-int-conversions"],
    ["signExtensions", "sign-extension-operations"],
    ["simd", "fixed-width-SIMD"],
    ["tailCall", "tail-calls"],
    ["threads", "threads-and-atomics"],
  ]);

  const tests = {};
  for (const feature of features) {
    const bcdPath = wasmBCDMap.has(feature) ? wasmBCDMap.get(feature) : feature;
    tests[`webassembly.${bcdPath}`] = compileTest({
      raw: {
        code: `bcd.testWasmFeature('${feature}')`,
      },
      exposure: ["WebAssembly"],
    });
  }
  return tests;
};
export {build};
