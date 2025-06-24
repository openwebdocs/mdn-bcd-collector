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
 * Tests a specified path to see if it's a local checkout of mdn/browser-compat-data
 * @param dir The directory to test
 * @returns {boolean} If the directory is a BCD checkout
 */
const try_bcd_dir = (dir) => {
  try {
    const packageJsonFile = fs.readFileSync(`${dir}/package.json`);
    const packageJson = JSON.parse(packageJsonFile.toString("utf8"));
    if (packageJson.name == "@mdn/browser-compat-data") {
      return true;
    }
    return false;
  } catch (e) {
    // If anything fails, we know that we're not looking at BCD
    return false;
  }
};

/**
 * Tests a specified path to see if it's a local checkout of mdn-bcd-results
 * @param dir The directory to test
 * @returns {boolean} If the directory is a mdn-bcd-results checkout
 */
const try_results_dir = (dir) => {
  try {
    return fs.existsSync(`${dir}/README.md`);
  } catch (e) {
    // If anything fails, we know that we're not looking at mdn-bcd-results
    return false;
  }
};

/**
 * Returns a valid directory path based upon environment variable or relative path and a checker function, or throws an error if none is found
 * @param env_variable The name of the environment variable to check
 * @param relative_path The expected relative path
 * @param github_url The URL to the GitHub repository for the expected folder
 * @param try_func The function to run to test if the path is a valid checkout of the expected repository
 * @returns {string} The path detected
 * @throws An error if no valid path detected
 */
const get_dir = (env_variable, relative_path, github_url, try_func) => {
  if (process.env[env_variable]) {
    const env_dir = path.resolve(process.env[env_variable]);
    if (try_func(env_dir)) {
      return env_dir;
    }
  }

  const relative_dir = fileURLToPath(new URL(relative_path, BASE_DIR));
  if (try_func(relative_dir)) {
    return relative_dir;
  }

  throw new Error(
    `You must have ${github_url} locally checked out, and its path defined using the ${env_variable} environment variable.`,
  );
};

/**
 * The directory path for the Browser Compatibility Data (BCD) repository.
 * If the environment variable BCD_DIR is set, it uses the resolved path of BCD_DIR.
 * Otherwise, it uses the resolved path of "../browser-compat-data" relative to BASE_DIR.
 * @returns The directory where BCD is located
 * @throws An error if no valid BCD path detected
 */
export const getBCDDir = () =>
  get_dir(
    "BCD_DIR",
    "../browser-compat-data",
    "https://github.com/mdn/browser-compat-data",
    try_bcd_dir,
  );

/**
 * The directory path where the results are stored.
 * If the RESULTS_DIR environment variable is set, it will be used.
 * Otherwise, the default path is resolved relative to the BASE_DIR.
 * @returns The directory where mdn-bcd-results is located
 * @throws An error if no valid mdn-bcd-results path detected
 */
export const getResultsDir = () =>
  process.env.NODE_ENV === "test"
    ? ""
    : get_dir(
        "RESULTS_DIR",
        "../mdn-bcd-results",
        "https://github.com/openwebdocs/mdn-bcd-results",
        try_results_dir,
      );
