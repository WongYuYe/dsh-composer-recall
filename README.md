# pokemon-claw

一个面向 OpenClaw 的可视化运行舱项目。

它当前的目标不是做一个“全功能后台”，而是做一个：

- 可长期挂页的运行舱
- 有实时状态流的 dashboard
- 具备最小控制闭环（如 retry / resolve / agent turn）的操作界面

---

## 仓库结构

```text
.
├── frontend/   # 页面 + Node 聚合服务
├── backend/    # 上游后端代码与接口实现
├── scripts/    # 运行、部署、巡检脚本
└── docs/       # 产品、架构、验收与运维文档
```

---

## 当前运行模式

项目当前采用双模式：

### 1. 开发模式
适合快速改 UI、联调、排障。

- 前端源码直跑
- 不走生产构建产物
- 更适合本地调试和开发预览

启动：

```bash
bash scripts/run-frontend-dev.sh
```

开发预览地址：

- `https://www.wangyuye.online/pokemon-claw-dev/`

### 2. 生产模式
适合正式访问、长期挂页和公网演示。

- 先做轻构建
- 再由 Node 提供 `dist/` 静态产物
- Node 继续负责 API 和 WebSocket 动态聚合

启动：

```bash
bash scripts/run-frontend-prod.sh
```

生产地址：

- `https://www.wangyuye.online/pokemon-claw/`

---

## 常用命令

### 前端开发预览

```bash
bash scripts/run-frontend-dev.sh
bash scripts/stop-frontend-dev.sh
```

### 前端生产启动 / 停止

```bash
bash scripts/run-frontend-prod.sh
bash scripts/stop-frontend-prod.sh
```

### 前端一键部署 + 巡检

```bash
bash scripts/deploy-frontend-prod.sh
```

### 公网健康检查

```bash
bash scripts/check-live-health.sh
```

### 前端单独构建

```bash
cd frontend
npm install
npm run build
```

---

## 当前能力

目前项目已经具备：

- 像素地图前端雏形
- 面向 OpenClaw 的 REST / WS 聚合层
- `status / tasks stats / tasks runtime / diagnostics`
- WebSocket 实时状态流
- dev / prod 双地址分离
- Nginx 分流与缓存策略
- 一键部署 / 巡检脚本

---

## 实时连接检查

如果你想确认页面当前是否真的保持了实时连接，而不是只靠 HTTP：

```bash
curl -fsS https://www.wangyuye.online/pokemon-claw/api/openclaw/diagnostics | jq '.data.ws.activeConnections'
```

正常情况下，这个值应大于 `0`。

---

## 推荐阅读

- `docs/ARCHITECTURE_CURRENT_2026-03-13.md`：当前模式与请求流
- `docs/NGINX_PROD_ROUTING_2026-03-13.md`：Nginx 路由与缓存策略
- `docs/NEXT_STEPS_2026-03-13.md`：当前待办
- `docs/PRODUCT_DEFINITION.md`：产品定义
- `docs/PROD_ACCEPTANCE.md`：生产验收记录

---

## 当前阶段判断

现在它已经不是单纯 demo，而是：

> 一个已经具备实时链路、双模式运行、部署脚本和巡检闭环的 OpenClaw 运行舱雏形。

下一阶段重点不是继续堆视觉，而是：

1. 收口信息层级
2. 强化最小控制闭环
3. 做真实用户验证
4. 继续降低长期运行成本
