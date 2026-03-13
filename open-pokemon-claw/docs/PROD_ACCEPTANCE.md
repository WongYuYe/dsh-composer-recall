# 生产环境验收清单（公网 / 子路径版）

适用目标：

- 公网地址：`https://www.wangyuye.online/open-pokemon-claw/`
- 子路径部署：`/open-pokemon-claw/`
- 前端聚合层：`frontend/server.js`
- 上游后端：`backend/src/server.js`

## 1. 只读验收（建议每次上线后先跑）

### 1.1 HTTP 基础连通

```bash
curl -sS https://www.wangyuye.online/open-pokemon-claw/api/openclaw/status | jq '.zone, .mode, .alertLevel, ._meta.wsPath'
curl -sS https://www.wangyuye.online/open-pokemon-claw/api/tasks/runtime | jq '.data.queueSummary'
```

通过标准：

- `/api/openclaw/status` 返回 JSON，不是 HTML
- `zone / mode / alertLevel / _meta` 均存在
- `/api/tasks/runtime` 返回 `data.queueSummary`

### 1.2 WebSocket 握手

推荐用 Node + ws：

```bash
node - <<'NODE'
const WebSocket = require('./frontend/node_modules/ws');
const url = 'wss://www.wangyuye.online/open-pokemon-claw/ws/openclaw/status';
const ws = new WebSocket(url);
ws.on('open', () => console.log('OPEN', url));
ws.on('message', (msg) => {
  console.log(String(msg).slice(0, 400));
  ws.close();
});
ws.on('error', (err) => {
  console.error('ERROR', err.message);
  process.exit(1);
});
setTimeout(() => {
  console.error('TIMEOUT');
  process.exit(2);
}, 8000);
NODE
```

通过标准：

- 能成功 `OPEN`
- 首帧能收到 `hello` 或 `status`
- 不应误连到根路径 `/ws/openclaw/status`

### 1.3 Agent 面板基础数据

```bash
curl -sS https://www.wangyuye.online/open-pokemon-claw/api/openclaw/status | jq '.openclaw.agents'
```

通过标准：

- 返回数组
- 每个 agent 至少带 `id / status / zone`

## 2. 写路径验收（受控执行，跑完要恢复）

> 这部分会改运行态，建议在低峰期执行。

### 2.1 注入 debug 告警态（本机后端）

```bash
curl -sS -X POST http://127.0.0.1:8787/api/debug/state \
  -H 'content-type: application/json' \
  -d '{"zone":"alarm"}' | jq
```

### 2.2 验证公网状态切到 alarm

```bash
curl -sS https://www.wangyuye.online/open-pokemon-claw/api/openclaw/status | jq '.zone, .mode, .openclaw.runtime.currentTask.availableActions'
```

通过标准：

- `zone == "alarm"`
- `mode == "RUNNING"`
- `availableActions` 包含 `retry` 和 `resolve`

### 2.3 验证任务动作：retry

```bash
curl -sS -X POST https://www.wangyuye.online/open-pokemon-claw/api/tasks/debug-alarm-task/retry \
  -H 'content-type: application/json' \
  -d '{}' | jq '.ok, .data.action, .data.runtime.currentTask.status'
```

通过标准：

- `ok == true`
- `action == "retry"`
- `status == "running"`

### 2.4 验证任务动作：resolve

```bash
curl -sS -X POST https://www.wangyuye.online/open-pokemon-claw/api/tasks/debug-alarm-task/resolve \
  -H 'content-type: application/json' \
  -d '{}' | jq '.ok, .data.action, .data.runtime.currentTask'
```

通过标准：

- `ok == true`
- `action == "resolve"`
- `currentTask == null`

### 2.5 验证 agent 发送任务

```bash
curl -sS -X POST https://www.wangyuye.online/open-pokemon-claw/api/openclaw/agent/turn \
  -H 'content-type: application/json' \
  -d '{"agent":"ops","message":"[acceptance] 连通性验收消息，可忽略"}' | jq '.ok, .data.status, .data.summary'
```

通过标准：

- `ok == true`
- `status == "ok"`
- `summary` 为完成态

### 2.6 清理 debug 态

```bash
curl -sS -X POST http://127.0.0.1:8787/api/debug/state \
  -H 'content-type: application/json' \
  -d '{"zone":"clear"}' | jq
```

## 3. 当前已知问题（本轮验收发现）

### 3.1 子路径部署下，前端 WebSocket 默认拼接错误

文件：`frontend/app.js`

现状：

- `wsEndpoint` 默认是 `ws/openclaw/status`
- `buildWsUrl()` 以 `window.location.host` 为基准拼接
- 页面在 `/open-pokemon-claw/` 时，会错误连到 `/ws/openclaw/status`
- 正确地址应为 `/open-pokemon-claw/ws/openclaw/status`

建议：

- 用 `new URL(CONFIG.wsEndpoint, window.location.href)` 统一处理相对路径
- 或显式把默认值改成 `./ws/openclaw/status`

### 3.2 子路径部署下，任务动作 URL 用了根路径绝对地址

文件：`frontend/app.js`

现状：

```js
return `/api/tasks/${encodeURIComponent(taskId)}/${action}`;
```

问题：

- 在 `/open-pokemon-claw/` 下会打到站点根路径 `/api/tasks/...`
- 正确应落到 `/open-pokemon-claw/api/tasks/...`

建议：

```js
return new URL(`api/tasks/${encodeURIComponent(taskId)}/${action}`, window.location.href).toString();
```

或至少使用相对路径：

```js
return `api/tasks/${encodeURIComponent(taskId)}/${action}`;
```

### 3.3 agent turn 返回体过大，且包含过多运行时细节

现象：

- 公网 `POST /api/openclaw/agent/turn` 会直接把 OpenClaw run 结果透出
- 当前返回里包含大量 `systemPromptReport / workspaceDir / model usage` 等细节
- 即使部分字段已脱敏，仍然不适合作为公网默认返回

建议：

- 前端聚合层只回传 `runId / status / summary / user-facing text`
- 详细运行元数据仅保留在服务端日志
- 公网模式默认裁剪 payload

## 4. 推荐发布门槛

满足以下 6 条再算通过：

1. 公网 `GET /api/openclaw/status` 返回 JSON
2. 公网 `GET /api/tasks/runtime` 返回 JSON
3. 子路径 WS：`/open-pokemon-claw/ws/openclaw/status` 可握手
4. 页面显示的 agent 列表非空或能解释为空
5. 发送任务返回成功，且不泄露内部冗长元数据
6. retry / resolve 在子路径场景下能成功命中
