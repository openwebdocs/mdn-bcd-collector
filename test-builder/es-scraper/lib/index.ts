import FS from "node:fs/promises";
import { generatedPath } from "./utils.js";
import type { JSGlobal } from "./types.js";

export async function getIntrinsics(): Promise<JSGlobal[]> {
  const data = await FS.readFile(generatedPath("intrinsics.json"), "utf8");
  return JSON.parse(data);
}

export async function getEarlyErrors(): Promise<{
  [lhs: string]: { [rhs: string]: string[] };
}> {
  const data = await FS.readFile(generatedPath("early-errors.json"), "utf8");
  return JSON.parse(data);
}

// Purely exporting types
// eslint-disable-next-line no-restricted-syntax
export type * from "./types.js";
