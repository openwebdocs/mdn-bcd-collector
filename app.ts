//
// mdn-bcd-collector: app.ts
// Main app backend for the website
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import https from "node:https";
import http from "node:http";
import querystring from "node:querystring";
import readline from "node:readline";

import fs from "fs-extra";
import bcd from "@mdn/browser-compat-data" assert {type: "json"};
const bcdBrowsers = bcd.browsers;
import esMain from "es-main";
import express from "express";
import {expressCspHeader, INLINE, SELF, EVAL} from "express-csp-header";
import cookieParser from "cookie-parser";
import {marked} from "marked";
import {markedHighlight} from "marked-highlight";
import hljs from "highlight.js";
import uniqueString from "unique-string";
import expressLayouts from "express-ejs-layouts";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {Octokit} from "@octokit/rest";

import logger from "./lib/logger.js";
import * as exporter from "./lib/exporter.js";
import {getStorage} from "./lib/storage.js";
import {parseUA} from "./lib/ua-parser.js";
import Tests from "./lib/tests.js";
import exec from "./lib/exec.js";
import parseResults from "./lib/results.js";

/* c8 ignore start */
const getAppVersion = async () => {
  const version = (
    await fs.readJson(new URL("./package.json", import.meta.url))
  ).version;
  if (process.env.NODE_ENV === "production") {
    return version;
  }

  try {
    return (await exec("git describe --tags"))
      .replace(/^v/, "")
      .replace("\n", "");
  } catch (e) {
    // If anything happens, e.g., git isn't installed, just use the version
    // from package.json with -dev appended.
    return `${version}-dev`;
  }
};

const appVersion = await getAppVersion();

const secrets = await fs.readJson(
  new URL(
    process.env.NODE_ENV === "test"
      ? "./secrets.sample.json"
      : "./secrets.json",
    import.meta.url,
  ),
);

const browserExtensions = await fs.readJson(
  new URL("./browser-extensions.json", import.meta.url),
);
/* c8 ignore stop */

const storage = getStorage(appVersion);

const tests = new Tests({
  tests: await fs.readJson(new URL("./tests.json", import.meta.url)),
  httpOnly: process.env.NODE_ENV !== "production",
});

const cookieSession = (req, res, next) => {
  req.sessionID = req.cookies.sid;
  if (!req.sessionID) {
    req.sessionID = uniqueString();
    res.cookie("sid", req.sessionID);
  }
  next();
};

const createReport = (results, req) => {
  const extensions = results.extensions;
  const testResults = Object.assign({}, results);
  delete testResults.extensions;
  return {
    __version: appVersion,
    results: testResults,
    extensions,
    userAgent: req.get("User-Agent"),
  };
};

const app = express();

// Cross-Origin policies
const headers = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// Options for static paths
const staticOptions = {
  setHeaders: (res) => {
    for (const h of Object.keys(headers)) {
      res.set(h, headers[h]);
    }
  },
};

// Layout config
app.set("views", "./views");
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout extractScripts", true);

// Additional config
app.use(cookieParser());
app.use(cookieSession);
app.use(express.urlencoded({extended: true}));
app.use(express.json({limit: "32mb"}));
app.use(express.static("static", staticOptions));
app.use(express.static("generated", staticOptions));

app.locals.appVersion = appVersion;
app.locals.bcdVersion = bcd.__meta.version;
app.locals.browserExtensions = browserExtensions;

// Get user agent
app.use((req, res, next) => {
  res.locals.browser = parseUA(req.get("User-Agent"), bcdBrowsers);
  next();
});

// Set Content Security Policy
app.use(
  expressCspHeader({
    directives: {
      "script-src": [SELF, INLINE, EVAL, "http://cdnjs.cloudflare.com"],
    },
  }),
);

// Set COOP/COEP
app.use((req, res, next) => {
  for (const h of Object.keys(headers)) {
    res.setHeader(h, headers[h]);
  }
  next();
});

