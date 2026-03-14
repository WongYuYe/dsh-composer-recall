function createUpstreamClient(config, dashboardHelpers) {
  const responseCache = {
    taskStats: { value: null, fetchedAtMs: 0, inFlight: null },
    taskRuntime: { value: null, fetchedAtMs: 0, inFlight: null },
  };

  function clearResponseCaches(keys = Object.keys(responseCache)) {
    for (const key of keys) {
      if (!responseCache[key]) {
        continue;
      }

      responseCache[key].value = null;
      responseCache[key].fetchedAtMs = 0;
      responseCache[key].inFlight = null;
    }
  }

  async function readCachedResponse(key, ttlMs, loader, options = {}) {
    const { force = false, allowStale = true } = options;
    const entry = responseCache[key];
    const now = Date.now();

    if (!force && entry.value && now - entry.fetchedAtMs < ttlMs) {
      return entry.value;
    }

    const startRefresh = () => {
      const task = (async () => {
        try {
          const value = await loader();
          if (value !== null && value !== undefined) {
            entry.value = value;
            entry.fetchedAtMs = Date.now();
            return value;
          }

          return entry.value;
        } catch (error) {
          if (entry.value !== null && entry.value !== undefined) {
            return entry.value;
          }
          throw error;
        }
      })();

      entry.inFlight = task;
      task.finally(() => {
        if (entry.inFlight === task) {
          entry.inFlight = null;
        }
      });

      return task;
    };

    if (!force && allowStale && entry.value !== null && entry.value !== undefined) {
      if (!entry.inFlight) {
        void startRefresh();
      }
      return entry.value;
    }

    if (!force && entry.inFlight) {
      return entry.inFlight;
    }

    return startRefresh();
  }

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

  async function fetchTaskStatsAsync(options = {}) {
    return readCachedResponse("taskStats", config.taskStatsTtlMs, async () => {
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
    }, options);
  }

  async function fetchTaskRuntimeAsync(options = {}) {
    return readCachedResponse("taskRuntime", config.taskRuntimeTtlMs, async () => {
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
    }, options);
  }

  function unwrapUpstreamStatusPayload(payload) {
    const root = payload?.data || payload?.status || payload;
    return root && typeof root === "object" && !Array.isArray(root) ? root : null;
  }

  async function fetchOpenclawStatusAsync() {
    const payload = await fetchJsonFromCandidates(getStatusEndpointCandidates(), config.statusTimeoutMs);
    const unwrapped = unwrapUpstreamStatusPayload(payload);
    if (unwrapped) {
      return unwrapped;
    }

    throw new Error("Upstream status payload is not a JSON object.");
  }

  return {
    fetchJsonFromCandidates,
    fetchOpenclawStatusAsync,
    fetchTaskRuntimeAsync,
    fetchTaskStatsAsync,
    clearResponseCaches,
    getAgentTurnCandidates,
    getStatusEndpointCandidates,
    getTaskActionCandidates,
    getTaskRuntimeCandidates,
    getTaskStatsCandidates,
    async postAgentTurn(body = {}) {
      const payload = await postJsonToCandidates(getAgentTurnCandidates(), config.agentTurnTimeoutMs, body);
      clearResponseCaches();
      return payload;
    },
    async postTaskAction(taskId, action, body = {}) {
      const payload = await postJsonToCandidates(
        getTaskActionCandidates(taskId, action),
        config.taskRuntimeTimeoutMs,
        body,
      );
      clearResponseCaches();
      return payload;
    },
  };
}

module.exports = {
  createUpstreamClient,
};
