import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import {
  CONFIG,
  applyDashboardCssVars,
  syncBadgeLabels,
  zoneLabels,
} from "../lib/dashboard-config.js";
import {
  applyMergePatch,
  buildCriticalMessage,
  buildDashboardState,
  buildFocusedViewState,
  buildTaskActions,
  buildTaskDetail,
  buildTimelineItems,
  cloneValue,
  formatClock,
  normalizeEventCursor,
  resolveFocusedAgentId,
} from "../lib/dashboard-model.js";

function buildAbsoluteUrl(target, params = null) {
  const url = new URL(target, window.location.href);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

function buildWsUrl(lastEventId) {
  if (!CONFIG.wsEndpoint) {
    return "";
  }

  const url = new URL(CONFIG.wsEndpoint, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  if (lastEventId) {
    url.searchParams.set("lastEventId", lastEventId);
  }

  if (CONFIG.apiKey && !url.searchParams.has("apiKey")) {
    url.searchParams.set("apiKey", CONFIG.apiKey);
  }

  return url.toString();
}

function buildRequestHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...CONFIG.headers,
  };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || CONFIG.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers || buildRequestHeaders(),
      cache: "no-store",
      body: options.body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || payload?.message || `HTTP ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function useOpenClawDashboard() {
  const rawStatus = ref(null);
  const rawTaskStats = ref(null);
  const rawTaskRuntime = ref(null);
  const connectionState = ref("syncing");
  const latestError = ref("");
  const requestedFocusedAgentId = ref("main");
  const lastEventId = ref("");
  const taskActionInFlight = ref("");
  const taskActionMessage = ref("");
  const now = ref(Date.now());

  let clockTimer = 0;
  let pollTimer = 0;
  let reconnectTimer = 0;
  let websocket = null;

  function syncEmbeddedTaskState(payload) {
    rawTaskStats.value = payload?.openclaw?.tasks || null;
    rawTaskRuntime.value = payload?.openclaw?.runtime || null;
  }

  const dashboardState = computed(() => buildDashboardState(
    rawStatus.value,
    rawTaskStats.value,
    rawTaskRuntime.value,
  ));

  const focusedAgentId = computed(() => resolveFocusedAgentId(
    dashboardState.value?.agents || [],
    requestedFocusedAgentId.value,
  ));

  const viewState = computed(() => buildFocusedViewState(
    dashboardState.value,
    focusedAgentId.value,
  ));

  const agents = computed(() => dashboardState.value?.agents || []);
  const taskDetail = computed(() => buildTaskDetail(viewState.value));
  const taskActions = computed(() => buildTaskActions(
    viewState.value,
    taskActionInFlight.value,
    taskActionMessage.value,
  ));
  const criticalMessage = computed(() => buildCriticalMessage(viewState.value));
  const timelineItems = computed(() => buildTimelineItems(viewState.value));
  const syncBadgeText = computed(() => syncBadgeLabels[connectionState.value] || syncBadgeLabels.offline);
  const syncBadgeClass = computed(() => `sync-badge sync-badge--${connectionState.value}`);
  const clockText = computed(() => `${formatClock(now.value)} 北京时间`);
  const modeValue = computed(() => viewState.value?.mode || "离线");
  const alertValue = computed(() => viewState.value?.alertText || "离线");
  const queueValue = computed(() => String(viewState.value?.runtime?.queueSummary?.queued ?? viewState.value?.queue ?? 0));
  const zoneName = computed(() => viewState.value?.zoneName || "连接中");
  const taskName = computed(() => viewState.value?.task || "正在同步状态");
  const taskSummary = computed(() => latestError.value || viewState.value?.description || "等待后台返回最新状态。");
  const mapBanner = computed(() => latestError.value || (viewState.value
    ? `${viewState.value.zoneName} · ${viewState.value.description}`
    : "等待状态同步后更新地图视图。"));
  const recentSummary = computed(() => viewState.value
    ? `${viewState.value.task} · ${viewState.value.description}`
    : "等待状态同步后生成摘要。");
  const phaserState = computed(() => {
    if (!viewState.value) {
      return null;
    }

    return cloneValue({
      ...viewState.value,
      openclaw: {
        ...(viewState.value.openclaw || {}),
        agents: viewState.value.agents,
        runtime: viewState.value.runtime,
        tasks: viewState.value.taskStats,
      },
    });
  });

  async function refreshStatus(forceRefresh = false) {
    const payload = await requestJson(
      buildAbsoluteUrl(CONFIG.endpoint, forceRefresh ? { refresh: "1" } : null),
      { method: "GET" },
    );
    rawStatus.value = payload;
    syncEmbeddedTaskState(payload);
    if (payload?._meta?.lastEventId !== undefined) {
      lastEventId.value = normalizeEventCursor(payload._meta.lastEventId);
    }
    latestError.value = "";
    connectionState.value = "online";
    return payload;
  }

  async function refreshAll(forceRefresh = false) {
    try {
      await refreshStatus(forceRefresh);
    } catch (error) {
      latestError.value = error?.message || "状态同步失败";
      connectionState.value = rawStatus.value ? "syncing" : "offline";
    }
  }

  function handleWsMessage(event) {
    let message = null;
    try {
      message = JSON.parse(String(event.data || "{}"));
    } catch {
      return;
    }

    if (message?.type === "hello") {
      if (message.latestEventId !== undefined) {
        lastEventId.value = normalizeEventCursor(message.latestEventId);
      }
      return;
    }

    if (message?.type === "replay_reset") {
      lastEventId.value = "";
      void refreshAll(true);
      return;
    }

    if (message?.type === "error") {
      latestError.value = message.error || "状态流同步失败";
      connectionState.value = rawStatus.value ? "syncing" : "offline";
      return;
    }

    if (message?.type !== "status") {
      return;
    }

    if (message.eventId !== undefined) {
      lastEventId.value = normalizeEventCursor(message.eventId);
    }

    if (message.mode === "snapshot") {
      rawStatus.value = message.payload || null;
    } else if (message.mode === "patch") {
      rawStatus.value = applyMergePatch(rawStatus.value || {}, message.patch || {});
    }

    syncEmbeddedTaskState(rawStatus.value);
    latestError.value = "";
    connectionState.value = "online";
  }

  function connectWs() {
    const url = buildWsUrl(lastEventId.value);
    if (!url) {
      return;
    }

    if (websocket) {
      websocket.close();
      websocket = null;
    }

    websocket = new WebSocket(url);
    websocket.addEventListener("message", handleWsMessage);
    websocket.addEventListener("open", () => {
      connectionState.value = rawStatus.value ? "online" : "syncing";
    });
    websocket.addEventListener("error", () => {
      connectionState.value = rawStatus.value ? "syncing" : "offline";
    });
    websocket.addEventListener("close", () => {
      websocket = null;
      connectionState.value = rawStatus.value ? "syncing" : "offline";
      clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        connectWs();
      }, CONFIG.wsReconnectDelayMs);
    });
  }

  async function performTaskAction(action) {
    const task = viewState.value?.actionableTask;
    if (!task?.taskId) {
      return;
    }

    taskActionInFlight.value = action;
    taskActionMessage.value = action === "retry" ? "正在发起重试..." : "正在更新处理结果...";

    try {
      await requestJson(
        buildAbsoluteUrl(`./api/tasks/${encodeURIComponent(task.taskId)}/${action}`),
        {
          method: "POST",
          body: "{}",
        },
      );
      taskActionMessage.value = action === "retry"
        ? "已发起重试，正在同步最新状态。"
        : "已标记处理完成，正在同步最新状态。";
      await refreshAll(true);
    } catch (error) {
      taskActionMessage.value = `任务动作失败：${error?.message || "未知错误"}`;
    } finally {
      taskActionInFlight.value = "";
    }
  }

  function selectAgent(agentId) {
    requestedFocusedAgentId.value = agentId;
  }

  onMounted(() => {
    applyDashboardCssVars();
    document.body.dataset.viewMode = "map";
    now.value = Date.now();
    clockTimer = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
    pollTimer = window.setInterval(() => {
      if (connectionState.value === "online") {
        return;
      }
      void refreshAll(false);
    }, CONFIG.pollIntervalMs);
    void refreshAll(true);
    connectWs();
  });

  onBeforeUnmount(() => {
    clearInterval(clockTimer);
    clearInterval(pollTimer);
    clearTimeout(reconnectTimer);
    if (websocket) {
      websocket.close();
      websocket = null;
    }
  });

  return {
    agents,
    alertValue,
    clockText,
    connectionState,
    criticalMessage,
    focusedAgentId,
    latestError,
    mapBanner,
    modeValue,
    performTaskAction,
    phaserState,
    queueValue,
    recentSummary,
    selectAgent,
    syncBadgeClass,
    syncBadgeText,
    taskActions,
    taskDetail,
    taskName,
    taskSummary,
    timelineItems,
    viewState,
    zoneLabels,
    zoneName,
  };
}
