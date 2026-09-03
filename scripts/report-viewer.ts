import * as fs from "fs";
import * as path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  exposure: string;
  name: string;
  result: boolean | null;
  message?: string;
}

interface Report {
  __version: string;
  results: Record<string, TestResult[]>;
  extensions: string[];
  userAgent: string;
  generatedAt?: string;
}

// Official top-level categories from browser-compat-data (directory order).
const BCD_CATEGORIES = [
  "api",
  "css",
  "html",
  "http",
  "javascript",
  "mathml",
  "mediatypes",
  "svg",
  "webassembly",
  "webdriver",
  "webextensions",
];

interface ReportStat {
  file: string;
  ua: string;
  version: string;
  __gi?: number;
  osName: string;
  osVersion: string;          // Raw OS version string, e.g. "7.0"
  osVersionNum: number[];     // Dot-split version as array, for cross-version ascending comparison
  browserFullVer: string;     // Full browser engine version, e.g. "142.0.0.0"
  shortLabel: string;         // Short label: browser-engineVersion-osName-osVersion, e.g. "chrome-142.0.0.0-windows-10"
  generatedAt: number;        // Report generation timestamp (ms); falls back to mtime for old reports
  mtime: number;              // File modification time (ms), used as fallback for old reports
  total: number;
  supported: number;
  unsupported: number;
  unknown: number;
  categories: Record<
    string,
    { total: number; supported: number; unsupported: number; unknown: number }
  >;
  entries: {
    path: string;
    result: boolean | null;
    exposure: string;
    name: string;
    message?: string;
  }[];
}

const collectJsonFiles = (args: string[]): string[] => {
  const baseDir = path.resolve(__dirname, "..", "mdn-bcd-results");
  if (args.length === 0) {
    if (!fs.existsSync(baseDir)) {
      console.error(`No result directory found at ${baseDir}`);
      process.exit(1);
    }
    return fs
      .readdirSync(baseDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(baseDir, f));
  }
  const files: string[] = [];
  for (const arg of args) {
    const p = path.resolve(arg);
    if (fs.statSync(p).isDirectory()) {
      files.push(
        ...fs
          .readdirSync(p)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.join(p, f)),
      );
    } else {
      files.push(p);
    }
  }
  return files;
};

// Parse the first complete JSON object from a file. This is tolerant of files
// that contain multiple concatenated JSON objects (e.g. two collector runs
// accidentally written to the same file), only the first one is used.
const parseFirstJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = (e as Error).message;
    // "Unexpected non-whitespace character after JSON" => concatenated payloads.
    if (!/after JSON/i.test(msg)) throw e;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(0, i + 1);
          return JSON.parse(candidate);
        }
      }
    }
    throw e;
  }
};

// Parse the browser id, OS name and version from the filename. The filename slug looks like:
//   {collectorVer}-{browserId}-{fullVer}-{osName}-{osVersion}-{digest}.json
// digest is a 10-char hex string (at the end). We strip segments from the right,
// extracting digest / osVersion / osName / browserFullVer in order, leaving
// collectorVer-browserId, from which browserId is split out; this robustly
// handles hyphens within each segment.
const parseOsFromFilename = (basename: string): {
  browserId: string;
  osName: string;
  osVersion: string;
  osVersionNum: number[];
  browserFullVer: string;
  shortLabel: string;
} => {
  const empty = { browserId: "", osName: "", osVersion: "", osVersionNum: [], browserFullVer: "", shortLabel: "" };
  let rest = basename.replace(/\.json$/i, "");
  let m = rest.match(/-([0-9a-f]{10})$/i);
  if (!m) return empty;
  rest = rest.slice(0, m.index);                       // strip -digest
  m = rest.match(/-(\d+(?:\.\d+)*)$/);                 // osVersion
  const osVersion = m ? m[1] : "";
  if (m) rest = rest.slice(0, m.index);
  m = rest.match(/-([^-\s]+)$/);                       // osName (single segment)
  const osName = m ? m[1] : "";
  if (m) rest = rest.slice(0, m.index);
  m = rest.match(/-(\d+(?:\.\d+)*)$/);                 // browserFullVer (engine version)
  const browserFullVer = m ? m[1] : "";
  if (m) rest = rest.slice(0, m.index);
  const parts = rest.split("-");
  parts.shift();                                        // strip collectorVer
  const browserId = parts.join("-");                   // browser id (may contain -)
  const osVersionNum = osVersion.split(".").map((n) => parseInt(n, 10) || 0);
  // short label: browser-engineVersion-osName-osVersion, segments joined by hyphen
  const shortLabel = [browserId, browserFullVer, osName, osVersion].filter(Boolean).join("-");
  return { browserId, osName, osVersion, osVersionNum, browserFullVer, shortLabel };
};

// Compare two dot-split version arrays; returns negative if a<b, positive if a>b, 0 if equal.
const compareVersionNum = (a: number[], b: number[]): number => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
};

