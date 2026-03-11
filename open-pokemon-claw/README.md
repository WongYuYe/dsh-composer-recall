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
