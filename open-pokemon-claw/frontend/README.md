# OpenClaw Show

一个基于 `Phaser + 原生 HTML/CSS/JS + Node.js` 的 OpenClaw 运行舱页面。

配套后端仓库：

- [onezf/openclaw-visual-backend](https://github.com/onezf/openclaw-visual-backend)

页面会根据后端返回的 `zone / scene / task / alertLevel / position` 实时切换场景：

- `work`：进入工作区办公室
- `rest + room`：进入休息区卧室
- `rest + outdoor`：停留在室外闲逛
- `alarm`：进入警报控制室

同时右侧栏展示：

- 当前状态
- 任务摘要
- 主事件流
- 最小任务操作

![页面预览](./docs/preview.png)

## 对接 `openclaw-visual-backend`

如果你使用的是 [onezf/openclaw-visual-backend](https://github.com/onezf/openclaw-visual-backend) 这套后端，当前前端建议按下面方式接入：

- 后端默认地址：`http://127.0.0.1:8787`
- 后端鉴权方式：请求头 `x-api-key`
- 当前后端仓库已提供：`GET /api/openclaw/status`
- 当前后端仓库 README 里公开的是 REST 接口，不是 WebSocket 实时接口
- 当前后端仓库 README 里还没有 `GET /api/tasks/stats` 和 `GET /api/tasks/runtime`

因此建议把前端配置成“直连状态接口 + HTTP 轮询”模式：

```js
window.OPENCLAW_CONFIG = {
  endpoint: "http://127.0.0.1:8787/api/openclaw/status",
  wsEndpoint: "",
  taskStatsEndpoint: "",
  taskRuntimeEndpoint: "",
  pollIntervalMs: 3000,
  requestTimeoutMs: 12000,
  headers: {
    "x-api-key": "你的后端 API_KEY",
  },
};
```

说明：

- `wsEndpoint` 置空后，页面会自动回退到 HTTP 轮询
- `taskStatsEndpoint` 和 `taskRuntimeEndpoint` 先置空，避免前端去请求后端当前还没公开的路由
- 如果你后续在后端补了任务统计或运行态接口，再把这两个地址补回去即可
- 如果后端开启了严格 `CORS_ORIGIN`，记得把前端地址加入白名单

## 技术栈

- `Node.js`
- `ws`
- `Phaser 3`
- 原生 `HTML / CSS / JavaScript`

## 目录结构

```text
.
├── app.js                 # 前端状态同步与渲染
├── phaser-map.js          # Phaser 地图与场景逻辑
├── server.js              # 本地聚合服务与 WS 推送
├── index.html             # 页面入口
├── styles.css             # 页面样式
├── openclaw.config.js     # 前端默认配置
├── assets/                # Phaser 地图与角色资源
├── vendor/                # 前端依赖
└── docs/preview.png       # README 展示图
```

## 本地启动

开发模式：

```bash
npm install
npm run start
```

这会直接从源码目录提供静态页面，适合快速改动和调试。

## 生产模式（轻构建 + Node 动态聚合）

先构建轻量静态产物：

```bash
npm run build
```

再用生产模式启动：

```bash
npm run start:prod
```

生产模式会优先从 `dist/` 提供压缩后的静态资源，同时继续由 Node 负责：

- `/api/openclaw/status`
- `/api/tasks/stats`
- `/api/tasks/runtime`
- `/api/openclaw/diagnostics`
- `WS /ws/openclaw/status`

## 生产建议启动方式

不要再用 `npm run dev` / `node --watch` 常驻运行，它会更重，也更容易放大对 OpenClaw 的影响。

推荐直接用仓库内脚本启动优化后的生产模式：

```bash
bash ../scripts/run-frontend-prod.sh
```

这个脚本会自动：

1. 执行 `npm run build`
2. 使用 `OPENCLAW_STATIC_ROOT=dist`
3. 以 `npm run start:prod` 启动 Node 聚合服务

停止：

```bash
bash ../scripts/stop-frontend-prod.sh
```

默认会使用更保守的参数：

- `OPENCLAW_STATUS_POLL_INTERVAL_MS=15000`
- `OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS=300`
- `OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS=5000`

后端 `8787` 也建议使用独立生产方式启动，不要依赖 `npm run dev` / `node --watch`：

```bash
bash ../scripts/run-backend-prod.sh
```

停止：

```bash
bash ../scripts/stop-backend-prod.sh
```

并且当前服务端逻辑已经改成：

- 无客户端时不轮询
- 启动时不主动 warm-up 刷新
- WS 建连时不额外触发一次状态拉取
- task / agent 操作后只排队刷新，不做同步强刷

默认地址：

- 页面：[http://127.0.0.1:3008/](http://127.0.0.1:3008/)
- 前端聚合状态接口：`http://127.0.0.1:3008/api/openclaw/status`
- 前端聚合 WebSocket：`ws://127.0.0.1:3008/ws/openclaw/status`
- 前端聚合任务统计：`http://127.0.0.1:3008/api/tasks/stats`
- 前端聚合任务运行态：`http://127.0.0.1:3008/api/tasks/runtime`
- 后端状态接口：`http://127.0.0.1:8787/api/openclaw/status`

## 已接入接口

### 1. OpenClaw 状态

- `GET /api/openclaw/status`
- `WS /ws/openclaw/status`

说明：

- `GET /api/openclaw/status` 是首页主数据源
- `WS /ws/openclaw/status` 是实时状态流
- HTTP 默认返回缓存
- `?refresh=1` 会触发强制刷新
- WebSocket 首帧为快照，后续支持 merge-patch 增量推送与 replay

### 2. 任务统计

- `GET /api/tasks/stats`

当前页面会读取：

- `data.total`
- `data.todo`
- `data.doing`
- `data.blocked`
- `data.done`

### 3. 任务运行态

- `GET /api/tasks/runtime`

当前页面会读取：

- `data.currentTask`
- `data.nextTask`
- `data.queueSummary`

如果上游暂时没有提供 `/api/tasks/runtime`，本地聚合层会自动用 `/api/tasks/stats` 合成一份运行摘要，保证页面先能显示排队/运行/失败统计。

## 当前真实请求收敛

当前这版前端应只请求以下业务接口：

- `GET /api/openclaw/status`
- `WS /ws/openclaw/status`
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`
- `GET /api/openclaw/diagnostics`（排障用途）
- `POST /api/tasks/:taskId/retry`
- `POST /api/tasks/:taskId/resolve`

当前聚合层上游只保留一个地址：

- `http://127.0.0.1:8787`

不再保留 `localhost:8787` 作为并行候选，也不应再出现这些错误路径：

- `/api/openclaw/tasks/stats`
- `/api/openclaw/tasks/runtime`

## 可配置环境变量

- `PORT`
- `HOST`
- `OPENCLAW_STATUS_TIMEOUT_MS`
- `OPENCLAW_STATUS_POLL_INTERVAL_MS`
- `OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS`
- `OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS`
- `OPENCLAW_TASK_STATS_URL`
- `OPENCLAW_TASK_RUNTIME_URL`
- `OPENCLAW_TASK_STATS_AUTH_TOKEN`
- `OPENCLAW_CORS_ORIGIN`
- `OPENCLAW_WS_PATH`

## 上传 GitHub 前说明

仓库已通过 `.gitignore` 排除了这些本地开发产物：

- `node_modules/`
- `.venv/`
- `.idea/`
- `.DS_Store`
- 本地调试截图与临时图片

保留入库的图片只包括：

- `assets/` 下运行必需资源
- `docs/preview.png` 这张 README 预览图
