export function createConfig() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const defaultOpenClawConfigPath = homeDir
    ? `${homeDir.replace(/[\\/]+$/, '')}/.openclaw/openclaw.json`
    : '';

  return {
    port: Number(process.env.PORT || 8787),
    host: process.env.HOST || '127.0.0.1',
    openclawBin: process.env.OPENCLAW_BIN || 'openclaw',
    openclawProfile: process.env.OPENCLAW_PROFILE || '',
    openclawConfigPath: process.env.OPENCLAW_CONFIG_PATH || defaultOpenClawConfigPath,
    apiKey: process.env.API_KEY || '',
    requireApiKey: String(process.env.REQUIRE_API_KEY || 'true').toLowerCase() !== 'false',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    enableExecEndpoint: String(process.env.ENABLE_EXEC_ENDPOINT || 'false').toLowerCase() === 'true',
    redactSensitiveOutput: String(process.env.REDACT_SENSITIVE_OUTPUT || 'true').toLowerCase() !== 'false',
    includeCommandInResponse: String(process.env.INCLUDE_COMMAND_IN_RESPONSE || 'false').toLowerCase() === 'true',
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 600),
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    wsStatusIntervalMs: Number(process.env.WS_STATUS_INTERVAL_MS || 10000),
    rawStatusTtlMs: Number(process.env.RAW_STATUS_TTL_MS || 10000),
    rawHealthTtlMs: Number(process.env.RAW_HEALTH_TTL_MS || 15000),
    rawCronTtlMs: Number(process.env.RAW_CRON_TTL_MS || 30000),
  };
}
