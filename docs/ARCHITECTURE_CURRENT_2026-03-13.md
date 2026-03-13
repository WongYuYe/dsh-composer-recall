# pokemon-claw 当前架构说明（2026-03-13）

## 1. 当前定位

`pokemon-claw` 当前不是全功能后台，也不是纯静态展示页。

它的当前形态是：

> 一个支持开发直跑、支持生产轻构建、由 Node 继续负责动态聚合与 WebSocket 实时流、并通过 Nginx 做公网分流的 OpenClaw 可视化运行舱。

核心目标：

- 保留开发期的快速迭代效率
- 降低公网长期运行时的静态资源负担
- 保持实时连接能力
- 不让展示层反向压垮 OpenClaw 主体

---

## 2. 当前架构分层

当前架构可分为 4 层。

### 2.1 前端展示层
目录：`frontend/`

主要文件：

- `index.html`
- `app.js`
- `phaser-map.js`
- `styles.css`
- `vendor/phaser.min.js`
- `openclaw.config.js`

职责：

- 渲染页面与地图
- 展示当前任务、摘要、时间线
- 发起 API 请求
- 建立前端 WebSocket 实时连接
- 触发 retry / resolve / agent turn 等动作

### 2.2 前端轻构建层
目录：`frontend/build.mjs`
输出：`frontend/dist/`

职责：

- 压缩 `app.js`
- 压缩 `phaser-map.js`
- 压缩 `styles.css`
- 生成带 hash 的静态资源文件名
- 生成生产用 `dist/index.html`
- 拷贝必要静态资源到 `dist/`

当前构建工具：

- `esbuild`

### 2.3 Node 聚合层
目录：`frontend/server.js`

职责：

- 代理并聚合 OpenClaw 状态
- 对接任务统计与任务运行态
- 输出统一的前端消费接口
- 提供 WebSocket 实时状态流
- 处理任务动作转发
- 在当前阶段同时提供静态文件

Node 聚合层当前暴露的主要接口：

- `GET /api/openclaw/status`
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`
- `GET /api/openclaw/diagnostics`
- `POST /api/tasks/:taskId/retry`
- `POST /api/tasks/:taskId/resolve`
- `POST /api/openclaw/agent/turn`
- `WS /ws/openclaw/status`

### 2.4 Nginx 公网入口层
入口地址：

- 生产：`https://www.wangyuye.online/pokemon-claw/`
- 开发预览：`https://www.wangyuye.online/pokemon-claw-dev/`

职责：

- 子路径路由转发
- 静态资源缓存控制
- API no-store 策略
- WebSocket upgrade 转发
- 将公网请求稳定映射到本地 Node 聚合服务

---

## 3. 当前双模式运行方式

## 3.1 开发模式

### 启动命令

```bash
cd frontend
npm run start
```

### 当前行为

- Node 直接从源码目录提供静态资源
- 页面加载的是源码版 `index.html / app.js / phaser-map.js / styles.css`
- API 与 WebSocket 仍由同一个 `server.js` 提供

### 适用场景

- 快速改 UI
- 本地联调
- 排查前端问题
- 验证 API/WS 对接

### 优点

- 启动简单
- 修改反馈快
- 调试直接

### 缺点

- 不适合公网长期作为最终生产形态
- 静态资源未做轻构建优化
- 缓存与体积控制较弱

---

## 3.2 生产模式

### 启动命令

```bash
bash scripts/run-pokemon-claw-prod.sh
```

### 内部流程

生产脚本会自动执行：

1. `npm run build`
2. 设置 `OPENCLAW_STATIC_ROOT=dist`
3. `npm run start:prod`

### 当前行为

- 先生成 `frontend/dist/`
- Node 聚合层从 `dist/` 提供静态页面与静态资源
- Node 继续处理 API 和 WebSocket 动态能力

### 适用场景

- 公网运行
- 长期挂页
- 正式演示
- 低打扰生产使用

### 优点

- 静态资源已压缩
- 关键资源带 hash，利于缓存
- 保留 Node 动态聚合能力
- 不需要额外维护独立前端发布系统

### 缺点

- 静态资源当前仍由 Node 提供，不是最终极致资源模型
- 还不是“纯 Nginx 托管 dist + Node 只管 API/WS”的最终拆分态

---

## 4. 当前请求流

## 4.1 页面访问流

用户访问：

- `https://www.wangyuye.online/pokemon-claw/`

请求先到 Nginx，再转到本地：

- `http://127.0.0.1:3008/`

Node 根据当前模式返回页面：

- 开发模式：源码目录页面
- 生产模式：`dist/index.html`

## 4.2 静态资源访问流

前端页面会进一步请求：

- `/pokemon-claw/assets/...`
- `/pokemon-claw/vendor/...`
- `/pokemon-claw/docs/...`

当前静态资源策略：

- `assets/`：长缓存，适合 hash 文件
- `vendor/` / `docs/`：中长缓存
- 根 HTML：短缓存

