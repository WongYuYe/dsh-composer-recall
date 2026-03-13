import { createApp } from './app.js';

try {
  const { app, cfg } = await createApp();
  await app.listen({ port: cfg.port, host: cfg.host });
} catch (error) {
  void error;
  process.exit(1);
}
