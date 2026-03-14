const urlParams = new URLSearchParams(window.location.search);
const externalConfig = window.OPENCLAW_CONFIG || {};

export const zoneLabels = {
  rest: "休息区",
  work: "工作区",
  system: "系统",
};

export const modeLabels = {
  RUNNING: "运行中",
  ACTIVE: "运行中",
  IDLE: "待命中",
  STANDBY: "待命中",
  SLEEP: "休眠中",
  OFFLINE: "离线",
  ERROR: "异常",
};

export const alertLabels = {
  GREEN: "正常",
  BLUE: "同步中",
  AMBER: "注意",
  RED: "警报",
  OFFLINE: "离线",
};

export const syncBadgeLabels = {
  offline: "离线",
  online: "在线",
  syncing: "同步中",
};

export const idleActivityLabels = {
  stay_home: "在家休息",
  walk_dog: "遛狗中",
  supermarket: "逛超市",
  walk: "外出散步",
  stroll: "外出放风",
  town: "城里闲逛",
  park: "公园散步",
  coffee: "喝咖啡",
};

export const zoneAnchors = {
  rest: { x: 5, y: 11 },
  work: { x: 13, y: 7 },
};

export const zoneRenderBounds = {
  rest: { minX: 6, maxX: 13, minY: 8, maxY: 12 },
  work: { minX: 8, maxX: 14, minY: 8, maxY: 11 },
};

const endpointOverride = urlParams.get("endpoint");
const wsOverride = urlParams.get("ws");
const taskStatsOverride = urlParams.get("tasksEndpoint");
const taskRuntimeOverride = urlParams.get("runtimeEndpoint");

export const CONFIG = {
  endpoint: endpointOverride || externalConfig.endpoint || "/api/openclaw/status",
  wsEndpoint: wsOverride || externalConfig.wsEndpoint || "/ws/openclaw/status",
  taskStatsEndpoint: taskStatsOverride || externalConfig.taskStatsEndpoint || "/api/tasks/stats",
  taskRuntimeEndpoint: taskRuntimeOverride || externalConfig.taskRuntimeEndpoint || "/api/tasks/runtime",
  pollIntervalMs: Math.max(Number(urlParams.get("poll") || externalConfig.pollIntervalMs || 30000), 10000),
  syncingPollIntervalMs: Math.max(Number(urlParams.get("syncingPoll") || externalConfig.syncingPollIntervalMs || 15000), 5000),
  offlinePollIntervalMs: Math.max(Number(urlParams.get("offlinePoll") || externalConfig.offlinePollIntervalMs || 30000), 10000),
  minRefreshGapMs: Math.max(Number(urlParams.get("minRefreshGap") || externalConfig.minRefreshGapMs || 5000), 1000),
  requestTimeoutMs: Math.max(Number(urlParams.get("timeout") || externalConfig.requestTimeoutMs || 12000), 2000),
  wsReconnectDelayMs: Math.max(Number(urlParams.get("wsReconnect") || externalConfig.wsReconnectDelayMs || 5000), 1000),
  wsHealthyWindowMs: Math.max(Number(urlParams.get("wsHealthyWindow") || externalConfig.wsHealthyWindowMs || 20000), 5000),
  hiddenTabPollMultiplier: Math.max(Number(urlParams.get("hiddenPollMultiplier") || externalConfig.hiddenTabPollMultiplier || 2), 1),
  headers: { ...(externalConfig.headers || {}) },
  apiKey: externalConfig.apiKey || "",
  authToken: externalConfig.authToken || "",
};

if (CONFIG.apiKey && !CONFIG.headers["x-api-key"] && !CONFIG.headers["X-API-Key"]) {
  CONFIG.headers["x-api-key"] = CONFIG.apiKey;
}

if (CONFIG.authToken && !CONFIG.headers.Authorization) {
  CONFIG.headers.Authorization = `Bearer ${CONFIG.authToken}`;
}

export function applyDashboardCssVars() {
  document.documentElement.style.setProperty("--map-width", "96");
  document.documentElement.style.setProperty("--map-height", "72");
  document.documentElement.style.setProperty("--zone-rest-top", "24");
  document.documentElement.style.setProperty("--zone-side-offset", "4");
}
