# API endpoints

HTTP endpoints under `/api/` are used to enumerate/iterate test URLs, report results for individual tests, and finally create a report for a whole session.

## Get URL to run tests

```http
POST /api/get
```

### Parameters

- `testSelection`: BCD path for the tests to run, such as "api.Node". (optional, default to all tests)
- `limitExposure`: The name of a global scope to run the tests on, such as "Window". (optional, defaults to all global scopes)
- `ignore`: Comma-separated list of BCD paths to skip, such as "api.Node.baseURI". (optional)
- `selenium`: Whether to hide the results when collecting results using Selenium. (optional)

### Response

Redirects to a URL to run the tests, such as `/tests/api/Node`.

## List tests

```http
GET /api/tests
```

### Parameters

- `after`: Only list tests after the given test URL. (optional)
- `limit`: The maximum number of tests to list. Defaults to all tests. (optional)

### Response

```json
[
  "https://collector.openwebdocs.org/tests/api/Sensor",
  "http://mdn-bcd-collector.gooborg.com/tests/css/properties/dot-supports"
]
```

If there are no more tests an empty array is returned.

## Report results

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

### Parameters

- `for`: The test URL the results are for. (required)

### Response

Status `201 Created` if the results were saved. The results are put in server-side session storage. Status `400 Bad Request` is returned if the results do not match the expected format.

## List results

```http
GET /api/results
```

### Response

```json
{
  "https://collector.openwebdocs.org/tests/api/Sensor": {
    "some-data": "some-value"
  }
}
```

If no results have been reported to `/api/results` in this session then an empty object is returned.
