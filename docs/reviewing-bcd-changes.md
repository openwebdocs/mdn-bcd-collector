# Reviewing BCD changes

When reviewing [BCD pull requests](https://github.com/mdn/browser-compat-data/pulls) created using mdn-bcd-collector, it helps to have a high-level understanding of how it works and what kinds of errors are common.

Basically, feature tests are run on multiple versions of the same browser and support ranges are inferred. A test could be as simple as `'fetch' in window`. If that test returns false in Chrome 1-41 and returns true in Chrome 42 and later, `{ "version_added": 42 }` will be inferred.

## How the script works

The `update-bcd.js` script works as follows:

- Build a "support matrix" mapping a BCD entry + browser release to a support status (true/false/null)
- For every BCD entry for which we have data in the support matrix:
  - Infer a BCD-style support statement from the per-version data in the support matrix. Where we have incomplete information, ranged (≤) versions are used.
  - If the inferred support statement isn't simple (a single object) give up and do nothing.
  - If the BCD support statement had only `prefix`/`alternative_name`/`flags` entries, add our inferred statement.
  - Otherwise, there was an existing simple statement, which we update using the inferred statement.

## What to look out for

These errors are worth looking out for:

- False negatives, where a test fails to detect support. This results in either an incorrect `false` or support actually going back further than inferred. Common causes are:
  - Missing [interface objects](https://webidl.spec.whatwg.org/#interface-object). For example, `crypto.subtle` was shipped long before the `SubtleCrypto` interface was [exposed](https://webkit.org/b/165629) in some browsers. Missing interface objects was common in the past, especially for events, but is quite _uncommon_ for APIs introduced after ~2020. See [#7963](https://github.com/mdn/browser-compat-data/pull/7963), [#7986](https://github.com/mdn/browser-compat-data/pull/7986) and [#10837](https://github.com/mdn/browser-compat-data/pull/10837) for examples.
  - [Attributes](https://webidl.spec.whatwg.org/#es-attributes) weren't on the prototypes in some older browsers, for example [before Chrome 43](https://github.com/mdn/browser-compat-data/issues/7843). See [#6568](https://github.com/mdn/browser-compat-data/pull/6568#discussion_r479039982) for an example.

  To guard against this, follow the link to the test and expand the code. A simple `'propertyName' in InterfaceName` test can yield false negatives, so an _instance_ of the type should be created and tested using the [custom tests](https://github.com/openwebdocs/mdn-bcd-collector/blob/main/custom-tests.yaml) mechanism. Ask for this when reviewing, you don't need to create the tests yourself.

- Consistency with other parts of the same feature. Does it seem plausible that the feature was introduced earlier or later than other parts? Examples of consistency to look for:
  - Support for `navigator.gpu` implies support for the `GPU` interface, because `navigator.gpu` is an instance of that interface.
  - Support for `audioContext.createPanner()` implies support for `PannerNode`, because that is the return type.
  - Support for `AnalyserNode` implies support for `AudioNode`, because `AnalyserNode` inherits from `AudioNode`.

  Examples of consistency checks in review are [#10397](https://github.com/mdn/browser-compat-data/pull/10397), [#12028](https://github.com/mdn/browser-compat-data/pull/12028) and [#12033](https://github.com/mdn/browser-compat-data/pull/12033). [#6571](https://github.com/mdn/browser-compat-data/issues/6571) proposes automating many such consistency checks.

### Changes to option parameter data

In v8.0.0, a new function was introduced (`bcd.testOptionParam()`) which allowed for the testing of option parameter support. For example, given the `Window.scroll()` method, it can determine if the `top` option parameter in `Window.scroll({top: 0})` has been accessed. However, there are still a few caveats with this approach:

- It can determine if the option as been accessed, but it cannot determine if the method's behavior changed. This approach has been known to cause some issues with detection in Chrome, as [Chrome may read the value before checking if the flag to enable the behavior has been turned on](https://github.com/mdn/browser-compat-data/pull/18985#issuecomment-1461923451).

### Minor Safari version changes

In v6.1.1, a major update was made to the useragent parser involving minor version numbers for browsers (specifically, Safari). As such, newer pull requests may be opened that change the minor version of a browser. If a newer collector version includes a change to a browser's minor version, then always trust the newer collector over the old one. (For example, if a collector PR for v6.0.8 was merged that indicates the feature was added in Safari 15.5, but there is a new PR with collector v6.1.2 that changes the version number to Safari 15.4, then trust Safari 15.4 to be the version number.)
