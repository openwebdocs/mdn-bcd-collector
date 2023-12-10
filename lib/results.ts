//
// mdn-bcd-collector: results.ts
// Module to parse and handle test results
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import type {TestResult, Exposure, InternalTestResult} from "../types/types.js";

/**
 * Parses a short string value.
 * @param value - The value to parse.
 * @param desc - The description of the value.
 * @returns The parsed short string value.
 * @throws {Error} If the value is not a string or if the string is too long.
 */
const parseShortString = (value: string | any, desc: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${desc} should be a string; got ${typeof value}`);
  }
  if (value.length > 1000) {
    throw new Error(`${desc} should be a short string; string is too long`);
  }
  return value;
};

/**
 * Parse a results payload from the client into a structure that only contains the expected data and does not contain any long strings.
 * @param url - The URL to be parsed.
 * @param results - The results to be parsed.
 * @returns - The parsed URL and parsed results.
 * @throws {Error} - If the URL is invalid or the results are not in the expected format.
 */
const parseResults = (
  url: string | URL,
  results: InternalTestResult[],
): [string, TestResult[]] => {
  try {
    url = new URL(url).toString();
  } catch (e) {
    throw new Error("invalid URL");
  }

  if (!Array.isArray(results)) {
    throw new Error("results should be an array");
  }

  return [
    url,
    results
      .map((v, i) => {
        if (!v || typeof v !== "object") {
          throw new Error(`results[${i}] should be an object; got ${v}`);
        }
        if (![true, false, null].includes(v.result)) {
          throw new Error(
            `results[${i}].result (${v.name}) should be true/false/null; got ${v.result}`,
          );
        }
        return {
          name: parseShortString(v.name, `results[${i}].name`),
          result: v.result,
          exposure: (v.info
            ? parseShortString(
                v.info.exposure,
                `results[${i}].info.exposure (${v.name})`,
              )
            : parseShortString(
                v.exposure,
                `results[${i}].exposure (${v.name})`,
              )) as Exposure,
        } as TestResult;
      })
      .sort((a, b) => (a.name + a.exposure).localeCompare(b.name + b.exposure)),
  ];
};

export default parseResults;
