const { execFile } = require("child_process");

const {
  extractJsonPayload,
} = require("./utils");

function createUpstreamClient(config, dashboardHelpers) {
  function getTaskEndpointCandidates(explicitUrl, pathname) {
    const fromEnv = String(explicitUrl || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (fromEnv.length > 0) {
      return fromEnv;
    }

    return [`http://127.0.0.1:8787${pathname}`];
  }

  function deriveBaseUrlFromEndpoint(endpoint, expectedPathname) {
    const value = String(endpoint || "").trim();
    if (!value || !/^https?:\/\//i.test(value)) {
      return "";
    }

    const normalized = value.replace(/\/+$/, "");
    return normalized.endsWith(expectedPathname)
      ? normalized.slice(0, -expectedPathname.length)
      : "";
  }

  function joinBaseUrlAndPath(baseUrl, pathname) {
    const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
    return normalizedBase ? `${normalizedBase}${pathname}` : "";
  }

  function getStatusEndpointCandidates() {
    const fromEnv = String(config.statusUrl || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return fromEnv.length > 0
      ? fromEnv
      : ["http://127.0.0.1:8787/api/openclaw/status"];
  }

  function buildUpstreamHeaderVariants() {
    const variants = [];
    const authHeaders = config.openclawAuthToken ? { Authorization: `Bearer ${config.openclawAuthToken}` } : {};

    for (const apiKey of config.openclawApiKeys) {
      variants.push({
        Accept: "application/json",
        ...authHeaders,
        "x-api-key": apiKey,
      });
    }

    variants.push({
      Accept: "application/json",
      ...authHeaders,
    });

    return variants;
  }

  async function fetchJsonFromCandidates(candidates, timeoutMs) {
    let lastError = null;
    const headerVariants = buildUpstreamHeaderVariants();

    for (const url of candidates) {
      for (const headers of headerVariants) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers,
            signal: controller.signal,
          });

          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status} from ${url}`);
            continue;
          }

          return await response.json();
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error("No upstream candidates configured.");
  }

  async function postJsonToCandidates(candidates, timeoutMs, body = {}) {
    let lastError = null;
    const headerVariants = buildUpstreamHeaderVariants();

    for (const url of candidates) {
      for (const headers of headerVariants) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            method: "POST",
            cache: "no-store",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            lastError = new Error(
              [payload?.error || payload?.message || `HTTP ${response.status} from ${url}`, payload?.detail]
                .filter(Boolean)
                .join(": "),
            );
            continue;
          }

          return payload;
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error("No upstream candidates configured.");
  }

  function getTaskStatsCandidates() {
    return getTaskEndpointCandidates(config.taskStatsUrl, "/api/tasks/stats");
  }

  function getTaskRuntimeCandidates() {
    return getTaskEndpointCandidates(config.taskRuntimeUrl, "/api/tasks/runtime");
  }

  function getTaskActionCandidates(taskId, action) {
    const pathname = `/api/tasks/${encodeURIComponent(taskId)}/${action}`;
    const derivedBaseUrl =
      deriveBaseUrlFromEndpoint(config.taskRuntimeUrl, "/api/tasks/runtime") ||
      deriveBaseUrlFromEndpoint(config.taskStatsUrl, "/api/tasks/stats") ||
      deriveBaseUrlFromEndpoint(config.statusUrl, "/api/openclaw/status");

    if (config.taskActionBaseUrl || derivedBaseUrl) {
      return [joinBaseUrlAndPath(config.taskActionBaseUrl || derivedBaseUrl, pathname)];
    }

    return getTaskEndpointCandidates("", pathname);
  }

  function getAgentTurnCandidates() {
    const pathname = "/api/openclaw/agent/turn";
    const derivedBaseUrl =
      deriveBaseUrlFromEndpoint(config.statusUrl, "/api/openclaw/status") ||
      deriveBaseUrlFromEndpoint(config.taskRuntimeUrl, "/api/tasks/runtime") ||
      deriveBaseUrlFromEndpoint(config.taskStatsUrl, "/api/tasks/stats");

    if (config.agentTurnUrl) {
      return [String(config.agentTurnUrl).trim()];
    }

    if (derivedBaseUrl) {
      return [joinBaseUrlAndPath(derivedBaseUrl, pathname)];
    }

    return ["http://127.0.0.1:8787/api/openclaw/agent/turn"];
  }

  async function fetchTaskStatsAsync() {
    const candidates = getTaskStatsCandidates();
    const headerVariants = buildUpstreamHeaderVariants();

    for (const url of candidates) {
      for (const headers of headerVariants) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.taskStatsTimeoutMs);

        try {
          const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers,
            signal: controller.signal,
          });

          if (!response.ok) {
            continue;
          }

          const payload = await response.json();
          const derived = dashboardHelpers.deriveTaskStatsFromPayload(payload);
          if (derived) {
            return {
              ...derived,
              source: config.taskStatsUrl ? "task-stats-endpoint" : `task-stats-auto:${url}`,
            };
          }
        } catch {
          // try next
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    return null;
  }

  async function fetchTaskRuntimeAsync() {
    const candidates = getTaskRuntimeCandidates();
    const headerVariants = buildUpstreamHeaderVariants();

    for (const url of candidates) {
      for (const headers of headerVariants) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.taskRuntimeTimeoutMs);

        try {
          const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers,
            signal: controller.signal,
          });

          if (!response.ok) {
            continue;
          }

          const payload = await response.json();
          const derived = dashboardHelpers.deriveTaskRuntimeFromPayload(payload);
          if (derived) {
            return {
              ...derived,
              source: config.taskRuntimeUrl ? "task-runtime-endpoint" : `task-runtime-auto:${url}`,
            };
          }
        } catch {
          // try next
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    return null;
  }

  function fetchOpenclawStatusFromCli(callback) {
    execFile(
      "/bin/zsh",
      ["-lc", "openclaw --no-color status --json"],
      {
        timeout: config.statusTimeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        env: process.env,
      },
      (error, stdout, stderr) => {
        if (error) {
          callback(error, null, stderr || stdout);
          return;
        }

        try {
          callback(null, extractJsonPayload(stdout), stderr);
        } catch (parseError) {
          parseError.message = `Failed to parse JSON from 'openclaw status --json': ${parseError.message}`;
          callback(parseError, null, stderr || stdout);
        }
      },
    );
  }

  function fetchOpenclawStatusFromCliAsync() {
    return new Promise((resolve, reject) => {
      fetchOpenclawStatusFromCli((error, status, stderr) => {
        if (error) {
          const wrapped = new Error(error.message);
          wrapped.stderr = (stderr || "").trim();
          reject(wrapped);
          return;
        }

        resolve(status);
      });
    });
  }

  function unwrapUpstreamStatusPayload(payload) {
    const root = payload?.data || payload?.status || payload;
    return root && typeof root === "object" && !Array.isArray(root) ? root : null;
  }

  async function fetchOpenclawStatusAsync() {
    try {
      const payload = await fetchJsonFromCandidates(getStatusEndpointCandidates(), config.statusTimeoutMs);
      const unwrapped = unwrapUpstreamStatusPayload(payload);
      if (unwrapped) {
        return unwrapped;
      }
      throw new Error("Upstream status payload is not a JSON object.");
    } catch (upstreamError) {
      try {
        return await fetchOpenclawStatusFromCliAsync();
      } catch (cliError) {
        const upstreamMessage = upstreamError?.message ? `; upstream status fetch failed: ${upstreamError.message}` : "";
        cliError.message = `${cliError.message}${upstreamMessage}`;
        throw cliError;
      }
    }
  }

  return {
    fetchJsonFromCandidates,
    fetchOpenclawStatusAsync,
    fetchTaskRuntimeAsync,
    fetchTaskStatsAsync,
    getAgentTurnCandidates,
    getStatusEndpointCandidates,
    getTaskActionCandidates,
    getTaskRuntimeCandidates,
    getTaskStatsCandidates,
    postAgentTurn(body = {}) {
      return postJsonToCandidates(getAgentTurnCandidates(), config.agentTurnTimeoutMs, body);
    },
    postTaskAction(taskId, action) {
      return postJsonToCandidates(getTaskActionCandidates(taskId, action), config.taskRuntimeTimeoutMs, {});
    },
  };
}

module.exports = {
  createUpstreamClient,
};
