//
// mdn-bcd-collector: prepare-resources.ts
// Script to prepare resources for the webserver, including SCSS compilation and
// copying files from node modules
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import path from "node:path";
import {fileURLToPath} from "node:url";

import esMain from "es-main";
import fs from "fs-extra";
import * as sass from "sass";

const generatedDir = fileURLToPath(new URL("./generated", import.meta.url));

/**
 * Copies the specified resources to their destination directories.
 * @returns A promise that resolves when all resources are copied.
 */
const copyResources = async () => {
  const resources = [
    ["json3/lib/json3.min.js", "resources"],
    ["chai/chai.js", "unittest"],
    ["mocha/mocha.css", "unittest"],
    ["mocha/mocha.js", "unittest"],
    ["mocha/mocha.js.map", "unittest"],
    ["sinon/pkg/sinon.js", "unittest"],
    ["@browser-logos/chrome/chrome_64x64.png", "browser-logos", "chrome.png"],
    ["@browser-logos/edge/edge_64x64.png", "browser-logos", "edge.png"],
    [
      "@browser-logos/firefox/firefox_64x64.png",
      "browser-logos",
      "firefox.png",
    ],
    ["@browser-logos/opera/opera_64x64.png", "browser-logos", "opera.png"],
    ["@browser-logos/safari/safari_64x64.png", "browser-logos", "safari.png"],
    ["@mdi/font/css/materialdesignicons.min.css", "resources"],
    ["@mdi/font/fonts/materialdesignicons-webfont.eot", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.ttf", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.woff", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.woff2", "fonts"],
    ["highlight.js/styles/stackoverflow-dark.css", "resources/highlight.js"],
    ["highlight.js/styles/stackoverflow-light.css", "resources/highlight.js"],
    ["mermaid/dist/mermaid.min.js", "resources"],
    [
      "wasm-feature-detect/dist/umd/index.js",
      "resources",
      "wasm-feature-detect.js",
    ],
  ];
  for (const [srcInModules, destInGenerated, newFilename] of resources) {
    const src = fileURLToPath(
      new URL(`./node_modules/${srcInModules}`, import.meta.url),
    );
    const destDir = path.join(generatedDir, destInGenerated);
    const dest = path.join(destDir, path.basename(src));
    await fs.ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
    if (newFilename) {
      await fs.rename(dest, path.join(destDir, newFilename));
    }
  }
};

/**
 * Generates CSS from SCSS file and writes it to the specified output path.
 * @returns A promise that resolves when the CSS generation and writing is complete.
 */
const generateCSS = async () => {
  const scssPath = fileURLToPath(new URL("./style.scss", import.meta.url));
  const outPath = path.join(generatedDir, "resources", "style.css");
  const result = sass.compile(scssPath);
  await fs.writeFile(outPath, result.css.toString(), "utf8");
};

/**
 * Prepares the necessary resources for the application.
 * This function copies resources and generates CSS.
 */
const prepareResources = async () => {
  await copyResources();
  await generateCSS();
};

if (esMain(import.meta)) {
  await prepareResources();
}
