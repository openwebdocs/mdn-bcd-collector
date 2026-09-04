import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {getReportMeta} from "./exporter.js";

import type {Report} from "../types/types.js";
import {FlagStatement} from "@mdn/browser-compat-data";

const REPORTS: {
  report: Report;
  expected: {
    digest: string;
    browser: string;
    os: string;
    desc: string;
    title: string;
    urls?: string[];
    slug: string;
    filename: string;
    branch: string;
    version: string;
    preview: boolean;
    flags: FlagStatement[];
  };
}[] = [
  {
    report: {
      __version: "1.2.3",
      results: {},
      extensions: [],
      flags: [],
      preview: false,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
    expected: {
      digest: "042f8f6ff9",
      browser: "Safari 12",
      os: "macOS 10.14",
      desc: "Safari 12 / macOS 10.14",
      title: "Results from Safari 12 / macOS 10.14 / Collector v1.2.3",
      slug: "1.2.3-safari-12.0-macos-10.14-042f8f6ff9",
      filename: "1.2.3-safari-12.0-macos-10.14-042f8f6ff9.json",
      branch: "collector/1.2.3-safari-12.0-macos-10.14-042f8f6ff9",
      version: "1.2.3",
      preview: false,
      flags: [],
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: true,
      extensions: [],
      flags: [],
      results: {
        "https://collector.openwebdocs.org/tests/?preview=true": [],
        "https://collector.openwebdocs.org/tests/?exposure=Worker&preview=true":
          [],
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
    expected: {
      digest: "997e303c7b",
      browser: "Safari 12",
      os: "macOS 10.14",
      desc: "Safari 12-preview / macOS 10.14",
      title: "Results from Safari 12-preview / macOS 10.14 / Collector v1.2.3",
      urls: [
        "https://collector.openwebdocs.org/tests/?preview=true",
        "https://collector.openwebdocs.org/tests/?exposure=Worker&preview=true",
      ],
      slug: "1.2.3-safari-12.0-preview-macos-10.14-997e303c7b",
      filename: "1.2.3-safari-12.0-preview-macos-10.14-997e303c7b.json",
      branch: "collector/1.2.3-safari-12.0-preview-macos-10.14-997e303c7b",
      version: "1.2.3",
      preview: true,
      flags: [],
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: false,
      extensions: [],
      flags: [
        {
          name: "dom.fancy_api.enabled",
          type: "preference",
          value_to_set: "true",
        },
        {
          name: "dom.another_fancy_api.enabled",
          type: "runtime_flag",
          value_to_set: "enabled",
        },
      ],
      results: {
        "https://collector.openwebdocs.org/tests/?flag1_type=preference&flag1_name=dom.fancy_api.enabled&flag1_value_to_set=true&flag2_type=runtime_flag&flag2_name=dom.another_fancy_api.enabled&flag2_value_to_set=enabled":
          [],
        "https://collector.openwebdocs.org/tests/?exposure=Worker&flag1_type=preference&flag1_name=dom.fancy_api.enabled&flag1_value_to_set=true&flag2_type=runtime_flag&flag2_name=dom.another_fancy_api.enabled&flag2_value_to_set=enabled":
          [],
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
    expected: {
      digest: "f22821d15b",
      browser: "Safari 12",
      os: "macOS 10.14",
      desc: "Safari 12-flagged / macOS 10.14",
      title: "Results from Safari 12-flagged / macOS 10.14 / Collector v1.2.3",
      urls: [
        "https://collector.openwebdocs.org/tests/?flag1_type=preference&flag1_name=dom.fancy_api.enabled&flag1_value_to_set=true&flag2_type=runtime_flag&flag2_name=dom.another_fancy_api.enabled&flag2_value_to_set=enabled",
        "https://collector.openwebdocs.org/tests/?exposure=Worker&flag1_type=preference&flag1_name=dom.fancy_api.enabled&flag1_value_to_set=true&flag2_type=runtime_flag&flag2_name=dom.another_fancy_api.enabled&flag2_value_to_set=enabled",
      ],
      slug: "1.2.3-safari-12.0-flagged-macos-10.14-f22821d15b",
      filename: "1.2.3-safari-12.0-flagged-macos-10.14-f22821d15b.json",
      branch: "collector/1.2.3-safari-12.0-flagged-macos-10.14-f22821d15b",
      version: "1.2.3",
      preview: false,
      flags: [
        {
          name: "dom.fancy_api.enabled",
          type: "preference",
          value_to_set: "true",
        },
        {
          name: "dom.another_fancy_api.enabled",
          type: "runtime_flag",
          value_to_set: "enabled",
        },
      ],
    },
  },
  {
    report: {
      __version: "1.2.3-dev",
      preview: false,
      extensions: [],
      flags: [],
      results: {},
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    },
    expected: {
      digest: "73aa1422aa",
      browser: "Chrome 86",
      os: "macOS 11.0.0",
      desc: "Chrome 86 / macOS 11.0.0",
      title: "Results from Chrome 86 / macOS 11.0.0 / Collector v1.2.3-dev",
      slug: "1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-73aa1422aa",
      filename: "1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-73aa1422aa.json",
      branch:
        "collector/1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-73aa1422aa",
      version: "1.2.3-dev",
      preview: false,
      flags: [],
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: false,
      extensions: [],
      flags: [],
      results: {
        "https://collector.openwebdocs.org/tests/": [],
      },
      userAgent:
        "Mozilla/5.0 (Linux; Android 11; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/12.1 Chrome/79.0.3945.136 Mobile Safari/537.36",
    },
    expected: {
      digest: "4f92b8b2e4",
      browser: "Samsung Browser 12.1",
      os: "Android 11",
      desc: "Samsung Browser 12.1 / Android 11",
      title:
        "Results from Samsung Browser 12.1 / Android 11 / Collector v1.2.3",
      urls: ["https://collector.openwebdocs.org/tests/"],
      slug: "1.2.3-samsunginternet-android-12.1-android-11-4f92b8b2e4",
      filename: "1.2.3-samsunginternet-android-12.1-android-11-4f92b8b2e4.json",
      branch:
        "collector/1.2.3-samsunginternet-android-12.1-android-11-4f92b8b2e4",
      version: "1.2.3",
      preview: false,
      flags: [],
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: false,
      extensions: [],
      flags: [],
      results: {
        "https://collector.openwebdocs.org/tests/?exposure=Window": [],
        "https://collector.openwebdocs.org/tests/?exposure=Worker": [],
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/800.0.1.2 Safari/537.36",
    },
    expected: {
      digest: "a9e3df1073",
      browser: "Chrome 800.0",
      os: "macOS 11.0.0",
      desc: "Chrome 800.0 / macOS 11.0.0",
      title: "Results from Chrome 800.0 / macOS 11.0.0 / Collector v1.2.3",
      urls: [
        "https://collector.openwebdocs.org/tests/?exposure=Window",
        "https://collector.openwebdocs.org/tests/?exposure=Worker",
      ],
      slug: "1.2.3-chrome-800.0.1.2-macos-11.0.0-a9e3df1073",
      filename: "1.2.3-chrome-800.0.1.2-macos-11.0.0-a9e3df1073.json",
      branch: "collector/1.2.3-chrome-800.0.1.2-macos-11.0.0-a9e3df1073",
      version: "1.2.3",
      preview: false,
      flags: [],
    },
  },
];

describe("exporter", () => {
  describe("getReportMeta()", () => {
    for (const i in REPORTS) {
      describe(`Report #${Number(i) + 1}`, async () => {
        const {report, expected} = REPORTS[i];
        const reportData = getReportMeta(report);
        for (const prop of Object.keys(expected)) {
          it(prop, async () => {
            if (prop === "urls") {
              for (const url of reportData["urls"]) {
                assert.equal(expected.urls.includes(url), true);
              }
            } else if (prop === "flags") {
              assert.equal(expected.flags.length, reportData.flags.length);
            } else {
              assert.equal(expected[prop], reportData[prop]);
            }
          });
        }
      });
    }
  });
});
