//
// mdn-bcd-collector: lib/constants.ts
// Common variables used throughout all of the collector
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {fileURLToPath} from "node:url";
import path from "node:path";

export const BASE_DIR = new URL("..", import.meta.url);

/**
 * The directory path for the Browser Compatibility Data (BCD) repository.
 * If the environment variable BCD_DIR is set, it uses the resolved path of BCD_DIR.
 * Otherwise, it uses the resolved path of "../browser-compat-data" relative to BASE_DIR.
 */
export const BCD_DIR = process.env.BCD_DIR
  ? path.resolve(process.env.BCD_DIR)
  : fileURLToPath(new URL("../browser-compat-data", BASE_DIR));

/**
 * The directory path where the results are stored.
 * If the RESULTS_DIR environment variable is set, it will be used.
 * Otherwise, the default path is resolved relative to the BASE_DIR.
 */
export const RESULTS_DIR = process.env.RESULTS_DIR
  ? path.resolve(process.env.RESULTS_DIR)
  : fileURLToPath(new URL("../mdn-bcd-results", BASE_DIR));
