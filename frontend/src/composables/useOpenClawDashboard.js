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
} from "../lib/dashboard-config.js";
import {
  applyMergePatch,
  buildCriticalMessage,
  buildDashboardState,
  buildFocusedViewState,
  buildTaskActions,
  buildTaskDetail,
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

function isWebSocketOpen(socket) {
  return Boolean(socket) && socket.readyState === WebSocket.OPEN;
}

const agentSourceLabels = {
  "status-payload": "实时状态",
  heartbeat: "心跳推导",
  config: "配置兜底",
  unknown: "未知来源",
};

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
  let refreshTimer = 0;
  let reconnectTimer = 0;
  let websocket = null;
  let refreshInFlight = null;
  let lastRefreshStartedAt = 0;
  let lastWsActivityAt = 0;
  let disposed = false;

  function syncEmbeddedTaskState(payload) {
    rawTaskStats.value = payload?.openclaw?.tasks || null;
    rawTaskRuntime.value = payload?.openclaw?.runtime || null;
  }

  function hasHealthyWebSocket() {
    if (!CONFIG.wsEndpoint || disposed) {
      return false;
    }

    if (isWebSocketOpen(websocket)) {
      return true;
    }

    return lastWsActivityAt > 0 && Date.now() - lastWsActivityAt < CONFIG.wsHealthyWindowMs;
  }

  function getRefreshDelayMs() {
    const baseDelay = connectionState.value === "offline"
      ? CONFIG.offlinePollIntervalMs
      : connectionState.value === "syncing"
        ? CONFIG.syncingPollIntervalMs
        : CONFIG.pollIntervalMs;

    if (document.visibilityState === "hidden") {
      return baseDelay * CONFIG.hiddenTabPollMultiplier;
    }

    return baseDelay;
  }

  function clearRefreshTimer() {
    clearTimeout(refreshTimer);
    refreshTimer = 0;
  }

  function clearReconnectTimer() {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }

  function scheduleRefresh(delayMs = getRefreshDelayMs(), forceRefresh = false) {
    clearRefreshTimer();

    if (disposed) {
      return;
    }

    const effectiveDelay = !forceRefresh && hasHealthyWebSocket()
      ? Math.max(CONFIG.wsHealthyWindowMs, delayMs)
      : delayMs;

    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;

      if (!forceRefresh && hasHealthyWebSocket()) {
        scheduleRefresh();
        return;
      }

      void refreshAll(forceRefresh);
    }, effectiveDelay);
  }

  function scheduleReconnect() {
    clearReconnectTimer();

    if (disposed || !CONFIG.wsEndpoint) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connectWs();
    }, CONFIG.wsReconnectDelayMs);
  }

  function applyStatusPayload(payload, source = "http") {
    rawStatus.value = payload;
    syncEmbeddedTaskState(payload);
    if (payload?._meta?.lastEventId !== undefined) {
      lastEventId.value = normalizeEventCursor(payload._meta.lastEventId);
    }

    const degraded = Boolean(payload?._meta?.degraded);
    latestError.value = degraded ? (payload?._meta?.lastError || payload?.description || "") : "";
    connectionState.value = degraded && source !== "ws" ? "syncing" : "online";
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
  const criticalMessage = computed(() => buildCriticalMessage(viewState.value) || latestError.value);
  const syncBadgeText = computed(() => syncBadgeLabels[connectionState.value] || syncBadgeLabels.offline);
  const syncBadgeClass = computed(() => `sync-badge sync-badge--${connectionState.value}`);
  const clockText = computed(() => `${formatClock(now.value)} 北京时间`);
  const agentSummary = computed(() => {
    const summary = dashboardState.value?.openclaw?.summary || {};
    const configured = Number(summary.configuredAgentCount);
    const active = Number(summary.activeAgentCount);
    const source = String(summary.agentSource || "").trim() || "unknown";
    const fallbackConfigured = agents.value.length;
    const fallbackActive = agents.value.filter((agent) => agent.active).length;
    const configuredCount = Number.isFinite(configured) ? configured : fallbackConfigured;
    const activeCount = Number.isFinite(active) ? active : fallbackActive;

    return {
      visible: configuredCount > 0 || activeCount > 0,
      source,
      sourceLabel: agentSourceLabels[source] || source,
      configuredCount,
      activeCount,
      state: activeCount <= 0 ? "empty" : activeCount < configuredCount ? "partial" : "full",
    };
  });
  const zoneName = computed(() => viewState.value?.zoneName || "连接中");
  const taskName = computed(() => viewState.value?.task || "正在同步状态");
  const taskSummary = computed(() => viewState.value?.description || "等待后台返回最新状态。");
  const mapBanner = computed(() => (viewState.value
    ? `${viewState.value.zoneName} · ${viewState.value.description}`
    : "等待状态同步后更新地图视图。"));
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
    applyStatusPayload(payload, "http");
    return payload;
  }

  async function refreshAll(forceRefresh = false) {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    if (!forceRefresh && Date.now() - lastRefreshStartedAt < CONFIG.minRefreshGapMs) {
      return rawStatus.value;
    }

    lastRefreshStartedAt = Date.now();

    const task = (async () => {
      try {
        return await refreshStatus(forceRefresh);
      } catch (error) {
        latestError.value = error?.message || "状态同步失败";
        connectionState.value = rawStatus.value ? "syncing" : "offline";
        return rawStatus.value;
      } finally {
        scheduleRefresh();
      }
    })();

    refreshInFlight = task.finally(() => {
      if (refreshInFlight === task) {
        refreshInFlight = null;
      }
    });

    return refreshInFlight;
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      if (hasHealthyWebSocket()) {
        clearRefreshTimer();
        scheduleRefresh();
        return;
      }

      void refreshAll(false);
      return;
    }

    scheduleRefresh();
  }

  function handleWsMessage(event) {
    let message = null;
    try {
      message = JSON.parse(String(event.data || "{}"));
    } catch {
      return;
    }

    lastWsActivityAt = Date.now();
    clearRefreshTimer();

    if (message?.type === "hello") {
      if (message.latestEventId !== undefined) {
        lastEventId.value = normalizeEventCursor(message.latestEventId);
      }
      scheduleRefresh();
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
      scheduleRefresh(CONFIG.syncingPollIntervalMs);
      return;
    }

    if (message?.type !== "status") {
      scheduleRefresh();
      return;
    }

    if (message.eventId !== undefined) {
      lastEventId.value = normalizeEventCursor(message.eventId);
    }

    if (message.mode === "snapshot") {
      applyStatusPayload(message.payload || null, "ws");
    } else if (message.mode === "patch") {
      applyStatusPayload(applyMergePatch(rawStatus.value || {}, message.patch || {}), "ws");
    }

    scheduleRefresh();
  }

  function connectWs() {
    const url = buildWsUrl(lastEventId.value);
    if (!url || disposed) {
      return;
    }

    if (websocket) {
      websocket.close();
      websocket = null;
    }

    websocket = new WebSocket(url);
    websocket.addEventListener("message", handleWsMessage);
    websocket.addEventListener("open", () => {
      if (disposed) {
        return;
      }

      lastWsActivityAt = Date.now();
      connectionState.value = rawStatus.value ? "online" : "syncing";
      clearRefreshTimer();
      scheduleRefresh();
    });
    websocket.addEventListener("error", () => {
      if (disposed) {
        return;
      }

      connectionState.value = rawStatus.value ? "syncing" : "offline";
      scheduleRefresh(CONFIG.syncingPollIntervalMs);
    });
    websocket.addEventListener("close", () => {
      websocket = null;
      if (disposed) {
        return;
      }

      connectionState.value = rawStatus.value ? "syncing" : "offline";
      scheduleReconnect();
      scheduleRefresh(CONFIG.syncingPollIntervalMs);
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
          body: JSON.stringify({ agentId: focusedAgentId.value }),
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
    now.value = Date.now();
    clockTimer = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void refreshAll(true);
    connectWs();
  });

  onBeforeUnmount(() => {
    disposed = true;
    clearInterval(clockTimer);
    clearRefreshTimer();
    clearReconnectTimer();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (websocket) {
      websocket.close();
      websocket = null;
    }
  });

  return {
    agents,
    agentSummary,
    clockText,
    criticalMessage,
    focusedAgentId,
    mapBanner,
    performTaskAction,
    phaserState,
    selectAgent,
    syncBadgeClass,
    syncBadgeText,
    taskActions,
    taskDetail,
    taskName,
    taskSummary,
    viewState,
    zoneName,
  };
}
