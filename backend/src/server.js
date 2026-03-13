import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { runOpenClaw } from './openclaw.js';

const app = Fastify({ logger: false });
let manualStateOverride = null;
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

const cfg = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  openclawBin: process.env.OPENCLAW_BIN || 'openclaw',
  openclawProfile: process.env.OPENCLAW_PROFILE || '',
  apiKey: process.env.API_KEY || '',
  requireApiKey: String(process.env.REQUIRE_API_KEY || 'true').toLowerCase() !== 'false',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  enableExecEndpoint: String(process.env.ENABLE_EXEC_ENDPOINT || 'false').toLowerCase() === 'true',
  redactSensitiveOutput: String(process.env.REDACT_SENSITIVE_OUTPUT || 'true').toLowerCase() !== 'false',
  includeCommandInResponse: String(process.env.INCLUDE_COMMAND_IN_RESPONSE || 'false').toLowerCase() === 'true',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 600),
  rateLimitWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  wsStatusIntervalMs: Number(process.env.WS_STATUS_INTERVAL_MS || 5000),
  rawStatusTtlMs: Number(process.env.RAW_STATUS_TTL_MS || 2500),
  rawHealthTtlMs: Number(process.env.RAW_HEALTH_TTL_MS || 3500),
  rawCronTtlMs: Number(process.env.RAW_CRON_TTL_MS || 10000),
};

if (cfg.requireApiKey && !cfg.apiKey) {
  process.exit(1);
}

await app.register(cors, { origin: cfg.corsOrigin === '*' ? true : cfg.corsOrigin });
await app.register(websocket);
await app.register(rateLimit, {
  max: cfg.rateLimitMax,
  timeWindow: cfg.rateLimitWindow,
  errorResponseBuilder: () => ({ ok: false, error: 'rate limit exceeded' }),
});

app.addHook('onRequest', async (req, reply) => {
  if (!cfg.apiKey) return;
  const token = req.headers['x-api-key'] || req.query?.apiKey;
  if (token !== cfg.apiKey) {
    return reply.code(401).send({ ok: false, error: 'unauthorized' });
  }
});

function redactString(input) {
  if (typeof input !== 'string') return input;
  let out = input;
  out = out.replace(/\/Users\/[^/\s]+/g, '/Users/<redacted>');
  out = out.replace(/\/home\/[^/\s]+/g, '/home/<redacted>');
  out = out.replace(/[A-Za-z]:\\\\Users\\\\[^\\\s]+/g, 'C:\\\\Users\\\\<redacted>');
  out = out.replace(/agent:main:telegram:direct:[0-9]+/g, 'agent:main:telegram:direct:<redacted>');
  out = out.replace(/(telegram:)[0-9]+/g, '$1<redacted>');
  return out;
}

