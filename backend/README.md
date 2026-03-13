# Backend

后端是本地 `openclaw` CLI 的 Fastify 包装层。

它负责：

- 调用 `openclaw status / health / sessions / cron / agent`
- 对前端输出统一 REST 接口
- 提供 WebSocket 状态流
- 在 CLI 缺失或返回异常时做安全兜底

## 启动

```bash
npm install
npm start
```

默认地址：

- `http://127.0.0.1:8787/`

## 最小配置

默认要求提供 API Key。

在 `backend/.env` 中至少放：

```env
API_KEY=your-api-key
```

如果本机 `openclaw` 不在默认 PATH，可再设置：

```env
OPENCLAW_BIN=openclaw
OPENCLAW_PROFILE=
```

## 常用脚本

```bash
npm start
npm run dev
npm test
```

含义：

- `npm start`：启动后端
- `npm run dev`：监听 `src/server.js`
- `npm test`：运行后端 smoke test

## 关键环境变量

- `HOST`
- `PORT`
- `API_KEY`
- `REQUIRE_API_KEY`
- `OPENCLAW_BIN`
- `OPENCLAW_PROFILE`
- `CORS_ORIGIN`
- `ENABLE_EXEC_ENDPOINT`
- `REDACT_SENSITIVE_OUTPUT`
- `INCLUDE_COMMAND_IN_RESPONSE`

## 主要接口

- `GET /health`
- `GET /api/openclaw/status`
- `GET /api/openclaw/status/raw`
- `GET /api/openclaw/health`
- `GET /api/openclaw/sessions`
- `GET /api/openclaw/cron`
- `GET /api/openclaw/cron/status`
- `GET /api/openclaw/diagnostics`
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`
- `POST /api/openclaw/agent/turn`
- `POST /api/openclaw/cron/run/:jobId`
- `POST /api/openclaw/cron/enable/:jobId`
- `POST /api/openclaw/cron/disable/:jobId`
- `DELETE /api/openclaw/cron/:jobId`
- `GET /ws/openclaw/status`

调试接口：

- `POST /api/debug/state`
- `POST /api/tasks/:taskId/retry`
- `POST /api/tasks/:taskId/resolve`

## 说明

- 如果你只用默认远程前端模式，这个后端不是必需的
- 如果本机没有安装 `openclaw`，后端应当失败可控，而不是直接崩溃
- 项目中不写运行日志文件
