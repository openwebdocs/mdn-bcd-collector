# Update-BCD Architecture Notes

The `update-bcd` script iterates through all the entries in a given file from the local BCD repository and compares them against a set of test results to see if there should be any updates to the BCD files.

The `update-bcd` script keeps an internal representation of the data from the BCD file for purposes of applying further transformations to the data to optimize comparisons and for logging.

## About the UpdateInternal Object

Explain the object...

- `path` - the "path" of the BCD entry we're iterating through
- a "shared" object that houses all the data that we're working off of to determine whether or not to update, including the test result Support Matrix and the BCD data.
- a "debug" object, which builds a stack trace of the changes to the entry data.
- a few "statement" objects that hold the data that are most pertinent for updating the BCD file

At a high level, this state object is built by:

1. First, we build the shared data object in the first set of `provideShared` functions (link).
2. Then, we collect the existing support statements in the following series of `provide...Statements` functions (link),
3. Finally, we make decisions about whether or not to update those statements in the last series of `persist...` functions (link).

## Data Flow Examples

Here's a step-by-step explainer along with JSON snapshots of the state object to show how it's built as we move through the chain of operations in the `update` method:

### [expand("entry", ...)](/scripts/update-bcd.ts#L1146)

Start iterating through entries in the BCD data and populating the state object.

```json
{
  path: "api.AbortController",
  debug: {
    stack: [
      {
        step: "entry",
        result: {
          path: "api.AbortController",
        },
      },
    ],
  },
  shared: {
    bcd: {
      api: { ... },
    },
    entry: { ...api.AbortContoller entry data from bcd... },
  },
}
```

We then exit early if the BCD Identifier path doesn’t match an optional `path` argument flag.

### [provideShared(“browserMap”, …)](/scripts/update-bcd.ts#L1152)

Builds the browser “Support Matrix” data based on BCD path.

```json
{
  path: "api.AbortController",
  debug: {
    stack: [
      {
        step: "entry",
        result: {
          path: "api.AbortController",
        },
      },
      {
        step: "provide_shared_browserMap",
        result: {},
      },
    ],
  },
  shared: {
    bcd: { ... },
    entry: { ... },
    browserMap: Map(2) {
	    chrome => Map(4),
	    safari => Map(3)
	  }
  },
}
```

### provideShared(“support”, …)

Get browser support data from BCD entry `__compat` data.

> [!NOTE]
> This is the BCD object entry that is finally mutated at the end of `update`, if we’ve determined there should be updates.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: {
    bcd: { ... },
    entry: { ... },
    browserMap: Map(2),
    support: {
      chrome: {
        version_added: "80",
      },
      safari: {
        version_added: null,
      },
    },
  },
}

```

### provideShared(“unmodifiedSupport”, …)

Clones original support data. This key remains unmodified at the end of `update`.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: {
    bcd: { ... },
    entry: { ... },
    browserMap: Map(2),
    support: { ... },
    unmodifiedSupport: {
      chrome: {
        version_added: "80",
      },
      safari: {
        version_added: null,
      },
    },
  },
}
```

### expand(“browser”, …)

Start iterating through browsers in BrowserMap Support Matrix test results per BCD entry. Gets `versionMap` support data from the `BrowserMap` by browser key.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: {
    bcd: { ... },
    entry: { ... },
    browserMap: Map(2),
    support: { ... },
    unmodifiedSupport: { ... },
    versionMap: Map(4) {
	    "82" => null,
	    "83" => true,
	    "84" => true,
	    "85" => true
    }
  },
  browser: "chrome",
}
```

**Exit early** here if `browser` doesn’t match the optional `browser` filter flag.

### provideAllStatements

Gets all existing support statements from BCD.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: { ...},
  browser: "chrome",
  allStatements: [
    {
      version_added: "80",
    },
  ],
}
```

### provideDefaultStatements

Gets existing un-flagged and un-prefixed statements from BCD. **Exit** if no default statements found. We also run an initial comparison of the test results from the `versionMap` against the `defaultStatements` to determine if there are possible updates. If not, exit early.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: { ... },
  browser: "chrome",
  allStatements: [...],
  defaultStatements: [
	{
      version_added: "80",
    },
  ]
}
```

### provide(“inferredStatements”, …)

Infer Support Statements from Test Report data. Exits if more than 1 statement inferred or if `version_added` doesn’t match any optional `release` filters.

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: { ... },
  browser: "chrome",
  allStatements: [...],
  defaulStatements: [...],
  inferredStatements: [
    {
      version_added: "≤83",
    },
  ],
}

```

