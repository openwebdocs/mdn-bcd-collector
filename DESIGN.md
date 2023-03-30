# Design of the MDN browser-compat-data collector

This service is part of an effort to [assist BCD updates with automation](https://github.com/mdn/browser-compat-data/issues/3308), and exists to run lots of small tests in browsers to determine the support status of a feature in a browser, and save those results.

## Custom tests

The collector generates simple tests for most features, but sometimes these simple tests may be ineffective for certain features. In these cases, tests can also be written manually.

The `custom-tests.yaml` file is used to write custom tests for features that cannot be tested with auto-generated test statements (for example, WebGL extensions).

Custom tests are written in the following structure:

```yaml
FEATURE_1:
  FEATURE_2:
    __resources:
      - foobar
    __base: doSomething();
    __test: return doTheTest();
    FEATURE_3: return doTheOtherTest();
    FEATURE_4:
      __base: doSomethingElse();
      __test: return doTheOtherOtherTest();
    __additional:
      FEATURE_3.OPTIONS_PARAMETER: "return doTheOtherTest({hello: 'world'});"
```

The structure of `custom-tests.yaml` closely adheres to BCD's own structure, where each feature is identified by a unique hierarchy of strings, with some slight differences. This is to ensure a seamless experience for BCD contributors. For example, to define a custom test for `api.Document.body`, write the following YAML:

```yaml
api:
  Document:
    body: (code goes here)

    # ...or...

    body:
      __test: (code goes here)
```

> **Note:** defining a feature in `custom-tests.yaml` does not directly generate tests, unless defined under the `__additional` property (which will be explained later). For example, defining a custom test for `api.FooBar.baz` in `custom-tests.yaml` will not generate the test for that feature.

> **Tip:** when writing custom tests, make sure to implement thorough feature checking as to not raise exceptions.

Each feature test will compile into a function as follows: `function() {__base + __test}`

### Custom test structure

Each feature within the `custom-tests.yaml` may either be a string or an object with the following properties:

- `__base`: Base code used across this test and every subfeature's test
- `__test`: Code used specifically for that test (does not bubble down to subtests)
- `__resources`: The list of reusable resources required for this test
- `__additional`: Additional tests to generate that cannot be defined in the source data

If the feature is set to a string, it will have the same effect as an object with `__test` set to the string value.

#### `__base`

The `__base` property is the common code used to access the feature, such as to generate an interface instance. This is where you create your elements and set up your environment.

In the code defined in this variable, the instance of the interface being tested should be defined in a variable called `instance`. This will allow the build script to automatically generate tests for the instance and its members.

Sometimes, tests require promises and callbacks. To define a custom test as a promise, simply create a `promise` variable in place of `instance`, and the system will automatically create a promise instead. To define a custom test with callbacks, do not define `var instance` and instead call `callback(<instance_variable>)`, and the system will define the appropriate variables and functions.

`__base` also compounds as it travels down the feature tree. In the example at the top of this document, the resulting `__base` values will be:

```yaml
FEATURE_1:
  # Nothing
FEATURE_1.FEATURE_2: doSomething();
FEATURE_1.FEATURE_2.FEATURE_3: doSomething();
FEATURE_1.FEATURE_2.FEATURE_4: doSomething();
  doSomethingElse();
```

#### `__test`

The `__test` property is the code used to test that specific feature, such as to test for the presence of an interface member, or to confirm a CSS property is supported. If there is a `__base` value, this code is appended to the end of said value.

In the code defined in this variable, a return statement should be declared that returns one of the following values:

- A boolean determining whether the feature is supported (`true`) or not (`false`)
- `null` if feature support cannot be determined
- An object containing:
  - A `result` property that is one of the two above values
  - An optional `message` property with a string explaining why or why not the feature is supported

#### `__resources`

The `__resources` property is used to state what reusable resources are required for this test, as well as tests for all subfeatures. Resources are defined in a top-level `__resources` property, as explained above in the "Reusable resources" section.

This variable is a list of identifiers for reusable resources the collector should load before running the feature's test.

#### `__additional`

The `__additional` property is used to define features that cannot be represented by the source data (for example, behavioral features, option parameters, etc.). This property should be used as sparingly as possible, and features should always be defined in the source data whenever possible.

### Resources

Certain tests may require resources, like audio or video. To allow the resources to load before running the tests, rather than create and add an element with JavaScript, we can define resources to be loaded through the top-level `__resources` object.

```yaml
__resources:
  RESOURCE_ELEMENT_ID:
    type: RESOURCE_TYPE
    src:
      - PATH_TO_RESOURCE
      - ALT_PATH_TO_RESOURCE
```

For each resource we wish to load, we simply define the element ID after `resource-` to assign as the object's key, specify the resource's `type` (audio, video, image, etc.), and define the `src` as an array of file paths after `/custom-tests` (or in the case of an `instance` type, code like a custom test to return the instance).

All resource files should be placed in `/static/resources/custom-tests`.

### Importing code from other tests

Sometimes, some features will depend on the setup and configuration from other features, especially with APIs. To prevent repeating code, you can import code from other custom tests. To import another test, add the following string to the test code: `<%ident:varname%>`, where `ident` is the full identifier to import from, and `varname` is what to rename the `instance` variable from that test to.

For example, the following YAML...

```yaml
api:
  AudioContext:
    __base: var instance = new (window.AudioContext || window.webkitAudioContext)();
  AudioDestinationNode:
    __base: |-
      <%api.AudioContext:audioCtx%>
      var instance = audioCtx.destination;
```

...will compile into...

```javascript
bcd.addTest(
  'api.AudioContext',
  '(function() {var instance = new (window.AudioContext || window.webkitAudioContext)();})()',
  'Window'
);
bcd.addTest(
  'api.AudioDestinationNode',
  '(function() {var instance = new (window.AudioContext || window.webkitAudioContext)(); if (!audioCtx) {return false}; var instance = audioCtx.destination;})()',
  'Window'
);
```

> **Note:** if the specified `ident` cannot be found, the code will be replaced with a error to throw indicating as such.

## API endpoints

HTTP endpoints under `/api/` are used to enumerate/iterate test URLs, report results for individual tests, and finally create a report for a whole session.

### Get URL to run tests

```http
POST /api/get
```

#### Parameters

- `testSelection`: BCD path for the tests to run, such as "api.Node". (optional, default to all tests)
- `limitExposure`: The name of a global scope to run the tests on, such as "Window". (optional, defaults to all global scopes)
- `ignore`: Comma-separated list of BCD paths to skip, such as "api.Node.baseURI". (optional)
- `selenium`: Whether to hide the results when collecting results using Selenium. (optional)

#### Response

Redirects to a URL to run the tests, such as `/tests/api/Node`.

### List tests

```http
GET /api/tests
```

#### Parameters

- `after`: Only list tests after the given test URL. (optional)
- `limit`: The maximum number of tests to list. Defaults to all tests. (optional)

#### Response

```json
[
  "https://mdn-bcd-collector.gooborg.com/tests/api/Sensor",
  "http://mdn-bcd-collector.gooborg.com/tests/css/properties/dot-supports"
]
```

If there are no more tests an empty array is returned.

### Report results

```http
POST /api/results
```

The `Content-Type` should be `application/json` and the post body should be an array of test results:

```json
[
  {
    "name": "api.Attr",
    "exposure": "Window",
    "result": true
  },
  {
    "name": "api.Blob",
    "exposure": "Worker",
    "result": null,
    "message": "[exception message]"
  }
]
```

#### Parameters

- `for`: The test URL the results are for. (required)

#### Response

Status `201 Created` if the results were saved. The results are put in server-side session storage. Status `400 Bad Request` is returned if the results do not match the expected format.

### List results

```http
GET /api/results
```

#### Response

```json
{
  "https://mdn-bcd-collector.gooborg.com/tests/api/Sensor": {
    "some-data": "some-value"
  }
}
```

If no results have been reported to `/api/results` in this session then an empty object is returned.

## Running tests

### Manually

When pointing a browser at https://mdn-bcd-collector.gooborg.com/ to run tests, the server keeps track of which tests to run, accepts results from each test as it run, and combines all of the results at the end. A random session ID, stored in a cookie, is used to get results back.

When the tests have finished running, buttons for results download and GitHub export be presented.

### WebDriver

Running the tests using WebDriver works in much the same way as when running manually. The results are downloaded and stored in a checkout of `mdn-bcd-results`.

## Updating BCD

The `update-bcd.js` script works as follows:

- Build a "support matrix" mapping a BCD entry + browser release to a support status (true/false/null)
- For every BCD entry for which we have data in the support matrix:
  - Infer a BCD-style support statement from the per-version data in the support matrix. Where we have incomplete information, ranged (≤) versions are used.
  - If the inferred support statement isn't simple (a single object) give up and do nothing.
  - If the BCD support statement had only `prefix`/`alternative_name`/`flags` entries, add our inferred statement.
  - Otherwise, there was an existing simple statement, which we update using the inferred statement.