const buildStat = (file: string): ReportStat => {
  const raw = parseFirstJson(fs.readFileSync(file, "utf-8")) as Report;
  const entries: ReportStat["entries"] = [];
  const categories: ReportStat["categories"] = {};
  let total = 0;
  let supported = 0;
  let unsupported = 0;
  let unknown = 0;
  const basename = path.basename(file);
  const { osName, osVersion, osVersionNum, browserFullVer, shortLabel } = parseOsFromFilename(basename);
  const mtime = fs.statSync(file).mtimeMs;
  // Prefer the report's internal timestamp (generatedAt, written by the collector);
  // fall back to file modification time for older reports that lack the field.
  const generatedAt = raw.generatedAt ? Date.parse(raw.generatedAt) : mtime;
  for (const arr of Object.values(raw.results)) {
    for (const t of arr as TestResult[]) {
      // The BCD path lives in the entry's "name" field, not the outer key.
      const bcdPath = t.name || "unknown";
      const category = bcdPath.split(".")[0] || "other";
      if (!categories[category]) {
        categories[category] = { total: 0, supported: 0, unsupported: 0, unknown: 0 };
      }
      total++;
      categories[category].total++;
      if (t.result === true) {
        supported++;
        categories[category].supported++;
      } else if (t.result === false) {
        unsupported++;
        categories[category].unsupported++;
      } else {
        unknown++;
        categories[category].unknown++;
      }
      entries.push({
        path: bcdPath,
        result: t.result,
        exposure: t.exposure,
        name: bcdPath,
        message: t.message,
      });
    }
  }
  return {
    file: basename,
    ua: raw.userAgent,
    version: raw.__version,
    osName,
    osVersion,
    osVersionNum,
    browserFullVer,
    shortLabel,
    generatedAt,
    mtime,
    total,
    supported,
    unsupported,
    unknown,
    categories,
    entries,
  };
};

