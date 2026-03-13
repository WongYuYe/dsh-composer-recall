# open-pokemon-claw

本地工作区，包含两部分上游代码：

- `frontend/` ← `https://github.com/onezf/openclaw-visual-frontend`
- `backend/` ← `https://github.com/onezf/openclaw-visual-backend`

## 当前目标

基于既有前后端仓库，按 4 周路线图把项目从“高辨识度 Demo”推进成“可真实使用的 OpenClaw 控制台”。

## 当前结论

现状已经具备：

- 像素地图前端雏形
- 面向 OpenClaw 的后端 REST/WS 聚合层
- 基础状态、任务统计、运行态接口

接下来优先做的不是继续堆视觉，而是：

1. 去 mock，全面接真实 runtime
2. 补最小控制闭环（查看 / 派发 / 停止 / 重试）
3. 建立地图 + 详情 + 时间线三层结构
4. 做真实用户验证

## 文档

- `docs/PRODUCT-ROADMAP-4W.md`：4 周产品路线图
- `docs/ARCHITECTURE-NEXT.md`：下一阶段架构与设计方案
- `docs/WEEK1-BUILD-LIST.md`：第 1 周执行清单
- `docs/NEXT_STEPS_2026-03-13.md`：当前状态与下一步清单
- `docs/NGINX_PROD_ROUTING_2026-03-13.md`：生产路由与缓存建议
- `docs/ARCHITECTURE_CURRENT_2026-03-13.md`：当前模式与请求流正式说明

## 巡检

- 一键巡检脚本：`scripts/check-live-health.sh`
- 生产验收脚本：`scripts/prod-acceptance.sh`
- 一键部署+巡检脚本：`scripts/deploy-frontend-prod.sh`

## 运行模式

当前建议采用双模式：

- 开发模式：前端源码直跑，适合快速修改
- 生产模式：轻构建静态产物 + Node 动态聚合

其中生产模式下：

- `frontend/dist/` 提供压缩后的静态资源
- `frontend/server.js` 继续负责 API 和 WebSocket 聚合
- `scripts/run-frontend-prod.sh` 会自动先构建再启动

如果你希望确认页面确实保持了实时连接，而不是只靠 HTTP 轮询：

1. 打开 `https://www.wangyuye.online/open-pokemon-claw/`
2. 检查：

```bash
curl -fsS https://www.wangyuye.online/open-pokemon-claw/api/openclaw/diagnostics | jq '.data.ws.activeConnections'
```

正常情况下，这个值应大于 `0`。
