# Week 1 字段映射表

## 目标
把前后端现有输出统一成前端内部可消费的稳定结构，为后续多 agent 地图、详情面板、时间线做准备。

---

## 1. 当前真实接口

### 前端默认读取
- `GET /api/openclaw/status`
- `GET /api/tasks/stats`
- `GET /api/tasks/runtime`
- `WS /ws/openclaw/status`

### 后端来源
- OpenClaw CLI: `openclaw status --json`
- OpenClaw CLI: `openclaw health --json`
- OpenClaw CLI: `openclaw cron list --json`
- 手动调试覆盖：`/api/debug/state`

---

## 2. 前端当前实际消费字段

### 基础状态
| 前端字段 | 当前来源 | 说明 |
|---|---|---|
| `zone` | `/api/openclaw/status.data.zone` | 地图主分区：rest/work/alarm |
| `scene` | `/api/openclaw/status.data.scene` | room/outdoor |
| `position` | `/api/openclaw/status.data.position` | 当前角色主坐标 |
| `task` | `/api/openclaw/status.data.task` | 当前主任务文案 |
| `description` | `/api/openclaw/status.data.description` | 状态摘要 |
| `mode` | `/api/openclaw/status.data.mode` | RUNNING / IDLE / ERROR |
| `alertLevel` | `/api/openclaw/status.data.alertLevel` | GREEN / AMBER / RED |
| `updatedAt` | `/api/openclaw/status.data.updatedAt` | 最近更新时间 |
| `logs` | `/api/openclaw/status.data.logs` | 现场日志 |

### 任务相关
| 前端字段 | 当前来源 | 说明 |
|---|---|---|
| `taskStats.total` | `/api/tasks/stats.data.total` | 任务总数 |
| `taskStats.todo` | `/api/tasks/stats.data.todo` | 待开始 |
| `taskStats.doing` | `/api/tasks/stats.data.doing` | 进行中 |
| `taskStats.blocked` | `/api/tasks/stats.data.blocked` | 阻塞/失败 |
| `taskStats.done` | `/api/tasks/stats.data.done` | 完成 |
| `runtime.currentTask` | `/api/tasks/runtime.data.currentTask` | 当前任务 |
| `runtime.nextTask` | `/api/tasks/runtime.data.nextTask` | 下一任务 |
| `runtime.queueSummary` | `/api/tasks/runtime.data.queueSummary` | 排队/运行/失败摘要 |

---

## 3. 新增统一内部模型

## 3.1 AgentState
```ts
interface AgentState {
  id: string;
  name: string;
  enabled: boolean;
  zone: 'rest' | 'work' | 'alarm';
  status: 'idle' | 'running' | 'blocked';
  heartbeatEvery: string;
  heartbeatEveryMs: number | null;
  session: {
    key: string;
    updatedAt: number | null;
    age: number | null;
    percentUsed: number | null;
    model: string;
  } | null;
}
```

## 3.2 TaskState
```ts
interface TaskState {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'waiting_user' | 'blocked' | 'failed' | 'completed';
  progress?: number | null;
  startedAt?: string;
  updatedAt?: string;
  availableActions?: string[];
}
```

## 3.3 RuntimeEvent
```ts
interface RuntimeEvent {
  type: 'status' | 'task' | 'tool' | 'system' | 'error';
  summary: string;
  createdAt: string;
  zone?: string;
}
```

---

## 4. Week 1 新增后端输出

`/api/openclaw/status.data.openclaw.agents`

结构：

```json
[
  {
    "id": "main",
    "name": "main",
    "enabled": true,
    "heartbeatEvery": "30m",
    "heartbeatEveryMs": 1800000,
    "zone": "work",
    "status": "running",
    "session": {
      "key": "agent:main:main",
      "updatedAt": 1773227813873,
      "age": 33490,
      "percentUsed": 71,
      "model": "gpt-5.4"
    }
  }
]
```

用途：
- 先为 Week 2 的多 agent 面板和地图铺数据基础
- 暂时不要求前端全部渲染出来，但接口要稳定可用

---

## 5. 设计约束

1. 前端默认不再依赖仓库内 public api key
2. 同源本地聚合层优先，避免跨域和鉴权复杂度
3. 所有新增字段必须兼容旧前端，不破坏现有展示
4. Week 1 先把数据模型稳住，不急着做全量多角色动画
