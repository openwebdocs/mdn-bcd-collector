//
// mdn-bcd-collector: lib/tests.ts
// Module for handling the tests for the web app
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import didYouMean from "didyoumean";

import type {Resources} from "../types/types.js";

interface Endpoints {
  [key: string]: string[];
}

/**
 * Represents a collection of tests.
 */
class Tests {
  tests: {[key: string]: any};
  resources: Resources;
  endpoints: Endpoints;
  httpOnly: boolean;

  /**
   * Constructs a new instance of the Tests class.
   * @param options - The options for the Tests class.
   * @param options.tests - The tests object.
   * @param options.tests.__resources - The resources object.
   * @param options.httpOnly - Indicates if the HTTP-only flag is enabled.
   */
  constructor(options) {
    this.tests = options.tests;
    this.resources = options.tests.__resources;
    this.endpoints = this.buildEndpoints();
    this.httpOnly = options.httpOnly;
  }

  /**
   * Builds and returns the endpoints object.
   * The endpoints object is a mapping of endpoint names to an array of test identifiers.
   * Each test identifier represents a specific test case.
   * @returns The endpoints object.
   */
  buildEndpoints() {
    const endpoints: Endpoints = {
      "": [],
    };

    for (const ident of Object.keys(this.tests)) {
      if (ident === "__resources") {
        continue;
      }
      endpoints[""].push(ident);

      let endpoint = "";
      for (const part of ident.split(".")) {
        endpoint += (endpoint ? "." : "") + part;

        if (!(endpoint in endpoints)) {
          endpoints[endpoint] = [];
        }

        if (!endpoints[endpoint].includes(ident)) {
          endpoints[endpoint].push(ident);
        }
      }
    }

    return endpoints;
  }

  /**
   * Returns an array of all the endpoints in the collection.
   * @returns An array of endpoint names.
   */
  listEndpoints() {
    return Object.keys(this.endpoints);
  }

  /**
   * Checks if the input matches any of the available endpoints and suggests a possible alternative if not.
   * @param input - The input to check against the available endpoints.
   * @returns A suggested alternative if the input does not match any of the available endpoints.
   */
  didYouMean(input) {
    return didYouMean(input, this.listEndpoints());
  }

  /**
   * Retrieves the tests for a given endpoint.
   * @param endpoint - The endpoint to retrieve tests for.
   * @param testExposure - Optional. The exposure type of the tests to retrieve.
   * @param ignoreIdents - Optional. An array of identifiers to ignore.
   * @returns An array of tests for the specified endpoint.
   */
  getTests(endpoint, testExposure?, ignoreIdents: string[] = []) {
    if (!(endpoint in this.endpoints)) {
      return [];
    }

    const idents = this.endpoints[endpoint];

    const tests: any[] = [];
    for (const ident of idents) {
      const ignore = ignoreIdents.some((ignoreIdent) => {
        return ident === ignoreIdent || ident.startsWith(`${ignoreIdent}.`);
      });
      if (ignore) {
        continue;
      }
      const test = this.tests[ident];
      for (const exposure of test.exposure) {
        if (!testExposure || exposure == testExposure) {
          tests.push({
            ident,
            // TODO: Simplify this to just a code string.
            tests: [{code: test.code}],
            exposure,
            resources: test.resources || [],
          });
        }
      }
    }

    return tests;
  }
}

export default Tests;