function sanitize(value) {
  if (!cfg.redactSensitiveOutput) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (['path', 'paths', 'sessionKey', 'chat_id', 'chatId'].includes(k)) {
        out[k] = '<redacted>';
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

function sendCommand(result, reply) {
  if (!result.ok) {
    return reply.code(500).send({
      ok: false,
      error: sanitize(result.stderr || 'openclaw command failed'),
      ...(cfg.includeCommandInResponse ? { command: sanitize(result.command) } : {}),
    });
  }

  const data = sanitize(result.data ?? result.stdout);
  return {
    ok: true,
    ...(cfg.includeCommandInResponse ? { command: sanitize(result.command) } : {}),
    data,
  };
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}


function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableJson(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function createMergePatch(previous, next) {
  if (Object.is(previous, next)) return null;

  const prevIsObject = previous && typeof previous === 'object' && !Array.isArray(previous);
  const nextIsObject = next && typeof next === 'object' && !Array.isArray(next);

  if (!prevIsObject || !nextIsObject) {
    return next;
  }

  const patch = {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const key of keys) {
    if (!(key in next)) {
      patch[key] = null;
      continue;
    }

    if (!(key in previous)) {
      patch[key] = next[key];
      continue;
    }

    const nested = createMergePatch(previous[key], next[key]);
    if (nested !== null) {
      patch[key] = nested;
    }
  }

  return Object.keys(patch).length ? patch : null;
}

function createWsEventId() {
  wsEventSeq += 1;
  return `evt-${Date.now()}-${wsEventSeq}`;
}

async function collectVisualPayload() {
  if (manualStateOverride) {
    const taskStats = buildTaskStats(null, null);
    const taskRuntime = buildTaskRuntime(null);
    return buildVisualStatus({ status: { sessions: { count: 0 } }, health: null, cron: null, taskStats, taskRuntime });
  }

  const [status, health, cron] = await Promise.all([getStatusRaw(), getHealthRaw(), getCronRaw()]);
  const taskStats = buildTaskStats(status, cron);
  const taskRuntime = buildTaskRuntime(health);
  return buildVisualStatus({ status, health, cron, taskStats, taskRuntime });
}

function sendWsJson(socket, payload) {
  if (socket.readyState !== 1) return false;
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
  const payload = await collectVisualPayload();
  const normalized = stableJson(payload);
  const clients = [...wsClients.values()];

  for (const client of clients) {
    if (client.socket.readyState !== 1) continue;

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
    if (mode === 'patch') wsMetrics.totalPatches += 1;
    else wsMetrics.totalSnapshots += 1;
  }
}

const rawCache = {
  status: { value: null, fetchedAtMs: 0, inFlight: null },
  health: { value: null, fetchedAtMs: 0, inFlight: null },
  cron: { value: null, fetchedAtMs: 0, inFlight: null },
};

function clearRawCaches(keys = Object.keys(rawCache)) {
  for (const key of keys) {
    if (!rawCache[key]) continue;
    rawCache[key].value = null;
    rawCache[key].fetchedAtMs = 0;
    rawCache[key].inFlight = null;
  }
}

async function readCachedRaw(key, ttlMs, loader, options = {}) {
  const { force = false } = options;
  const entry = rawCache[key];
  const now = Date.now();

  if (!force && entry.value && now - entry.fetchedAtMs < ttlMs) {
    return entry.value;
  }

  if (!force && entry.inFlight) {
    return entry.inFlight;
  }

  const task = (async () => {
    const value = await loader();
    if (value !== null && value !== undefined) {
      entry.value = value;
      entry.fetchedAtMs = Date.now();
    }
    return value;
  })();

  entry.inFlight = task;

  try {
    return await task;
  } finally {
    entry.inFlight = null;
  }
}

async function getStatusRaw(options = {}) {
  return readCachedRaw('status', cfg.rawStatusTtlMs, async () => {
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['status', '--json'] });
    return res.ok ? (res.data ?? null) : null;
  }, options);
}

async function getHealthRaw(options = {}) {
  return readCachedRaw('health', cfg.rawHealthTtlMs, async () => {
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['health', '--json'] });
    return res.ok ? (res.data ?? null) : null;
  }, options);
}

async function getCronRaw(options = {}) {
  return readCachedRaw('cron', cfg.rawCronTtlMs, async () => {
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'list', '--json'] });
    return res.ok ? (res.data ?? null) : null;
  }, options);
}

function createManualState(zone, overrides = {}) {
  const updatedAt = overrides.updatedAt || new Date().toISOString();
  const presets = {
    rest: {
      zone: 'rest',
      scene: 'room',
      position: { x: 5, y: 11 },
      taskId: '',
      task: '休息中',
      description: '后端手动状态：休息区',
      mode: 'IDLE',
      alertLevel: 'AMBER',
      queue: 0,
      taskCount: 0,
      progress: 0,
      etaSeconds: null,
      failureReason: '',
      lastError: '',
      availableActions: [],
      updatedAt,
    },
    work: {
      zone: 'work',
      scene: 'room',
      position: { x: 13, y: 7 },
      taskId: 'debug-work-task',
      task: '执行任务中',
      description: '后端手动状态：工作区',
      mode: 'RUNNING',
      alertLevel: 'GREEN',
      queue: 1,
      taskCount: 1,
      progress: 45,
      etaSeconds: 120,
      failureReason: '',
      lastError: '',
      availableActions: ['resolve'],
      updatedAt,
    },
    alarm: {
      zone: 'alarm',
      scene: 'room',
      position: { x: 20, y: 11 },
      taskId: 'debug-alarm-task',
      task: '告警处理中',
      description: '后端手动状态：警报区',
      mode: 'RUNNING',
      alertLevel: 'RED',
      queue: 2,
      taskCount: 2,
      progress: 80,
      etaSeconds: 30,
      failureReason: '任务执行超时，已转人工处理',
      lastError: 'debug-alarm-task failed after timeout',
      availableActions: ['retry', 'resolve'],
      updatedAt,
    },
  };

  return { ...presets[zone], ...overrides, updatedAt };
}

