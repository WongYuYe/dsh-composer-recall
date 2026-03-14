# Frontend

前端目录现在包含两层：

- Vue 页面与 Phaser 地图
- 提供静态资源、`/api` 和 `/ws` 的本地聚合服务

默认上游是：

- `https://www.wangyuye.online/pokemon-claw`

## 启动

```bash
npm install
npm start
```

默认访问地址：

- `http://127.0.0.1:3008/`

`npm start` 会先执行 `vite build`，再启动 [server.js](./server.js)。 
服务固定提供 `dist/`，`index.html` 不缓存，构建产物使用 hash 文件名。

## 常用脚本

```bash
npm start
npm run build
npm run dev
npm run dev:proxy
npm run start:prod
```

- `npm start`：先构建再启动本地聚合服务
- `npm run build`：只构建 `dist/`
- `npm run dev`：启动 Vite 前端开发服务，默认端口 `5173`
- `npm run dev:proxy`：启动本地聚合服务，给 Vite 代理 `/api` 和 `/ws`
- `npm run start:prod`：和 `npm start` 一样，都会先构建再启动

## 运行模式

### 远程模式

默认就是远程模式。  
页面在本地运行，但数据来自远程上游：

- `status`
- `tasks/stats`
- `tasks/runtime`
- `agent/turn`
- `tasks/:id/retry`
- `tasks/:id/resolve`

### 本地模式

如果本机启动了本地后端，启动前可以设置：

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

- `dist`：显式指定服务构建产物
- 其他自定义目录：用于特殊静态资源目录覆盖

## 本地接口

前端本地服务会向浏览器暴露这些接口：

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
- 当前前端主入口是 Vue + Vite，地图仍由 Phaser 负责
