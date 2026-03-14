export function createRawCacheService({ cfg, runOpenClaw }) {
  const rawCache = {
    status: { value: null, fetchedAtMs: 0, inFlight: null },
    health: { value: null, fetchedAtMs: 0, inFlight: null },
    cron: { value: null, fetchedAtMs: 0, inFlight: null },
  };

  function clearRawCaches(keys = Object.keys(rawCache)) {
    for (const key of keys) {
      if (!rawCache[key]) {
        continue;
      }

      rawCache[key].value = null;
      rawCache[key].fetchedAtMs = 0;
      rawCache[key].inFlight = null;
    }
  }

  async function readCachedRaw(key, ttlMs, loader, options = {}) {
    const { force = false, allowStale = true } = options;
    const entry = rawCache[key];
    const now = Date.now();

    if (!force && entry.value && now - entry.fetchedAtMs < ttlMs) {
      return entry.value;
    }

    const startRefresh = () => {
      const task = (async () => {
        try {
          const value = await loader();
          if (value !== null && value !== undefined) {
            entry.value = value;
            entry.fetchedAtMs = Date.now();
            return value;
          }

          return entry.value;
        } catch (error) {
          if (entry.value !== null && entry.value !== undefined) {
            return entry.value;
          }
          throw error;
        }
      })();

      entry.inFlight = task;
      task.finally(() => {
        if (entry.inFlight === task) {
          entry.inFlight = null;
        }
      });

      return task;
    };

    if (!force && allowStale && entry.value !== null && entry.value !== undefined) {
      if (!entry.inFlight) {
        void startRefresh();
      }
      return entry.value;
    }

    if (!force && entry.inFlight) {
      return entry.inFlight;
    }

    return startRefresh();
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

  function snapshot() {
    return Object.fromEntries(Object.entries(rawCache).map(([key, entry]) => [key, {
      cached: Boolean(entry.value),
      fetchedAtMs: entry.fetchedAtMs || 0,
      inFlight: Boolean(entry.inFlight),
    }]));
  }

  return {
    clearRawCaches,
    getCronRaw,
    getHealthRaw,
    getStatusRaw,
    readCachedRaw,
    snapshot,
  };
}
