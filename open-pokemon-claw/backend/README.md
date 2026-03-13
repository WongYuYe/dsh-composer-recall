# OpenClaw Visual Backend

给前端可视化系统用的后端 API（REST）。
它通过本机 `openclaw` CLI 连接 OpenClaw 本体，把常用能力（状态、会话、cron、agent turn）统一成前端好接的接口。

> 关键点：每个用户只要在自己的电脑安装 OpenClaw + 本项目，就会自动连到“他自己的 OpenClaw 实例”，不依赖你的个人机器信息。

---

## 0. 你最关心的：到底要申请哪些 API_KEY？

### A) 本项目自己的 API_KEY（用于保护这个后端接口）
- 变量名：`API_KEY`
- **不是去任何平台申请的**，你自己生成一串随机密钥即可。
- 生成命令：

```bash
openssl rand -hex 32
```

把输出填到 `.env` 里：

```bash
API_KEY=你刚生成的随机串
```

前端调用时带请求头：

```http
x-api-key: 你的API_KEY
```

---

### B) OpenClaw 本体的模型 Key（决定 AI 能不能回复）
这个后端不直接保存模型 Key，但当你调用 `/api/openclaw/agent/turn` 时，是否可用取决于 OpenClaw 本体是否已配置模型供应商密钥（如 OpenAI/Anthropic/OpenRouter）。

---

### C) 渠道 Token（可选）
如果你要用 Telegram/Discord 等渠道发消息，需要在 OpenClaw 本体里配置对应渠道 token。

---

## 1) 功能范围

已提供接口：

- OpenClaw 状态：`status / health / sessions`
- Cron 任务：`list / status / run / enable / disable / remove`
- Agent 对话：`agent turn`
- 可选扩展：`exec`（默认关闭）

---

## 2) 保姆级部署（本机）

### 2.1 前置条件

1. 已安装 Node.js 18+
2. 已安装并可运行 OpenClaw（`openclaw status --json` 有输出）
3. 已进入项目目录

```bash
cd openclaw-visual-backend
```

### 2.2 一键初始化（推荐）

```bash
npm run setup
npm test
```

这个命令会自动：
- 检查本机是否安装 `openclaw`
- 自动创建 `.env`
- 自动生成 `API_KEY`
- 检查 OpenClaw 连接是否可用
- 自动安装依赖（若未安装）

> 默认安全基线：
> - 仅监听本机：`HOST=127.0.0.1`
> - 强制 API_KEY：`REQUIRE_API_KEY=true`
> - 默认关闭 exec：`ENABLE_EXEC_ENDPOINT=false`

### 2.3 启动

```bash
npm run dev
```

默认监听：`http://localhost:8787`

### 2.4 验证

不带 key（如果你设置了 API_KEY，会 401）：

```bash
curl http://127.0.0.1:8787/health
```

带 key：

```bash
curl -H "x-api-key: <你的API_KEY>" http://127.0.0.1:8787/api/openclaw/health
```

---

## 3) 保姆级部署（Docker）

### 3.1 创建 `.env`

```bash
cp .env.example .env
```

编辑 `.env`，至少设置：
- `API_KEY`
- `CORS_ORIGIN`（生产不要用 `*`）

### 3.2 启动

```bash
docker compose up -d --build
```

### 3.3 验证

```bash
curl -H "x-api-key: <你的API_KEY>" http://127.0.0.1:8787/api/openclaw/status
```

---

## 4) 全部配置项

`.env` 中支持：

```bash
PORT=8787
HOST=127.0.0.1
OPENCLAW_BIN=openclaw
OPENCLAW_PROFILE=
API_KEY=
REQUIRE_API_KEY=true
CORS_ORIGIN=*
ENABLE_EXEC_ENDPOINT=false
REDACT_SENSITIVE_OUTPUT=true
INCLUDE_COMMAND_IN_RESPONSE=false
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW=1 minute
WS_STATUS_INTERVAL_MS=5000
```

说明：

