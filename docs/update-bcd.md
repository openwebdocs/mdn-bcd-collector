# Updating BCD using the results

In this repository, the `update-bcd` and `add-new-bcd` scripts can be used to update the existing BCD entries. These scripts assume you have the following:

- An understanding of the [compat data JSON schema](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md#mirroring-data)
  - An understanding of [ranged versions](https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data-schema.md#ranged-versions) in BCD
- A local checkout of:
  - [This repository](https://github.com/openwebdocs/mdn-bcd-collector)
  - [mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) at `../browser-compat-data` (or the path set as the `BCD_DIR` environment variable)
  - Recommended: [mdn-bcd-results](https://github.com/openwebdocs/mdn-bcd-results), preferably at `../mdn-bcd-results`
    - This repository contains the reports that have been exported to GitHub, but you may use your own reports if desired

By default, the following scripts generate results based on pre-collected reports stored in the [mdn-bcd-results](https://github.com/openwebdocs/mdn-bcd-results) repository. The reports in this repository are collected on every new release of the collector for almost every release of Chrome, Edge, Firefox and Safari since January 2020, and for the latest release of mobile browsers. With these reports, most contributors will not need access to their own browser library or CT platform in order to update BCD.

## `update-bcd`

The `update-bcd` script is used to update the features tracked in BCD with the collected results. This script takes results files and compiles them into BCD support statements, which are then compared against the local BCD repository. If the collector's results differ from BCD's statements, the files are modified accordingly. Read the [data flow documentation](/docs/update-bcd-data-flow.md) for more step-by-step info on how the script processes the data and makes decisions on whether or not to modify BCD files.

### Basic usage

To update BCD, run the following command:

```sh
npm run update-bcd
```

This will update BCD using all of the results files in the `../mdn-bcd-results` folder. To use results in a different path, and/or to use a specific file, you may specify any number of paths as arguments:

```sh
npm run update-bcd ../local-results
npm run update-bcd ../mdn-bcd-results/9.1.0-chrome-112.0.0.0-mac-os-10.15.7-79d130f929.json
```

### Limit changes by BCD path

To limit changes to a specific BCD path, such as by category or a specific interface, you may use the `-p/--path` argument.

Updating a specific category:

```sh
npm run update-bcd -- --p=css.properties
npm run update-bcd -- -p css.properties
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

> [!NOTE]
> The `update-bcd` script used to take a `-c/--category` parameter. This has been deprecated in favor of the more versatile `-p/--path`.

### Limit changes by browser

The `-b/--browser` argument can be used to only update data for one or more browsers:

```sh
npm run update-bcd -- --browser=safari --browser=safari_ios
npm run update-bcd -- -b safari -b safari_ios
```

The `-r/--release` argument can be used to only update data for a specific browser release, ex. Firefox 84:

```sh
npm run update-bcd -- --browser=firefox --release=84
npm run update-bcd -- -b firefox -r 84
```

This will only make changes that set either `version_added` or `version_removed` to "84".

### Limit changes to non-ranged only

The `-e/--exact-only` argument can be used to only update BCD when we have an exact version number and skip any ranges (ex. `≤37`):

```sh
npm run update-bcd -- --exact-only
npm run update-bcd -- -e
```

## `add-new-bcd`

As specifications update, new features may be added that BCD doesn't yet track. This script utilizes `update-bcd` to add any missing features to BCD that are supported in at least one browser version.

### Basic usage

To add missing features, run the following command:

```sh
npm run add-new-bcd
```

This script takes no arguments.

## Custom ranged version format

When the results don't have enough data to determine an exact version, ranges which aren't valid in BCD may be added:

- "≤N" for any release, not just the ranged versions allowed by BCD.
- "M> ≤N" when a feature is _not_ in M and _is_ in N, but there are releases between the two for which support is unknown.

In both cases, the uncertainty has to be resolved by hand before submitting the data to BCD.

## New releases or browsers

If you have results from a browser not yet in BCD, first add the release in `../browser-compat-data/browsers/`. This is because the full version (from the `User-Agent` header) is mapped to BCD browser release as part of the processing.
