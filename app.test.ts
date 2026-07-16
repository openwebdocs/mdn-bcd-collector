import {describe, it, before, after} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import fs from "fs-extra";

import {app, version} from "./app.js";

const tests = Object.entries(
  await fs.readJson(new URL("./tests.json", import.meta.url)),
);

const server = http.createServer(app);
let baseURL: string;
let cookie = "";

/**
 * Fetch wrapper that stores the session cookie
 * @param path Path to fetch
 * @param init Request object
 * @returns Promise<Response> Fetch response
 */
const cookieFetch = async (
  path: string,
  /* global RequestInit */
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers);

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    headers,
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // express-session only needs the first cookie pair
    cookie = setCookie.split(";", 1)[0];
  }

  return res;
};

before(() => {
  server.listen(0);
  const {port} = server.address() as any;
  baseURL = `http://127.0.0.1:${port}`;
});

describe("/api/results", () => {
  it("missing `Content-Type` header", async () => {
    const res = await cookieFetch("/api/results", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "string",
    });

    assert.equal(res.status, 400);
  });

  it("missing `for` param", async () => {
    const res = await cookieFetch("/api/results", {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
  });

  it("list results before", async () => {
    const res = await cookieFetch("/api/results");

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      __version: version,
      extensions: [],
      results: {},
      userAgent: "node",
      preview: false,
    });
  });

  const testURL = `http://localhost:8080/tests/api`;
  const testURL2 = `https://host.test/tests/css`;

  const testResults = [
    {
      exposure: "Worker",
      name: "api.Blob",
      result: false,
    },
  ];

  const modifiedResults = [
    {
      exposure: "Worker",
      name: "api.Blob",
      result: true,
    },
  ];

  it("submit valid results", async () => {
    const res = await cookieFetch(
      `/api/results?for=${encodeURIComponent(testURL)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testResults),
      },
    );

    assert.equal(res.status, 201);
    assert.equal(await res.text(), "");
  });

  it("list results after valid", async () => {
    const res = await cookieFetch("/api/results");

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      __version: version,
      extensions: [],
      results: {[testURL]: testResults},
      userAgent: "node",
      preview: false,
    });
  });

  it("submit modified results", async () => {
    const res = await cookieFetch(
      `/api/results?for=${encodeURIComponent(testURL)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modifiedResults),
      },
    );

    assert.equal(res.status, 201);
  });

  it("list results after duplicate", async () => {
    const res = await cookieFetch("/api/results");

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      __version: version,
      extensions: [],
      results: {[testURL]: modifiedResults},
      userAgent: "node",
      preview: false,
    });
  });

  it("submit valid results for new URL", async () => {
    const res = await cookieFetch(
      `/api/results?for=${encodeURIComponent(testURL2)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testResults),
      },
    );

    assert.equal(res.status, 201);
    assert.equal(await res.text(), "");
  });

  it("list results after new valid", async () => {
    const res = await cookieFetch("/api/results");

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      __version: version,
      extensions: [],
      results: {
        [testURL]: modifiedResults,
        [testURL2]: testResults,
      },
      userAgent: "node",
      preview: false,
    });
  });

  it("submit invalid results", async () => {
    const res = await cookieFetch(
      `/api/results?for=${encodeURIComponent(testURL)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "my bad results",
      },
    );

    assert.equal(res.status, 400);
  });
});

describe("/api/get", () => {
  it("get all tests, no post vars", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") || "", /\/tests\/$/);
  });

  it("get all tests, with post vars", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "",
        limitExposure: "",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") || "", /\/tests\/$/);
  });

  it("get all tests, limit exposure", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "",
        limitExposure: "Window",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/\?exposure=Window$/,
    );
  });

  it("get all tests, preview browser", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "",
        limitExposure: "",
        preview: "true",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") || "", /\/tests\/\?preview=true$/);
  });

  it('get "api"', async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api",
        limitExposure: "",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") || "", /\/tests\/api$/);
  });

  it('get "api", limit exposure', async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api",
        limitExposure: "Window",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/api\?exposure=Window$/,
    );
  });

  it("get specific test", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api.AbortController.signal",
        limitExposure: "",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/api\/AbortController\/signal$/,
    );
  });

  it("get specific test, limit exposure", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api.AbortController.signal",
        limitExposure: "Window",
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/api\/AbortController\/signal\?exposure=Window$/,
    );
  });

  it("get specific test, hide results", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api.AbortController.signal",
        limitExposure: "",
        selenium: true,
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/api\/AbortController\/signal\?selenium=true$/,
    );
  });

  it("get specific test, limit exposure and hide results", async () => {
    const res = await fetch(`${baseURL}/api/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testSelection: "api.AbortController.signal",
        limitExposure: "Window",
        selenium: true,
      }),
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.match(
      res.headers.get("location") || "",
      /\/tests\/api\/AbortController\/signal\?selenium=true&exposure=Window$/,
    );
  });
});

describe("test assets", () => {
  it("/eventstream", async () => {
    const res = await fetch(`${baseURL}/eventstream`);
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("content-type"),
      "text/event-stream; charset=utf-8",
    );
  });
});

describe("rendered pages", () => {
  it("/", async () => {
    const res = await fetch(`${baseURL}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /mdn-bcd-collector/);
  });

  it("404", async () => {
    const res = await fetch(`${baseURL}/fakepage`);
    assert.equal(res.status, 404);
  });
});

describe("/tests/", () => {
  it("get a test", async () => {
    // TODO Test page content and ensure we're loading the right tests
    const res = await fetch(
      `${baseURL}/tests/${tests[2][0].replace(/\./g, "/")}`,
    );
    assert.equal(res.status, 200);
  });

  it("get all tests", async () => {
    // TODO Test page content and ensure we're loading the right tests
    const res = await fetch(`${baseURL}/tests/`);
    assert.equal(res.status, 200);
  });

  it("get all tests, ignore CSS", async () => {
    // TODO Test page content and ensure we're loading the right tests
    const res = await fetch(`${baseURL}/tests/?ignore=css`);
    assert.equal(res.status, 200);
  });

  it("get a non-existent test", async () => {
    const res = await fetch(`${baseURL}/tests/dummy/test`);
    assert.equal(res.status, 404);
  });
});

after(() => {
  server.close();
});
