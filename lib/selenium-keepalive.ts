import http from "node:http";
import https from "node:https";

// set the time (in seconds) for connection to be alive
const keepAliveTimeout = 30 * 1000;

if (http.globalAgent && "keepAlive" in http.globalAgent) {
  (http.globalAgent as any).keepAlive = true;
  (https.globalAgent as any).keepAlive = true;
  (http.globalAgent as any).keepAliveMsecs = keepAliveTimeout;
  (https.globalAgent as any).keepAliveMsecs = keepAliveTimeout;
} else {
  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: keepAliveTimeout,
  });

  const secureAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: keepAliveTimeout,
  });

  const httpRequest = http.request;
  const httpsRequest = https.request;

  /**
   * Sends an HTTP request.
   * @param options - The request options.
   * @param callback - The callback function to handle the response.
   * @returns The HTTP request object.
   */
  http.request = (options, callback) => {
    if (options.protocol == "https:") {
      options["agent"] = secureAgent;
      return httpsRequest(options, callback);
    }
    options["agent"] = agent;
    return httpRequest(options, callback);
  };
}
