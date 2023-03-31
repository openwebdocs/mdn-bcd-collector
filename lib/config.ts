//
// mdn-bcd-collector: lib/config.ts
// Common variables used throughout all of the collector
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import {fileURLToPath} from 'node:url';

export const BASE_DIR = new URL('..', import.meta.url);

export const BCD_DIR = fileURLToPath(
  new URL(process.env.BCD_DIR || '../browser-compat-data', BASE_DIR)
);

export const RESULTS_DIR = fileURLToPath(
  new URL(process.env.RESULTS_DIR || '../mdn-bcd-results', BASE_DIR)
);