function getManualTaskMeta() {
  if (!manualStateOverride?.taskId) {
    return null;
  }

  return {
    taskId: manualStateOverride.taskId,
    title: manualStateOverride.task,
    progress: manualStateOverride.progress ?? null,
    updatedAt: manualStateOverride.updatedAt,
    startedAt: manualStateOverride.updatedAt,
    etaSeconds: manualStateOverride.etaSeconds ?? null,
    failureReason: manualStateOverride.failureReason || '',
    lastError: manualStateOverride.lastError || '',
    availableActions: Array.isArray(manualStateOverride.availableActions) ? manualStateOverride.availableActions : [],
  };
}

function requireManualTask(req, reply) {
  const taskId = String(req.params?.taskId || '').trim();
  const taskMeta = getManualTaskMeta();

  if (!taskId) {
    reply.code(400).send({ ok: false, error: 'taskId is required' });
    return null;
  }

  if (!taskMeta || taskMeta.taskId !== taskId) {
    reply.code(404).send({ ok: false, error: 'task not found or not actionable' });
    return null;
  }

  return { taskId, taskMeta };
}

function buildTaskStats(status, cron) {
  if (manualStateOverride) {
    const taskMeta = getManualTaskMeta();
    if (manualStateOverride.zone === 'work') {
      return sanitize({
        taskCount: 1,
        total: 1,
        totalTasks: 1,
        todo: 0,
        doing: 1,
        blocked: 0,
        done: 0,
        currentTask: taskMeta
          ? {
              taskId: taskMeta.taskId,
              title: taskMeta.title,
              status: 'doing',
              progress: taskMeta.progress,
              updatedAt: taskMeta.updatedAt,
              availableActions: taskMeta.availableActions,
            }
          : null,
      });
    }

    if (manualStateOverride.zone === 'alarm') {
      return sanitize({
        taskCount: 2,
        total: 2,
        totalTasks: 2,
        todo: 0,
        doing: 1,
        blocked: 1,
        done: 0,
        currentTask: taskMeta
          ? {
              taskId: taskMeta.taskId,
              title: taskMeta.title,
              status: 'blocked',
              progress: taskMeta.progress,
              updatedAt: taskMeta.updatedAt,
              failureReason: taskMeta.failureReason,
              lastError: taskMeta.lastError,
              availableActions: taskMeta.availableActions,
            }
          : null,
      });
    }

    return sanitize({
      taskCount: 0,
      total: 0,
      totalTasks: 0,
      todo: 0,
      doing: 0,
      blocked: 0,
      done: 0,
      currentTask: null,
    });
  }

  const sessions = status?.sessions?.count ?? 0;
  const jobs = cron?.jobs ?? [];
  const enabled = jobs.filter((j) => j.enabled).length;
  const doing = 0;
  const blocked = 0;
  const todo = 0;
  const done = 0;

  return sanitize({
    taskCount: sessions,
    total: sessions,
    totalTasks: sessions,
    todo,
    doing,
    blocked,
    done,
    currentTask: null,
    totalSessions: sessions,
    totalCronJobs: jobs.length,
    enabledCronJobs: enabled,
    disabledCronJobs: jobs.length - enabled,
  });
}

