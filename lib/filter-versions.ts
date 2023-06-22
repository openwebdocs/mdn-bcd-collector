//
// mdn-bcd-collector: lib/filter-versions.ts
// A helper function to filter browser releases by release date
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import bcd from '@mdn/browser-compat-data' assert {type: 'json'};
import type {BrowserStatement, BrowserName} from '@mdn/browser-compat-data';
const bcdBrowsers = bcd.browsers;
import {
  compare as compareVersions,
  compareVersions as compareVersionsSort,
} from 'compare-versions';

const filterVersions = (
  browser: BrowserName,
  since: string | Date | null,
  reverse,
) => {
  const versions: string[] = [];

  const releases = Object.entries(
    (bcdBrowsers[browser] as BrowserStatement).releases,
  ).filter(([, r]) => ['current', 'retired'].includes(r.status));

  for (const [version, versionData] of releases) {
    if (typeof since === 'string') {
      if (compareVersions(version, since, '>=')) {
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
