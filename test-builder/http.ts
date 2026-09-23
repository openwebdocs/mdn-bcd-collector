import {getCustomTest, customTests, compileTest} from "./common.js";

/**
 * Builds tests for HTTP request headers with custom tests defined in custom/tests.yaml.
 * @returns A test object with BCD paths as keys and compiled tests as values.
 */
const build = async () => {
  const tests = {};
  const headers = customTests.http?.headers || {};

  for (const name of Object.keys(headers)) {
    const bcdPath = `http.headers.${name}`;
    const customTest = await getCustomTest(bcdPath, "http", true);

    if (customTest.test) {
      tests[bcdPath] = compileTest({
        raw: {code: customTest.test},
        exposure: ["Window"],
      });
    }

    for (const [key, code] of Object.entries(customTest.additional)) {
      tests[`${bcdPath}.${key}`] = compileTest({
        raw: {code},
        exposure: ["Window"],
      });
    }
  }

  return tests;
};

export {build};