function buildTaskRuntime(health) {
  if (manualStateOverride) {
    const taskMeta = getManualTaskMeta();
    if (manualStateOverride.zone === 'work') {
      return sanitize({
        currentTask: taskMeta
          ? {
              taskId: taskMeta.taskId,
              title: taskMeta.title,
              status: 'running',
              startedAt: taskMeta.startedAt,
              progress: taskMeta.progress,
              etaSeconds: taskMeta.etaSeconds,
              availableActions: taskMeta.availableActions,
            }
          : null,
        nextTask: null,
        queueSummary: { queued: 0, running: 1, failed: 0 },
        uptimeSec: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        openclawHealthy: Boolean(health?.ok),
        now: new Date().toISOString(),
      });
    }

    if (manualStateOverride.zone === 'alarm') {
      return sanitize({
        currentTask: taskMeta
          ? {
              taskId: taskMeta.taskId,
              title: taskMeta.title,
              status: 'failed',
              startedAt: taskMeta.startedAt,
              progress: taskMeta.progress,
              etaSeconds: taskMeta.etaSeconds,
              failureReason: taskMeta.failureReason,
              lastError: taskMeta.lastError,
              availableActions: taskMeta.availableActions,
            }
          : null,
        nextTask: null,
        queueSummary: { queued: 0, running: 1, failed: 1 },
        uptimeSec: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        openclawHealthy: Boolean(health?.ok),
        now: new Date().toISOString(),
      });
    }

    return sanitize({
      currentTask: null,
      nextTask: null,
      queueSummary: { queued: 0, running: 0, failed: 0 },
      uptimeSec: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      openclawHealthy: Boolean(health?.ok),
      now: new Date().toISOString(),
    });
  }

  return sanitize({
    currentTask: null,
    nextTask: null,
    queueSummary: { queued: 0, running: 0, failed: 0 },
    uptimeSec: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    openclawHealthy: Boolean(health?.ok),
    now: new Date().toISOString(),
  });
}

function inferAgentStatus(agentId, recentSession, currentZone, alertLevel) {
  if (!recentSession) {
    return 'idle';
  }

  const ageMs = toFiniteNumber(recentSession.age);
  if (alertLevel === 'RED' && agentId === 'ops') {
    return 'blocked';
  }

  if (ageMs !== null && ageMs < 5 * 60 * 1000) {
    return currentZone === 'rest' && agentId !== 'main' ? 'idle' : 'running';
  }

  return 'idle';
}

function buildAgentStates(status, currentZone, alertLevel) {
  const configuredAgents = Array.isArray(status?.heartbeat?.agents) ? status.heartbeat.agents : [];
  const recentSessions = Array.isArray(status?.sessions?.recent) ? status.sessions.recent : [];
  const recentByAgent = new Map();

  for (const session of recentSessions) {
    const agentId = String(session?.agentId || '').trim();
    if (!agentId || recentByAgent.has(agentId)) continue;
    recentByAgent.set(agentId, session);
  }

  const defaultZones = {
    main: currentZone === 'alarm' ? 'alarm' : 'work',
    research: currentZone === 'work' ? 'work' : 'rest',
    executor: currentZone === 'work' ? 'work' : 'rest',
    ops: currentZone === 'alarm' ? 'alarm' : 'rest',
  };

  return configuredAgents.map((agent, index) => {
    const agentId = String(agent?.agentId || '').trim();
    const recent = recentByAgent.get(agentId) || null;
    return {
      id: agentId,
      name: agentId,
      enabled: Boolean(agent?.enabled),
      heartbeatEvery: agent?.every || '',
      heartbeatEveryMs: agent?.everyMs ?? null,
      zone: defaultZones[agentId] || (index % 2 === 0 ? 'work' : 'rest'),
      status: inferAgentStatus(agentId, recent, currentZone, alertLevel),
      session: recent
        ? {
            key: recent.key || '',
            updatedAt: recent.updatedAt || null,
            age: recent.age ?? null,
            percentUsed: recent.percentUsed ?? null,
            model: recent.model || '',
          }
        : null,
    };
  });
}

