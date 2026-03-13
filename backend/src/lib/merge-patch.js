export function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableJson(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function createMergePatch(previous, next) {
  if (Object.is(previous, next)) {
    return null;
  }

  const prevIsObject = previous && typeof previous === 'object' && !Array.isArray(previous);
  const nextIsObject = next && typeof next === 'object' && !Array.isArray(next);

  if (!prevIsObject || !nextIsObject) {
    return next;
  }

  const patch = {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const key of keys) {
    if (!(key in next)) {
      patch[key] = null;
      continue;
    }

    if (!(key in previous)) {
      patch[key] = next[key];
      continue;
    }

    const nested = createMergePatch(previous[key], next[key]);
    if (nested !== null) {
      patch[key] = nested;
    }
  }

  return Object.keys(patch).length ? patch : null;
}
