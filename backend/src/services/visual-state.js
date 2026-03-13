import { toFiniteNumber } from '../lib/value-utils.js';

export function createVisualStateService({ sanitize, rawCacheService }) {
  let manualStateOverride = null;

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

    return sanitize({
      taskCount: sessions,
      total: sessions,
      totalTasks: sessions,
      todo: 0,
      doing: 0,
      blocked: 0,
      done: 0,
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
        session: recent ? {
          key: recent.key || '',
          updatedAt: recent.updatedAt || null,
          age: recent.age ?? null,
          percentUsed: recent.percentUsed ?? null,
          model: recent.model || '',
        } : null,
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
    const alertLevel = failed > 0 ? 'RED' : running > 0 ? 'GREEN' : 'AMBER';
    const task = taskRuntime?.currentTask?.title || (zone === 'work' ? '执行任务中' : zone === 'alarm' ? '告警处理' : '休息中');
    const agents = buildAgentStates(status, zone, alertLevel);

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
    const taskStats = buildTaskStats(status, cron);
    const taskRuntime = buildTaskRuntime(health);
    return buildVisualStatus({ status, health, cron, taskStats, taskRuntime });
  }

  function getManualStateOverride() {
    return manualStateOverride;
  }

  function setManualStateOverride(nextState) {
    manualStateOverride = nextState;
    rawCacheService.clearRawCaches();
    return manualStateOverride;
  }

  function clearManualStateOverride() {
    manualStateOverride = null;
    rawCacheService.clearRawCaches();
  }

  return {
    buildTaskRuntime,
    buildTaskStats,
    collectVisualPayload,
    clearManualStateOverride,
    createManualState,
    getManualStateOverride,
    rawCacheService,
    requireManualTask,
    setManualStateOverride,
  };
}
