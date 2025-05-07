//
// mdn-bcd-collector: static/resources/serviceworker.js
// JavaScript to run tests within service workers
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

/* global bcd */

self.importScripts("harness.js");

// eslint-disable-next-line no-unused-vars
var installEvent = null;

self.addEventListener("install", function (event) {
  installEvent = event;
  var promiseChain = caches.open("test-cache").then(function (openCache) {
    return openCache.put(new Request(""), new Response(""));
  });
  event.waitUntil(promiseChain);
});

self.addEventListener("message", function (event) {
  var data = JSON.parse(event.data);
  self.browserInfo = event.browser;

  for (var i in data.instances) {
    bcd.addInstance(i, data.instances[i]);
  }

  bcd.runTests(data.tests, function (results) {
    event.ports[0].postMessage(JSON.stringify(results));
  });
});
