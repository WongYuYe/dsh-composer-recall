export async function registerVisualRoutes(app, {
  sanitize,
  rawCacheService,
  visualStateService,
  wsStatusService,
}) {
  app.get('/health', async () => ({ ok: true, service: 'openclaw-visual-backend' }));

  app.post('/api/debug/state', async (req, reply) => {
    const zone = String(req.body?.zone || '').toLowerCase();
    const allowed = new Set(['rest', 'work', 'alarm', 'clear']);
    if (!allowed.has(zone)) {
      return reply.code(400).send({ ok: false, error: 'zone must be rest|work|alarm|clear' });
    }

    if (zone === 'clear') {
      visualStateService.clearManualStateOverride();
      return { ok: true, data: { override: false } };
    }

    const state = visualStateService.createManualState(zone);
    visualStateService.setManualStateOverride(state);
    return { ok: true, data: { override: true, state } };
  });

  app.get('/api/openclaw/status', async (_, reply) => {
    const data = await visualStateService.collectVisualPayload();
    if (!data) {
      return reply.code(500).send({ ok: false, error: 'failed to read openclaw status' });
    }
    return { ok: true, data };
  });

  app.get('/api/openclaw/diagnostics', async () => ({
    ok: true,
    data: {
      ws: wsStatusService.buildWsDiagnostics(),
      cache: sanitize(rawCacheService.snapshot()),
      manualOverride: sanitize(visualStateService.getManualStateOverride()),
    },
  }));
}