## 4.3 API 请求流

前端会请求：

- `/pokemon-claw/api/openclaw/status`
- `/pokemon-claw/api/tasks/stats`
- `/pokemon-claw/api/tasks/runtime`
- `/pokemon-claw/api/openclaw/diagnostics`

Nginx 负责转发到 Node 聚合层：

- `http://127.0.0.1:3008/api/...`

Node 再从上游拉取或合成状态，再回给前端。

## 4.4 WebSocket 实时流

前端会建立：

- `/pokemon-claw/ws/openclaw/status`

Nginx 负责 websocket upgrade，转发到：

- `http://127.0.0.1:3008/ws/openclaw/status`

Node WebSocket 流当前支持：

- `hello`
- `snapshot`
- `patch`
- `replay`

页面常驻打开时，应保持实时连接。可通过：

```bash
curl -fsS https://www.wangyuye.online/pokemon-claw/api/openclaw/diagnostics | jq '.data.ws.activeConnections'
```

验证是否大于 `0`。

---

## 5. 当前 Nginx 路由策略

当前已经从“单条粗粒度代理”调整为分流模式。

### 5.1 WebSocket

- `/pokemon-claw/ws/`
- 独立处理 upgrade
- `Cache-Control: no-store`

### 5.2 API

- `/pokemon-claw/api/`
- 独立动态接口代理
- `Cache-Control: no-store`

### 5.3 构建产物 assets

- `/pokemon-claw/assets/`
- 长缓存
- `immutable`

### 5.4 vendor / docs

- `/pokemon-claw/vendor/`
- `/pokemon-claw/docs/`
- 中长缓存

### 5.5 页面根路由

- `/pokemon-claw/`
- 短缓存
- `stale-while-revalidate`

详细路由建议见：

- `docs/NGINX_PROD_ROUTING_2026-03-13.md`

---

## 6. 当前脚本体系

## 6.1 开发 / 运行脚本

### 前端开发启动

```bash
cd frontend
npm run start
```

或直接启动独立开发预览服务：

```bash
bash scripts/run-pokemon-claw-dev.sh
```

### 前端构建

```bash
cd frontend
npm run build
```

### 前端生产启动

```bash
cd frontend
npm run start:prod
```

### 前端生产脚本

```bash
bash scripts/run-pokemon-claw-prod.sh
```

### 前端停止脚本

```bash
bash scripts/stop-pokemon-claw-prod.sh
```

### 开发预览停止脚本

```bash
bash scripts/stop-pokemon-claw-dev.sh
```

## 6.2 巡检 / 部署脚本

### 公网巡检

```bash
bash scripts/check-live-health.sh
```

会检查：

- status
- tasks stats
- tasks runtime
- diagnostics
- websocket handshake / first frame

### 一键部署 + 校验

```bash
bash scripts/deploy-pokemon-claw-prod.sh
```

会执行：

1. `npm install`
2. `npm run build`
3. restart prod service
4. 本地 diagnostics 检查
5. 公网 live health check

---

## 7. 当前模式的优点

### 7.1 保留开发效率
开发模式仍然可以源码直跑，不必每次都走完整发布流程。

### 7.2 公网资源模型已经明显优于源码直出
生产模式已经引入：

- 轻构建
- 压缩资源
- hash 文件名
- 分路由缓存策略
- API/WS 与静态资源分流

### 7.3 Node 角色更稳定
Node 不再只是“开发时顺手起个服务”，而是明确承担：

- 动态聚合
- 实时状态流
- 当前阶段的静态产物托管

### 7.4 可运维性增强
现在已经具备：

- 健康检查脚本
- 部署脚本
- diagnostics
- 实时连接数观测

---

## 8. 当前模式的边界

### 8.1 静态资源尚未完全脱离 Node
当前 Node 仍在提供 `dist/` 静态产物。这是有意保留的中间态，优点是简单、统一；缺点是还没把 Node 静态负担降到最低。

### 8.2 仍然是一体化前端 + 聚合层项目
当前不是完全拆分成独立前端工程 + 独立 API 服务，而是仍由一个项目维护展示层与聚合层。

### 8.3 CI/CD 还未完整建立
当前已具备本地/手动部署闭环，但还没有正式的自动构建、自动发布、产物归档流水线。

---

## 9. 推荐理解方式

如果要用一句话概括当前模式，可以写成：

> 开发时源码直跑，生产时先做轻构建输出 `dist/`，Node 继续负责状态聚合与 WebSocket，Nginx 再按 API / WS / 静态资源分流到公网。

这是当前最符合项目阶段和资源目标的运行方式。

---

## 10. 下一步可演进方向

如果后续继续优化，建议按下面顺序：

1. 保持双模式不变
2. 继续清理前端生产包中的 demo/mock/debug 负担
3. 把 `dist/` 逐步交给 Nginx 直接托管
4. Node 最终只保留 `/api` 和 `/ws`
5. 再考虑更正式的 CI/CD 或发布流程
