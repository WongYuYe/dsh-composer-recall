const { WebSocketServer } = require("ws");

const { buildRequestOrigin } = require("./config");

function createWsGateway(server, config, streamService) {
  const wss = new WebSocketServer({ noServer: true });
  streamService.attachWebSocketServer(wss);

  server.on("upgrade", (req, socket, head) => {
    let url;

    try {
      url = new URL(req.url, buildRequestOrigin(req, config));
    } catch {
      socket.destroy();
      return;
    }

    if (url.pathname !== config.wsPath) {
      return;
    }

    req._openclawParsedUrl = url;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    ws.isAlive = true;
    ws.missedPongs = 0;
    ws.connectionId = streamService.state.nextConnectionId++;
    ws.connectedAt = Date.now();

    ws.on("pong", () => {
      ws.isAlive = true;
      ws.missedPongs = 0;
    });

    ws.on("close", (code, reason) => {
      void code;
      void reason;
    });

    ws.on("error", () => {});

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw));
        if (message?.type === "refresh") {
          streamService.scheduleRefresh("ws-client-refresh");
        }
      } catch {
        // ignore malformed frames
      }
    });

    const url = req._openclawParsedUrl || new URL(req.url, buildRequestOrigin(req, config));
    const lastEventId = url.searchParams.get("lastEventId");

    streamService.sendWs(ws, {
      type: "hello",
      ts: new Date().toISOString(),
      connectionId: ws.connectionId,
      wsPath: config.wsPath,
      pollIntervalMs: config.statusPollIntervalMs,
      refreshDebounceMs: config.statusRefreshDebounceMs,
      refreshMinIntervalMs: config.statusRefreshMinIntervalMs,
      latestEventId: streamService.state.latestEventId,
      replayWindow: streamService.replayWindowMeta(),
    });

    streamService.replayEventsFrom(ws, lastEventId);
  });

  const pollTimer = setInterval(() => {
    const hasDemand = wss.clients.size > 0 || streamService.state.activeHttpRequests > 0;
    if (hasDemand) {
      streamService.scheduleRefresh("poll");
    }
  }, config.statusPollIntervalMs);

  const wsPingTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.missedPongs = Number(ws.missedPongs || 0) + 1;
        if (ws.missedPongs > config.wsMaxMissedPongs) {
          ws.terminate();
          continue;
        }
      }

      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, config.wsPingIntervalMs);

  pollTimer.unref?.();
  wsPingTimer.unref?.();

  return {
    timers: { pollTimer, wsPingTimer },
    wss,
  };
}

module.exports = {
  createWsGateway,
};