function buildVisualStatus({ status, health, cron, taskStats, taskRuntime }) {
  const sessionsCount = status?.sessions?.count ?? 0;
  if (manualStateOverride) {
    return sanitize({
      zone: manualStateOverride.zone,
      scene: manualStateOverride.scene,
      position: manualStateOverride.position,
      task: manualStateOverride.task,
      description: manualStateOverride.description,
      mode: manualStateOverride.mode,
      alertLevel: manualStateOverride.alertLevel,
      queue: manualStateOverride.queue,
      taskCount: manualStateOverride.taskCount,
      openclaw: {
        tasks: taskStats,
        runtime: taskRuntime,
        summary: {
          sessions: sessionsCount,
          override: true,
          overrideUpdatedAt: manualStateOverride.updatedAt,
        },
      },
      raw: { status, health, cron },
    });
  }
  const heartbeatEvery = status?.heartbeat?.agents?.[0]?.every ?? null;
  const channels = Array.isArray(status?.channelSummary) ? status.channelSummary : [];
  const cronJobs = cron?.total ?? cron?.jobs?.length ?? 0;

  const running = taskRuntime?.queueSummary?.running ?? taskStats?.doing ?? 0;
  const failed = taskRuntime?.queueSummary?.failed ?? taskStats?.blocked ?? 0;
  const queued = taskRuntime?.queueSummary?.queued ?? taskStats?.todo ?? 0;

  const zone = failed > 0 ? 'alarm' : running > 0 ? 'work' : 'rest';
  const scene = zone === 'rest' ? 'room' : 'room';
  const alertLevel = failed > 0 ? 'RED' : running > 0 ? 'GREEN' : 'AMBER';
  const task = taskRuntime?.currentTask?.title || (zone === 'work' ? '执行任务中' : zone === 'alarm' ? '告警处理' : '休息中');
  const agents = buildAgentStates(status, zone, alertLevel);

  return sanitize({
    zone,
    scene,
    position: zone === 'work' ? { x: 13, y: 7 } : zone === 'alarm' ? { x: 20, y: 11 } : { x: 5, y: 11 },
    task,
    description: `队列：排队 ${queued} 项 · 运行中 ${running} 项 · 失败 ${failed} 项`,
    mode: running > 0 ? 'RUNNING' : 'IDLE',
    alertLevel,
    queue: queued,
    taskCount: taskStats?.taskCount ?? sessionsCount,
    openclaw: {
      agents,
      tasks: taskStats,
      runtime: taskRuntime,
      summary: {
        sessions: sessionsCount,
        cronJobs,
        heartbeatEvery,
        channels,
        gatewayOk: Boolean(health?.ok),
      },
    },
    raw: {
      status,
      health,
      cron,
    },
  });
}

app.get('/health', async () => ({ ok: true, service: 'openclaw-visual-backend' }));

app.post('/api/debug/state', async (req, reply) => {
  const zone = String(req.body?.zone || '').toLowerCase();
  const allowed = new Set(['rest', 'work', 'alarm', 'clear']);
  if (!allowed.has(zone)) return reply.code(400).send({ ok: false, error: 'zone must be rest|work|alarm|clear' });

  if (zone === 'clear') {
    manualStateOverride = null;
    clearRawCaches();
    return { ok: true, data: { override: false } };
  }

  manualStateOverride = createManualState(zone);
  clearRawCaches();
  return { ok: true, data: { override: true, state: manualStateOverride } };
});

app.post('/api/tasks/:taskId/retry', async (req, reply) => {
  const required = requireManualTask(req, reply);
  if (!required) return;

  if (manualStateOverride?.zone !== 'alarm') {
    return reply.code(409).send({ ok: false, error: 'retry is only available for alarm tasks' });
  }

  manualStateOverride = createManualState('work', {
    taskId: required.taskId,
    task: '重试执行中',
    description: `失败任务 ${required.taskId} 已重新投入执行。`,
    progress: 15,
    etaSeconds: 180,
    availableActions: ['resolve'],
  });
  clearRawCaches();

  return {
    ok: true,
    data: {
      action: 'retry',
      taskId: required.taskId,
      state: manualStateOverride,
    },
  };
});

app.post('/api/tasks/:taskId/resolve', async (req, reply) => {
  const required = requireManualTask(req, reply);
  if (!required) return;

  manualStateOverride = createManualState('rest', {
    task: '已恢复待命',
    description: `任务 ${required.taskId} 已处理完成，系统恢复待命。`,
  });
  clearRawCaches();

  return {
    ok: true,
    data: {
      action: 'resolve',
      taskId: required.taskId,
      state: manualStateOverride,
    },
  };
});

