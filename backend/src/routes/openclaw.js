export async function registerOpenClawRoutes(app, { cfg, runOpenClaw, sendCommand }) {
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

    if (!message) {
      return reply.code(400).send({ ok: false, error: 'message is required' });
    }

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
    if (!command) {
      return reply.code(400).send({ ok: false, error: 'command is required' });
    }

    const unsafe = ['rm -rf', ':(){', 'mkfs', 'shutdown', 'reboot'];
    if (unsafe.some((item) => String(command).includes(item))) {
      return reply.code(400).send({ ok: false, error: 'blocked by safety guard' });
    }

    const split = String(command).trim().split(/\s+/);
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: split });
    return sendCommand(res, reply);
  });

  app.get('/api/openclaw/status/raw', async (_, reply) => {
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['status', '--json'] });
    return sendCommand(res, reply);
  });

  app.get('/api/openclaw/health', async (_, reply) => {
    const res = await runOpenClaw({ bin: cfg.openclawBin, profile: cfg.openclawProfile, args: ['health', '--json'] });
    return sendCommand(res, reply);
  });
}
