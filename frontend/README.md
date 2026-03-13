# Frontend

前端负责三件事：

- 提供本地页面
- 代理和聚合上游状态接口
- 向浏览器输出 HTTP + WebSocket 数据

默认上游是：

- `https://www.wangyuye.online/pokemon-claw`

## 启动

```bash
npm install
npm start
```

默认访问地址：

- `http://127.0.0.1:3008/`

说明：

- `npm start` 会先执行 `node build.mjs`
- 启动后默认优先服务 `dist/`
- `index.html` 不缓存，`dist/assets/` 使用 hash 文件名

## 常用脚本

```bash
npm start
npm run build
npm run dev
npm run start:prod
```

含义：

- `npm start`：推荐入口，先构建再启动
- `npm run build`：只构建 `dist/`
- `npm run dev`：监听 `server.js`
- `npm run start:prod`：当前与 `npm start` 一样，都会先构建再启动

## 运行模式

### 1. 远程模式

默认就是远程模式。

页面在本地跑，但数据来自远程上游：

- `status`
- `tasks/stats`
- `tasks/runtime`
- `agent/turn`
- `tasks/:id/retry`
- `tasks/:id/resolve`

### 2. 本地模式

如果你本机启动了后端，可以在启动前设置：

```bash
OPENCLAW_UPSTREAM_BASE_URL=http://127.0.0.1:8787
```

## 关键环境变量

- `HOST`
- `PORT`
- `OPENCLAW_UPSTREAM_BASE_URL`
- `OPENCLAW_STATUS_URL`
- `OPENCLAW_TASK_STATS_URL`
- `OPENCLAW_TASK_RUNTIME_URL`
- `OPENCLAW_TASK_ACTION_BASE_URL`
- `OPENCLAW_AGENT_TURN_URL`
- `OPENCLAW_STATIC_ROOT`

`OPENCLAW_STATIC_ROOT` 支持：

- `dist`：强制服务构建产物
- `source`：强制服务源码目录

## 本地接口

前端本地服务会对浏览器暴露这些接口：

- `GET /api/openclaw/status`
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`
- `POST /api/openclaw/agent/turn`
- `POST /api/tasks/:taskId/retry`
- `POST /api/tasks/:taskId/resolve`
- `GET /ws/openclaw/status`

## 约束

- 不写运行日志文件
- 静态资源以构建产物为准
- 文档只保留当前模式，不写过期方案
