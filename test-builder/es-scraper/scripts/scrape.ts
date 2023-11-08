import "../lib/polyfill.js";

import fs from "node:fs/promises";
import type { Section } from "../lib/types.js";
import { generatedPath, getSpec } from "../lib/utils.js";
import { collectIntrinsics } from "../lib/intrinsics.js";
import { collectEarlyErrors } from "../lib/early-errors.js";

const $ = await getSpec();

function buildTOC(root = $(":root > body")) {
  return root
    .children("emu-clause, emu-annex")
    .map((_, el): Section => {
      const subRoot = $(el);
      return {
        title: $(subRoot.children("h1").get()[0]!)
          .text()
          .replace(/[\s\n]+/gu, " ")
          .trim(),
        id: subRoot.attr("id")!,
        children: buildTOC(subRoot),
      };
    })
    .get();
}

const toc = buildTOC();
const intrinsics = collectIntrinsics(toc);
const earlyErrors = collectEarlyErrors(toc);

async function writeWithBackup(path: string, content: string, quiet: boolean = false) {
  const old = await fs.readFile(generatedPath(path), "utf8").catch(() => "");
  if (old === content) {
    if (!quiet) console.log(`No change to ${path}`);
  } else if (old !== "") {
    await fs.rename(
      generatedPath(path),
      generatedPath(path.replace(/\.\w+$/, ".bak$&")),
    );
    await fs.writeFile(generatedPath(path), content);
    if (!quiet) console.log(`Updated ${path}. Backup saved; remember to compare the diff.`);
  } else {
    await fs.writeFile(generatedPath(path), content);
    if (!quiet) console.log(`Created ${path}`);
  }
}

async function scrape(quiet = false) {
  await Promise.all([
    writeWithBackup("toc.json", JSON.stringify(toc, null, 2), quiet),
    writeWithBackup("intrinsics.json", JSON.stringify(intrinsics, null, 2), quiet),
    writeWithBackup("early-errors.json", JSON.stringify(earlyErrors, null, 2), quiet),
  ]);
}

export default scrape;
