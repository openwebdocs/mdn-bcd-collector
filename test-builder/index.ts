//
// mdn-bcd-collector: test-builder/index.ts
// Script to build all of the tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import esMain from 'es-main';
import fs from 'fs-extra';

import customIDL from '../custom-idl/index.js';

import {build as buildAPI} from './api.js';
import {build as buildCSS} from './css.js';
import {build as buildJS} from './javascript.js';

import type {
  Test,
  RawTest,
  RawTestCodeExpr,
  Exposure,
  Resources,
  IDLFiles
} from '../types/types.js';

const customCSS = await fs.readJson(
  new URL('../custom-css.json', import.meta.url)
);
const customJS = await fs.readJson(
  new URL('../custom-js.json', import.meta.url)
);

/* c8 ignore start */
const build = async (customIDL: IDLFiles, customCSS) => {
  const APITests = await buildAPI(customIDL);
  const CSSTests = await buildCSS(customCSS);
  const JSTests = await buildJS(customJS);
  const tests = Object.assign({}, APITests, CSSTests, JSTests);

  await fs.writeJson(new URL('./tests.json', import.meta.url), tests);
};

if (esMain(import.meta)) {
  await build(customIDL, customCSS);
}
/* c8 ignore stop */
