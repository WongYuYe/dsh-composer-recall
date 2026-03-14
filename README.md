# pokemon-claw

`pokemon-claw` 是一个面向 OpenClaw 的本地可视化面板。

它分成两层：

- `frontend/`：本地页面、静态资源服务、上游接口聚合
- `backend/`：本地 `openclaw` CLI 的 Fastify 包装层

当前默认运行方式是：

- 页面在本地启动
- 数据默认读取远程上游 `https://www.wangyuye.online/pokemon-claw`
- 如果你本机装好了 `openclaw`，也可以切回本地后端模式

## 仓库结构

```text
.
|-- frontend/
|-- backend/
`-- docs/
```

## 快速启动

只跑前端：

```bash
cd frontend
npm install
npm start
```

打开：

- `http://127.0.0.1:3008/`

说明：

- `npm start` 会先构建 `dist/`，再启动本地服务
- 默认读取远程上游，所以不依赖本机安装 `openclaw`

## 切换到本地后端模式

1. 先启动后端
2. 再让前端指向 `http://127.0.0.1:8787`

示意：

```bash
cd backend
npm install
npm start
```

然后启动前端前设置：

```bash
OPENCLAW_UPSTREAM_BASE_URL=http://127.0.0.1:8787
```

## 当前约束

- 项目中不写运行日志文件
- README 保持简短，只写当前真实可用的信息
- 前端固定以构建产物运行，避免源码模式和 `dist` 模式漂移

## 进一步说明

- 前端说明见 [frontend/README.md](/D:/Code/pokemon-claw/frontend/README.md)
- 后端说明见 [backend/README.md](/D:/Code/pokemon-claw/backend/README.md)
- 当前架构说明见 [docs/ARCHITECTURE_CURRENT_2026-03-13.md](/D:/Code/pokemon-claw/docs/ARCHITECTURE_CURRENT_2026-03-13.md)
