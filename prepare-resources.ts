import path from "node:path";
import {fileURLToPath} from "node:url";

import esMain from "es-main";
import fs from "fs-extra";

const generatedDir = fileURLToPath(new URL("./generated", import.meta.url));

/**
 * Copies the specified resources to their destination directories.
 * @returns A promise that resolves when all resources are copied.
 */
const copyResources = async () => {
  const resources = [
    ["json3/lib/json3.min.js", "resources"],
    ["@mdi/font/css/materialdesignicons.min.css", "resources"],
    ["@mdi/font/fonts/materialdesignicons-webfont.eot", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.ttf", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.woff", "fonts"],
    ["@mdi/font/fonts/materialdesignicons-webfont.woff2", "fonts"],
    ["highlight.js/styles/stackoverflow-dark.css", "resources/highlight.js"],
    ["highlight.js/styles/stackoverflow-light.css", "resources/highlight.js"],
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

if (esMain(import.meta)) {
  await copyResources();
}