### persistIfNoDefault

Updates support data with inferred statements (& existing un-flagged statements) when no default statements exist.

```json
{
  path: "api.AudioContext.close",
  debug: {
    stack: [
      ...,
      {
  	  step: "provide_statements_nonDefault",
         result: {
    	    statements: [
      {
        version_added: "85",
      },
    ],
    	  reason: {
    step: "provide_statements_nonDefault",
    message: "api.AudioContext.close applied for chrome because there is no default statement",
    skip: true,
   },
  },
}
     ]
  },
  shared: { ... },
  browser: "chrome",
  allStatements: [],
  defaultStatements: [],
  inferredStatements: [
   {
      version_added: "85",
    },
  ],
  statements: [
    {
      version_added: "85",
    },
  ]
}
```

> [!NOTE]
> Data that gets written into the `statements` key is ultimately what mutates the original BCD data when we exit the full entry loop, resulting in writes back to the BCD files.

**Exits early** if:

1. More than 1 default statement,
2. Default statement has `version_removed` data, or
3. BCD shows support for newer version than there are test results for

### persistInferredRange

Persist inferred version range when BCD version was set to `preview` or when inferred range supersedes original data.

```json
{
  path: "api.AbortController.abort",
  debug: { ... },
  shared: { ... },
  browser: "chrome",
  allStatements: [ ... ],
  defaultStatements: [
    {
      version_added: "85",
    },
  ],
  inferredStatements: [
    {
      version_added: "≤84",
    },
  ],
  statements: [
    {
      version_added: "≤84",
    },
  ],
}
```

### persistAddedOverPartial

Sets `version_added` to `false` if no inferred added data and only "partial implementation" in BCD data.

```json
{
  path: "api.FakeInterface",
  debug: { ... },
  shared: { ... },
  browser: "chrome",
  allStatements: [ ... ],
  defaultStatements: [
    {
      version_added: "85",
      partial_implementation: true,
      impl_url: "http://zombo.com",
      notes: "This only works on Wednesdays",
    }
  ],
  inferredStatements: [
    {
      version_added: false,
    },
  ],
  statements: [
    {
      version_added: false,
    },
  ],
}
```

### persistAddedOver

Generally overwrites BCD version data with inferred `version_added` data under following conditions:

- it is different from existing value
- is not a range
- is not a boolean (if existing value is a string)
- existing data does not contain `partial_implementation`

```json
{
  path: "api.AbortController",
  debug: { ... },
  shared: {
    ...,
    unmodifiedSupport: {
      ...,
      safari: {
        version_added: null,
      }
    },
  },
  browser: "safari",
  allStatements: [ ... ],
  defaultStatements: [ ... ],
  inferredStatements: [
    {
      version_added: "≤13.1",
       },
  ],
  statements: [
    {
      version_added: "≤13.1",
    },
  ],
}
```

### persistRemoved

Adds `version_removed` data and optionally updates existing `version_removed` data if the inferred `version_removed` data is a string.

```json
{
  path: "api.DeprecatedInterface",
  debug: { ... },
  shared: {
    ...,
    unmodifiedSupport: {
      ...,
      chrome: {
        version_added: null,
      }
    },
  },
  browser: "chrome",
  allStatements: [ ... ],
  defaultStatements: [ ... ],
  inferredStatements: [
    {
      version_added: "≤83",
      version_removed: "85",
    }
  ],
  statements: [
    {
      version_added: "≤83",
      version_removed: "85",
    },
  ],
}
```

### clearNonExact

Overwrites and clears any `statements` with ranged data if optional `exactOnly` flag is set. There is one final skip check after this step . If there are still `statements` at this point, then we include them in the final set of changes for BCD. We also run another comparison of the `versionMap` data from the test results against the updated `defaultStatements` to see if there are still possible updates that could have been made. If there are, then we log those with a warning that possible manual intervention may be required on the BCD file data.
