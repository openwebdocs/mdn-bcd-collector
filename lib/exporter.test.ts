import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {getReportMeta} from "./exporter.js";

import type {Report} from "../types/types.js";

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
  };
}[] = [
  {
    report: {
      __version: "1.2.3",
      results: {},
      extensions: [],
      preview: false,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
    expected: {
      digest: "a562c83457",
      browser: "Safari 12",
      os: "macOS 10.14",
      desc: "Safari 12 / macOS 10.14",
      title: "Results from Safari 12 / macOS 10.14 / Collector v1.2.3",
      slug: "1.2.3-safari-12.0-macos-10.14-a562c83457",
      filename: "1.2.3-safari-12.0-macos-10.14-a562c83457.json",
      branch: "collector/1.2.3-safari-12.0-macos-10.14-a562c83457",
      version: "1.2.3",
      preview: false,
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: true,
      extensions: [],
      results: {
        "https://collector.openwebdocs.org/tests/?preview=true": [],
        "https://collector.openwebdocs.org/tests/?exposure=Worker&preview=true":
          [],
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
    expected: {
      digest: "80818584fc",
      browser: "Safari 12",
      os: "macOS 10.14",
      desc: "Safari 12-preview / macOS 10.14",
      title: "Results from Safari 12-preview / macOS 10.14 / Collector v1.2.3",
      urls: [
        "https://collector.openwebdocs.org/tests/?preview=true",
        "https://collector.openwebdocs.org/tests/?exposure=Worker&preview=true",
      ],
      slug: "1.2.3-safari-12.0-preview-macos-10.14-80818584fc",
      filename: "1.2.3-safari-12.0-preview-macos-10.14-80818584fc.json",
      branch: "collector/1.2.3-safari-12.0-preview-macos-10.14-80818584fc",
      version: "1.2.3",
      preview: true,
    },
  },
  {
    report: {
      __version: "1.2.3-dev",
      preview: false,
      extensions: [],
      results: {},
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
    },
    expected: {
      digest: "324bfb6b8f",
      browser: "Chrome 86",
      os: "macOS 11.0.0",
      desc: "Chrome 86 / macOS 11.0.0",
      title: "Results from Chrome 86 / macOS 11.0.0 / Collector v1.2.3-dev",
      slug: "1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-324bfb6b8f",
      filename: "1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-324bfb6b8f.json",
      branch:
        "collector/1.2.3-dev-chrome-86.0.4240.198-macos-11.0.0-324bfb6b8f",
      version: "1.2.3-dev",
      preview: false,
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: false,
      extensions: [],
      results: {
        "https://collector.openwebdocs.org/tests/": [],
      },
      userAgent:
        "Mozilla/5.0 (Linux; Android 11; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/12.1 Chrome/79.0.3945.136 Mobile Safari/537.36",
    },
    expected: {
      digest: "2b4d5a5f00",
      browser: "Samsung Internet 12.1",
      os: "Android 11",
      desc: "Samsung Internet 12.1 / Android 11",
      title:
        "Results from Samsung Internet 12.1 / Android 11 / Collector v1.2.3",
      urls: ["https://collector.openwebdocs.org/tests/"],
      slug: "1.2.3-samsunginternet-android-12.1-android-11-2b4d5a5f00",
      filename: "1.2.3-samsunginternet-android-12.1-android-11-2b4d5a5f00.json",
      branch:
        "collector/1.2.3-samsunginternet-android-12.1-android-11-2b4d5a5f00",
      version: "1.2.3",
      preview: false,
    },
  },
  {
    report: {
      __version: "1.2.3",
      preview: false,
      extensions: [],
      results: {
        "https://collector.openwebdocs.org/tests/?exposure=Window": [],
        "https://collector.openwebdocs.org/tests/?exposure=Worker": [],
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/800.0.1.2 Safari/537.36",
    },
    expected: {
      digest: "b4ed5c5b0d",
      browser: "Chrome 800.0",
      os: "macOS 11.0.0",
      desc: "Chrome 800.0 / macOS 11.0.0",
      title: "Results from Chrome 800.0 / macOS 11.0.0 / Collector v1.2.3",
      urls: [
        "https://collector.openwebdocs.org/tests/?exposure=Window",
        "https://collector.openwebdocs.org/tests/?exposure=Worker",
      ],
      slug: "1.2.3-chrome-800.0.1.2-macos-11.0.0-b4ed5c5b0d",
      filename: "1.2.3-chrome-800.0.1.2-macos-11.0.0-b4ed5c5b0d.json",
      branch: "collector/1.2.3-chrome-800.0.1.2-macos-11.0.0-b4ed5c5b0d",
      version: "1.2.3",
      preview: false,
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
            } else {
              assert.equal(expected[prop], reportData[prop]);
            }
          });
        }
      });
    }
  });
});
