//
// mdn-bcd-collector: lib/secrets.ts
// Module to parse data from secrets.json or SECRETS_JSON environment variable
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

import fs from "fs-extra";

const getSecrets = async () => {
  // In testing environments, real secrets shouldn't be used
  if (process.env.NODE_ENV === "test") {
    return await fs.readJson(
      new URL("../secrets.sample.json", import.meta.url),
    );
  }

  // If SECRETS_JSON present, try to parse and use it
  if (process.env.SECRETS_JSON) {
    try {
      return JSON.parse(process.env.SECRETS_JSON);
    } catch {
      console.warn(
        "SECRETS_JSON environment variable present but is not valid JSON; using secrets.json...",
      );
    }
  }

  // Use secrets.json
  return await fs.readJson(new URL("../secrets.json", import.meta.url));
};

export default getSecrets;
