# Automated testing tool for Huawei Browser

本工具用于在 HarmonyOS 设备（板子）上自动化运行 MDN BCD 兼容性测试，并把
结果写入 `mdn-bcd-results` 目录、生成报告。

自动化测试的入口脚本为
[`auto-run-HuaweiBrowser-tests.cjs`](../auto-run-HuaweiBrowser-tests.cjs)，
它把"获取板子内核版本 → 准备 chromedriver → 跑 selenium → 生成报告"串成一条命令。

## Prerequisites

- **当前需要在板子上安装指定的测试 demo**（浏览器为 demo 版本，非正式发布版本）
- 板子（HarmonyOS 设备）与 PC 处于同一局域网，且可通过 `hdc` 访问
- 板子已开启远程调试，调试端口（默认 `9222`）已通过 `hdc fport` 映射到 PC
- 本地存在 [browser-compat-data](https://github.com/mdn/browser-compat-data)
  checkout，且其中的 `browsers/huaweibrowser_harmonyos.json` 包含华为浏览器数据
- `mdn-bcd-results` 目录存在（脚本依赖它存放结果）

### 目录结构

`mdn-bcd-collector`、`browser-compat-data`、`mdn-bcd-results`、`ua-parser-js`
四个目录必须放在**同一级目录**下。脚本通过相对路径 `../browser-compat-data`、
`../mdn-bcd-results` 定位它们（见 [Configuration](#configuration)）。

以 `E:\BCD_original` 为例：

```
E:\BCD_original\
├── browser-compat-data\      # 本地 BCD checkout，提供华为浏览器版本数据
├── mdn-bcd-collector\        # 本工具所在目录
├── mdn-bcd-results\          # 测试结果 JSON 存放目录
└── ua-parser-js\             # UA 解析库
```

> [!NOTE]
> `browser-compat-data` 必须包含 `browsers/huaweibrowser_harmonyos.json`，
> 因为 npm 上的 `@mdn/browser-compat-data` 尚未收录 `huaweibrowser_harmonyos`；
> 该文件是华为浏览器版本数据的**唯一来源**。

> [!WARNING]
> 板子上安装的是测试 demo，其 User-Agent 中的浏览器版本号（`HuaweiBrowser/x.y.z`）
> 可能与正式发布版本不一致。因此版本推导优先**以 `browser-compat-data` 中的
> `engine_version` 为准**。详见 [Version Resolution](#version-resolution)。

## Quick Start

首次使用时，先安装依赖并构建（`app.js`、`tests.json` 等产物由构建生成，
自动化脚本会启动 `node app.js` 作为本地结果服务器）：

```sh
# Windows (PowerShell)
set PUPPETEER_SKIP_DOWNLOAD=true && npm install --legacy-peer-deps
npm run build

# macOS / Linux
PUPPETEER_SKIP_DOWNLOAD=true npm install --legacy-peer-deps
npm run build
```

`PUPPETEER_SKIP_DOWNLOAD=true` 用于跳过 Puppeteer 自带的 Chromium 下载
（本流程使用板子上的浏览器，不需要它），可显著加快安装。

然后运行自动化测试：

```sh
# 在 mdn-bcd-collector 目录下运行
node auto-run-HuaweiBrowser-tests.cjs
```

默认会自动探测板子 IP（通过 `hdc shell ifconfig`）并组合 `DEBUGGER_PORT`。
若自动探测失败，显式指定调试地址（例如）：

```sh
# Windows (PowerShell)
$env:DEBUGGER_ADDRESS = "192.168.1.145:9222"
node auto-run-HuaweiBrowser-tests.cjs

# macOS / Linux
DEBUGGER_ADDRESS=192.168.1.145:9222 node auto-run-HuaweiBrowser-tests.cjs
```

### 手动运行 selenium

也可以跳过自动化脚本，直接调用 selenium（适用于调试单个环节）。
注意浏览器名用的是 BCD 中的 ID `huaweibrowser_harmonyos`，而非 UA 里的
显示名 `HuaweiBrowser`：

```sh
npm run selenium -- huaweibrowser_harmonyos --since=2026 -v 7.0 -o HarmonyOS -j 1 -d 192.168.1.145:9222
```

参数说明：

| 参数 | 含义 |
| - | - |
| `huaweibrowser_harmonyos` | 浏览器 ID（positional，必填） |
| `--since=2026` | 只跑 2026 年及之后发布的版本 |
| `-v 7.0` | 只跑指定的浏览器版本（建议显式指定，见 [Version Resolution](#version-resolution)） |
| `-o HarmonyOS` | 被测系统，华为固定为 `HarmonyOS`（其他值会导致零任务） |
| `-j 1` | 并发任务数 |
| `-d <host:port>` | 板子调试地址，必填；必须是 `host:port` 格式，不要带 `http://` |

> [!IMPORTANT]
> `npm run` 后面的 `--` 是**必须的**，否则 npm 会把 `--since`、`-o`、`-j`
> 当作自己的参数消费掉，导致这些参数无法传给 selenium。

也可用 `npx tsx` 直接执行，效果相同：

```sh
npx tsx scripts/selenium.ts huaweibrowser_harmonyos --since=2026 -v 7.0 -o HarmonyOS -j 1 -d 192.168.1.145:9222
```

## What the Script Does

脚本依次执行以下步骤，每步都会打印 `=== ... ===` 分隔的日志：

| 步骤 | 说明 |
| - | - |
| 0 | 访问板子 `http://<addr>/json/version`，获取 Chrome 内核版本 |
| 1 | 从 npmmirror 下载与内核版本匹配的 `chromedriver` |
| 2 | 解压到 `CHROMEDRIVER_INSTALL_DIR`（默认 `D:\Program Files\chromedriver-win64`） |
| 3 | 启动 `chromedriver --port=9515` |
| 4 | 运行 `scripts/selenium.ts`，驱动板子上的华为浏览器跑测试 |
| 5 | 确认结果已下载到 `mdn-bcd-results`，并生成报告 |

## Version Resolution

脚本会推导出两个参数传给 selenium：`--version`（浏览器版本）和 `--since`（年份）。

推导优先级如下：

1. **`VERSION` / `SINCE` 环境变量** —— 最高优先级，指定后不再自动推导
2. **板子内核版本推导** —— 用内核大版本（如 `144`）匹配
   `browser-compat-data/browsers/huaweibrowser_harmonyos.json` 中各 release 的
   `engine_version`，匹配到的 release key 即版本（如 `7.0`），其 `release_date`
   年份即 `since`

例如：

```sh
Board kernel 144 -> release "7.0" -> --since=2026
```

> [!NOTE]
> 当一个内核版本对应多个 release 时（如内核 `132` 同时对应 `6.0` 和 `6.1`），
> 脚本会用板子 UA 中的 `HuaweiBrowser/<version>` 来决断；若 UA 不可用或不匹配，
> 则回退到第一个匹配项并打印 `⚠` 告警。

> [!WARNING]
> 手动指定 `VERSION` 时请确保它与板子实际安装的浏览器一致。指定值仅用于
> **筛选要跑的任务**，并不能改变实际被驱动的浏览器 —— 板子上始终只有一个
> 浏览器实例。报告文件名由板子的真实 UA 决定，与 `VERSION` 无关。

## Configuration

### 常用环境变量

| 变量 | 默认值 | 说明 |
| - | - | - |
| `DEBUGGER_ADDRESS` | 自动探测 | 板子调试地址，如 `192.168.1.145:9222` |
| `DEBUGGER_PORT` | `9222` | 仅在自动探测板子 IP 时生效 |
| `VERSION` | 自动推导 | 浏览器版本，如 `7.0`；最高优先级 |
| `SINCE` | 自动推导 | 起始年份，如 `2027` |
| `BROWSER` | `huaweibrowser_harmonyos` | 要测试的浏览器 |
| `JOBS` | `1` | 并发任务数 |
| `BCD_OS` | `HarmonyOS` | 传给 selenium 的 `-o` 参数 |

### 路径相关

| 变量 | 默认值 | 说明 |
| - | - | - |
| `PROJECT_DIR` | 脚本所在目录 | `mdn-bcd-collector` 目录 |
| `RESULTS_DIR` | `../mdn-bcd-results` | 结果 JSON 存放目录 |
| `BCD_DIR` | `../browser-compat-data` | 本地 BCD checkout |
| `CHROMEDRIVER_INSTALL_DIR` | `D:\Program Files\chromedriver-win64` | chromedriver 安装位置 |
| `CHROMEDRIVER_PORT` | `9515` | chromedriver 监听端口 |

### 报告相关

| 变量 | 默认值 | 说明 |
| - | - | - |
| `REPORT_COUNT` | `3` | 生成报告时包含的最新结果文件数 |
| `REPORT_FILTER` | 无 | 只保留文件名含该子串的结果，如 `huawei-browser` |
| `START_LOCAL_SERVER` | 无（默认不启动） | 设为 `1` 才启动本地结果服务器（`npm start`）。默认不启动，因为华为测试在公网 collector 上执行并从那里下载结果 |
| `APP_PORT` | `8080` | 本地结果服务器端口，仅在 `START_LOCAL_SERVER=1` 时生效 |
> [!TIP]
> 华为测试**默认不需要本地结果服务器**。仅当以 `NODE_ENV=test` 让 selenium
> 访问本地 collector（而非公网）时，才需要设 `START_LOCAL_SERVER=1`。

> [!IMPORTANT]
> 建议设置 `REPORT_FILTER=huawei-browser`。否则 `REPORT_COUNT=3` 会取
> `mdn-bcd-results` 下**最新 3 个**文件，若最近跑过其他浏览器，报告会混入
> 非华为的结果。

### 调试相关

| 变量 | 说明 |
| - | - |
| `SKIP_DRIVER_DOWNLOAD=1` | 跳过下载，使用已有的 chromedriver |
| `KEEP_CHROMEDRIVER=1` | 测试结束后保留 chromedriver 进程 |
| `CHROMEDRIVER_VERBOSE=1` | 给 chromedriver 传 `--verbose`，用于诊断渲染器问题 |
| `MIRROR_BASE` | chromedriver 下载源，默认 npmmirror |

## Results

测试完成后，结果 JSON 会写入 `mdn-bcd-results`，文件名形如：

```sh
10.20.8-huawei-browser-6.1.3.352-openharmony-7.0-5a54320dc3.json
```

脚本随后会用 `scripts/report-viewer.ts` 基于最新的若干份结果生成报告。

### 单独生成报告

报告也可以脱离自动化测试单独运行，在参数后追加**结果文件名**或**结果文件夹路径**。

指定若干份报告（可跨版本对比）：

```sh
npx tsx scripts/report-viewer.ts "../mdn-bcd-results/10.20.8-huawei-browser-7.0.3.352-openharmony-7.0-a3e91cc924.json" "../mdn-bcd-results/10.20.8-huawei-browser-7.0.3.352-openharmony-7.0-dad5577e2d.json"
```

指定整个结果目录（生成该目录下所有结果对应的报告）：

```sh
npx tsx scripts/report-viewer.ts "../mdn-bcd-results"
```

不传参数时，默认读取 `../mdn-bcd-results` 下的全部结果：

```sh
npx tsx scripts/report-viewer.ts
```

> [!NOTE]
> - 报告输出为 `report.html`：若参数中含**文件夹**，输出到该文件夹下；否则输出到
>   第一份结果文件所在的目录。
> - 多份报告会按系统版本号升序、同版本按生成时间从旧到新排列，可在页面
>   右上角下拉切换对比。

> [!NOTE]
> 测试是在 [collector.openwebdocs.org](https://collector.openwebdocs.org)
> 上执行的，结果由 selenium 下载回本地；本地 `app.ts` 仅在 `--testenv`
> 模式下参与。因此报告中的浏览器识别依赖公网 collector 的 BCD 数据。

## Updating `browser-compat-data`

若要把测试结果回写到本地 BCD，可运行：

```sh
npm run update-bcd -- -b huaweibrowser_harmonyos <results-file>...
```

更多细节参见 [update-bcd.md](./update-bcd.md)。

> [!NOTE]
> `update-bcd` 直接使用本地 `browser-compat-data`，因此首次使用前需要确保
> 该目录已安装依赖（运行 `npm install`）。

## Troubleshooting

### 板子连接失败

确认板子 IP 与端口可达（例）：

```sh
curl http://192.168.1.145:9222/json/version
```

### 结果文件损坏（JSON 解析失败）

若下载被中断且服务端忽略了续传请求，结果文件可能出现两份 JSON 拼接，
表现为 `npm run report` 或 `update-bcd` 报 JSON 解析错误。

找出损坏的文件：

```sh
cd ../mdn-bcd-results
node -e "const fs=require('fs');for(const f of fs.readdirSync('.').filter(x=>x.endsWith('.json'))){try{JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){console.log('corrupt:',f)}}"
```

删除损坏的文件后重跑即可。

### 测试未执行 / 退出码非 0

检查日志中是否出现 `Board kernel ... -> release ...`。若缺失，说明板子
`/json/version` 未能访问，或 BCD 中没有匹配 `engine_version` 的 release。
