//
// mdn-bcd-collector: custom-idl/index.ts
// Loader script to load the custom IDL to supplement @webref/idl
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import path from "node:path";

import fs from "fs-extra";
import * as WebIDL2 from "webidl2";

import type {IDLFiles} from "../../types/types.js";

/**
 * Parses the IDL files from a directory and returns an object mapping each
 * name (sans extension) to the parsed result of that text.
 * @returns The object mapping each name to the parsed IDL result.
 */
const parseIDL = async (): Promise<IDLFiles> => {
  const files = await fs.readdir(new URL(".", import.meta.url));
  files.sort();
  const results = {};
  for (const file of files) {
    /* c8 ignore next 3 */
    if (path.extname(file) !== ".idl") {
      continue;
    }

    const name = path.parse(file).name;
    const text = await fs.readFile(
      new URL(`./${file}`, import.meta.url),
      "utf8",
    );
    results[name] = WebIDL2.parse(text);
  }
  return results;
};

export default await parseIDL();
