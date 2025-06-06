//
// mdn-bcd-collector: lib/constants.ts
// Common variables used throughout all of the collector
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {fileURLToPath} from "node:url";
import path from "node:path";
import fs from "node:fs";

export const BASE_DIR = new URL("..", import.meta.url);

/**
 * The directory path for the Browser Compatibility Data (BCD) repository.
 * If the environment variable BCD_DIR is set, it uses the resolved path of BCD_DIR.
 * Otherwise, it uses the resolved path of "../browser-compat-data" relative to BASE_DIR.
 */
let _get_bcd_dir = {
  confirmed_path: null,
  try_bcd_dir(dir) {
    try {
      const packageJsonFile = fs.readFileSync(`${dir}/package.json`);
      const packageJson = JSON.parse(packageJsonFile);
      if (packageJson.name == "@mdn/browser-compat-data") {
        return true;
      }
      return false;
    } catch (e) {
      // If anything fails, we know that we're not looking at BCD
      return false;
    }
  },
  get dir() {
    if (this.confirmed_path) {
      return this.confirmed_path;
    }

    // First run: determine the BCD path
    if (process.env.BCD_DIR) {
      const env_dir = path.resolve(process.env.BCD_DIR);
      if (this.try_bcd_dir(env_dir)) {
        this.confirmed_path = env_dir;
        return env_dir;
      }
    }

    const relative_dir = fileURLToPath(
      new URL("../browser-compat-data", BASE_DIR),
    );
    if (this.try_bcd_dir(relative_dir)) {
      this.confirmed_path = relative_dir;
      return relative_dir;
    }

    throw new Error(
      "You must have https://github.com/mdn/browser-compat-data locally checked out, and its path defined using the BCD_DIR environment variable.",
    );
  },
};
export const BCD_DIR = _get_bcd_dir.dir;

/**
 * The directory path where the results are stored.
 * If the RESULTS_DIR environment variable is set, it will be used.
 * Otherwise, the default path is resolved relative to the BASE_DIR.
 */
export const RESULTS_DIR = process.env.RESULTS_DIR
  ? path.resolve(process.env.RESULTS_DIR)
  : fileURLToPath(new URL("../mdn-bcd-results", BASE_DIR));
