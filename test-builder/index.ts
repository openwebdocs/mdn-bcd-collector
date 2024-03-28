//
// mdn-bcd-collector: test-builder/index.ts
// Script to build all of the tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import esMain from "es-main";
import fs from "fs-extra";
import idl from "@webref/idl";
import css from "@webref/css";
import elements from "@webref/elements";
import {getIntrinsics} from "es-scraper";
import * as wasmFeatures from "wasm-feature-detect";

import customIDL from "../custom/idl/index.js";

import {build as buildAPI} from "./api.js";
import {build as buildCSS} from "./css.js";
import {build as buildElements} from "./elements.js";
import {build as buildJS} from "./javascript.js";
import {build as buildWasm} from "./webassembly.js";
import {customTests} from "./common.js";

import type {IDLFiles} from "../types/types.js";
import appVersion from "../lib/app-version.js";

const customCSS = await fs.readJson(
  new URL("../custom/css.json", import.meta.url),
);
const customElements = await fs.readJson(
  new URL("../custom/elements.json", import.meta.url),
);
const customJS = await fs.readJson(
  new URL("../custom/js.json", import.meta.url),
);

/* c8 ignore start */
/**
 * Builds the tests.
 */
const build = async () => {
  const specIDLs: IDLFiles = await idl.parseAll();
  const specCSS = await css.listAll();
  const specElements = await elements.listAll();
  const specJS = await getIntrinsics();

  const tests = Object.assign(
    {
      __version: appVersion,
      __resources: customTests.__resources,
    },
    await buildAPI(specIDLs, customIDL),
    await buildCSS(specCSS, customCSS),
    await buildElements(specElements, customElements),
    await buildJS(specJS, customJS),
    await buildWasm(wasmFeatures),
  );

  await fs.writeJson(new URL("../tests.json", import.meta.url), tests);
};

if (esMain(import.meta)) {
  await build();
}
/* c8 ignore stop */
