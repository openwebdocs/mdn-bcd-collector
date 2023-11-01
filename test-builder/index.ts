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

import customIDL from "../custom/idl/index.js";

import {build as buildAPI} from "./api.js";
import {build as buildCSS} from "./css.js";
import {build as buildElements} from "./elements.js";
import {build as buildJS} from "./javascript.js";
import {build as buildWasm} from "./webassembly.js";
import {customTests} from "./common.js";

import type {IDLFiles} from "../types/types.js";

const specJS = await fs.readJson(
  new URL("../es-scraper/generated/intrinsics.json", import.meta.url),
);

const customCSS = await fs.readJson(
  new URL("../custom/css.json", import.meta.url),
);
const customElements = await fs.readJson(
  new URL("../custom/elements.json", import.meta.url),
);
const customJS = await fs.readJson(
  new URL("../custom/js.json", import.meta.url),
);
const customWasm = await fs.readJson(
  new URL("../custom/wasm.json", import.meta.url),
);

/* c8 ignore start */
const build = async (customIDL: IDLFiles, customCSS) => {
  const specIDLs: IDLFiles = await idl.parseAll();
  const specCSS = await css.listAll();
  const specElements = await elements.listAll();

  const tests = Object.assign(
    {__resources: customTests.__resources},
    await buildAPI(specIDLs, customIDL),
    await buildCSS(specCSS, customCSS),
    await buildElements(specElements, customElements),
    await buildJS(specJS, customJS),
    await buildWasm(customWasm),
  );

  await fs.writeJson(new URL("../tests.json", import.meta.url), tests);
};

if (esMain(import.meta)) {
  await build(customIDL, customCSS);
}
/* c8 ignore stop */
