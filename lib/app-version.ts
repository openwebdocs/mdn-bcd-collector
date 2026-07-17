import fs from "fs-extra";

import exec from "./exec.js";

/* node:coverage disable */
/**
 * Retrieves the version of the application.
 * If the application is running in production mode, it returns the version from the package.json file.
 * Otherwise, it attempts to retrieve the version using the "git describe --tags" command.
 * If the command fails or encounters an error, it falls back to using the version from package.json with "-dev" appended.
 * @returns The version of the application.
 */
const getAppVersion = async () => {
  const version = (
    await fs.readJson(new URL("../package.json", import.meta.url))
  ).version;
  if (process.env.NODE_ENV === "production") {
    return version;
  }

  try {
    return (await exec("git describe --tags"))
      .replace(/^v/, "")
      .replaceAll("\n", "");
  } catch (e) {
    if (process.env.HEROKU_PR_NUMBER) {
      return `${version}-pr${process.env.HEROKU_PR_NUMBER}`;
    }
    // If anything happens, e.g., git isn't installed, just use the version
    // from package.json with -dev appended.
    return `${version}-dev`;
  }
};

const appVersion = await getAppVersion();

export default appVersion;
/* node:coverage enable */
