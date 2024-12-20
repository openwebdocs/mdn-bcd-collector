//
// mdn-bcd-collector: lib/exporter.ts
// This module is responsible for getting results/reports out of the collector
// web service into JSON files that can be used by update-bcd.ts.
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import crypto from "node:crypto";

import slugify from "slugify";
import stringify from "json-stable-stringify";
import bcd from "@mdn/browser-compat-data" assert {type: "json"};
const bcdBrowsers = bcd.browsers;

import {parseUA} from "./ua-parser.js";

import type {Octokit} from "@octokit/rest";
import type {Report, ReportMeta} from "../types/types.js";

/**
 * Retrieves the metadata for a report.
 * @param report - The report object.
 * @returns - The metadata object containing various properties extracted from the report.
 */
const getReportMeta = (report: Report): ReportMeta => {
  const json = stringify(report) as string;
  const buffer = Buffer.from(json);

  /* eslint-disable-next-line max-len */
  // like https://github.com/web-platform-tests/wpt.fyi/blob/26805a0122ea01076ac22c0a96313c1cf5cc30d6/results-processor/wptreport.py#L79
  const digest = crypto
    .createHash("sha1")
    .update(buffer)
    .digest("hex")
    .substring(0, 10);

  // Get user agent details
  const ua = parseUA(report.userAgent, bcdBrowsers);
  const browser = `${ua.browser.name} ${ua.version}`;
  const os = `${ua.os.name} ${ua.os.version}`;
  const desc = `${browser} / ${os}`;

  const slug = `${report.__version.toLowerCase()}-${ua.browser.id.replace(
    /_/g,
    "-",
  )}-${ua.fullVersion}-${slugify(os, {lower: true})}-${digest}`;

  return {
    json,
    buffer,
    digest,
    uaString: report.userAgent,
    ua,
    browser,
    os,
    desc,
    title: `Results from ${desc} / Collector v${report.__version}`,
    urls: Object.keys(report.results),
    slug,
    filename: `${slug}.json`,
    branch: `collector/${slug}`,
    version: report.__version,
  };
};

/**
 * Creates the body of a pull request with the given metadata.
 * @param meta - The metadata object.
 * @returns The body of the pull request.
 */
const createBody = (meta: ReportMeta): string => {
  return (
    `User Agent: ${meta.uaString}\nBrowser: ${meta.browser} (on ${meta.os})${
      meta.ua.inBcd ? "" : " - **Not in BCD**"
    }` +
    `\nHash Digest: ${meta.digest}` +
    `\nTest URLs: ${meta.urls.join(", ")}` +
    (meta.version.includes("-")
      ? "\n\n**WARNING:** this PR was created from a development/staging version!"
      : "")
  );
};

/**
 * Exports the given report as a pull request.
 * @param report - The report to be exported as a PR.
 * @param octokit - The octokit instance used for creating the PR.
 * @returns An object containing the filename and URL of the created PR.
 * @throws {Error} An error if "octokit" is not defined or if octokit authentication fails.
 */
const exportAsPR = async (
  report: Report,
  octokit?: Octokit,
): Promise<{filename: string; url: string}> => {
  if (!octokit) {
    throw new Error('"octokit" must be defined');
  }

  if (((await octokit.auth()) as any).type == "unauthenticated") {
    throw new Error("Octokit authentication failure");
  }

  const meta = getReportMeta(report);
  await octokit.git.createRef({
    owner: "openwebdocs",
    repo: "mdn-bcd-results",
    ref: `refs/heads/${meta.branch}`,
    // first commit in repo
    sha: "753c6ed8e991e9729353a63d650ff0f5bd902b69",
  });

  await octokit.repos.createOrUpdateFileContents({
    owner: "openwebdocs",
    repo: "mdn-bcd-results",
    path: `${meta.filename}`,
    message: meta.title,
    content: meta.buffer.toString("base64"),
    branch: meta.branch,
  });

  const {data} = await octokit.pulls.create({
    owner: "openwebdocs",
    repo: "mdn-bcd-results",
    title: meta.title,
    head: meta.branch,
    body: createBody(meta),
    base: "main",
  });

  return {
    filename: meta.filename,
    url: data.html_url,
  };
};

export {getReportMeta, createBody, exportAsPR};