app.get('/api/openclaw/status', async (_, reply) => {
  const data = await collectVisualPayload();
  if (!data) return reply.code(500).send({ ok: false, error: 'failed to read openclaw status' });
  return { ok: true, data };
});

app.get('/api/openclaw/diagnostics', async () => ({
  ok: true,
  data: {
    ws: buildWsDiagnostics(),
    cache: sanitize(Object.fromEntries(Object.entries(rawCache).map(([key, entry]) => [key, {
      cached: Boolean(entry.value),
      fetchedAtMs: entry.fetchedAtMs || 0,
      inFlight: Boolean(entry.inFlight),
    }]))),
    manualOverride: sanitize(manualStateOverride),
  },
}));

app.get('/api/openclaw/status/raw', async (_, reply) => {
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['status', '--json'] });
  return sendCommand(res, reply);
});

app.get('/api/openclaw/health', async (_, reply) => {
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['health', '--json'] });
  return sendCommand(res, reply);
});

app.get('/api/tasks/stats', async () => {
  if (manualStateOverride) {
    return { ok: true, data: buildTaskStats(null, null) };
  }

  const [status, cron] = await Promise.all([getStatusRaw(), getCronRaw()]);
  return { ok: true, data: buildTaskStats(status, cron) };
});

app.get('/api/tasks/runtime', async () => {
  if (manualStateOverride) {
    return { ok: true, data: buildTaskRuntime(null) };
  }

  const health = await getHealthRaw();
  return { ok: true, data: buildTaskRuntime(health) };
});

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

app.get('/api/openclaw/sessions', async (req, reply) => {
  const args = ['sessions', '--json'];
  if (req.query?.active) args.push('--active', String(req.query.active));
  if (req.query?.agent) args.push('--agent', String(req.query.agent));
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args });
  return sendCommand(res, reply);
});

app.get('/api/openclaw/cron', async (_, reply) => {
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'list', '--json'] });
  return sendCommand(res, reply);
});

app.get('/api/openclaw/cron/status', async (_, reply) => {
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'status', '--json'] });
  return sendCommand(res, reply);
});

app.post('/api/openclaw/cron/run/:jobId', async (req, reply) => {
  const { jobId } = req.params;
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'run', jobId, '--json'] });
  return sendCommand(res, reply);
});

app.post('/api/openclaw/cron/enable/:jobId', async (req, reply) => {
  const { jobId } = req.params;
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'enable', jobId, '--json'] });
  return sendCommand(res, reply);
});

app.post('/api/openclaw/cron/disable/:jobId', async (req, reply) => {
  const { jobId } = req.params;
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'disable', jobId, '--json'] });
  return sendCommand(res, reply);
});

app.delete('/api/openclaw/cron/:jobId', async (req, reply) => {
  const { jobId } = req.params;
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['cron', 'rm', jobId, '--json'] });
  return sendCommand(res, reply);
});

app.post('/api/openclaw/agent/turn', async (req, reply) => {
  const message = req.body?.message;
  const to = req.body?.to;
  const agent = req.body?.agent;

  if (!message) return reply.code(400).send({ ok: false, error: 'message is required' });

  const args = ['agent', '--json', '--message', String(message)];
  if (to) args.push('--to', String(to));
  if (agent) args.push('--agent', String(agent));

  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args });
  return sendCommand(res, reply);
});

app.post('/api/openclaw/exec', async (req, reply) => {
  if (!cfg.enableExecEndpoint) {
    return reply.code(403).send({ ok: false, error: 'exec endpoint disabled (set ENABLE_EXEC_ENDPOINT=true to enable)' });
  }

  const command = req.body?.command;
  if (!command) return reply.code(400).send({ ok: false, error: 'command is required' });

  const unsafe = ['rm -rf', ':(){', 'mkfs', 'shutdown', 'reboot'];
  if (unsafe.some((x) => String(command).includes(x))) {
    return reply.code(400).send({ ok: false, error: 'blocked by safety guard' });
  }

  const split = String(command).trim().split(/\s+/);
  const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: split });
  return sendCommand(res, reply);
});

app.listen({ port: cfg.port, host: cfg.host })
  .catch((err) => {
    void err;
    process.exit(1);
  });
