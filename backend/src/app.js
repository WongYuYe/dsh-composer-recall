import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { createConfig } from './config.js';
import { createMergePatch, stableJson } from './lib/merge-patch.js';
import { createSanitizer } from './lib/sanitize.js';
import { runOpenClaw } from './openclaw.js';
import { registerOpenClawRoutes } from './routes/openclaw.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerVisualRoutes } from './routes/visual.js';
import { createRawCacheService } from './services/raw-cache.js';
import { createVisualStateService } from './services/visual-state.js';
import { createWsStatusService } from './services/ws-status.js';

export async function createApp() {
  const cfg = createConfig();
  if (cfg.requireApiKey && !cfg.apiKey) {
    throw new Error('API_KEY is required');
  }

  const app = Fastify({ logger: false });
  const { sanitize, sendCommand } = createSanitizer(cfg);
  const rawCacheService = createRawCacheService({ cfg, runOpenClaw });
  const visualStateService = createVisualStateService({ cfg, sanitize, rawCacheService });
  const wsStatusService = createWsStatusService({
    cfg,
    sanitize,
    stableJson,
    createMergePatch,
    collectVisualPayload: visualStateService.collectVisualPayload,
  });

  await app.register(cors, { origin: cfg.corsOrigin === '*' ? true : cfg.corsOrigin });
  await app.register(websocket);
  await app.register(rateLimit, {
    max: cfg.rateLimitMax,
    timeWindow: cfg.rateLimitWindow,
    errorResponseBuilder: () => ({ ok: false, error: 'rate limit exceeded' }),
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!cfg.apiKey) {
      return;
    }

    const token = req.headers['x-api-key'] || req.query?.apiKey;
    if (token !== cfg.apiKey) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
  });

  await registerVisualRoutes(app, {
    sanitize,
    rawCacheService,
    visualStateService,
    wsStatusService,
  });
  await registerTaskRoutes(app, { visualStateService });
  await registerOpenClawRoutes(app, {
    cfg,
    runOpenClaw,
    sendCommand,
  });
  wsStatusService.register(app);

  return {
    app,
    cfg,
  };
}
