# Design of the MDN browser-compat-data collector

This service is part of an effort to [assist BCD updates with automation](https://github.com/mdn/browser-compat-data/issues/3308), and exists to run lots of small tests in browsers to determine the support status of a feature in a browser, and save those results.

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