// Code highlighting for Markdown files
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight: (code, lang) => {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, {language}).value;
    },
  }),
);

// Markdown renderer
const renderMarkdown = async (filepath, req, res) => {
  if (!fs.existsSync(filepath)) {
    res.status(404).render("error", {
      title: "Page Not Found",
      message: "The requested page was not found.",
      url: req.url,
    });
    return;
  }

  const fileData = await fs.readFile(filepath, "utf8");
  res.render("md", {md: marked.parse(fileData)});
};

// Backend API

app.post("/api/get", (req, res) => {
  const testSelection = (req.body.testSelection || "").replace(/\./g, "/");
  const queryParams = {
    selenium: req.body.selenium,
    ignore: req.body.ignore,
    exposure: req.body.limitExposure,
  };
  Object.keys(queryParams).forEach((key) => {
    if (!queryParams[key]) {
      delete queryParams[key];
    }
  });
  const query = querystring.encode(queryParams);

  res.redirect(`/tests/${testSelection}${query ? `?${query}` : ""}`);
});

app.post("/api/results", async (req, res, next) => {
  if (!req.is("json")) {
    res.status(400).send("body should be JSON");
    return;
  }

  let url;
  let results;
  try {
    [url, results] = parseResults(req.query.for, req.body);
  } catch (error) {
    res.status(400).send((error as Error).message);
    return;
  }

  try {
    await storage.put(req.sessionID, url, results);
    res.status(201).end();
  } catch (e) {
    next(e);
  }
});

app.get("/api/results", async (req, res) => {
  const results = await storage.getAll(req.sessionID);
  res.status(200).json(createReport(results, req));
});

app.post("/api/browserExtensions", async (req, res) => {
  if (!req.is("json")) {
    res.status(400).send("body should be JSON");
    return;
  }

  let extData: string[] = [];

  try {
    extData = (await storage.get(req.sessionID, "extensions")) || [];
  } catch (e) {
    // We probably don't have any extension data yet
  }

  if (!Array.isArray(req.body)) {
    res.status(400).send("body should be an array of strings");
    return;
  }

  extData.push(...req.body);
  await storage.put(req.sessionID, "extensions", extData);
  res.status(201).end();
});

// Test Resources

// api.EventSource
app.get("/eventstream", (req, res) => {
  res.header("Content-Type", "text/event-stream");
  res.send(
    'event: ping\ndata: Hello world!\ndata: {"foo": "bar"}\ndata: Goodbye world!',
  );
});

// Views

app.get("/", (req, res) => {
  res.render("index", {
    tests: tests.listEndpoints(),
    selenium: req.query.selenium,
    ignore: req.query.ignore,
  });
});

app.get("/about", async (req, res) => {
  res.redirect("/docs/about.md");
});

app.get("/changelog", async (req, res) => {
  await renderMarkdown(new URL("./CHANGELOG.md", import.meta.url), req, res);
});

app.get("/changelog/*", async (req, res) => {
  await renderMarkdown(
    new URL(`./changelog/${req.params[0]}`, import.meta.url),
    req,
    res,
  );
});

app.get("/docs", async (req, res) => {
  const docs = {};
  for (const f of await fs.readdir(new URL("./docs", import.meta.url))) {
    const readable = fs.createReadStream(
      new URL(`./docs/${f}`, import.meta.url),
    );
    const reader = readline.createInterface({input: readable});
    const line: string = await new Promise((resolve) => {
      reader.on("line", (line) => {
        reader.close();
        resolve(line);
      });
    });
    readable.close();

    docs[f] = line.replace("# ", "");
  }
  res.render("docs", {
    docs,
  });
});

app.get("/docs/*", async (req, res) => {
  await renderMarkdown(
    new URL(`./docs/${req.params["0"]}`, import.meta.url),
    req,
    res,
  );
});

