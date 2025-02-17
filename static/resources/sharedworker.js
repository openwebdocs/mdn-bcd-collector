//
// mdn-bcd-collector: static/resources/sharedworker.js
// JavaScript to run tests within shared workers
//
// © Mozilla Corporation, Gooborg Studios
// See the LICENSE file for copyright details
//

/* global bcd */

self.importScripts("harness.js");

/**
 * Handle the connection event for the shared worker.
 * @param {Event} connectEvent - The connection event.
 */
self.onconnect = function (connectEvent) {
  var port = connectEvent.ports[0];

  /**
   * Handle the message event for the shared worker port.
   * @param {MessageEvent} event - The message event.
   */
  port.onmessage = function (event) {
    var data = JSON.parse(event.data);

    for (var i in data.instances) {
      bcd.addInstance(i, data.instances[i]);
    }

    bcd.runTests(data.tests, function (results) {
      port.postMessage(JSON.stringify(results));
    });
  };
};
