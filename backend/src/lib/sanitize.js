export function createSanitizer(cfg) {
  function redactString(input) {
    if (typeof input !== 'string') {
      return input;
    }

    let out = input;
    out = out.replace(/\/Users\/[^/\s]+/g, '/Users/<redacted>');
    out = out.replace(/\/home\/[^/\s]+/g, '/home/<redacted>');
    out = out.replace(/[A-Za-z]:\\\\Users\\\\[^\\\s]+/g, 'C:\\\\Users\\\\<redacted>');
    out = out.replace(/agent:main:telegram:direct:[0-9]+/g, 'agent:main:telegram:direct:<redacted>');
    out = out.replace(/(telegram:)[0-9]+/g, '$1<redacted>');
    return out;
  }

  function sanitize(value) {
    if (!cfg.redactSensitiveOutput) {
      return value;
    }

    if (typeof value === 'string') {
      return redactString(value);
    }

    if (Array.isArray(value)) {
      return value.map(sanitize);
    }

    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, nested] of Object.entries(value)) {
        if (['path', 'paths', 'sessionKey', 'chat_id', 'chatId'].includes(key)) {
          out[key] = '<redacted>';
        } else {
          out[key] = sanitize(nested);
        }
      }
      return out;
    }

    return value;
  }

  function sendCommand(result, reply) {
    if (!result.ok) {
      return reply.code(500).send({
        ok: false,
        error: sanitize(result.stderr || 'openclaw command failed'),
        ...(cfg.includeCommandInResponse ? { command: sanitize(result.command) } : {}),
      });
    }

    const data = sanitize(result.data ?? result.stdout);
    return {
      ok: true,
      ...(cfg.includeCommandInResponse ? { command: sanitize(result.command) } : {}),
      data,
    };
  }

  return {
    redactString,
    sanitize,
    sendCommand,
  };
}
