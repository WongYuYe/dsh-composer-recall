export function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

export function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isMergeObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function applyMergePatch(target, patch) {
  if (!isMergeObject(patch)) {
    return cloneJson(patch);
  }

  const base = isMergeObject(target) ? cloneJson(target) : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete base[key];
      continue;
    }

    base[key] = applyMergePatch(base[key], value);
  }

  return base;
}

export function normalizeEventCursor(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return String(value).trim();
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatClock(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function formatShortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return formatClock(date);
}

export function formatEtaLabel(value) {
  const numeric = safeNumber(value);
  if (numeric === null || numeric < 0) {
    return "";
  }

  if (numeric < 60) {
    return `${Math.round(numeric)} 秒`;
  }

  const minutes = Math.floor(numeric / 60);
  const remainSeconds = Math.round(numeric % 60);
  return remainSeconds > 0 ? `${minutes} 分 ${remainSeconds} 秒` : `${minutes} 分钟`;
}

export function formatPercent(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return String(Math.round(numeric));
}

export function formatTemperature(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return String(Math.round(numeric));
}

export function formatTaskCount(value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    return "--";
  }

  return String(Math.max(0, Math.round(numeric)));
}
