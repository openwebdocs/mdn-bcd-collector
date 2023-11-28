import fs from "node:fs/promises";
import Path from "node:path";
import { generatedPath } from "../lib/utils.js";

const specFilePath = generatedPath("spec.html");

// Ensure the generated directory exists
try {
  await fs.access(Path.dirname(specFilePath));
} catch {
  await fs.mkdir(Path.dirname(specFilePath));
}

const { sha: newSHA } = await fetch(
  "https://api.github.com/repos/tc39/ecma262/commits/main",
).then((res) => res.json());

async function sync(quiet = false) {
  try {
    const revision = await fs.readFile(specFilePath, "utf-8");
    const oldSHA = revision.match(/<!-- REVISION: (?<sha>.*) -->/)!.groups!.sha!;
    if (oldSHA === newSHA) {
      if (!quiet) console.log("No new changes found. Not re-generating files.");
      return;
    } else {
      if (!quiet) console.log("New version detected. Downloading...");
    }
  } catch {
    // If we couldn't read the old file, continue
    if (!quiet) console.log("No existing spec.html detected. Downloading...");
  }

  // Cannot use the API endpoint because the file is too big
  const data = await fetch(
    "https://raw.githubusercontent.com/tc39/ecma262/main/spec.html",
  ).then((res) => res.text());

  await fs.writeFile(specFilePath, `<!-- REVISION: ${newSHA} -->\n${data}`);

  if (!quiet) console.log(`Download completed! Saved to ${specFilePath}.`);
}

export default sync;
