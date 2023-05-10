# MDN browser-compat-data collector

Data collection service for MDN's [browser-compat-data](https://github.com/mdn/browser-compat-data). Live at https://mdn-bcd-collector.gooborg.com/.

Feature detection tests are generated based on machine readable data (Web IDL and CSS definitions) from web standards, with support for custom tests where needed. Results are submitted to the [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) repository.

This service is part of an effort to [assist BCD updates with automation](https://github.com/mdn/browser-compat-data/issues/3308), and exists to run lots of small tests in browsers to determine the support status of a feature in a browser, and save those results.

## Copyright

© 2023 Gooborg Studios + various contributors, © 2020-2022 Google LLC, Mozilla Corporation and Gooborg Studios.

This project is under the Apache License 2.0 license. See the LICENSE file for more details.

## Setup

This project requires Node.js 18 or 19. Node.js 20 is currently unsupported due to a [breaking change that impacts `ts-node`](https://github.com/TypeStrong/ts-node/issues/1997).

```sh
npm install
```

## Updating BCD using the results

Given a checkout of [BCD](https://github.com/mdn/browser-compat-data) at `../browser-compat-data` and a checkout of [collector results](https://github.com/GooborgStudios/mdn-bcd-results) at `../mdn-bcd-results`, `npm run update-bcd` can be used to update existing BCD entries.

If you have results from a browser not yet in BCD, first add the release in `../browser-compat-data/browsers/`. This is because the full version (from the `User-Agent` header) is mapped to BCD browser release as part of the processing.

Updating all data:

```sh
npm run update-bcd
```

Updating a specific category:

```sh
npm run update-bcd -- --category=css.properties
npm run update-bcd -- -c css.properties
```

Updating a specific entry, ex. the `appendChild()` method on `Node`:

```sh
npm run update-bcd -- --path=api.Node.appendChild
npm run update-bcd -- -p api.Node.appendChild
```

Updating a specific feature and its children, ex. the `Document` API (also updates `api.Document.*`, ex. `api.Document.body`):

```sh
npm run update-bcd -- --path=api.Document
npm run update-bcd -- -p api.Document
```

Updating paths matched with wildcards, ex. everything related to WebRTC:

```sh
npm run update-bcd -- --path=api.RTC*
npm run update-bcd -- -p api.RTC*
```

Only update BCD when we have an exact version number and skip any ranges:

```sh
npm run update-bcd -- --exact-only
npm run update-bcd -- -e
```

The `--browser` argument can be used to only update data for one or more browsers:

```sh
npm run update-bcd -- --browser=safari --browser=safari_ios
npm run update-bcd -- -b safari -b safari_ios
```

The `--release` arguments can be used to only update data for a specific browser release, ex. Firefox 84:

```sh
npm run update-bcd -- --browser=firefox --release=84
npm run update-bcd -- -b firefox -r 84
```

This will only make changes that set either `version_added` or `version_removed` to "84".

### Custom ranged version format

When the results don't have enough data to determine an exact version, ranges which aren't valid in BCD may be added:

- "≤N" for any release, not just the ranged versions allowed by BCD.
- "M> ≤N" when a feature is _not_ in M and _is_ in N, but there are releases between the two for which support is unknown.

In both cases, the uncertainty has to be resolved by hand before submitting the data to BCD.

## Reviewing BCD changes

See [docs/reviewing-bcd-changes.md](./docs/reviewing-bcd-changes.md) for information on reviewing changes made by the collector.

## Running the server locally

```sh
npm run dev
```

(`dev`, as opposed to `start`, will use `ts-node` to run the TypeScript file, as well as automatically rebuild the tests and reload the server on file changes.)

To also handle HTTPS traffic, use the `--https-cert` and `--https-key` arguments:

```sh
npm run dev -- --https-cert=my-cert.pem --https-key=my-cert.key
```

## Running tests via Selenium WebDriver

A script has been provided which will collect all of the results for nearly all of the browsers, using the Selenium WebDriver to control your CTs, and download them to your computer (which can then be submitted as a PR). To run this script, you'll need a few prerequisites:

- A clone of [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) adjacent to this folder's repository (or at least a folder at `../mdn-bcd-results`)
- At least one Selenium remote (ex. BrowserStack, SauceLabs, etc.)

### Define Selenium Hosts

In `secrets.json`, you'll need to add your Selenium remote(s). In the `selenium` object, define your remote(s) by setting the key as the service name (ex. "browserstack", "saucelabs", "lambdatest", "custom", etc.) and the value as either an object containing the username and key for known remotes, or simply a string of the remote URL. Your `secrets.json` should look something like this:

```json
{
  "github": {
    "token": "github-token-goes-here"
  },
  "selenium": {
    "browserstack": {
      "username": "example",
      "key": "some-API-key-goes-here"
    },
    "saucelabs": {
      "username": "example",
      "key": "some-API-key-goes-here",
      "region": "us-west-1"
    },
    "lambdatest": {
      "username": "example",
      "key": "some-API-key-goes-here"
    },
    "custom": "https://my.example.page.org/selenium/wd"
  }
}
```

Currently, the Selenium hosts known to the script are:

- BrowserStack - requires `username` and `key`
- SauceLabs - requires `username`, `key`, and `region`
- LambdaTest - requires `username` and `key`

You may use other Selenium hosts, but please be aware that they have not been tested and you may experience unexpected results.

### Run the script

To test using the latest deployed version, run:

```sh
npm run selenium
```

You can also limit the browsers to test by defining browsers as arguments:

```sh
npm run selenium chrome
npm run selenium edge ie
```

Additionally, you can limit the browser versions by the year with the `--since` argument (default: 2020):

```sh
npm run selenium -- --since=2016
npm run selenium firefox -- --since=2000 # Grab all versions of Firefox
```

## Running the unit tests and linter

```sh
npm test
```

Code coverage reports can be viewed in a browser by running:

```sh
npm run coverage
```

## Cleaning up generated files

```sh
npm run clean
```
