export async function registerTaskRoutes(app, { visualStateService }) {
  app.post('/api/tasks/:taskId/retry', async (req, reply) => {
    const required = visualStateService.requireManualTask(req, reply);
    if (!required) {
      return;
    }

    if (visualStateService.getManualStateOverride()?.zone !== 'alarm') {
      return reply.code(409).send({ ok: false, error: 'retry is only available for alarm tasks' });
    }

    const nextState = visualStateService.createManualState('work', {
      taskId: required.taskId,
      task: '重试执行中',
      description: `失败任务 ${required.taskId} 已重新投入执行。`,
      progress: 15,
      etaSeconds: 180,
      availableActions: ['resolve'],
    });

    visualStateService.setManualStateOverride(nextState);

    return {
      ok: true,
      data: {
        action: 'retry',
        taskId: required.taskId,
        state: nextState,
      },
    };
  });

  app.post('/api/tasks/:taskId/resolve', async (req, reply) => {
    const required = visualStateService.requireManualTask(req, reply);
    if (!required) {
      return;
    }

    const nextState = visualStateService.createManualState('rest', {
      task: '已恢复待命',
      description: `任务 ${required.taskId} 已处理完成，系统恢复待命。`,
    });

    visualStateService.setManualStateOverride(nextState);

    return {
      ok: true,
      data: {
        action: 'resolve',
        taskId: required.taskId,
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

    const health = await visualStateService.rawCacheService.getHealthRaw();
    return { ok: true, data: visualStateService.buildTaskRuntime(health) };
  });
}
