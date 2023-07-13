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

export const BCD_DIR = process.env.BCD_DIR
  ? path.resolve(process.env.BCD_DIR)
  : fileURLToPath(new URL("../browser-compat-data", BASE_DIR));

export const RESULTS_DIR = process.env.RESULTS_DIR
  ? path.resolve(process.env.RESULTS_DIR)
  : fileURLToPath(new URL("../mdn-bcd-results", BASE_DIR));