const buildHtml = (stats: ReportStat[]): string => {
  const data = JSON.stringify(
  stats.map((s, gi) => ({ ...s, __gi: gi })),
);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>BCD 测试结果查看器</title>
<style>
  body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 20px; background: #f5f6f8; color: #222; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  .toolbar { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  select, input { padding: 6px 10px; border: 1px solid #ccd; border-radius: 6px; font-size: 14px; }
  input { min-width: 240px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); min-width: 120px; }
  .card .num { font-size: 26px; font-weight: 700; }
  .card .lbl { font-size: 12px; color: #777; }
  .card.pass .num { color: #4f9e74; }
  .card.fail .num { color: #c26666; }
  .card.unknown .num { color: #b89a45; }
  .bar { height: 10px; border-radius: 6px; overflow: hidden; display: flex; margin: 8px 0 18px; background: #eee; }
  .bar .pass { background: #7ec9a4; }
  .bar .fail { background: #e1919a; }
  .bar .unknown { background: #e6cf86; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  th { background: #f0f1f4; position: sticky; top: 0; }
  tr:hover { background: #fafbfc; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .tag.pass { background: #e3f4ea; color: #4f9e74; }
  .tag.fail { background: #fbe2e2; color: #c26666; }
  .tag.unknown { background: #f9eed2; color: #b89a45; }
  .path { font-family: ui-monospace, Menlo, Consolas, monospace; }
  .msg { color: #888; font-size: 12px; }
  .meta { font-size: 13px; color: #555; margin-bottom: 6px; }
  .cat-title { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }
  .cat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
  .cat { background: #fff; border-radius: 10px; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); min-width: 150px; cursor: pointer; border: 2px solid transparent; }
  .cat:hover { border-color: #c9d4ff; }
  .cat.active { border-color: #4a73ff; }
  .cat .cname { font-size: 13px; color: #555; margin-bottom: 6px; }
  .cat .cstat { font-size: 12px; color: #888; line-height: 1.6; }
  .cat .cstat b.p { color: #4f9e74; }
  .cat .cstat b.f { color: #c26666; }
  .cat .cstat b.u { color: #b89a45; }
  .pie-wrap { display: flex; align-items: center; gap: 24px; background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 16px; flex-wrap: wrap; }
  .pie-wrap svg { display: block; }
  .pie-legend { font-size: 14px; }
  .pie-legend .li { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .pie-legend .sw { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
  .pie-legend .li b { min-width: 52px; }
  .pie-title { font-size: 13px; color: #777; margin-bottom: 6px; }
  .report-list { max-height: 200px; overflow: auto; border: 1px solid #ccd; border-radius: 6px; padding: 8px 10px; background: #fff; min-width: 360px; }
  .report-list .hint { font-size: 11px; color: #999; margin-bottom: 6px; }
  .file-table { border-collapse: collapse; width: 100%; font-size: 13px; }
  .file-table th, .file-table td { border-bottom: 1px solid #eee; padding: 4px 8px; text-align: left; }
  .file-table thead th { background: #f0f2f5; color: #555; font-weight: 600; }
  .file-table .gi-cb { width: 28px; text-align: center; }
  .file-table .gi-num { width: 48px; text-align: center; color: #1565c0; font-weight: 600; white-space: nowrap; }
  .file-table .gi-file { word-break: break-all; }
  .compare-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .compare-grid .rep { width: 396px; box-sizing: border-box; background: #fff; border-radius: 10px; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; gap: 14px; align-items: flex-start; }
  .compare-grid .rep .meta2 { font-size: 12px; color: #555; width: 216px; word-break: break-word; overflow-wrap: break-word; }
  .compare-grid .rep .meta2 b { font-size: 13px; display: block; margin-bottom: 4px; word-break: break-word; overflow-wrap: break-word; }
  table.compare { min-width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 18px; }
  #catCompare { overflow-x: auto; table-layout: fixed; }
  #attrCompare { overflow-x: auto; table-layout: fixed; }
  .rep-h { display: block; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  table.compare th, table.compare td { padding: 7px 6px; border: 1px solid #e3e6ea; font-size: 13px; text-align: center; }
  table.compare th:first-child, table.compare td:first-child { overflow: visible; }
  table.compare th { background: #f0f1f4; font-weight: 700; }
  table.compare thead th { border-bottom: 2px solid #c4ccd6; }
  table.compare col.col-path { width: 240px; }
  table.compare thead th:first-child { vertical-align: middle; }
  #attrCompare th:first-child, #attrCompare td:first-child { white-space: normal; width: 583px; min-width: 583px; max-width: 583px; word-break: break-all; overflow-wrap: break-word; }
  #catCompare th:first-child, #catCompare td:first-child { white-space: normal; width: 240px; min-width: 240px; max-width: 240px; word-break: break-all; overflow-wrap: break-word; }
  table.compare td.path { text-align: left; font-family: ui-monospace, Menlo, Consolas, monospace; }
  table.compare thead tr:first-child th { white-space: nowrap; font-size: 11px; }
  table.compare .cat-h { text-align: left; }
  table.compare tr.diff td { background: #fff7e6; }
  table.compare td.dim { opacity: .35; }
  table.compare td.na { color: #bbb; }
  .cmp-title { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }
  .bar-chart { background: #fff; border-radius: 10px; padding: 16px 20px 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 16px; overflow-x: auto; }
  .bar-chart svg { display: block; }
  .bar-chart .axis { stroke: #ccc; stroke-width: 1; }
  .bar-chart .grid { stroke: #eee; stroke-width: 1; }
  .bar-chart .ytick { font-size: 11px; fill: #888; }
  .bar-chart .xtick { font-size: 12px; fill: #444; text-anchor: middle; }
  .bar-chart .bar-val { font-size: 9px; fill: #222; text-anchor: middle; }
  .bar-chart .bar-val.in { fill: #333; font-weight: 600; }
  .compare .r-pass { color: #4f9e74; font-weight: 600; background: #e3f4ea; }
  .compare .r-fail { color: #c26666; font-weight: 600; background: #fbe2e2; }
  .compare .r-unk  { color: #b89a45; font-weight: 600; background: #f9eed2; }
  .compare .muted { color: #999; font-weight: 400; font-size: 11px; }
  .bar-chart .grp-label { font-size: 11px; fill: #666; text-anchor: middle; }
  .bar-chart .chart-legend { font-size: 12px; margin: 6px 0 2px; }
  .bar-chart .chart-legend .li { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; }
  .bar-chart .chart-legend .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
</style>
</head>
<body>
<h1>BCD 测试结果查看器</h1>
<div class="toolbar">
  <div class="report-list" id="fileList"></div>
  <input id="search" type="text" placeholder="筛选属性路径，如 api.css or 失败" />
  <label>仅显示：
    <select id="filter">
      <option value="all">全部</option>
      <option value="true">仅支持</option>
      <option value="false">仅失败</option>
      <option value="null">仅未知</option>
      <option value="diff">仅不一致</option>
    </select>
  </label>
  <label>按分类：
    <select id="catFilter">
      <option value="all">全部</option>
    </select>
  </label>
</div>
<div id="meta" class="meta"></div>
<div class="pie-wrap" id="pieWrap">
  <svg id="pie" width="140" height="140" viewBox="0 0 140 140"></svg>
  <div class="pie-legend" id="pieLegend"></div>
</div>
<div class="cards" id="cards"></div>
<div class="bar" id="bar"></div>
<div class="cat-title" id="catTitle">按 BCD 分类统计（点击可筛选下方列表）</div>
<div class="cat-grid" id="catGrid"></div>
<table id="singleTable">
  <thead><tr><th>结果</th><th>属性路径</th><th>名称</th><th>类型</th><th>说明</th></tr></thead>
  <tbody id="rows"></tbody>
</table>

<div id="compareView" style="display:none">
  <div class="cmp-title">报告结果整体趋势（支持 / 失败 / 未知 占比折线图，按报告顺序从左到右）</div>
  <div class="line-chart" id="compareLine"></div>
  <div class="cmp-title">各报告筛选结果对比（每张饼图对应当前筛选 / 搜索条件下的属性结果占比）</div>
  <div class="compare-grid" id="compareSummary"></div>
  <div class="cmp-title" id="catBarTitle">按 BCD 分类对比（支持率柱状图）</div>
  <div class="bar-chart" id="catBarChart"></div>
  <div class="cmp-title">按 BCD 分类对比（支持率 %）</div>
  <table class="compare" id="catCompare"></table>
  <div class="cmp-title">属性结果横向对比（高亮行 = 各报告结果不一致）</div>
  <table class="compare" id="attrCompare"></table>
</div>

<script>
const STATS = ${data};
const BCD_CATEGORIES = ${JSON.stringify(BCD_CATEGORIES)};
const fileListEl = document.getElementById("fileList");
const search = document.getElementById("search");
const filterSel = document.getElementById("filter");
const catFilter = document.getElementById("catFilter");
const catGrid = document.getElementById("catGrid");
const rowsEl = document.getElementById("rows");
const cardsEl = document.getElementById("cards");
const barEl = document.getElementById("bar");
const metaEl = document.getElementById("meta");
let activeCat = "all";

// ----- Report multi-select checkboxes -----
const selected = new Set(STATS.map((s) => s.__gi));
const fileRows = STATS.map((s) => {
  const checked = selected.has(s.__gi) ? "checked" : "";
  return "<tr>" +
    "<td class='gi-cb'><input type='checkbox' data-gi='" + s.__gi + "' " + checked + "></td>" +
    "<td class='gi-file'>" + esc(s.file) + "  (" + s.total + " 项)</td>" +
    "<td class='gi-num'>#" + (s.__gi + 1) + "</td>" +
    "</tr>";
}).join("");
fileListEl.innerHTML =
  "<div class='hint'>Check to compare multiple reports (keep at least 1)</div>" +
  "<table class='file-table'>" +
  "<thead><tr><th></th><th>报告</th><th>编号</th></tr></thead>" +
  "<tbody>" + fileRows + "</tbody>" +
  "</table>";
fileListEl.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
  cb.addEventListener("change", function () {
    const gi = parseInt(cb.getAttribute("data-gi"), 10);
    if (cb.checked) selected.add(gi);
    else {
      selected.delete(gi);
      if (selected.size === 0) { cb.checked = true; selected.add(gi); }
    }
    render();
  });
});
const selectedStats = () => STATS.filter((s) => selected.has(s.__gi));

// ----- Utility functions -----
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function resultClass(r){ return r===true?"pass":r===false?"fail":"unknown"; }
function resultText(r){ return r===true?"支持":r===false?"失败":"未知"; }
function card(lbl, num, cls) {
  return "<div class='card " + cls + "'><div class='num'>" + num + "</div><div class='lbl'>" + lbl + "</div></div>";
}
function pct(n, total){ return total ? (n / total * 100).toFixed(1) : "0.0"; }

function renderPieInto(pieEl, legendEl, s) {
  const segs = [
    { label: "支持", value: s.supported, color: "#7ec9a4" },
    { label: "失败", value: s.unsupported, color: "#e1919a" },
    { label: "未知", value: s.unknown, color: "#e6cf86" },
  ];
  const total = s.total || 1;
  const cx = 70, cy = 70, r = 60;
  const polar = (deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  let acc = 0;
  let paths = "";
  const nonZero = segs.filter((x) => x.value > 0);
  for (const seg of segs) {
    if (seg.value <= 0) continue;
    if (nonZero.length === 1) {
      paths += "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='" + seg.color + "'/>";
      continue;
    }
    const start = acc * 360;
    const end = (acc + seg.value / total) * 360;
    acc += seg.value / total;
    const [x1, y1] = polar(start);
    const [x2, y2] = polar(end);
    const large = end - start > 180 ? 1 : 0;
    paths +=
      "<path d='M" + cx + " " + cy + " L" + x1.toFixed(2) + " " + y1.toFixed(2) +
      " A" + r + " " + r + " 0 " + large + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) +
      " Z' fill='" + seg.color + "'/>";
  }
  pieEl.innerHTML = paths;
  if (legendEl) {
    legendEl.innerHTML =
      "<div class='pie-title'>当前筛选结果占比（共 " + s.total + " 项）</div>" +
      (s.total === 0
        ? "<div class='li'>无匹配结果</div>"
        : segs.map((seg) =>
            "<div class='li'><span class='sw' style='background:" + seg.color + "'></span>" +
            "<b>" + seg.label + "</b> " + pct(seg.value, total) + "% （" + seg.value + "）</div>"
          ).join(""));
  }
}

// Grouped bar chart by BCD category. X axis: BCD categories; Y axis: percent.
// Each group = one category; within a group, one bar per report (supported/unsupported/unknown stacked).
function renderCatBars(container, stats) {
  const cats = BCD_CATEGORIES;
  const segDefs = [
    { key: "supported", label: "支持", color: "#7ec9a4" },
    { key: "unsupported", label: "失败", color: "#e1919a" },
    { key: "unknown", label: "未知", color: "#e6cf86" },
  ];
  const nReports = stats.length;         // one bar per report
  const groupW = 90;                     // width of one category group
  const barGap = 8;                      // gap between bars within a group
  const barW = (groupW - (nReports - 1) * barGap) / nReports;  // single bar width
  const groupGap = 20;                   // gap between category groups
  const padL = 40, padR = 16, padT = 22, padB = 56;
  const chartH = 320;
  const innerW = cats.length * groupW + (cats.length - 1) * groupGap;
  const innerH = chartH - padT - padB;
  const svgW = padL + innerW + padR;
  const svgH = chartH;

  let svg = "";
  // grid + Y axis ticks (0/25/50/75/100%)
  for (let p = 0; p <= 100; p += 25) {
    const y = padT + innerH * (1 - p / 100);
    svg += "<line class='grid' x1='" + padL + "' y1='" + y.toFixed(1) + "' x2='" + (padL + innerW) + "' y2='" + y.toFixed(1) + "'/>";
    svg += "<text class='ytick' x='" + (padL - 6) + "' y='" + (y + 4).toFixed(1) + "' text-anchor='end'>" + p + "%</text>";
  }
  svg += "<line class='axis' x1='" + padL + "' y1='" + padT + "' x2='" + padL + "' y2='" + (padT + innerH) + "'/>";
  svg += "<line class='axis' x1='" + padL + "' y1='" + (padT + innerH) + "' x2='" + (padL + innerW) + "' y2='" + (padT + innerH) + "'/>";

  cats.forEach((c, ci) => {
    const gx = padL + ci * (groupW + groupGap);
    const groupCx = gx + groupW / 2;
    stats.forEach((s, gi) => {
      const st = s.categories[c] || { total: 0, supported: 0, unsupported: 0, unknown: 0 };
      const t = st.total || 1;
      const bx = gx + gi * (barW + barGap);
      // stack: supported (bottom) -> unsupported -> unknown (top)
      let yCursor = padT + innerH;
      segDefs.forEach((sd) => {
        const v = st[sd.key];
        const h = (v / t) * innerH;
        const y = yCursor - h;
        svg += "<rect x='" + bx.toFixed(1) + "' y='" + y.toFixed(1) + "' width='" + barW.toFixed(1) + "' height='" + h.toFixed(1) + "' fill='" + sd.color + "'><title>" + esc(s.file) + " / " + esc(c) + " / " + sd.label + " " + pct(v, t) + "% (" + v + ")</title></rect>";
        // show percentage inside the segment (only if tall enough to fit text)
        if (v > 0 && h >= 10) {
          svg += "<text class='bar-val in' x='" + (bx + barW / 2).toFixed(1) + "' y='" + (y + h / 2 + 3).toFixed(1) + "'>" + pct(v, t) + "%</text>";
        }
        yCursor = y;
      });
    });
    svg += "<text class='xtick' x='" + groupCx.toFixed(1) + "' y='" + (padT + innerH + 16) + "'>" + esc(c) + "</text>";
  });

  // legend (per-segment color hints)
  const legend = "<div class='chart-legend'>" + segDefs.map((sd) =>
    "<span class='li'><span class='sw' style='background:" + sd.color + "'></span>" + sd.label + "</span>"
  ).join("") + "</div>";

  container.innerHTML = legend +
    "<svg width='" + svgW + "' height='" + svgH + "' viewBox='0 0 " + svgW + " " + svgH + "'>" + svg + "</svg>";
}

// Populate the category dropdown (BCD order), shared by single and compare views
function fillCatOptions() {
  const cur = catFilter.value;
  while (catFilter.options.length > 1) catFilter.remove(1);
  BCD_CATEGORIES.forEach((c) => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    catFilter.appendChild(o);
  });
  // Restore the current selection after rebuilding options (browser resets to first item otherwise)
  if (cur && (cur === "all" || BCD_CATEGORIES.includes(cur))) catFilter.value = cur;
  if (activeCat !== "all" && !BCD_CATEGORIES.includes(activeCat)) activeCat = "all";
}

// Category cards (single-report view)
function renderCats(s) {
  const cats = BCD_CATEGORIES.slice();
  fillCatOptions();
  if (activeCat !== "all" && !cats.includes(activeCat)) activeCat = "all";
  const html = [];
  for (const c of cats) {
    const st = s.categories[c] || { total: 0, supported: 0, unsupported: 0, unknown: 0 };
    html.push(
      "<div class='cat" + (activeCat === c ? " active" : "") + "' data-cat='" + esc(c) + "'>" +
      "<div class='cname'>" + esc(c) + " (" + st.total + ")</div>" +
      "<div class='cstat'>支持 <b class='p'>" + pct(st.supported, st.total) + "%</b> · " +
      "失败 <b class='f'>" + pct(st.unsupported, st.total) + "%</b> · " +
      "未知 <b class='u'>" + pct(st.unknown, st.total) + "%</b></div>" +
      "</div>"
    );
  }
  catGrid.innerHTML = html.join("");
  catGrid.querySelectorAll(".cat").forEach((el) => {
    el.onclick = () => {
      const c = el.getAttribute("data-cat");
      activeCat = activeCat === c ? "all" : c;
      catFilter.value = activeCat;
      render();
    };
  });
}

// Whether an entry matches the filter conditions (shared by single report and compare table)
function matchEntry(e, q, f) {
  if (activeCat !== "all" && e.path.split(".")[0] !== activeCat) return false;
  if (f !== "all" && String(e.result) !== f) return false;
  if (q && !(e.path.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || resultText(e.result).includes(q))) return false;
  return true;
}

// ----- Single-report view -----
function renderSingle(s) {
  const q = search.value.trim().toLowerCase();
  const f = filterSel.value;
  if (catFilter.value !== activeCat) activeCat = catFilter.value;
  metaEl.textContent = "UA: " + s.ua + "   报告版本: " + s.version;
  cardsEl.innerHTML =
    card("总数", s.total, "") +
    card("支持率", pct(s.supported, s.total) + "%", "pass") +
    card("失败率", pct(s.unsupported, s.total) + "%", "fail") +
    card("未知率", pct(s.unknown, s.total) + "%", "unknown");
  barEl.innerHTML =
    '<div class="pass" style="width:' + pct(s.supported, s.total) + '%"></div>' +
    '<div class="fail" style="width:' + pct(s.unsupported, s.total) + '%"></div>' +
    '<div class="unknown" style="width:' + pct(s.unknown, s.total) + '%"></div>';

  let fTotal = 0, fSup = 0, fUns = 0, fUnk = 0;
  const html = [];
  for (const e of s.entries) {
    if (!matchEntry(e, q, f)) continue;
    fTotal++;
    if (e.result === true) fSup++;
    else if (e.result === false) fUns++;
    else fUnk++;
    html.push(
      "<tr><td><span class='tag " + resultClass(e.result) + "'>" + resultText(e.result) + "</span></td>" +
      "<td class='path'>" + esc(e.path) + "</td>" +
      "<td>" + esc(e.name) + "</td>" +
      "<td>" + esc(e.exposure) + "</td>" +
      "<td class='msg'>" + esc(e.message || "") + "</td></tr>"
    );
  }
  rowsEl.innerHTML = html.join("");
  renderPieInto(document.getElementById("pie"), document.getElementById("pieLegend"),
    { total: fTotal, supported: fSup, unsupported: fUns, unknown: fUnk });
}

// ----- Compare view: overall report trend line chart -----
// X axis = reports (in stats order: OS version ascending, within same version by time old->new,
// i.e. low to high left to right). Three lines show overall supported/unsupported/unknown rates
// based on each report's full test results, unaffected by search/filter.
function renderCompareLine(container, stats) {
  if (!stats.length) { container.innerHTML = ""; return; }
  const data = stats.map(function (s) {
    const t = s.total || 0;
    return {
      file: s.file,
      idx: s.__gi,
      sup: t ? (s.supported / t) * 100 : 0,
      uns: t ? (s.unsupported / t) * 100 : 0,
      unk: t ? (s.unknown / t) * 100 : 0,
    };
  });

  const W = Math.max(360, 48 + data.length * 64);
  const H = 290, padL = 46, padR = 16, padT = 26, padB = 80;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = function (i) { return data.length === 1 ? padL + innerW / 2 : padL + innerW * i / (data.length - 1); };
  const y = function (v) { return padT + innerH * (1 - v / 100); };

  let svg = "";
  [0, 25, 50, 75, 100].forEach(function (v) {
    const yy = y(v);
    svg += "<line x1='" + padL + "' y1='" + yy + "' x2='" + (W - padR) + "' y2='" + yy + "' stroke='#eee'/>";
    svg += "<text x='" + (padL - 6) + "' y='" + (yy + 4) + "' font-size='10' fill='#888' text-anchor='end'>" + v + "%</text>";
  });

  const series = [
    { key: "sup", color: "#2e7d32", label: "支持" },
    { key: "uns", color: "#c62828", label: "失败" },
    { key: "unk", color: "#f9a825", label: "未知" },
  ];
  series.forEach(function (ser) {
    const pts = data.map(function (d, i) { return x(i) + "," + y(d[ser.key]); }).join(" ");
    svg += "<polyline points='" + pts + "' fill='none' stroke='" + ser.color + "' stroke-width='2'/>";
    data.forEach(function (d, i) {
      const cx = x(i), cy = y(d[ser.key]);
      // The three lines share the same x; number labels are offset to avoid overlap:
      // supported -> above, unknown -> upper-right, unsupported -> below
      const dyTxt = ser.key === "sup" ? -6 : ser.key === "uns" ? 12 : -6;
      const dxTxt = ser.key === "unk" ? 11 : 0;
      svg += "<circle cx='" + cx + "' cy='" + cy + "' r='3' fill='" + ser.color + "'>" +
        "<title>" + esc(d.file) + "&#10;" + ser.label + ": " + d[ser.key].toFixed(1) + "%</title></circle>";
      svg += "<text x='" + (cx + dxTxt) + "' y='" + (cy + dyTxt) + "' font-size='10' fill='" + ser.color + "' text-anchor='middle'>" + d[ser.key].toFixed(1) + "%</text>";
    });
  });

  data.forEach(function (d, i) {
    const label = "#" + (d.idx + 1);   // X axis shows only the report number to avoid long filenames
    const tx = x(i), ty = H - padB + 14;
    svg += "<text x='" + tx + "' y='" + ty + "' font-size='11' fill='#333' text-anchor='end' " +
      "transform='rotate(-35 " + tx + " " + ty + ")'><title>" + esc(d.file) + "</title>" + esc(label) + "</text>";
  });

  const legend = "<div class='line-legend'>" +
    series.map(function (s) {
      return "<span style='display:inline-flex;align-items:center;margin-right:14px;font-size:12px'>" +
        "<i style='display:inline-block;width:14px;height:3px;background:" + s.color + ";margin-right:5px'></i>" +
        s.label + "</span>";
    }).join("") + "</div>";

  container.innerHTML = legend +
    "<div style='overflow-x:auto;max-width:100%'>" +
    "<svg width='" + W + "' height='" + H + "' viewBox='0 0 " + W + " " + H + "' style='display:block'>" + svg + "</svg>" +
    "</div>";
}

// ----- Compare view -----
function renderCompare(stats) {
  const q = search.value.trim().toLowerCase();
  const f = filterSel.value;

  // 0) Overall report trend line chart (supported / unsupported / unknown ratio)
  renderCompareLine(document.getElementById("compareLine"), stats);

  // 1) Per-report summary (card + mini pie)
  // NOTE: use the stable global index s.__gi as the DOM id and result-map key;
  // do not mix it with the local index of stats.map, otherwise selecting
  // non-contiguous reports would cause id mismatch and break rendering.
  const summaryHtml = stats.map((s) => {
    let fTotal = 0, fSup = 0, fUns = 0, fUnk = 0;
    for (const e of s.entries) {
      if (!matchEntry(e, q, f)) continue;
      fTotal++;
      if (e.result === true) fSup++;
      else if (e.result === false) fUns++;
      else fUnk++;
    }
    const svgId = "pie" + s.__gi;
    return "<div class='rep'><svg id='" + svgId + "' width='90' height='90' viewBox='0 0 140 140'></svg>" +
      "<div class='meta2'><b title='" + esc(s.file) + "'>#" + (s.__gi + 1) + (s.shortLabel ? "_" + s.shortLabel : "") + "</b>" +
      "支持 " + pct(fSup, fTotal) + "% · 失败 " + pct(fUns, fTotal) + "% · 未知 " + pct(fUnk, fTotal) + "%" +
      "</div></div>";
  }).join("");
  document.getElementById("compareSummary").innerHTML = summaryHtml;
  stats.forEach((s) => {
    let fTotal = 0, fSup = 0, fUns = 0, fUnk = 0;
    for (const e of s.entries) {
      if (!matchEntry(e, q, f)) continue;
      fTotal++;
      if (e.result === true) fSup++;
      else if (e.result === false) fUns++;
      else fUnk++;
    }
    renderPieInto(document.getElementById("pie" + s.__gi), null,
      { total: fTotal, supported: fSup, unsupported: fUns, unknown: fUnk });
  });

  // 2) Category compare bar chart + table (supported rate %)
  // When there are too many reports (> 4), the bars get too narrow to read, so the
  // bar chart is hidden automatically, keeping only the supported-rate % table (catCompare).
  const catBarTitleEl = document.getElementById("catBarTitle");
  const catBarChartEl = document.getElementById("catBarChart");
  if (stats.length > 4) {
    if (catBarTitleEl) catBarTitleEl.style.display = "none";
    if (catBarChartEl) catBarChartEl.style.display = "none";
  } else {
    if (catBarTitleEl) catBarTitleEl.style.display = "";
    if (catBarChartEl) catBarChartEl.style.display = "";
    renderCatBars(catBarChartEl, stats);
  }

  const catRows = BCD_CATEGORIES.map((c) => {
    const cells = stats.map((s) => {
      const st = s.categories[c] || { total: 0, supported: 0, unsupported: 0, unknown: 0 };
      return "<td class='r-pass'>" + pct(st.supported, st.total) + "%</td>" +
        "<td class='r-fail'>" + pct(st.unsupported, st.total) + "%</td>" +
        "<td class='r-unk'>" + pct(st.unknown, st.total) + "%</td>";
    }).join("");
    const totalItems = stats.map((s) => (s.categories[c] ? s.categories[c].total : 0)).reduce((a, b) => a + b, 0);
    return "<tr><td class='path'>" + esc(c) + " <span class='muted'>(" + totalItems + ")</span></td>" + cells + "</tr>";
  }).join("");
  const cols = "<col class='col-path'>" + Array(stats.length * 3).fill("<col style='width:64px'>").join("");
  document.getElementById("catCompare").innerHTML =
    "<colgroup>" + cols + "</colgroup>" +
    "<thead><tr><th class='cat-h' rowspan='2'>分类</th>" +
    stats.map((s) => "<th colspan='3'><span class='rep-h' title='" + esc(s.file) + "'>#" + (s.__gi + 1) + (s.shortLabel ? "_" + s.shortLabel : "") + "</span></th>").join("") + "</tr>" +
    "<tr>" + stats.map(() => "<th style='white-space:nowrap'>支持</th><th style='white-space:nowrap'>失败</th><th style='white-space:nowrap'>未知</th>").join("") + "</tr></thead>" +
    "<tbody>" + catRows + "</tbody>";

  // 3) Attribute horizontal compare table (merge paths of all selected reports)
  // First collect by category + search (without filtering results), then apply the
  // "show only" filter as an intersection: an attribute is shown only if it satisfies
  // the selected result in EVERY selected report.
  const pathMap = new Map();
  stats.forEach((s) => {
    for (const e of s.entries) {
      if (!matchEntry(e, q, "all")) continue;   // category + search only
      if (!pathMap.has(e.path)) pathMap.set(e.path, { name: e.name, exposure: e.exposure, results: {} });
      pathMap.get(e.path).results[s.__gi] = e.result;
    }
  });
  const paths = Array.from(pathMap.keys()).filter((p) => {
    if (f === "all") return true;
    const info = pathMap.get(p);
    if (f === "diff") {
      const vals = stats.map((s) => info.results[s.__gi]).filter((v) => v !== undefined);
      return vals.length > 1 && new Set(vals).size > 1;
    }
    return stats.every((s) => {
      const r = info.results[s.__gi];
      return r !== undefined && String(r) === f;
    });
  }).sort();
  const attrRows = paths.map((p) => {
    const info = pathMap.get(p);
    const vals = stats.map((s) => info.results[s.__gi]);
    const diff = new Set(vals.filter((v) => v !== undefined)).size > 1;
    const cells = stats.map((s) => {
      const r = info.results[s.__gi];
      if (r === undefined) return "<td class='na'>—</td>";
      const dim = (["true", "false", "null"].includes(f) && String(r) !== f) ? " dim" : "";
      return "<td class='" + dim + "'><span class='tag " + resultClass(r) + "'>" + resultText(r) + "</span></td>";
    }).join("");
    return "<tr class='" + (diff ? "diff" : "") + "'><td class='path'>" + esc(p) + "</td>" + cells + "</tr>";
  }).join("");
  document.getElementById("attrCompare").innerHTML =
    "<colgroup><col style='width:583px'>" + stats.map(() => "<col style='width:80px'>").join("") + "</colgroup>" +
    "<thead><tr><th>属性路径</th>" + stats.map((s) => "<th><span class='rep-h' title='" + esc(s.file) + "'>#" + (s.__gi + 1) + (s.shortLabel ? "_" + s.shortLabel : "") + "</span></th>").join("") + "</tr></thead>" +
    "<tbody>" + attrRows + "</tbody>";
}

// ----- Main render: switch between single / compare based on selection count -----
function render() {
  const stats = selectedStats();
  const single = stats.length === 1;
  fillCatOptions();
  if (catFilter.value !== activeCat) activeCat = catFilter.value;
  document.getElementById("meta").style.display = single ? "" : "none";
  document.getElementById("pieWrap").style.display = single ? "" : "none";
  document.getElementById("cards").style.display = single ? "" : "none";
  document.getElementById("bar").style.display = single ? "" : "none";
  document.getElementById("catTitle").style.display = single ? "" : "none";
  document.getElementById("catGrid").style.display = single ? "" : "none";
  document.getElementById("singleTable").style.display = single ? "" : "none";
  document.getElementById("compareView").style.display = single ? "none" : "";
  if (single) renderSingle(stats[0]);
  else renderCompare(stats);
}

search.oninput = render;
filterSel.onchange = render;
catFilter.onchange = render;
render();
</script>
</body>
</html>`;
};

const main = () => {
  const files = collectJsonFiles(process.argv.slice(2));
  if (files.length === 0) {
    console.error("未找到任何 JSON 报告文件");
    process.exit(1);
  }
  const stats = files.map(buildStat);

  // Sort order: first by OS version number (e.g. 5.0 < 6.0 < 7.0) ascending left to right;
  // within the same OS version, by report generation time (generatedAt, falling back to mtime) old to new.
  stats.sort((a, b) => {
    const byVersion = compareVersionNum(a.osVersionNum, b.osVersionNum);
    if (byVersion !== 0) return byVersion;
    return a.generatedAt - b.generatedAt;
  });
  const outDir =
    process.argv.slice(2).find((a) => fs.existsSync(a) && fs.statSync(a).isDirectory()) ||
    path.dirname(files[0]);
  const outFile = path.join(outDir, "report.html");
  fs.writeFileSync(outFile, buildHtml(stats), "utf-8");
  console.log(`已生成报告查看器: ${outFile}`);
  console.log(`包含 ${stats.length} 个报告文件，可在页面右上角下拉切换`);
};

main();
