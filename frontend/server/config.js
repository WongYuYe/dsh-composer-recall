const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "..");
const defaultStaticRoot = path.join(frontendRoot, "dist");

function resolveStaticRoot(configuredRoot = process.env.OPENCLAW_STATIC_ROOT || "") {
  const normalized = String(configuredRoot || "").trim();
  if (normalized) {
    if (normalized === "dist") {
      return defaultStaticRoot;
    }

    return path.isAbsolute(normalized)
      ? normalized
      : path.resolve(frontendRoot, normalized);
  }

  return defaultStaticRoot;
}

function readApiKeyFromDotenv(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("API_KEY="));
    return line ? line.slice("API_KEY=".length).trim() : "";
  } catch {
    return "";
  }
}

function pushUniqueValue(list, value) {
  const normalized = String(value || "").trim();
  if (!normalized || list.includes(normalized)) {
    return;
  }

  list.push(normalized);
}

function discoverOpenclawApiKeys() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const values = [];
  pushUniqueValue(values, process.env.OPENCLAW_API_KEY);
  pushUniqueValue(values, process.env.OPENCLAW_BACKEND_API_KEY);
  pushUniqueValue(values, process.env.API_KEY);

  const candidates = [
    path.join(homeDir, ".openclaw", "workspace", "openclaw-visual-backend", ".env"),
    path.join(frontendRoot, "..", "openclaw-visual-backend", ".env"),
  ];

  for (const candidate of candidates) {
    pushUniqueValue(values, readApiKeyFromDotenv(candidate));
  }

  return values;
}

function createConfig() {
  const defaultUpstreamBaseUrl = "https://www.wangyuye.online/pokemon-claw";
  const upstreamBaseUrl = String(process.env.OPENCLAW_UPSTREAM_BASE_URL || defaultUpstreamBaseUrl)
    .trim()
    .replace(/\/+$/, "");
  const taskStatsAuthToken = process.env.OPENCLAW_TASK_STATS_AUTH_TOKEN || "";

  return {
    frontendRoot,
    defaultStaticRoot,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3008),
    robotName: "小龙虾",
    statusTimeoutMs: Number(process.env.OPENCLAW_STATUS_TIMEOUT_MS || 12000),
    statusPollIntervalMs: Number(process.env.OPENCLAW_STATUS_POLL_INTERVAL_MS || 15000),
    statusRefreshDebounceMs: Number(process.env.OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS || 300),
    statusRefreshMinIntervalMs: Number(process.env.OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS || 5000),
    upstreamBaseUrl,
    statusUrl: process.env.OPENCLAW_STATUS_URL || `${upstreamBaseUrl}/api/openclaw/status`,
    taskStatsUrl: process.env.OPENCLAW_TASK_STATS_URL || `${upstreamBaseUrl}/api/tasks/stats`,
    taskRuntimeUrl: process.env.OPENCLAW_TASK_RUNTIME_URL || `${upstreamBaseUrl}/api/tasks/runtime`,
    taskActionBaseUrl: process.env.OPENCLAW_TASK_ACTION_BASE_URL || upstreamBaseUrl,
    agentTurnUrl: process.env.OPENCLAW_AGENT_TURN_URL || `${upstreamBaseUrl}/api/openclaw/agent/turn`,
    taskStatsTimeoutMs: Number(process.env.OPENCLAW_TASK_STATS_TIMEOUT_MS || 5000),
    taskRuntimeTimeoutMs: Number(process.env.OPENCLAW_TASK_RUNTIME_TIMEOUT_MS || process.env.OPENCLAW_TASK_STATS_TIMEOUT_MS || 5000),
    agentTurnTimeoutMs: Number(process.env.OPENCLAW_AGENT_TURN_TIMEOUT_MS || 30000),
    taskStatsAuthToken,
    openclawApiKeys: discoverOpenclawApiKeys(),
    openclawAuthToken: process.env.OPENCLAW_AUTH_TOKEN || taskStatsAuthToken || "",
    wsPath: process.env.OPENCLAW_WS_PATH || "/ws/openclaw/status",
    wsPingIntervalMs: Number(process.env.OPENCLAW_WS_PING_INTERVAL_MS || 30000),
    wsMaxMissedPongs: Number(process.env.OPENCLAW_WS_MAX_MISSED_PONGS || 2),
    eventBufferSize: Number(process.env.OPENCLAW_EVENT_BUFFER_SIZE || 300),
    corsOrigin: process.env.OPENCLAW_CORS_ORIGIN || "*",
    mimeTypes: {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ico": "image/x-icon",
    },
    resolveStaticRoot,
  };
}

function buildRequestOrigin(req, config) {
  return `http://${req.headers.host || `${config.host}:${config.port}`}`;
}

module.exports = {
  buildRequestOrigin,
  createConfig,
  discoverOpenclawApiKeys,
  resolveStaticRoot,
};