- `PORT`：后端端口
- `HOST`：监听地址（默认 `127.0.0.1`，仅本机访问）
- `OPENCLAW_BIN`：openclaw 可执行名/路径
- `OPENCLAW_PROFILE`：可选，指定 OpenClaw profile
- `API_KEY`：后端鉴权密钥
- `REQUIRE_API_KEY`：`true` 时无 API_KEY 不允许启动（默认 `true`）
- `CORS_ORIGIN`：允许的前端域名，生产不要 `*`
- `ENABLE_EXEC_ENDPOINT`：是否开启 `/api/openclaw/exec`（默认关）
- `REDACT_SENSITIVE_OUTPUT`：是否自动脱敏本机路径/会话标识（默认开）
- `INCLUDE_COMMAND_IN_RESPONSE`：是否返回后端执行命令文本（默认关，避免信息泄露）
- `RATE_LIMIT_MAX`：单位时间内最大请求数（默认 120）
- `RATE_LIMIT_WINDOW`：限流时间窗口（默认 `1 minute`）
- `WS_STATUS_INTERVAL_MS`：WebSocket 状态推送间隔（默认 5000ms）

---

## 5) 安全审查结果（本项目）

已按“默认安全优先”调整：

1. ✅ 默认只监听本机（`HOST=127.0.0.1`）
2. ✅ 默认强制 API_KEY（`REQUIRE_API_KEY=true`）
3. ✅ 默认关闭高风险 `exec` 接口
4. ✅ 默认对输出进行脱敏（本机路径/会话标识）
5. ✅ 默认不回显后端命令文本
6. ✅ 默认开启请求限流（`RATE_LIMIT_MAX / RATE_LIMIT_WINDOW`）

### OpenClaw 本体审查（read-only）
执行了：`openclaw security audit --deep`

结果摘要：
- 0 critical
- 2 warn
- 1 info

重点告警：
- `gateway.trusted_proxies_missing`
- `gateway.nodes.deny_commands_ineffective`

建议：
- 若经反向代理暴露，配置 `gateway.trustedProxies`
- 复查 `gateway.nodes.denyCommands` 的命令名是否精确匹配

> 注意：以上是 OpenClaw 网关层建议，不是本项目代码漏洞。

---

## 6) API 列表

### 基础
- `GET /health`

### OpenClaw 状态
- `GET /api/openclaw/status`（前端业务态：含 `zone/scene/position/task/alertLevel`）
- `GET /api/openclaw/status/raw`（原始 `openclaw status --json`）
- `GET /api/openclaw/health`
- `GET /api/openclaw/sessions?active=120&agent=main`
- `WS /ws/openclaw/status?apiKey=<API_KEY>`（推送状态流）

### Tasks 统计/运行态
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`

### Cron
- `GET /api/openclaw/cron`
- `GET /api/openclaw/cron/status`
- `POST /api/openclaw/cron/run/:jobId`
- `POST /api/openclaw/cron/enable/:jobId`
- `POST /api/openclaw/cron/disable/:jobId`
- `DELETE /api/openclaw/cron/:jobId`

### Agent
- `POST /api/openclaw/agent/turn`

Body:
```json
{
  "message": "Summarize latest session",
  "agent": "main",
  "to": "+15550001111"
}
```

### 扩展命令（默认关闭）
- `POST /api/openclaw/exec`

Body:
```json
{ "command": "status --json" }
```

---

## 7) 前端无缝对接（建议）

- OpenClaw 请求前缀：`/api/openclaw/*`
- 任务面板请求：`/api/tasks/*`
- HTTP 请求统一加：`x-api-key`
- WebSocket 可带 query：`?apiKey=<API_KEY>`（浏览器端更方便）
- 错误处理只看：`ok === false` 和 `error`

示例（前端 axios）：

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://127.0.0.1:8787',
  headers: {
    'x-api-key': import.meta.env.VITE_OPENCLAW_API_KEY,
  },
});

export async function getOpenClawHealth() {
  const { data } = await api.get('/api/openclaw/health');
  return data;
}
```

建议前端 `.env`：

```bash
VITE_OPENCLAW_API_BASE=http://127.0.0.1:8787
VITE_OPENCLAW_API_KEY=<与后端 .env 的 API_KEY 一致>
```

---

## 8) 生产上线清单（强烈建议）

1. `API_KEY` 必填
2. `CORS_ORIGIN` 改成前端正式域名
3. `ENABLE_EXEC_ENDPOINT=false`
4. `INCLUDE_COMMAND_IN_RESPONSE=false`
5. `REDACT_SENSITIVE_OUTPUT=true`
6. 反向代理 + HTTPS
7. OpenClaw 本体执行一次：`openclaw security audit --deep`
