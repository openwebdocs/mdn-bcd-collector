//
// mdn-bcd-collector: lib/filter-versions.ts
// A helper function to filter browser releases by release date
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import bcd from "@mdn/browser-compat-data" assert {type: "json"};

import type {BrowserStatement, BrowserName} from "@mdn/browser-compat-data";

const bcdBrowsers = bcd.browsers;
import {
  compare as compareVersions,
  compareVersions as compareVersionsSort,
} from "compare-versions";

/**
 * Filters for the versions of a given browser based on the specified criteria.
 * @param browser - The name of the browser.
 * @param since - The minimum version or release date to include. Can be a string, Date object, or null.
 * @param reverse - Whether to sort the versions in reverse order.
 * @returns An array of filtered versions sorted in the specified order.
 * @throws {Error} if the specified browser is not defined in BCD.
 */
const filterVersions = (
  browser: BrowserName,
  since: string | Date | null,
  reverse,
): string[] => {
  const versions: string[] = [];

  if (!(browser in bcdBrowsers)) {
    throw new Error(`${browser} is not defined as a browser in BCD`);
  }

  const releases = Object.entries(
    (bcdBrowsers[browser] as BrowserStatement).releases,
  ).filter(([, r]) => ["current", "beta", "retired"].includes(r.status));

  for (const [version, versionData] of releases) {
    if (typeof since === "string") {
      if (compareVersions(version, since, ">=")) {
        versions.push(version);
      }
    } else if (since instanceof Date) {
      if (
        versionData.release_date &&
        new Date(versionData.release_date) > since
      ) {
        versions.push(version);
      }
    } else if (!since) {
      versions.push(version);
    }
  }

  return versions.sort((a, b) =>
    reverse ? compareVersionsSort(a, b) : compareVersionsSort(b, a),
  );
};

export default filterVersions;
