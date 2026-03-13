# pokemon-claw · 下一阶段架构与设计方案

## 1. 产品定位

`pokemon-claw` 不是普通状态大屏，而是面向 OpenClaw 的 **可视化操作层**：

- 地图层：全局感知谁在做什么
- 面板层：查看与执行控制动作
- 时间线层：追踪任务、工具调用与异常

目标是让用户更容易：

- 看懂 agent 当前行为
- 理解多 agent 协作关系
- 在需要时快速接管

---

## 2. 目标架构

```text
OpenClaw Runtime
  ├─ sessions / subagents / cron / tools / status
  ↓
Visual Backend (backend/)
  ├─ status aggregation
  ├─ task stats/runtime aggregation
  ├─ command/control endpoints
  └─ websocket push / polling fallback
  ↓
Visual Frontend (frontend/)
  ├─ Phaser map world
  ├─ side detail panel
  ├─ timeline / debug panel
  └─ action controls
```

---

## 3. 三层交互结构

## 3.1 地图层（Map Layer）
职责：全局感知。

应承载：
- agent 的位置与状态
- 环境区块（work / rest / alarm / outdoor）
- 当前是否有警报、阻塞、待确认事件
- 协作方向提示（谁派发给谁）

不应承载：
- 过多文本细节
- 复杂诊断信息
- 全量日志

### 推荐状态映射
- `idle` → 原地待命/轻微呼吸动画
- `running` → 移动/工作动画
- `waiting_user` → 气泡/感叹号
- `blocked` → 黄橙色警戒标记
- `failed` → 红色异常标记

---

## 3.2 详情层（Detail Panel）
职责：单体管理。

点击 agent / task 后右侧显示：
- 当前状态
- 当前任务
- 最近事件
- 最近错误
- 可执行动作

### 建议动作
- Refresh
- Send task
- Stop task
- Retry task
- Open timeline

---

## 3.3 时间线层（Timeline Layer）
职责：追溯与诊断。

建议展示：
- task created
- dispatched to subagent
- tool call started
- waiting for user
- failed / timeout
- completed

时间线要回答三件事：
1. 刚才发生了什么
2. 现在卡在什么地方
3. 要不要人工接管

---

## 4. 数据模型建议

## 4.1 AgentState

```ts
interface AgentState {
  id: string;
  name: string;
  role: 'main' | 'research' | 'executor' | 'ops' | string;
  status: 'idle' | 'running' | 'waiting_user' | 'blocked' | 'failed';
  zone: 'work' | 'rest' | 'alarm' | 'outdoor';
  position?: { x: number; y: number };
  currentTaskId?: string;
  currentTaskTitle?: string;
  activeChildrenCount?: number;
  lastUpdatedAt: string;
}
```

## 4.2 TaskState

```ts
interface TaskState {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'waiting_user' | 'blocked' | 'failed' | 'completed';
  ownerAgentId: string;
  parentTaskId?: string;
  startedAt?: string;
  updatedAt: string;
  latestEvent?: string;
}
```

## 4.3 RuntimeEvent

```ts
interface RuntimeEvent {
  id: string;
  type: 'task' | 'tool' | 'system' | 'error' | 'message';
  sourceAgentId?: string;
  targetAgentId?: string;
  taskId?: string;
  severity?: 'info' | 'warn' | 'error';
  summary: string;
  createdAt: string;
}
```

---

## 5. Week 1 设计落点

### 前端
- 去掉默认 mock 优先逻辑
- 增加 runtime adapter：统一把后端数据映射成 `AgentState[] / TaskState[] / RuntimeEvent[]`
- 地图上的角色位置先固定，不追求动态寻路
- 增加全局状态条：连接状态 / 最近刷新时间 / 当前模式

### 后端
- 统一 `/api/openclaw/status` 输出结构
- 明确 `/api/tasks/stats` 和 `/api/tasks/runtime` 的最终字段规范
- 补一个最近事件接口，或在 status 中附带 `recentEvents`
- 如果暂时做不到 WebSocket 完整推送，保留 HTTP 轮询 fallback

---

## 6. 设计约束

1. 不为了像素风牺牲可读性
2. 不把排障信息全塞进地图层
3. 不在第 1 周追求复杂动画系统
4. 所有视觉表现都必须对应真实状态

---

## 7. 成功标准

如果下一阶段设计正确，用户应该能在 10 秒内回答：

- 哪个 agent 正在工作
- 哪个 agent 空闲
- 哪个任务需要我介入
- 最近一次异常发生在哪里

如果做不到，说明产品还是偏展示，不够控制台。
