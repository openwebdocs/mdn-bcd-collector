//
// mdn-bcd-collector: prepare.ts
// A main entry point to run various scripts in a cross-platform friendly way
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import fs from "node:fs";

import esMain from "es-main";

import exec from "./lib/exec.js";

/**
 * Prepares the environment for the MDN BCD Collector.
 * This function checks if the secrets.json file exists and copies it from secrets.sample.json if it doesn't.
 * If the environment is not set to "production", it installs Firefox for Puppeteer.
 * @returns A promise that resolves when the preparation is complete.
 */
const prepare = async () => {
  // Copy secrets.sample.json to secrets.json if needed
  const secretsPath = new URL("./secrets.json", import.meta.url);
  const secretsSamplePath = new URL("./secrets.sample.json", import.meta.url);

  if (!fs.existsSync(secretsPath)) {
    fs.copyFileSync(secretsSamplePath, secretsPath);
  }

  if (process.env.NODE_ENV !== "production") {
    // Install Firefox for Puppeteer
    process.chdir("node_modules/puppeteer");
    try {
      await exec("node install.mjs", {PUPPETEER_PRODUCT: "firefox"}, false);
    } catch (e) {
      console.error(`Failure preparing Puppeteer Firefox: ${e}`);
    }
    process.chdir("../..");
  }
};

if (esMain(import.meta)) {
  await prepare();
}
