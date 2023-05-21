# About the mdn-bcd-collector

This project's goal is to help keep MDN's [browser-compat-data (BCD)](https://github.com/mdn/browser-compat-data) as up-to-date and as accurate as possible, by running predefined JavaScript code in browsers to determine what features are and are not supported. This project was started by [Philip Jägenstedt](https://foolip.org/) at Google, who later contracted [Vinyl Da.i'gyu-Kazotetsu](https://www.queengoob.org) to help develop the project further. Vinyl has since forked the project and has been maintaining her own version under her own company, [Gooborg Studios](https://www.gooborg.com).

Feature detection tests are generated based on machine readable data (Web IDL, CSS definitions, etc.) from web standards, with support for custom tests and custom data where needed. Tests are then run within browsers (either manually or via a Selenium WebDriver script), generating a results file that can either be downloaded locally or submitted to the [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) repository.

## How to Use

The collector project contains two primary parts:

- The website (https://mdn-bcd-collector.gooborg.com)
- The update scripts (`update-bcd` and `add-new-bcd`)

These parts work in tandem to ultimately help ensure that the data within the browser-compat-data repository is as accurate as possible. Depending on what your end goal is, you may use either or both of these components differently. A few common ways that the collector is used include the following:

- Running a specific test in a specific browser to determine if that browser version supports that feature
  - Checking to see what code was run to determine support or lack of, often during reviews of BCD PRs based on collector data
- Running all tests in a specific browser to determine what that browser does and does not support
- Running updates on BCD based on the collector's data to fix errors in BCD
- Adding data for new standard features that BCD does not yet track

### General workflow

The workflow for the collector's process looks something like this:

- In the browser...
  - The collector's website is opened
  - The "Run" button is clicked to run all of the tests
  - Once tests are completed, they are exported
  - Rinse and repeat for every browser and browser version results are desired for
- After running through all browser and browser versions...
  - The `update-bcd` script is run to create changes to BCD

> **Note:** on every new release of the collector, the first part is automatically run on all browsers released in 2020 and later, using Selenium WebDriver on [BrowserStack](https://www.browserstack.com/open-source), [SauceLabs](https://opensource.saucelabs.com/) and [LambdaTest](https://www.lambdatest.com/hyperexecute). These results are saved to the [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) repository for easy use by BCD contributors.

### The Website

The "website" encompasses everything involved with the web interface. This includes:

- The web server
- The web interface
- The [HTTP API](./http-api.md)

The role of the website is to act as a backend during the results collection process, serving files and test code to the browser to determine what features are and are not supported in that browser. It then receives the results from the browser so that it may be compiled into a JSON results file and either downloaded or exported to GitHub in the [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) repository.

### The update scripts

The update scripts take the results collected from the website, compiles them, and then makes changes to the files in BCD to synchronize them with the collector's results. For BCD contributors, this is the primary interaction they will have with the collector. There are two scripts involved in updating BCD:

- `update-bcd` -- this updates the data for features tracked by BCD
- `add-new-bcd` -- this adds features that are not currently tracked by BCD

See [docs/update-bcd.md](./update-bcd.md) for information on how to use the `update-bcd` and `add-new-bcd` scripts.

## FAQ

### Why not generate your own version of BCD using the collected results?

Our tool was not built to compete against BCD, and it may never be able to in the first place.

- `@mdn/browser-compat-data` is widely used in many projects and has many contributors/reviewers
- There are a number of features that can't be tested automatically well (OS limitations, hardware requirements, etc.)
- A number of features tracked in BCD are not/cannot be tracked by the collector
- We at Gooborg Studios are contracted by Open Web Docs and MDN Web Docs to maintain BCD already

### Why not use the interactive examples from MDN?

The examples on MDN Web Docs are written with different goals:

- MDN Web Docs examples are designed to reflect real world use cases; our code is just for feature testing
- Example code on MDN is written using newer syntax (`let`/`const`, arrow functions, etc.) for modern browsers; our code is designed to run on as old of browsers as possible

While some of our code is based on MDN Web Docs examples, it is modified to fit our needs better.

### Why not use tests from WPT.live?

WPT.live is a great resource to test support for various features, but like MDN Web Docs, it has different goals:

- WPT.live exclusively focuses on support for standard features; BCD covers non-standard features as well
- WPT.live focuses on providing test code for the latest browsers to ensure they're all functioning according to spec; thus, they use newer syntax just like the interactive examples on MDN

## Copyright

© 2023 Gooborg Studios + various contributors, © 2020-2022 Google LLC, Mozilla Corporation and Gooborg Studios.

This project is under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html) license.
