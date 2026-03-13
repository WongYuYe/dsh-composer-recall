const {
  countPatchLeaves,
  createMergePatch,
  deepClone,
} = require("./utils");

function createStreamService(config, upstreamClient, dashboardHelpers) {
  const streamState = {
    latestPayload: null,
    latestError: null,
    latestUpdatedAtMs: 0,
    latestFetchDurationMs: 0,
    latestSignature: "",
    publishedPayload: null,
    latestEventId: 0,
    nextEventId: 1,
    nextConnectionId: 1,
    events: [],
    fetchInFlight: null,
    lastRefreshStartedAtMs: 0,
    refreshDebounceTimer: null,
    pendingRefreshReasons: new Set(),
    refreshQueued: false,
    activeHttpRequests: 0,
  };

  let wsServer = null;

  function attachWebSocketServer(server) {
    wsServer = server;
  }

  function nextEventId() {
    const id = streamState.nextEventId;
    streamState.nextEventId += 1;
    return id;
  }

  function sendWs(ws, payload) {
    if (ws.readyState !== 1) {
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  function broadcastWs(payload) {
    if (!wsServer) {
      return;
    }

    const raw = JSON.stringify(payload);
    for (const client of wsServer.clients) {
      if (client.readyState === 1) {
        client.send(raw);
      }
    }
  }

  function appendEvent(event) {
    streamState.events.push(event);
    if (streamState.events.length > config.eventBufferSize) {
      streamState.events.splice(0, streamState.events.length - config.eventBufferSize);
    }
    streamState.latestEventId = event.eventId;
  }

  function emitEvent(event) {
    appendEvent(event);
    broadcastWs(event);
  }

  function replayWindowMeta() {
    const first = streamState.events[0]?.eventId ?? null;
    const last = streamState.events[streamState.events.length - 1]?.eventId ?? streamState.latestEventId ?? null;

    return {
      from: first,
      to: last,
      count: streamState.events.length,
    };
  }

  function replayEventsFrom(ws, lastEventIdRaw) {
    const hasLastEventId =
      lastEventIdRaw !== null &&
      lastEventIdRaw !== undefined &&
      String(lastEventIdRaw).trim() !== "";

    if (!hasLastEventId) {
      if (streamState.latestPayload) {
        sendWs(ws, {
          type: "status",
          mode: "snapshot",
          eventId: streamState.latestEventId,
          ts: new Date().toISOString(),
          replay: false,
          reason: "connect-snapshot",
          payload: streamState.latestPayload,
        });
      }
      return;
    }

    const lastEventId = Number(lastEventIdRaw);
    if (!Number.isInteger(lastEventId) || lastEventId < 0) {
      sendWs(ws, {
        type: "replay_reset",
        ts: new Date().toISOString(),
        reason: "invalid_last_event_id",
        replayWindow: replayWindowMeta(),
      });

      if (streamState.latestPayload) {
        sendWs(ws, {
          type: "status",
          mode: "snapshot",
          eventId: streamState.latestEventId,
          ts: new Date().toISOString(),
          replay: true,
          reason: "invalid-last-event-id-snapshot",
          payload: streamState.latestPayload,
        });
      }
      return;
    }

    if (streamState.events.length === 0) {
      if (streamState.latestPayload) {
        sendWs(ws, {
          type: "status",
          mode: "snapshot",
          eventId: streamState.latestEventId,
          ts: new Date().toISOString(),
          replay: true,
          reason: "snapshot-empty-buffer",
          payload: streamState.latestPayload,
        });
      }
      return;
    }

    const latestKnownEventId = streamState.events[streamState.events.length - 1]?.eventId ?? streamState.latestEventId ?? 0;
    if (lastEventId > latestKnownEventId) {
      sendWs(ws, {
        type: "replay_reset",
        ts: new Date().toISOString(),
        reason: "cursor_ahead_of_server",
        replayWindow: replayWindowMeta(),
      });

      if (streamState.latestPayload) {
        sendWs(ws, {
          type: "status",
          mode: "snapshot",
          eventId: streamState.latestEventId,
          ts: new Date().toISOString(),
          replay: true,
          reason: "cursor-ahead-snapshot",
          payload: streamState.latestPayload,
        });
      }
      return;
    }

    const firstId = streamState.events[0].eventId;
    if (lastEventId < firstId - 1) {
      sendWs(ws, {
        type: "replay_reset",
        ts: new Date().toISOString(),
        reason: "history_pruned",
        replayWindow: replayWindowMeta(),
      });

      if (streamState.latestPayload) {
        sendWs(ws, {
          type: "status",
          mode: "snapshot",
          eventId: streamState.latestEventId,
          ts: new Date().toISOString(),
          replay: true,
          reason: "replay-reset-snapshot",
          payload: streamState.latestPayload,
        });
      }
      return;
    }

    const missed = streamState.events.filter((event) => event.eventId > lastEventId);
    for (const event of missed) {
      sendWs(ws, { ...event, replay: true });
    }
  }

  function buildStatusSnapshotEvent(payload, reason, fetchDurationMs) {
    return {
      type: "status",
      mode: "snapshot",
      eventId: nextEventId(),
      ts: new Date().toISOString(),
      reason,
      fetchDurationMs,
      payload,
    };
  }

  function buildStatusPatchEvent(patch, reason, fetchDurationMs, baseEventId) {
    return {
      type: "status",
      mode: "patch",
      eventId: nextEventId(),
      baseEventId,
      ts: new Date().toISOString(),
      reason,
      fetchDurationMs,
      patch,
      patchLeafCount: countPatchLeaves(patch),
    };
  }

  async function refreshStatus(reason = "poll", options = {}) {
    const { force = false } = options;

    if (streamState.fetchInFlight) {
      if (force) {
        streamState.refreshQueued = true;
      }
      return streamState.fetchInFlight;
    }

    const run = (async () => {
      const startedAt = Date.now();

      try {
        const [rawStatus, externalTaskStats, externalTaskRuntime] = await Promise.all([
          upstreamClient.fetchOpenclawStatusAsync(),
          upstreamClient.fetchTaskStatsAsync().catch(() => null),
          upstreamClient.fetchTaskRuntimeAsync().catch(() => null),
        ]);
        const payload = dashboardHelpers.toDashboardPayload(rawStatus, externalTaskStats, externalTaskRuntime);
        const signature = JSON.stringify(payload);

        streamState.latestPayload = payload;
        streamState.latestError = null;
        streamState.latestUpdatedAtMs = Date.now();
        streamState.latestFetchDurationMs = Date.now() - startedAt;

        if (!streamState.publishedPayload) {
          emitEvent(buildStatusSnapshotEvent(payload, reason, streamState.latestFetchDurationMs));
        } else {
          const patch = createMergePatch(streamState.publishedPayload, payload);
          if (patch !== undefined) {
            emitEvent(buildStatusPatchEvent(
              patch,
              reason,
              streamState.latestFetchDurationMs,
              streamState.latestEventId,
            ));
          }
        }

        streamState.publishedPayload = deepClone(payload);
        streamState.latestSignature = signature;

        return payload;
      } catch (error) {
        streamState.latestError = error.message;
        streamState.latestFetchDurationMs = Date.now() - startedAt;

        emitEvent({
          type: "error",
          eventId: nextEventId(),
          ts: new Date().toISOString(),
          reason,
          error: error.message,
        });

        throw error;
      } finally {
        streamState.fetchInFlight = null;

        if (streamState.refreshQueued) {
          streamState.refreshQueued = false;
          scheduleRefresh("queued");
        }
      }
    })();

    streamState.fetchInFlight = run;
    return run;
  }

  function scheduleRefresh(reason = "manual") {
    streamState.pendingRefreshReasons.add(reason);

    if (streamState.refreshDebounceTimer) {
      clearTimeout(streamState.refreshDebounceTimer);
    }

    streamState.refreshDebounceTimer = setTimeout(async () => {
      streamState.refreshDebounceTimer = null;

      if (streamState.fetchInFlight) {
        streamState.refreshQueued = true;
        return;
      }

      const elapsed = Date.now() - streamState.lastRefreshStartedAtMs;
      if (elapsed < config.statusRefreshMinIntervalMs) {
        streamState.refreshDebounceTimer = setTimeout(() => {
          scheduleRefresh("throttled");
        }, config.statusRefreshMinIntervalMs - elapsed);
        return;
      }

      const mergedReason = Array.from(streamState.pendingRefreshReasons).join("+") || reason;
      streamState.pendingRefreshReasons.clear();
      streamState.lastRefreshStartedAtMs = Date.now();

      try {
        await refreshStatus(mergedReason);
      } catch {
        // latestError is already set on failure
      }
    }, config.statusRefreshDebounceMs);
  }

  function statusResponseBody() {
    if (!streamState.latestPayload) {
      return null;
    }

    return {
      ...streamState.latestPayload,
      _meta: {
        source: "cache",
        ageMs: Math.max(0, Date.now() - streamState.latestUpdatedAtMs),
        fetchDurationMs: streamState.latestFetchDurationMs,
        pollIntervalMs: config.statusPollIntervalMs,
        requestDebounceMs: config.statusRefreshDebounceMs,
        requestMinIntervalMs: config.statusRefreshMinIntervalMs,
        wsPath: config.wsPath,
        lastEventId: streamState.latestEventId,
        replayWindow: replayWindowMeta(),
      },
    };
  }

  function diagnosticsResponseBody() {
    return {
      ok: true,
      data: {
        ws: {
          path: config.wsPath,
          clients: wsServer
            ? [...wsServer.clients].map((ws) => ({
                connectionId: ws.connectionId,
                connectedAt: ws.connectedAt ? new Date(ws.connectedAt).toISOString() : null,
                isAlive: Boolean(ws.isAlive),
                missedPongs: Number(ws.missedPongs || 0),
              }))
            : [],
          activeConnections: wsServer?.clients?.size || 0,
          replayWindow: replayWindowMeta(),
          latestEventId: streamState.latestEventId,
        },
        stream: {
          latestUpdatedAt: streamState.latestPayload?.updatedAt || null,
          latestFetchDurationMs: streamState.latestFetchDurationMs,
          latestError: streamState.latestError,
          latestSignature: streamState.latestSignature,
          hasPayload: Boolean(streamState.latestPayload),
          fetchInFlight: Boolean(streamState.fetchInFlight),
        },
        upstream: {
          statusCandidates: upstreamClient.getStatusEndpointCandidates(),
          taskStatsCandidates: upstreamClient.getTaskStatsCandidates(),
          taskRuntimeCandidates: upstreamClient.getTaskRuntimeCandidates(),
        },
      },
    };
  }

  return {
    attachWebSocketServer,
    diagnosticsResponseBody,
    replayEventsFrom,
    replayWindowMeta,
    refreshStatus,
    scheduleRefresh,
    sendWs,
    state: streamState,
    statusResponseBody,
  };
}

module.exports = {
  createStreamService,
};
