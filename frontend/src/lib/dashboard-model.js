import {
  alertLabels,
  idleActivityLabels,
  modeLabels,
  zoneAnchors,
  zoneLabels,
  zoneRenderBounds,
} from "./dashboard-config.js";

const AGENT_ORDER = ["main", "research", "executor", "ops"];

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

export function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function applyMergePatch(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return cloneValue(patch);
  }

  const base = target && typeof target === "object" && !Array.isArray(target)
    ? cloneValue(target)
    : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete base[key];
      continue;
    }

    base[key] = applyMergePatch(base[key], value);
  }

  return base;
}

export function normalizeEventCursor(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return String(value).trim();
}

export function formatClock(value = Date.now()) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function formatShortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return formatClock(date);
}

export function formatPercent(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return String(Math.round(numeric));
}

export function formatTemperature(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return `${Math.round(numeric)}°C`;
}

export function formatTaskCount(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return String(Math.max(0, Math.round(numeric)));
}

export function normalizeZone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("alarm") || normalized.includes("alert")) {
    return "alarm";
  }

  if (normalized.includes("work")) {
    return "work";
  }

  if (normalized.includes("rest") || normalized.includes("idle")) {
    return "rest";
  }

  return "";
}

export function normalizeScene(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("outdoor") || normalized.includes("town")) {
    return "outdoor";
  }

  return "room";
}

export function normalizeAlert(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (["GREEN", "BLUE", "AMBER", "RED", "OFFLINE"].includes(normalized)) {
    return normalized;
  }

  return "OFFLINE";
}

export function normalizeIdleActivity(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (idleActivityLabels[normalized]) {
    return normalized;
  }

  return normalized.replace(/\s+/g, "_");
}

function parsePositionNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasExplicitPosition(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return parsePositionNumber(value.x) !== null && parsePositionNumber(value.y) !== null;
}

export function normalizePosition(value, fallbackZone = "rest") {
  if (hasExplicitPosition(value)) {
    return {
      x: parsePositionNumber(value.x),
      y: parsePositionNumber(value.y),
    };
  }

  return cloneValue(zoneAnchors[fallbackZone] || zoneAnchors.rest);
}

export function projectPositionIntoZone(position, zone = "rest") {
  const base = normalizePosition(position, zone);
  const bounds = zoneRenderBounds[zone] || zoneRenderBounds.rest;
  return {
    x: clamp(base.x, bounds.minX, bounds.maxX),
    y: clamp(base.y, bounds.minY, bounds.maxY),
  };
}

function normalizeLogs(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      zone: normalizeZone(entry.zone) || "system",
      time: entry.time || entry.timestamp || new Date().toISOString(),
      message: String(entry.message || entry.text || entry.summary || "").trim(),
    }))
    .filter((entry) => entry.message)
    .slice(0, 12);
}

function normalizeAgent(agent) {
  const zone = normalizeZone(agent?.zone) || "rest";
  const rawPosition = firstDefined(
    agent?.position,
    agent?.coords,
    agent?.coordinate,
    agent?.tile,
    agent?.mapPosition,
    { x: agent?.x, y: agent?.y },
  );
  const hasPosition = hasExplicitPosition(rawPosition);
  const position = hasPosition ? normalizePosition(rawPosition, zone) : null;
  const mapPosition = hasPosition ? projectPositionIntoZone(position, zone) : null;

  return {
    id: String(agent?.id || "").trim(),
    name: String(agent?.name || agent?.id || "").trim(),
    enabled: agent?.enabled !== false,
    source: String(agent?.source || "").trim() || "unknown",
    active: agent?.active === true || Boolean(agent?.session),
    zone,
    status: String(agent?.status || "idle").trim().toLowerCase() || "idle",
    heartbeatEvery: String(agent?.heartbeatEvery || "").trim(),
    heartbeatEveryMs: safeNumber(agent?.heartbeatEveryMs),
    position,
    mapPosition,
    session: agent?.session && typeof agent.session === "object"
      ? {
          key: String(agent.session.key || "").trim(),
          updatedAt: safeNumber(agent.session.updatedAt),
          age: safeNumber(agent.session.age),
          percentUsed: safeNumber(agent.session.percentUsed),
          model: String(agent.session.model || "").trim(),
        }
      : null,
  };
}

