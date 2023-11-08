import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import * as Cheerio from "cheerio";

export function generatedPath(name: string): string {
  return fileURLToPath(new URL(`../generated/${name}`, import.meta.url));
}

export async function getSpec() {
  return await fs
    .readFile(generatedPath("spec.html"))
    .then((content) => Cheerio.load(content))
    .catch(() => {
      throw Error(
        "Could not read ../generated/spec.html file. You may have to run 'npm run sync' to download it.",
      );
    });
}

export function assert(
  condition: unknown,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message ? `Assertion failed: ${message}` : "Assertion failed",
    );
  }
}
