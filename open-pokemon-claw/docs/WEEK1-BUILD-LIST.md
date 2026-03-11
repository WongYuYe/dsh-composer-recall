# Week 1 执行清单

## 目标
完成去 mock，接通真实 OpenClaw runtime，并让地图基于真实状态工作。

---

## A. 仓库梳理

- [ ] 前端梳理现有数据来源：
  - [ ] `openclaw.config.js`
  - [ ] `app.js`
  - [ ] `server.js`
  - [ ] 各类 `mock-*.json`
- [ ] 后端梳理现有接口：
  - [ ] `/api/openclaw/status`
  - [ ] `/api/tasks/stats`
  - [ ] `/api/tasks/runtime`
  - [ ] `WS /ws/openclaw/status`

---

## B. 数据模型统一

- [ ] 产出统一字段映射表
- [ ] 明确前端内部数据结构：
  - [ ] AgentState
  - [ ] TaskState
  - [ ] RuntimeEvent
- [ ] 约定状态枚举：
  - [ ] idle
  - [ ] running
  - [ ] waiting_user
  - [ ] blocked
  - [ ] failed

---

## C. 前端去 mock

- [ ] 默认关闭 mock 数据入口
- [ ] 增加真实数据 adapter
- [ ] 接入轮询或 WS 的统一刷新逻辑
- [ ] 做连接状态提示：
  - [ ] connected
  - [ ] reconnecting
  - [ ] error

---

## D. 地图状态映射

- [ ] 固定 `main / research / executor / ops` 的地图位置
- [ ] 每个状态有明确视觉反馈
- [ ] 当前任务可在角色附近显示简短提示
- [ ] 有异常时出现高优先级标记

---

## E. 验证

- [ ] 能在本地启动前后端
- [ ] 能从真实 OpenClaw runtime 拉到状态
- [ ] 不依赖 mock 也能展示地图
- [ ] 手动切换运行状态时，地图能正确变化

---

## Week 1 交付物

- 可运行演示
- 字段映射表
- 状态语义说明
- 一个简短录屏或截图集