/* c8 ignore start */
app.get("/download/:filename", async (req, res, next) => {
  const data = await storage.readFile(req.params.filename);

  try {
    res.setHeader("content-type", "application/json;charset=UTF-8");
    res.setHeader("content-disposition", "attachment");
    res.send(data);
  } catch (e) {
    next(e);
  }
});

// Accept both GET and POST requests. The form uses POST, but selenium.ts
// instead simply navigates to /export.
app.all("/export", async (req, res, next) => {
  const github = !!req.body.github;
  const results = await storage.getAll(req.sessionID);

  if (!results) {
    res.status(400).render("export", {
      title: "Export Failed",
      description:
        "Export failed because there were no results for your session.",
      url: null,
    });
  }

  try {
    const report = createReport(results, req);
    if (github) {
      const token = secrets.github.token || process.env.GITHUB_TOKEN;
      if (token) {
        try {
          const octokit = new Octokit({auth: `token ${token}`});
          const {url} = await exporter.exportAsPR(report, octokit);
          res.render("export", {
            title: "Exported to GitHub",
            description: url,
            url,
          });
        } catch (e) {
          logger.error(e);
          res.status(500).render("export", {
            title: "GitHub Export Failed",
            description: "[GitHub Export Failed]",
            url: null,
          });
        }
      } else {
        res.render("export", {
          title: "GitHub Export Disabled",
          description: "[No GitHub Token, GitHub Export Disabled]",
          url: null,
        });
      }
    } else {
      const {filename, buffer} = exporter.getReportMeta(report);
      await storage.saveFile(filename, buffer);
      res.render("export", {
        title: "Exported for download",
        description: filename,
        url: `/download/${filename}`,
      });
    }
  } catch (e) {
    next(e);
  }
});
/* c8 ignore stop */

app.all("/tests/*", (req, res) => {
  const ident = req.params["0"].replace(/\//g, ".");
  const ignoreIdents = req.query.ignore
    ? req.query.ignore.split(",").filter((s) => s)
    : [];
  const foundTests = tests.getTests(ident, req.query.exposure, ignoreIdents);
  if (foundTests && foundTests.length) {
    res.render("tests", {
      title: `${ident || "All Tests"}`,
      tests: foundTests,
      resources: tests.resources,
      selenium: req.query.selenium,
    });
  } else {
    res.status(404).render("testnotfound", {
      ident,
      suggestion: tests.didYouMean(ident),
      query: querystring.encode(req.query),
    });
  }
});

// Page Not Found Handler
app.use((req, res) => {
  res.status(404).render("error", {
    title: `Page Not Found`,
    message: "The requested page was not found.",
    url: req.url,
  });
});

/* c8 ignore start */
if (esMain(import.meta)) {
  const {argv}: {argv: any} = yargs(hideBin(process.argv)).command(
    "$0",
    "Run the mdn-bcd-collector server",
    (yargs) => {
      yargs
        .option("https-cert", {
          describe: "HTTPS cert chains in PEM format",
          type: "string",
        })
        .option("https-key", {
          describe: "HTTPS private keys in PEM format",
          type: "string",
        })
        .option("https-port", {
          describe: "HTTPS port (requires cert and key)",
          type: "number",
          default: 8443,
        })
        .option("port", {
          describe: "HTTP port",
          type: "number",
          default: process.env.PORT ? +process.env.PORT : 8080,
        });
    },
  );

  http.createServer(app).listen(argv.port);
  logger.info(`Listening on port ${argv.port} (HTTP)`);
  if (argv.httpsCert && argv.httpsKey) {
    const options = {
      cert: fs.readFileSync(argv.httpsCert),
      key: fs.readFileSync(argv.httpsKey),
    };
    https.createServer(options, app).listen(argv.httpsPort);
    logger.info(`Listening on port ${argv.httpsPort} (HTTPS)`);
  }
  logger.info("Press Ctrl+C to quit.");
}
/* c8 ignore stop */

export {app, appVersion as version};
