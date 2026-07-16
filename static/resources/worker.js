/* global bcd */

self.importScripts("harness.js");

/**
 * Handles the 'message' event received by the worker.
 * @param {MessageEvent} event - The message event.
 */
self.onmessage = function (event) {
  var data = JSON.parse(event.data);
  self.browserInfo = event.browser;

  for (var i in data.instances) {
    bcd.addInstance(i, data.instances[i]);
  }

  bcd.runTests(data.tests, function (results) {
    self.postMessage(JSON.stringify(results));
  });
};
