import fs from 'node:fs';

import { toFiniteNumber } from '../lib/value-utils.js';

export function createVisualStateService({ cfg, sanitize, rawCacheService }) {
  let manualStateOverride = null;
  let manualAgentOverrides = new Map();
  let configuredAgentsCache = {
    filePath: '',
    mtimeMs: 0,
    agents: [],
  };

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

  function normalizeAgentId(value) {
    return String(value || '').trim();
  }

  function deriveFallbackZoneFromStatus(status) {
    const raw = String(status?.zone || status?.currentZone || '').trim().toLowerCase();
    if (raw.includes('alarm') || raw.includes('alert')) {
      return 'alarm';
    }
    if (raw.includes('work')) {
      return 'work';
    }
    if (raw.includes('rest') || raw.includes('idle')) {
      return 'rest';
    }

    return (status?.sessions?.count ?? 0) > 0 ? 'work' : 'rest';
  }

  function deriveFallbackAlertLevel(status) {
    const explicit = String(status?.alertLevel || status?.alert || '').trim().toUpperCase();
    if (['GREEN', 'BLUE', 'AMBER', 'RED', 'OFFLINE'].includes(explicit)) {
      return explicit;
    }

    return 'GREEN';
  }

  function buildAgentTaskFromState(agent) {
    if (!agent?.id) {
      return null;
    }

    const override = manualAgentOverrides.get(agent.id) || null;
    const baseStatus = String(override?.taskStatus || override?.status || agent.status || '').trim().toLowerCase();
    const taskStatus = baseStatus === 'running'
      ? 'doing'
      : baseStatus === 'failed'
        ? 'blocked'
        : baseStatus === 'idle'
          ? 'todo'
          : baseStatus || 'todo';
    const title = String(
      override?.task
      || override?.title
      || agent.session?.key
      || (taskStatus === 'blocked'
        ? '告警处理中'
        : taskStatus === 'doing'
          ? '执行任务中'
          : agent.enabled === false
            ? '已停用'
            : '待命中'),
    ).trim();
    const availableActions = Array.isArray(override?.availableActions)
      ? override.availableActions
      : taskStatus === 'blocked'
        ? ['retry', 'resolve']
        : taskStatus === 'doing'
          ? ['resolve']
          : [];
    const updatedAt = override?.updatedAt || agent.session?.updatedAt || new Date().toISOString();
    const progress = override?.progress ?? agent.session?.percentUsed ?? null;
    const failureReason = String(
      override?.failureReason
      || (taskStatus === 'blocked' ? '任务执行异常，等待处理。' : ''),
    ).trim();
    const lastError = String(
      override?.lastError
      || (taskStatus === 'blocked' ? `${agent.id} task is currently blocked` : ''),
    ).trim();
    const shouldExpose = Boolean(
      override
      || agent.session?.key
      || agent.active
      || taskStatus === 'blocked'
      || availableActions.length > 0,
    );

    if (!shouldExpose) {
      return null;
    }

    return {
      taskId: String(override?.taskId || `agent-task-${agent.id}`),
      agentId: agent.id,
      assignee: agent.id,
      title,
      status: taskStatus,
      progress,
      updatedAt,
      startedAt: override?.startedAt || updatedAt,
      etaSeconds: override?.etaSeconds ?? null,
      failureReason,
      lastError,
      availableActions,
    };
  }

  function buildAgentTaskSnapshot(status, currentZone, alertLevel) {
    const agentState = buildAgentStates(status, currentZone, alertLevel);
    const taskList = agentState.items
      .map((agent) => buildAgentTaskFromState(agent))
      .filter(Boolean);
    const currentTask = taskList.find((task) => task.status === 'blocked')
      || taskList.find((task) => task.status === 'doing')
      || null;
    const nextTask = taskList.find((task) => task.status === 'todo')
      || null;
    const doing = taskList.filter((task) => task.status === 'doing').length;
    const blocked = taskList.filter((task) => task.status === 'blocked').length;
    const todo = taskList.filter((task) => task.status === 'todo').length;

    return {
      agentState,
      taskList,
      currentTask,
      nextTask,
      counts: {
        total: taskList.length,
        todo,
        doing,
        blocked,
        done: 0,
      },
    };
  }

  async function resolveActionableTask(taskId, preferredAgentId = '') {
    const normalizedTaskId = String(taskId || '').trim();
    if (!normalizedTaskId) {
      return null;
    }

    const manualTask = getManualTaskMeta();
    if (manualTask?.taskId === normalizedTaskId) {
      return {
        taskId: normalizedTaskId,
        agentId: normalizeAgentId(preferredAgentId),
        taskMeta: manualTask,
      };
    }

    const [status, health, cron] = await Promise.all([
      rawCacheService.getStatusRaw().catch(() => null),
      rawCacheService.getHealthRaw().catch(() => null),
      rawCacheService.getCronRaw().catch(() => null),
    ]);
    const currentZone = deriveFallbackZoneFromStatus(status);
    const alertLevel = deriveFallbackAlertLevel(status);
    const taskStats = buildTaskStats(status, cron, currentZone, alertLevel);
    const taskRuntime = buildTaskRuntime(health, status, currentZone, alertLevel);
    const candidates = [
      ...(Array.isArray(taskStats?.taskList) ? taskStats.taskList : []),
      taskRuntime?.currentTask || null,
      taskRuntime?.nextTask || null,
    ].filter(Boolean);
    const normalizedAgentId = normalizeAgentId(preferredAgentId);
    const taskMeta = candidates.find((item) => {
      if (item.taskId !== normalizedTaskId) {
        return false;
      }

      return !normalizedAgentId || normalizeAgentId(item.agentId) === normalizedAgentId;
    }) || candidates.find((item) => item.taskId === normalizedTaskId) || null;

    if (!taskMeta) {
      return null;
    }

    return {
      taskId: normalizedTaskId,
      agentId: normalizeAgentId(taskMeta.agentId || normalizedAgentId),
      taskMeta,
    };
  }

  async function requireActionableTask(req, reply) {
    const taskId = String(req.params?.taskId || '').trim();
    const preferredAgentId = normalizeAgentId(req.body?.agentId);

    if (!taskId) {
      reply.code(400).send({ ok: false, error: 'taskId is required' });
      return null;
    }

    const resolved = await resolveActionableTask(taskId, preferredAgentId);
    if (!resolved) {
      reply.code(404).send({ ok: false, error: 'task not found or not actionable' });
      return null;
    }

    return resolved;
  }

  function setManualAgentOverride(agentId, nextState = {}) {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) {
      return null;
    }

    manualStateOverride = null;
    manualAgentOverrides.set(normalizedAgentId, {
      agentId: normalizedAgentId,
      taskId: nextState.taskId || `agent-task-${normalizedAgentId}`,
      updatedAt: nextState.updatedAt || new Date().toISOString(),
      ...nextState,
    });
    rawCacheService.clearRawCaches();
    return manualAgentOverrides.get(normalizedAgentId);
  }

  function buildTaskStats(status, cron, currentZone = deriveFallbackZoneFromStatus(status), alertLevel = deriveFallbackAlertLevel(status)) {
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
          currentTask: taskMeta ? {
            taskId: taskMeta.taskId,
            title: taskMeta.title,
            status: 'doing',
            progress: taskMeta.progress,
            updatedAt: taskMeta.updatedAt,
            availableActions: taskMeta.availableActions,
          } : null,
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
          currentTask: taskMeta ? {
            taskId: taskMeta.taskId,
            title: taskMeta.title,
            status: 'blocked',
            progress: taskMeta.progress,
            updatedAt: taskMeta.updatedAt,
            failureReason: taskMeta.failureReason,
            lastError: taskMeta.lastError,
            availableActions: taskMeta.availableActions,
          } : null,
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
    const enabled = jobs.filter((job) => job.enabled).length;
    const snapshot = buildAgentTaskSnapshot(status, currentZone, alertLevel);

    return sanitize({
      taskCount: snapshot.counts.total || sessions,
      total: snapshot.counts.total || sessions,
      totalTasks: snapshot.counts.total || sessions,
      todo: snapshot.counts.todo,
      doing: snapshot.counts.doing,
      blocked: snapshot.counts.blocked,
      done: 0,
      currentTask: snapshot.currentTask,
      taskList: snapshot.taskList,
      totalSessions: sessions,
      totalCronJobs: jobs.length,
      enabledCronJobs: enabled,
      disabledCronJobs: jobs.length - enabled,
    });
  }

  function buildTaskRuntime(health, status = null, currentZone = deriveFallbackZoneFromStatus(status), alertLevel = deriveFallbackAlertLevel(status)) {
    if (manualStateOverride) {
      const taskMeta = getManualTaskMeta();
      if (manualStateOverride.zone === 'work') {
        return sanitize({
          currentTask: taskMeta ? {
            taskId: taskMeta.taskId,
            title: taskMeta.title,
            status: 'running',
            startedAt: taskMeta.startedAt,
            progress: taskMeta.progress,
            etaSeconds: taskMeta.etaSeconds,
            availableActions: taskMeta.availableActions,
          } : null,
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
          currentTask: taskMeta ? {
            taskId: taskMeta.taskId,
            title: taskMeta.title,
            status: 'failed',
            startedAt: taskMeta.startedAt,
            progress: taskMeta.progress,
            etaSeconds: taskMeta.etaSeconds,
            failureReason: taskMeta.failureReason,
            lastError: taskMeta.lastError,
            availableActions: taskMeta.availableActions,
          } : null,
          nextTask: null,
          queueSummary: { queued: 0, running: 1, failed: 1 },
          uptimeSec: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          openclawHealthy: Boolean(health?.ok),
          now: new Date().toISOString(),
        });
      }
    }

    const snapshot = buildAgentTaskSnapshot(status, currentZone, alertLevel);

    return sanitize({
      currentTask: snapshot.currentTask,
      nextTask: snapshot.nextTask,
      queueSummary: {
        queued: snapshot.counts.todo,
        running: snapshot.counts.doing,
        failed: snapshot.counts.blocked,
      },
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

  function loadConfiguredAgentsFallback() {
    const filePath = String(cfg?.openclawConfigPath || '').trim();
    if (!filePath) {
      return [];
    }

    try {
      const stats = fs.statSync(filePath);
      if (
        configuredAgentsCache.filePath === filePath
        && configuredAgentsCache.mtimeMs === stats.mtimeMs
        && Array.isArray(configuredAgentsCache.agents)
      ) {
        return configuredAgentsCache.agents;
      }

      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const list = Array.isArray(payload?.agents?.list) ? payload.agents.list : [];
      const agents = list
        .map((agent) => ({
          agentId: String(agent?.agentId || agent?.id || '').trim(),
          enabled: agent?.enabled !== false,
          every: agent?.every || '',
          everyMs: agent?.everyMs ?? null,
        }))
        .filter((agent) => agent.agentId);

      configuredAgentsCache = {
        filePath,
        mtimeMs: stats.mtimeMs,
        agents,
      };

      return agents;
    } catch {
      return configuredAgentsCache.filePath === filePath ? configuredAgentsCache.agents : [];
    }
  }

  function buildAgentStates(status, currentZone, alertLevel) {
    const hasHeartbeatAgents = Array.isArray(status?.heartbeat?.agents) && status.heartbeat.agents.length > 0;
    const configuredAgents = hasHeartbeatAgents
      ? status.heartbeat.agents
      : loadConfiguredAgentsFallback();
    const recentSessions = Array.isArray(status?.sessions?.recent) ? status.sessions.recent : [];
    const recentByAgent = new Map();

    for (const session of recentSessions) {
      const agentId = String(session?.agentId || '').trim();
      if (!agentId || recentByAgent.has(agentId)) {
        continue;
      }
      recentByAgent.set(agentId, session);
    }

    const defaultZones = {
      main: currentZone === 'alarm' ? 'alarm' : 'work',
      research: currentZone === 'work' ? 'work' : 'rest',
      executor: currentZone === 'work' ? 'work' : 'rest',
      ops: currentZone === 'alarm' ? 'alarm' : 'rest',
    };

    const items = configuredAgents.map((agent, index) => {
      const agentId = String(agent?.agentId || agent?.id || '').trim();
      const recent = recentByAgent.get(agentId) || null;
      const override = manualAgentOverrides.get(agentId) || null;
      const zone = String(override?.zone || defaultZones[agentId] || (index % 2 === 0 ? 'work' : 'rest'));
      const statusValue = String(
        override?.status
        || inferAgentStatus(agentId, recent, currentZone, alertLevel),
      ).trim().toLowerCase();

      return {
        id: agentId,
        name: agentId,
        enabled: agent?.enabled !== false,
        source: hasHeartbeatAgents ? 'heartbeat' : 'config-fallback',
        active: override
          ? ['running', 'blocked', 'doing'].includes(statusValue) || Boolean(recent)
          : Boolean(recent),
        heartbeatEvery: agent?.every || '',
        heartbeatEveryMs: agent?.everyMs ?? null,
        zone,
        status: statusValue,
        session: recent ? {
          key: recent.key || '',
          updatedAt: recent.updatedAt || null,
          age: recent.age ?? null,
          percentUsed: recent.percentUsed ?? null,
          model: recent.model || '',
        } : null,
      };
    });

    return {
      source: hasHeartbeatAgents ? 'heartbeat' : 'config-fallback',
      configuredCount: items.length,
      activeCount: items.filter((agent) => agent.active).length,
      items,
    };
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
    const alertLevel = failed > 0 ? 'RED' : running > 0 ? 'GREEN' : 'AMBER';
    const task = taskRuntime?.currentTask?.title || (zone === 'work' ? '执行任务中' : zone === 'alarm' ? '告警处理' : '休息中');
    const agentState = buildAgentStates(status, zone, alertLevel);

    return sanitize({
      zone,
      scene: 'room',
      position: zone === 'work' ? { x: 13, y: 7 } : zone === 'alarm' ? { x: 20, y: 11 } : { x: 5, y: 11 },
      task,
      description: `队列：排队 ${queued} 项 · 运行中 ${running} 项 · 失败 ${failed} 项`,
      mode: running > 0 ? 'RUNNING' : 'IDLE',
      alertLevel,
      queue: queued,
      taskCount: taskStats?.taskCount ?? sessionsCount,
      openclaw: {
        agents: agentState.items,
        tasks: taskStats,
        runtime: taskRuntime,
        gateway: {
          reachable: Boolean(health?.ok),
          source: health ? 'health' : 'unavailable',
        },
        summary: {
          sessions: sessionsCount,
          cronJobs,
          heartbeatEvery,
          channels,
          agentSource: agentState.source,
          configuredAgentCount: agentState.configuredCount,
          activeAgentCount: agentState.activeCount,
          rawStatusAvailable: Boolean(status),
          rawHealthAvailable: Boolean(health),
          rawCronAvailable: Boolean(cron),
          gatewayOk: Boolean(health?.ok),
        },
      },
      raw: { status, health, cron },
    });
  }

  async function collectVisualPayload() {
    if (manualStateOverride) {
      const taskStats = buildTaskStats(null, null);
      const taskRuntime = buildTaskRuntime(null);
      return buildVisualStatus({ status: { sessions: { count: 0 } }, health: null, cron: null, taskStats, taskRuntime });
    }

    const [status, health, cron] = await Promise.all([
      rawCacheService.getStatusRaw(),
      rawCacheService.getHealthRaw(),
      rawCacheService.getCronRaw(),
    ]);
    const currentZone = deriveFallbackZoneFromStatus(status);
    const alertLevel = deriveFallbackAlertLevel(status);
    const taskStats = buildTaskStats(status, cron, currentZone, alertLevel);
    const taskRuntime = buildTaskRuntime(health, status, currentZone, alertLevel);
    return buildVisualStatus({ status, health, cron, taskStats, taskRuntime });
  }

  function getManualStateOverride() {
    return manualStateOverride;
  }

  function setManualStateOverride(nextState) {
    manualStateOverride = nextState;
    manualAgentOverrides = new Map();
    rawCacheService.clearRawCaches();
    return manualStateOverride;
  }

  function clearManualStateOverride() {
    manualStateOverride = null;
    manualAgentOverrides = new Map();
    rawCacheService.clearRawCaches();
  }

  return {
    buildTaskRuntime,
    buildTaskStats,
    collectVisualPayload,
    clearManualStateOverride,
    createManualState,
    getManualStateOverride,
    requireActionableTask,
    rawCacheService,
    setManualAgentOverride,
    setManualStateOverride,
  };
}
