export function createWsStatusService({ cfg, sanitize, stableJson, createMergePatch, collectVisualPayload }) {
  let wsConnectionSeq = 0;
  let wsEventSeq = 0;
  const wsClients = new Map();
  const wsMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    totalSnapshots: 0,
    totalPatches: 0,
    totalErrors: 0,
    lastBroadcastAt: '',
    lastError: '',
  };

  function createWsEventId() {
    wsEventSeq += 1;
    return `evt-${Date.now()}-${wsEventSeq}`;
  }

  function sendWsJson(socket, payload) {
    if (socket.readyState !== 1) {
      return false;
    }

    socket.send(JSON.stringify(payload));
    wsMetrics.totalMessages += 1;
    wsMetrics.lastBroadcastAt = new Date().toISOString();
    return true;
  }

  function buildWsDiagnostics() {
    return sanitize({
      intervalMs: cfg.wsStatusIntervalMs,
      activeConnections: wsMetrics.activeConnections,
      totalConnections: wsMetrics.totalConnections,
      totalMessages: wsMetrics.totalMessages,
      totalSnapshots: wsMetrics.totalSnapshots,
      totalPatches: wsMetrics.totalPatches,
      totalErrors: wsMetrics.totalErrors,
      lastBroadcastAt: wsMetrics.lastBroadcastAt || null,
      lastError: wsMetrics.lastError || null,
      clients: [...wsClients.values()].map((client) => ({
        connectionId: client.connectionId,
        connectedAt: client.connectedAt,
        lastSentAt: client.lastSentAt || null,
        lastEventId: client.lastEventId || null,
        mode: client.lastPayload ? 'warm' : 'cold',
      })),
    });
  }

  async function broadcastVisualStatus(reason = 'interval') {
    const clients = [...wsClients.values()].filter((client) => client.socket.readyState === 1);
    if (clients.length === 0) {
      return null;
    }

    const payload = await collectVisualPayload();
    const normalized = stableJson(payload);

    for (const client of clients) {
      let mode = 'snapshot';
      let patch = null;
      if (client.lastPayload) {
        patch = createMergePatch(client.lastPayload, normalized);
        if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
          mode = 'patch';
        } else if (patch === null) {
          mode = 'patch';
          patch = {};
        }
      }

      const eventId = createWsEventId();
      const message = mode === 'patch'
        ? { type: 'status', mode, reason, ts: new Date().toISOString(), eventId, baseEventId: client.lastEventId || '', patch }
        : { type: 'status', mode: 'snapshot', reason, ts: new Date().toISOString(), eventId, data: payload };

      sendWsJson(client.socket, message);
      client.lastEventId = eventId;
      client.lastPayload = normalized;
      client.lastSentAt = new Date().toISOString();
      if (mode === 'patch') {
        wsMetrics.totalPatches += 1;
      } else {
        wsMetrics.totalSnapshots += 1;
      }
    }
  }

  function register(app) {
    app.get('/ws/openclaw/status', { websocket: true }, (socket) => {
      const connectionId = ++wsConnectionSeq;
      const client = {
        connectionId,
        socket,
        connectedAt: new Date().toISOString(),
        lastSentAt: '',
        lastEventId: '',
        lastPayload: null,
      };

      wsClients.set(connectionId, client);
      wsMetrics.totalConnections += 1;
      wsMetrics.activeConnections = wsClients.size;

      sendWsJson(socket, {
        type: 'hello',
        connectionId,
        latestEventId: '',
        ts: new Date().toISOString(),
        diagnostics: buildWsDiagnostics(),
      });

      broadcastVisualStatus('connect').catch((error) => {
        wsMetrics.totalErrors += 1;
        wsMetrics.lastError = String(error?.message || error);
      });

      socket.on('close', () => {
        wsClients.delete(connectionId);
        wsMetrics.activeConnections = wsClients.size;
      });

      socket.on('error', (error) => {
        wsMetrics.totalErrors += 1;
        wsMetrics.lastError = String(error?.message || error);
      });
    });

    setInterval(() => {
      broadcastVisualStatus('interval').catch((error) => {
        wsMetrics.totalErrors += 1;
        wsMetrics.lastError = String(error?.message || error);
      });
    }, cfg.wsStatusIntervalMs).unref();
  }

  return {
    buildWsDiagnostics,
    broadcastVisualStatus,
    register,
  };
}
