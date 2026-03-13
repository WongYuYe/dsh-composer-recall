const urlParams = new URLSearchParams(window.location.search);
const externalConfig = window.OPENCLAW_CONFIG || {};

export const LOGICAL_MAP_WIDTH = 24;
export const LOGICAL_MAP_HEIGHT = 18;
export const MAP_RENDER_SCALE = 4;
export const MAP_WIDTH = LOGICAL_MAP_WIDTH * MAP_RENDER_SCALE;
export const MAP_HEIGHT = LOGICAL_MAP_HEIGHT * MAP_RENDER_SCALE;
export const MAX_FEED_ITEMS = 12;
export const ROBOT_DISPLAY_NAME = "小龙虾";

export const useDemo = urlParams.get("demo") === "1";
export const demoAlertEnabled = urlParams.get("demoAlert") === "1";

const endpointOverride = urlParams.get("endpoint");
const wsOverride = urlParams.get("ws");
const tasksEndpointOverride = urlParams.get("tasksEndpoint");
const runtimeEndpointOverride = urlParams.get("runtimeEndpoint");

export const DEMO_STEP_DURATION_MS = Math.max(Number(urlParams.get("demoStepMs") || 5200), 2500);
export const REST_ANIMATION_CYCLE_MS = 10 * 60 * 1000;
export const REST_ROOM_PHASE_MS = 6 * 60 * 1000;

export const CONFIG = {
  endpoint: endpointOverride || externalConfig.endpoint || "/api/openclaw/status",
  wsEndpoint: useDemo ? "" : wsOverride || externalConfig.wsEndpoint || "",
  taskStatsEndpoint: useDemo ? "" : tasksEndpointOverride || externalConfig.taskStatsEndpoint || "",
  taskRuntimeEndpoint: useDemo ? "" : runtimeEndpointOverride || externalConfig.taskRuntimeEndpoint || "/api/tasks/runtime",
  pollIntervalMs: Math.max(Number(urlParams.get("poll") || externalConfig.pollIntervalMs || 3000), 1500),
  requestTimeoutMs: Math.max(Number(urlParams.get("timeout") || externalConfig.requestTimeoutMs || 12000), 2000),
  wsReconnectDelayMs: Math.max(Number(urlParams.get("wsReconnect") || externalConfig.wsReconnectDelayMs || 3500), 1000),
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

document.documentElement.style.setProperty("--map-width", String(MAP_WIDTH));
document.documentElement.style.setProperty("--map-height", String(MAP_HEIGHT));
document.documentElement.style.setProperty("--zone-rest-top", String(6 * MAP_RENDER_SCALE));
document.documentElement.style.setProperty("--zone-side-offset", String(1 * MAP_RENDER_SCALE));
document.documentElement.style.setProperty("--zone-alarm-bottom", String(2 * MAP_RENDER_SCALE));

export const zoneLabels = {
  rest: "休息区",
  work: "工作区",
  alarm: "警报区",
  system: "系统",
};

export const syncBadgeLabels = {
  offline: "离线",
  online: "在线",
  syncing: "同步中",
};

export const modeLabels = {
  RUNNING: "运行中",
  ACTIVE: "运行中",
  IDLE: "待机中",
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

export const sceneLabels = {
  room: "室内",
  outdoor: "室外",
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
  alarm: { x: 20, y: 11 },
};

export const zoneRenderBounds = {
  rest: { minX: 6, maxX: 13, minY: 8, maxY: 12 },
  work: { minX: 8, maxX: 14, minY: 8, maxY: 11 },
  alarm: { minX: 7, maxX: 13, minY: 8, maxY: 12 },
};

export const refs = {
  mapHome: document.getElementById("mapHome"),
  mapScreen: document.querySelector(".map-screen"),
  runModeChip: document.getElementById("runModeChip"),
  mapScroller: document.querySelector(".map-scroller"),
  mapWorld: document.querySelector(".map-world"),
  mapBottom: document.querySelector(".map-bottom"),
  mapGrid: document.getElementById("mapGrid"),
  mapBanner: document.getElementById("mapBanner"),
  zoneName: document.getElementById("zoneName"),
  taskName: document.getElementById("taskName"),
  taskSummary: document.getElementById("taskSummary"),
  taskDetail: document.getElementById("taskDetail"),
  taskDetailStatus: document.getElementById("taskDetailStatus"),
  taskDetailMeta: document.getElementById("taskDetailMeta"),
  taskDetailTitle: document.getElementById("taskDetailTitle"),
  taskDetailSummary: document.getElementById("taskDetailSummary"),
  taskActions: document.getElementById("taskActions"),
  retryTaskButton: document.getElementById("retryTaskButton"),
  resolveTaskButton: document.getElementById("resolveTaskButton"),
  taskActionNote: document.getElementById("taskActionNote"),
  modeValue: document.getElementById("modeValue"),
  alertValue: document.getElementById("alertValue"),
  queueValue: document.getElementById("queueValue"),
  clock: document.getElementById("clock"),
  syncBadge: document.getElementById("syncBadge"),
  criticalBanner: document.getElementById("criticalBanner"),
  recentSummary: document.getElementById("recentSummary"),
  timelineList: document.getElementById("timelineList"),
  zonePills: [...document.querySelectorAll(".zone-pill")],
  agentTabs: [...document.querySelectorAll(".agent-tab")],
  agentOverview: document.getElementById("agentOverview"),
  agentPanels: document.getElementById("agentPanels"),
};
