const http = require("http");
const path = require("path");

const { buildRequestOrigin, createConfig } = require("./server/config");
const { createDashboardHelpers } = require("./server/dashboard");
const { createStaticHelpers } = require("./server/static");
const { createStreamService } = require("./server/stream");
const { createUpstreamClient } = require("./server/upstream");
const { createWsGateway } = require("./server/ws");

const config = createConfig();
const dashboardHelpers = createDashboardHelpers(config);
const upstreamClient = createUpstreamClient(config, dashboardHelpers);
const staticHelpers = createStaticHelpers(config);
const streamService = createStreamService(config, upstreamClient, dashboardHelpers);

const {
  sendJson,
  serveStaticFile,
  setCorsHeaders,
} = staticHelpers;

const {
  synthesizeTaskRuntimeFromTaskStats,
  taskRuntimeResponseBody,
  taskStatsResponseBody,
} = dashboardHelpers;

async function createDevStaticMiddleware(config, httpServer = null) {
  if (config.isProduction) {
    return null;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    root: config.frontendRoot,
    configFile: path.join(config.frontendRoot, "vite.config.js"),
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer || undefined,
        clientPort: config.port,
      },
    },
  });

  return {
    close: () => vite.close(),
    handle: (req, res) => new Promise((resolve, reject) => {
      vite.middlewares(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
  };
}

async function main() {
  const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, buildRequestOrigin(req, config));

    if (req.method === "GET" && url.pathname === "/api/tasks/stats") {
      upstreamClient.fetchTaskStatsAsync()
        .then((taskStats) => {
          const fallbackTaskStats = taskStats || streamService.state.latestPayload?.openclaw?.tasks || null;
          const body = taskStatsResponseBody(fallbackTaskStats);
          if (body) {
            sendJson(res, 200, body);
            return;
          }

          sendJson(res, 502, {
            error: "Failed to query task stats",
            detail: "No upstream task stats source is currently available.",
          });
        })
        .catch((error) => {
          sendJson(res, 502, {
            error: "Failed to query task stats",
            detail: error?.message || "Unknown error",
          });
        });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tasks/runtime") {
      upstreamClient.fetchTaskRuntimeAsync()
        .then(async (taskRuntime) => {
          const cachedRuntime = streamService.state.latestPayload?.openclaw?.runtime || null;
          const fallbackTaskStats = taskRuntime || cachedRuntime
            ? null
            : await upstreamClient.fetchTaskStatsAsync().catch(() => null);
          const resolvedTaskRuntime =
            taskRuntime
            || cachedRuntime
            || synthesizeTaskRuntimeFromTaskStats(fallbackTaskStats);
          const body = taskRuntimeResponseBody(resolvedTaskRuntime);
          if (body) {
            sendJson(res, 200, body);
            return;
          }

          sendJson(res, 502, {
            error: "Failed to query task runtime",
            detail: "No upstream task runtime source is currently available.",
          });
        })
        .catch((error) => {
          sendJson(res, 502, {
            error: "Failed to query task runtime",
            detail: error?.message || "Unknown error",
          });
        });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/openclaw/status") {
      const forceRefresh = url.searchParams.get("refresh") === "1";

      const reply = () => {
        const body = streamService.statusResponseBody();
        if (body) {
          sendJson(res, 200, body);
          return;
        }

        if (streamService.state.latestError) {
          sendJson(res, 502, {
            error: "Failed to query OpenClaw status",
            detail: streamService.state.latestError,
            hint: "Run 'openclaw --no-color status --json' in terminal to verify CLI access.",
          });
          return;
        }

        sendJson(res, 202, {
          status: "warming_up",
          message: "Status poller is starting, retry shortly.",
        });
      };

      if (forceRefresh || !streamService.state.latestPayload) {
        streamService.state.activeHttpRequests += 1;
        streamService.refreshStatus(forceRefresh ? "http-refresh" : "http-warm", { force: forceRefresh })
          .catch(() => null)
          .finally(() => {
            streamService.state.activeHttpRequests = Math.max(0, streamService.state.activeHttpRequests - 1);
            reply();
          });
        return;
      }

      reply();
      return;
    }

    const taskActionMatch = req.method === "POST"
      ? url.pathname.match(/^\/api\/tasks\/([^/]+)\/(retry|resolve)$/)
      : null;

    if (taskActionMatch) {
      const [, encodedTaskId, action] = taskActionMatch;
      const taskId = decodeURIComponent(encodedTaskId);
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk.toString();
        if (raw.length > 1024 * 1024) {
          req.destroy(new Error("payload too large"));
        }
      });

      req.on("end", () => {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
          return;
        }

        upstreamClient.postTaskAction(taskId, action, body)
          .then(async (payload) => {
            streamService.scheduleRefresh(`task-${action}`);
            const [taskRuntime, taskStats] = await Promise.all([
              upstreamClient.fetchTaskRuntimeAsync().catch(() => null),
              upstreamClient.fetchTaskStatsAsync().catch(() => null),
            ]);

            sendJson(res, 200, {
              ok: true,
              data: {
                action,
                taskId,
                upstream: payload?.data || payload || {},
                runtime: taskRuntimeResponseBody(taskRuntime)?.data || null,
                stats: taskStatsResponseBody(taskStats)?.data || null,
              },
            });
          })
          .catch((error) => {
            sendJson(res, 502, {
              ok: false,
              error: "Failed to apply task action",
              detail: error?.message || "Unknown error",
            });
          });
      });

      req.on("error", (error) => {
        sendJson(res, 400, { ok: false, error: error?.message || "Request read failed" });
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/openclaw/agent/turn") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk.toString();
        if (raw.length > 1024 * 1024) {
          req.destroy(new Error("payload too large"));
        }
      });

      req.on("end", () => {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
          return;
        }

        upstreamClient.postAgentTurn(body)
          .then((payload) => {
            streamService.scheduleRefresh("agent-turn");
            sendJson(res, 200, {
              ok: true,
              data: payload?.data || payload || {},
            });
          })
          .catch((error) => {
            sendJson(res, 502, {
              ok: false,
              error: "Failed to send agent task",
              detail: error?.message || "Unknown error",
            });
          });
      });

      req.on("error", (error) => {
        sendJson(res, 400, { ok: false, error: error?.message || "Request read failed" });
      });
      return;
    }

    if (req.method === "GET") {
      if (devStaticMiddleware) {
        devStaticMiddleware.handle(req, res)
          .then(() => {
            if (!res.writableEnded) {
              serveStaticFile(req.url || url.pathname, res, req).catch(() => {
                sendJson(res, 500, { error: "Failed to read static file" });
              });
            }
          })
          .catch(() => {
            if (!res.writableEnded) {
              sendJson(res, 500, { error: "Failed to load development assets" });
            }
          });
        return;
      }

      serveStaticFile(req.url || url.pathname, res, req).catch(() => {
        sendJson(res, 500, { error: "Failed to read static file" });
      });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  });
  const devStaticMiddleware = await createDevStaticMiddleware(config, server);

  createWsGateway(server, config, streamService);
  server.listen(config.port, config.host);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const cleanup = [];
    cleanup.push(new Promise((resolve) => {
      server.close(() => resolve());
    }));

    if (devStaticMiddleware?.close) {
      cleanup.push(devStaticMiddleware.close().catch(() => {}));
    }

    Promise.allSettled(cleanup).finally(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch(() => {
  process.exit(1);
});
