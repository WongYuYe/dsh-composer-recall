export async function registerTaskRoutes(app, { visualStateService }) {
  app.post('/api/tasks/:taskId/retry', async (req, reply) => {
    const required = await visualStateService.requireActionableTask(req, reply);
    if (!required) {
      return;
    }

    const taskMeta = required.taskMeta || {};
    const agentId = required.agentId || taskMeta.agentId || 'main';
    const taskStatus = String(taskMeta.status || '').toLowerCase();

    if (!['blocked', 'failed'].includes(taskStatus)) {
      return reply.code(409).send({ ok: false, error: 'retry is only available for alarm tasks' });
    }

    const nextState = {
      agentId,
      taskId: required.taskId,
      task: '重试执行中',
      title: '重试执行中',
      description: `失败任务 ${required.taskId} 已重新投入执行。`,
      zone: 'work',
      status: 'running',
      taskStatus: 'doing',
      progress: 15,
      etaSeconds: 180,
      failureReason: '',
      lastError: '',
      availableActions: ['resolve'],
      updatedAt: new Date().toISOString(),
    };

    visualStateService.setManualAgentOverride(agentId, nextState);

    return {
      ok: true,
      data: {
        action: 'retry',
        taskId: required.taskId,
        agentId,
        state: nextState,
      },
    };
  });

  app.post('/api/tasks/:taskId/resolve', async (req, reply) => {
    const required = await visualStateService.requireActionableTask(req, reply);
    if (!required) {
      return;
    }

    const taskMeta = required.taskMeta || {};
    const agentId = required.agentId || taskMeta.agentId || 'main';
    const nextState = {
      agentId,
      taskId: required.taskId,
      task: '已恢复待命',
      title: '已恢复待命',
      description: `任务 ${required.taskId} 已处理完成，系统恢复待命。`,
      zone: 'rest',
      status: 'idle',
      taskStatus: 'todo',
      progress: 100,
      etaSeconds: null,
      failureReason: '',
      lastError: '',
      availableActions: [],
      updatedAt: new Date().toISOString(),
    };

    visualStateService.setManualAgentOverride(agentId, nextState);

    return {
      ok: true,
      data: {
        action: 'resolve',
        taskId: required.taskId,
        agentId,
        state: nextState,
      },
    };
  });

  app.get('/api/tasks/stats', async () => {
    if (visualStateService.getManualStateOverride()) {
      return { ok: true, data: visualStateService.buildTaskStats(null, null) };
    }

    const [status, cron] = await Promise.all([
      visualStateService.rawCacheService.getStatusRaw(),
      visualStateService.rawCacheService.getCronRaw(),
    ]);
    return { ok: true, data: visualStateService.buildTaskStats(status, cron) };
  });

  app.get('/api/tasks/runtime', async () => {
    if (visualStateService.getManualStateOverride()) {
      return { ok: true, data: visualStateService.buildTaskRuntime(null) };
    }

    const [health, status] = await Promise.all([
      visualStateService.rawCacheService.getHealthRaw(),
      visualStateService.rawCacheService.getStatusRaw(),
    ]);
    return { ok: true, data: visualStateService.buildTaskRuntime(health, status) };
  });
}
