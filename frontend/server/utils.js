function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const numeric = toFiniteNumber(value);
    if (numeric !== null) {
      return numeric;
    }
  }

  return null;
}

function countArray(value) {
  return Array.isArray(value) ? value.length : null;
}

function extractJsonPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    throw new Error("empty stdout");
  }

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const start = text.indexOf("{");
  if (start < 0) {
    throw new Error("no JSON object start token found");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error("no complete JSON object found in stdout");
}

function createMergePatch(previous, next) {
  if (deepEqual(previous, next)) {
    return undefined;
  }

  if (isPlainObject(previous) && isPlainObject(next)) {
    const patch = {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

    for (const key of keys) {
      if (!(key in next)) {
        patch[key] = null;
        continue;
      }

      if (!(key in previous)) {
        patch[key] = deepClone(next[key]);
        continue;
      }

      const childPatch = createMergePatch(previous[key], next[key]);
      if (childPatch !== undefined) {
        patch[key] = childPatch;
      }
    }

    return Object.keys(patch).length > 0 ? patch : undefined;
  }

  return deepClone(next);
}

function countPatchLeaves(patch) {
  if (!isPlainObject(patch)) {
    return 1;
  }

  const values = Object.values(patch);
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + countPatchLeaves(value), 0);
}

module.exports = {
  countArray,
  countPatchLeaves,
  createMergePatch,
  deepClone,
  deepEqual,
  extractJsonPayload,
  firstFiniteNumber,
  isPlainObject,
  toFiniteNumber,
};