function resolveAgentOrder(agents) {
  return [...agents].sort((left, right) => {
    const leftIndex = AGENT_ORDER.indexOf(left.id);
    const rightIndex = AGENT_ORDER.indexOf(right.id);
    const safeLeftIndex = leftIndex === -1 ? AGENT_ORDER.length : leftIndex;
    const safeRightIndex = rightIndex === -1 ? AGENT_ORDER.length : rightIndex;
    if (safeLeftIndex !== safeRightIndex) {
      return safeLeftIndex - safeRightIndex;
    }

    return left.id.localeCompare(right.id);
  });
}

export function resolveFocusedAgentId(agents, requested) {
  const list = Array.isArray(agents) ? agents.filter((agent) => agent?.id) : [];
  if (list.length === 0) {
    return "main";
  }

  if (requested && list.some((agent) => agent.id === requested)) {
    return requested;
  }

  const fallback = list.find((agent) => agent.id === "main") || list[0];
  return fallback.id;
}

export function normalizeTaskStatsPayload(payload) {
  const root = payload?.data || payload?.stats || payload;
  if (!root || typeof root !== "object") {
    return null;
  }

  const list = Array.isArray(root.taskList)
    ? root.taskList
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.tasks)
        ? root.tasks
        : [];

  const taskList = list
    .map((item) => normalizeTaskRecord(item))
    .filter(Boolean);
  const currentTask = pickCurrentTask(taskList);

  return {
    total: safeNumber(firstDefined(root.total, root.taskCount, list.length)) ?? 0,
    todo: safeNumber(root.todo) ?? 0,
    doing: safeNumber(firstDefined(root.doing, root.inProgress)) ?? 0,
    blocked: safeNumber(root.blocked) ?? 0,
    done: safeNumber(root.done) ?? 0,
    taskList,
    currentTask,
  };
}

export function normalizeTaskRuntimePayload(payload) {
  const root = payload?.data || payload?.runtime || payload;
  if (!root || typeof root !== "object") {
    return null;
  }

  const queueSummary = root.queueSummary && typeof root.queueSummary === "object"
    ? root.queueSummary
    : root;

  return {
    currentTask: normalizeTaskRecord(root.currentTask),
    nextTask: normalizeTaskRecord(root.nextTask),
    queueSummary: {
      queued: safeNumber(firstDefined(queueSummary.queued, root.queued)) ?? 0,
      running: safeNumber(firstDefined(queueSummary.running, root.running)) ?? 0,
      failed: safeNumber(firstDefined(queueSummary.failed, root.failed)) ?? 0,
    },
  };
}

function normalizeTaskRecord(task) {
  if (!task || typeof task !== "object") {
    return null;
  }

  return {
    taskId: task.taskId || task.id || "",
    agentId: String(
      firstDefined(
        task.agentId,
        task.agent,
        task.ownerId,
        task.assignee?.agentId,
        "",
      ) || "",
    ).trim(),
    assignee: String(firstDefined(task.assignee?.name, task.assignee, task.owner, "") || "").trim(),
    sessionKey: String(firstDefined(task.sessionKey, task.session?.key, "") || "").trim(),
    title: task.title || task.name || "",
    status: String(task.status || "").toLowerCase(),
    progress: safeNumber(task.progress),
    updatedAt: task.updatedAt || "",
    startedAt: task.startedAt || task.updatedAt || "",
    etaSeconds: safeNumber(firstDefined(task.etaSeconds, task.eta)),
    failureReason: String(task.failureReason || "").trim(),
    lastError: String(task.lastError || "").trim(),
    availableActions: Array.isArray(task.availableActions)
      ? task.availableActions.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [],
  };
}

function pickCurrentTask(taskList) {
  if (!Array.isArray(taskList) || taskList.length === 0) {
    return null;
  }

  return taskList.find((item) => item.status === "blocked")
    || taskList.find((item) => item.status === "failed")
    || taskList.find((item) => item.status === "doing")
    || taskList.find((item) => item.status === "running")
    || taskList[0]
    || null;
}

function normalizeComparableText(value) {
  return String(value || "").trim().toLowerCase();
}

