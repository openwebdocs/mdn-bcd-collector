//
// mdn-bcd-collector: lib/ua-parser.ts
// Module to parse user agent strings and compare them with BCD browser data
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import {Browsers} from "@mdn/browser-compat-data";
import {
  compare as compareVersions,
  compareVersions as compareVersionsSort,
} from "compare-versions";
import {UAParser} from "ua-parser-js";

import type {ParsedUserAgent} from "../types/types.d.ts";
import {RUNTIME_IDS_WITH_PATCH_VERSIONING} from "./constants.js";

/**
 * Returns the major version from a given version string.
 * @param version - The version string.
 * @returns The major version.
 */
const getMajorVersion = (version: string): string => {
  return version.split(".")[0];
};

/**
 * Returns the major and minor version of a given version string.
 * If the version string does not contain a minor version, it defaults to 0.
 * @param version - The version string.
 * @returns The major and minor version.
 */
const getMajorMinorVersion = (version: string): string => {
  const [major, minor] = version.split(".");
  return `${major}.${minor || 0}`;
};

/**
 * Parses the user agent string and extracts relevant information about the browser and operating system.
 * @param userAgent - The user agent string.
 * @param browsers - An object containing browser data.
 * @returns An object containing the parsed browser and operating system information.
 */
const parseUA = (userAgent: string, browsers: Browsers): ParsedUserAgent => {
  const ua = UAParser(userAgent);
  const data: ParsedUserAgent = {
    browser: {id: "", name: ""},
    version: "",
    fullVersion: "",
    os: {name: "", version: ""},
    inBcd: undefined,
  };

  if (userAgent.startsWith("!! ")) {
    // UA strings in unjs/runtime-compat are prepended with this string to prevent incorrect parsing by standard UA libs
    const [runtime, runtimeVersion] = userAgent.replace("!! ", "").split("/");
    data.browser.id = runtime;
    data.fullVersion = runtimeVersion;
  } else if (userAgent.includes("Servo/")) {
    // Servo browser detection
    const servoMatch = userAgent.match(/Servo\/([\d.]+)/);
    if (servoMatch) {
      data.browser.id = "servo";
      data.browser.name = "Servo";
      data.fullVersion = servoMatch[1];
    }
    data.os.name = ua.os.name || "";
    data.os.version = ua.os.version || "";
  } else {
    if (!ua.browser.name) {
      return data;
    }

    data.browser.id = ua.browser.name.toLowerCase().replace(/ /g, "_");
    data.browser.name = ua.browser.name;
    data.os.name = ua.os.name || "";
    data.os.version = ua.os.version || "";
  }

  data.browser.id = data.browser.id.replace("mobile_", "");
  data.browser.name = data.browser.name.replace("Mobile ", "");

  switch (data.browser.id) {
    case "oculus_browser":
      data.browser.id = "oculus";
      break;
    case "samsung_internet":
      data.browser.id = "samsunginternet";
      break;
    case "android_browser":
    case "chrome_webview":
      data.browser.id = "webview";
      break;
    case "node":
      data.browser.id = "nodejs";
      break;
  }

  const os = data.os.name.toLowerCase();
  if (os === "android" && data.browser.id !== "oculus") {
    data.browser.id += "_android";
    data.browser.name += " Android";

    if (ua.browser.name === "Android Browser") {
      // For early WebView Android, use the OS version
      data.fullVersion =
        (compareVersions(ua.os.version || "0", "5.0", "<")
          ? ua.os.version
          : ua.engine.version) || "0";
    }
  } else if (os === "ios") {
    if (data.browser.id === "webkit") {
      data.browser = {id: "webview", name: "WebView"};
    }

    data.browser.id += "_ios";
    data.browser.name += " iOS";

    // https://github.com/mdn/browser-compat-data/blob/main/docs/data-guidelines.md#safari-for-ios-versioning
    data.fullVersion = ua.os.version || "0";
  }

  data.fullVersion = data.fullVersion || ua.browser.version || "0";

  if (RUNTIME_IDS_WITH_PATCH_VERSIONING.has(data.browser.id)) {
    data.version = data.fullVersion;
  } else {
    data.version = getMajorMinorVersion(data.fullVersion);
  }

  if (!(data.browser.id in browsers)) {
    return data;
  }

  data.browser.name = browsers[data.browser.id].name;
  data.inBcd = false;

  const versions = Object.keys(browsers[data.browser.id].releases);
  versions.sort(compareVersionsSort);

  // Android 4.4.3 needs to be handled as a special case, because its data
  // differs from 4.4, and the code below will strip out the patch versions from
  // our version numbers.
  if (
    data.browser.id === "webview_android" &&
    compareVersions(data.fullVersion, "4.4.3", ">=") &&
    compareVersions(data.fullVersion, "5.0", "<")
  ) {
    data.version = "4.4.3";
    data.inBcd = true;
    return data;
  }

  // Certain Safari versions are backports of newer versions, but contain fewer
  // features, particularly ones involving OS integration. We are explicitly
  // marking these versions as "not in BCD" to avoid confusion.
  if (
    data.browser.id === "safari" &&
    ["4.1", "6.1", "6.2", "7.1"].includes(data.version)
  ) {
    return data;
  }

  // The |version| from the UA string is typically more precise than |versions|
  // from BCD, and some "uninteresting" releases are missing from BCD. To deal
  // with this, find the pair of versions in |versions| that sandwiches
  // |version|, and use the first of this pair. For example, given |version|
  // "10.1" and |versions| entries "10.0" and "10.2", return "10.0".
  // However, for Bun, we need exact version matches because patch versions can add features.
  if (RUNTIME_IDS_WITH_PATCH_VERSIONING.has(data.browser.id)) {
    // For Bun, only mark as inBcd if exact version exists
    if (versions.includes(data.version)) {
      data.inBcd = true;
    }
  } else {
    for (let i = 0; i < versions.length - 1; i++) {
      const current = versions[i];
      const next = versions[i + 1];
      if (
        compareVersions(data.version, current, ">=") &&
        compareVersions(data.version, next, "<")
      ) {
        data.inBcd = true;
        data.version = current;
        break;
      }
    }
  }

  // We reached the last entry in |versions|. With no |next| to compare against
  // we have to check if it looks like a significant release or not. By default
  // that means a new major version, but for Safari and Samsung Internet the
  // major and minor version are significant.
  if (!RUNTIME_IDS_WITH_PATCH_VERSIONING.has(data.browser.id)) {
    let normalize = getMajorVersion;
    if (
      data.browser.id.startsWith("safari") ||
      data.browser.id === "samsunginternet_android"
    ) {
      normalize = getMajorMinorVersion;
    }
    if (
      data.inBcd == false &&
      normalize(data.version) === normalize(versions[versions.length - 1])
    ) {
      data.inBcd = true;
      data.version = versions[versions.length - 1];
    }
  }

  return data;
};

export {getMajorMinorVersion, parseUA};
