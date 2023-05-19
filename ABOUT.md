# About the mdn-bcd-collector

This project's goal is to help keep MDN's [browser-compat-data](https://github.com/mdn/browser-compat-data) as up-to-date and as accurate as possible, by running predefined JavaScript code in browsers to determine what features are and are not supported. This project was started by [Philip Jägenstedt](https://foolip.org/) at Google, who later contracted [Vinyl Da.i'gyu-Kazotetsu](https://www.queengoob.org) to help develop the project further. Vinyl has since forked the project and has been maintaining her own version under her own company, [Gooborg Studios](https://www.gooborg.com).

Feature detection tests are generated based on machine readable data (Web IDL, CSS definitions, etc.) from web standards, with support for custom tests and custom data where needed. Tests are then run within browsers (either manually or via a Selenium WebDriver script), generating a results file that can either be downloaded locally or submitted to the [mdn-bcd-results](https://github.com/GooborgStudios/mdn-bcd-results) repository.

## Copyright

© 2023 Gooborg Studios + various contributors, © 2020-2022 Google LLC, Mozilla Corporation and Gooborg Studios.

This project is under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html) license.

## How it Works

The collector has two primary parts:

- The website, which contains the test code that is run in browsers to determine support, and...
- The `update-bcd` script, which takes saved results and compiles them into BCD changes

The workflow for the collector's process looks something like this:

- In the browser...
  - The collector's website is opened
  - The "Run" button is clicked to run all of the tests
  - Once tests are completed, they are exported
  - Rinse and repeat for every browser and browser version results are desired for
- After running through all browser and browser versions...
  - The `update-bcd` script is run to create changes to BCD

## How to Use

The collector can be used to both:

- Determine if a certain feature is supported in the local browser
- Update BCD using collected results

### Runing tests in the browser

Tests may be run in the local browser to determine what is supported and what is not. Head to the homepage to start running tests.

### Updating BCD using the results

See [docs/update-bcd.md](./docs/update-bcd.md) for information on how to use the `update-bcd` script.