function taskBelongsToAgent(task, agent) {
  if (!task || !agent?.id) {
    return false;
  }

  const agentId = normalizeComparableText(agent.id);
  if (!agentId) {
    return false;
  }

  const explicitOwner = normalizeComparableText(firstDefined(task.agentId, task.assignee));
  if (explicitOwner && explicitOwner === agentId) {
    return true;
  }

  const taskId = normalizeComparableText(task.taskId);
  if (taskId === `agent-task-${agentId}`) {
    return true;
  }

  const sessionKey = normalizeComparableText(firstDefined(task.sessionKey, agent.session?.key));
  if (sessionKey && normalizeComparableText(task.sessionKey) === sessionKey) {
    return true;
  }

  return Boolean(sessionKey) && normalizeComparableText(task.title).includes(sessionKey);
}

function collectTaskCandidates(state) {
  if (!state) {
    return [];
  }

  const seen = new Set();
  const items = [
    state.runtime?.currentTask || null,
    state.runtime?.nextTask || null,
    state.taskStats?.currentTask || null,
    ...(Array.isArray(state.taskStats?.taskList) ? state.taskStats.taskList : []),
  ].filter(Boolean);

  return items.filter((task) => {
    const key = String(task.taskId || `${task.agentId}:${task.title}:${task.status}`).trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatEtaLabel(seconds) {
  const numeric = safeNumber(seconds);
  if (numeric === null || numeric < 0) {
    return "";
  }

  if (numeric < 60) {
    return `${Math.round(numeric)} 秒`;
  }

  const minutes = Math.floor(numeric / 60);
  const remainSeconds = Math.round(numeric % 60);
  return remainSeconds > 0 ? `${minutes} 分 ${remainSeconds} 秒` : `${minutes} 分钟`;
}

function buildTaskDescription(task, fallback) {
  if (!task) {
    return fallback;
  }

  const parts = [];
  if (task.failureReason) {
    parts.push(`原因：${task.failureReason}`);
  }
  if (task.lastError) {
    parts.push(`错误：${task.lastError}`);
  }
  if (safeNumber(task.progress) !== null) {
    parts.push(`进度 ${Math.round(Number(task.progress))}%`);
  }
  const etaLabel = formatEtaLabel(task.etaSeconds);
  if (etaLabel) {
    parts.push(`预计 ${etaLabel}`);
  }

  return parts.join(" · ") || fallback;
}

function resolveFocusedTask(state, focusedAgent, primaryAgentId) {
  if (!state || !focusedAgent) {
    return null;
  }

  const candidates = collectTaskCandidates(state);
  const matchedTask = candidates.find((task) => taskBelongsToAgent(task, focusedAgent)) || null;
  if (matchedTask) {
    return matchedTask;
  }

  return focusedAgent.id === primaryAgentId
    ? state.actionableTask || state.runtime?.currentTask || state.taskStats?.currentTask || null
    : null;
}

function deriveZone(taskStats, runtime) {
  if ((runtime?.queueSummary?.failed || 0) > 0 || (taskStats?.blocked || 0) > 0) {
    return "alarm";
  }

  if ((runtime?.queueSummary?.running || 0) > 0 || (taskStats?.doing || 0) > 0) {
    return "work";
  }

  return "rest";
}

function deriveMode(baseMode, taskStats, runtime) {
  const normalized = String(baseMode || "RUNNING").trim().toUpperCase() || "RUNNING";
  if ((runtime?.queueSummary?.failed || 0) > 0 || (taskStats?.blocked || 0) > 0) {
    return "ERROR";
  }

  if ((runtime?.queueSummary?.running || 0) > 0 || (taskStats?.doing || 0) > 0) {
    return normalized;
  }

  return "IDLE";
}

function buildQueueSummary(queue) {
  if (!queue) {
    return "";
  }

  return `队列：排队 ${queue.queued ?? 0} 项 · 运行中 ${queue.running ?? 0} 项 · 失败 ${queue.failed ?? 0} 项`;
}

function buildTaskLabel(root, taskStats, runtime, idleActivityLabel, zone) {
  const runtimeTask = runtime?.currentTask?.title || runtime?.nextTask?.title || "";
  const explicitTask = String(firstDefined(root.task, root.taskName, root.action, root.job, "") || "").trim();
  if (runtimeTask) {
    return runtimeTask;
  }

  if (explicitTask) {
    return explicitTask;
  }

  if (idleActivityLabel) {
    return idleActivityLabel;
  }

  if ((runtime?.queueSummary?.failed || 0) > 0 || (taskStats?.blocked || 0) > 0) {
    return "警报处理中";
  }

  if ((runtime?.queueSummary?.running || 0) > 0 || (taskStats?.doing || 0) > 0) {
    return "远程控制进行中";
  }

  if (zone === "rest") {
    return "休息中";
  }

  return "等待任务安排";
}

function buildDescription(root, taskStats, runtime, zone, focusedAgentLabel) {
  const explicit = String(firstDefined(root.description, root.statusText, root.message, "") || "").trim();
  if (explicit) {
    return explicit;
  }

  const queueSummary = buildQueueSummary(runtime?.queueSummary);
  if (queueSummary) {
    return queueSummary;
  }

  if (taskStats) {
    return `任务总数 ${taskStats.total} 项 · 进行中 ${taskStats.doing} 项 · 阻塞 ${taskStats.blocked} 项`;
  }

  return `${focusedAgentLabel} 当前位于${zoneLabels[zone] || zone}。`;
}

function buildAgentFallbackTask(agent, zone) {
  if (agent?.enabled === false) {
    return "已停用";
  }

  if (agent?.session?.key) {
    return `会话中：${agent.session.key}`;
  }

  if (agent?.status === "blocked" || zone === "alarm") {
    return "警报处理中";
  }

  if (agent?.active || agent?.status === "running") {
    return "处理中";
  }

  if (zone === "work") {
    return "待处理任务";
  }

  return "待命中";
}

function buildAgentFallbackDescription(agent, zone) {
  if (agent?.enabled === false) {
    return `${agent.id} 当前已停用。`;
  }

  if (agent?.session?.key) {
    return `当前会话：${agent.session.key}`;
  }

  if (agent?.active && Number.isFinite(agent?.session?.age)) {
    return `${agent.id} 最近一次活跃在 ${Math.round(agent.session.age / 1000)} 秒前。`;
  }

  return `${agent.id} 当前位于${zoneLabels[zone] || zone}，状态为 ${agent.status || "idle"}。`;
}

export function buildDashboardState(statusPayload, taskStatsPayload, taskRuntimePayload) {
  const root = statusPayload?.robot || statusPayload?.data || statusPayload;
  if (!root || typeof root !== "object") {
    return null;
  }

  const openclaw = root.openclaw && typeof root.openclaw === "object" ? root.openclaw : {};
  const taskStats = normalizeTaskStatsPayload(taskStatsPayload || openclaw.tasks);
  const runtime = normalizeTaskRuntimePayload(taskRuntimePayload || openclaw.runtime);
  const rawAgents = Array.isArray(openclaw.agents)
    ? openclaw.agents
    : Array.isArray(root.agents)
      ? root.agents
      : [];
  const agents = resolveAgentOrder(rawAgents.map(normalizeAgent).filter((agent) => agent.id));
  const fallbackAgent = agents.find((agent) => agent.id === "main") || agents[0] || null;
  const zone = normalizeZone(firstDefined(root.zone, root.currentZone))
    || normalizeZone(fallbackAgent?.zone)
    || deriveZone(taskStats, runtime);
  const idleActivity = normalizeIdleActivity(firstDefined(root.idleActivity, root.activity));
  const idleActivityLabel = idleActivityLabels[idleActivity] || "";
  const scene = normalizeScene(firstDefined(root.scene, root.view))
    || (idleActivity ? "outdoor" : "room");
  const rawPosition = normalizePosition(
    firstDefined(root.position, root.coords, root.coordinate, root.tile, { x: root.x, y: root.y }),
    zone,
  );
  const mapPosition = projectPositionIntoZone(rawPosition, zone);
  const modeRaw = deriveMode(firstDefined(root.mode, root.status, "RUNNING"), taskStats, runtime);
  const alertLevel = normalizeAlert(firstDefined(root.alertLevel, root.alert, root.riskLevel, "GREEN"));
  const task = buildTaskLabel(root, taskStats, runtime, idleActivityLabel, zone);
  const description = buildDescription(root, taskStats, runtime, zone, fallbackAgent?.id || "main");
  const actionableTask = runtime?.currentTask?.taskId
    ? runtime.currentTask
    : taskStats?.currentTask?.taskId
      ? taskStats.currentTask
      : null;

  return {
    zone,
    zoneLabel: zoneLabels[zone] || zone,
    zoneName: zoneLabels[zone] || zone,
    scene,
    idleActivity,
    idleActivityLabel,
    position: rawPosition,
    mapPosition,
    task,
    description,
    modeRaw,
    mode: modeLabels[modeRaw] || modeRaw,
    alertLevel,
    alertText: alertLabels[alertLevel] || alertLevel,
    load: formatPercent(firstDefined(root.load, root.metrics?.load)),
    battery: formatPercent(firstDefined(root.battery, root.metrics?.battery)),
    temperature: formatTemperature(firstDefined(root.temperature, root.metrics?.temperature)),
    taskCount: formatTaskCount(firstDefined(root.taskCount, openclaw.tasks?.taskCount, taskStats?.total)),
    queue: runtime?.queueSummary?.queued ?? taskStats?.todo ?? 0,
    updatedAt: firstDefined(root.updatedAt, root.timestamp, new Date().toISOString()),
    logs: normalizeLogs(firstDefined(root.logs, statusPayload?.logs, statusPayload?.feed, statusPayload?.events)),
    runtime,
    taskStats,
    actionableTask,
    agents,
    openclaw: {
      ...openclaw,
      agents,
      runtime,
      tasks: taskStats,
      summary: openclaw.summary && typeof openclaw.summary === "object"
        ? { ...openclaw.summary }
        : {},
    },
  };
}

export function buildFocusedViewState(state, focusedAgentId) {
  if (!state) {
    return null;
  }

  const focusedAgent = state.agents.find((agent) => agent.id === focusedAgentId)
    || state.agents.find((agent) => agent.id === "main")
    || state.agents[0]
    || null;

  if (!focusedAgent) {
    return {
      ...state,
      focusedAgentId: focusedAgentId || "main",
      focusedAgent: null,
      ownsGlobalTask: true,
      zoneName: state.zoneLabel,
    };
  }

  const primaryAgentId = state.agents.find((agent) => agent.id === "main")?.id
    || state.agents[0]?.id
    || focusedAgent.id;
  const ownsGlobalTask = focusedAgent.id === primaryAgentId;
  const focusedZone = normalizeZone(focusedAgent.zone) || state.zone || "rest";
  const sharesPrimaryZone = focusedZone === state.zone;
  const focusedTask = resolveFocusedTask(state, focusedAgent, primaryAgentId);
  const position = focusedAgent.position
    ? cloneValue(focusedAgent.position)
    : sharesPrimaryZone
      ? cloneValue(state.position)
      : cloneValue(zoneAnchors[focusedZone] || zoneAnchors.rest);
  const mapPosition = focusedAgent.mapPosition
    ? cloneValue(focusedAgent.mapPosition)
    : sharesPrimaryZone
      ? cloneValue(state.mapPosition)
      : projectPositionIntoZone(position, focusedZone);
  const scene = sharesPrimaryZone ? state.scene : "room";
  const task = focusedTask?.title
    ? focusedTask.title
    : focusedAgent.session?.key
      ? `会话中：${focusedAgent.session.key}`
      : ownsGlobalTask
        ? state.task
        : buildAgentFallbackTask(focusedAgent, focusedZone);
  const fallbackDescription = ownsGlobalTask
    ? state.description
    : buildAgentFallbackDescription(focusedAgent, focusedZone);
  const description = focusedTask
    ? buildTaskDescription(focusedTask, fallbackDescription)
    : focusedAgent.session?.key
      ? `当前会话：${focusedAgent.session.key}`
      : fallbackDescription;
  const actionableTask = focusedTask?.taskId && focusedTask.availableActions?.length
    ? cloneValue(focusedTask)
    : null;

  return {
    ...state,
    focusedAgentId: focusedAgent.id,
    focusedAgent,
    focusedTask,
    primaryAgentId,
    ownsGlobalTask,
    zone: focusedZone,
    zoneLabel: zoneLabels[focusedZone] || focusedZone,
    zoneName: `${focusedAgent.id} · ${zoneLabels[focusedZone] || focusedZone}`,
    scene,
    position,
    mapPosition,
    task,
    description,
    actionableTask,
    openclaw: {
      ...(state.openclaw || {}),
      agents: state.agents,
      runtime: state.runtime,
      tasks: state.taskStats,
    },
  };
}

export function buildTaskDetail(viewState) {
  if (!viewState) {
    return {
      visible: false,
      status: "idle",
      meta: "",
      title: "",
      summary: "",
    };
  }

  const focusedAgent = viewState.focusedAgent;
  const queue = viewState.ownsGlobalTask !== false ? viewState.runtime?.queueSummary || null : null;
  const task = viewState.actionableTask
    || viewState.focusedTask
    || (focusedAgent?.session?.key
    ? {
        status: focusedAgent.status || "active",
        title: focusedAgent.session.key,
        progress: focusedAgent.session.percentUsed,
      }
    : null);

  if (!task && !queue && !focusedAgent?.session?.key) {
    if (!focusedAgent) {
      return {
        visible: false,
        status: "idle",
        meta: "",
        title: "",
        summary: "",
      };
    }

    const disabled = focusedAgent.enabled === false;
    const updatedAt = focusedAgent.updatedAt || viewState.updatedAt || null;

    return {
      visible: true,
      status: "idle",
      meta: updatedAt
        ? `最近更新 ${formatShortTime(updatedAt)}`
        : disabled
          ? "当前未启用"
          : "当前无任务",
      title: disabled
        ? `${focusedAgent.id} 已停用`
        : `${focusedAgent.id} 当前无任务`,
      summary: disabled
        ? "该 Agent 当前未启用，暂未接收任务。"
        : "该 Agent 当前没有匹配中的任务，正在等待新的安排。",
    };
  }

  const metaBits = [];
  if (task?.startedAt) {
    metaBits.push(`开始于 ${formatShortTime(task.startedAt)}`);
  }
  if (viewState.updatedAt) {
    metaBits.push(`更新于 ${formatShortTime(viewState.updatedAt)}`);
  }
  if (safeNumber(task?.progress) !== null) {
    metaBits.push(`进度 ${Math.round(Number(task.progress))}%`);
  }

  const summaryBits = [];
  if (task?.failureReason) {
    summaryBits.push(`原因：${task.failureReason}`);
  }
  if (task?.lastError) {
    summaryBits.push(`错误：${task.lastError}`);
  }
  if (queue) {
    summaryBits.push(buildQueueSummary(queue));
  }

  return {
    visible: true,
    status: String(task?.status || (queue?.running ? "running" : "idle")).toLowerCase(),
    meta: metaBits.join(" · ") || "暂无运行任务",
    title: task?.title || `${focusedAgent?.id || "main"} 当前没有运行任务`,
    summary: summaryBits.join(" · ") || "系统运行稳定，正在等待下一项安排。",
  };
}

export function buildTaskActions(viewState, inFlight, taskActionMessage) {
  const task = viewState?.actionableTask || null;
  const actions = Array.isArray(task?.availableActions) ? task.availableActions : [];
  const showRetry = actions.includes("retry");
  const showResolve = actions.includes("resolve");
  const visible = Boolean(task?.taskId) && (showRetry || showResolve);

  return {
    visible,
    showRetry,
    showResolve,
    retryLabel: inFlight === "retry" ? "重试中..." : "重试任务",
    resolveLabel: inFlight === "resolve" ? "处理中..." : "处理完成",
    disabled: Boolean(inFlight),
    note: taskActionMessage
      || task?.failureReason
      || task?.lastError
      || (showRetry ? "当前失败任务可直接重试或标记处理完成。" : "当前任务可标记为处理完成。"),
  };
}

export function buildCriticalMessage(viewState) {
  if (!viewState) {
    return "";
  }

  const task = viewState.actionableTask || viewState.focusedTask || viewState.runtime?.currentTask || null;
  const text = `${task?.failureReason || ""} ${task?.lastError || ""} ${viewState.description || ""}`.toLowerCase();
  const critical = viewState.alertLevel === "RED" || /failed|error|timeout|blocked|waiting_user|tool_error/.test(text);
  if (!critical) {
    return "";
  }

  return task?.failureReason || task?.lastError || viewState.description || "建议尽快检查并处理当前异常。";
}
