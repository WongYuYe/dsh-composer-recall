import { spawn } from 'node:child_process';

function buildArgs(args, profile) {
  const out = [];
  if (profile) out.push('--profile', profile);
  out.push(...args);
  return out;
}

function parsePossiblyPrefixedJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const startCandidates = [];
  const objIndex = text.indexOf('{');
  const arrIndex = text.indexOf('[');
  if (objIndex >= 0) startCandidates.push(objIndex);
  if (arrIndex >= 0) startCandidates.push(arrIndex);
  startCandidates.sort((a, b) => a - b);

  for (const start of startCandidates) {
    const candidate = text.slice(start).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const candidate = lines.slice(i).join('\n').trim();
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

export async function runOpenClaw({ bin = 'openclaw', profile = '', args = [] }) {
  const finalArgs = buildArgs(args, profile);

  return await new Promise((resolve) => {
    const p = spawn(bin, finalArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));

    p.on('close', (code) => {
      const parsed = parsePossiblyPrefixedJson(stdout);

      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        data: parsed,
        command: [bin, ...finalArgs].join(' '),
      });
    });
  });
}
