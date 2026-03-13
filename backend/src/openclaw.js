import { spawn } from 'node:child_process';
import { extname } from 'node:path';

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
  const extension = extname(String(bin || '')).toLowerCase();
  const shouldInvokeWithNode = ['.js', '.mjs', '.cjs'].includes(extension);
  const command = shouldInvokeWithNode ? process.execPath : bin;
  const spawnArgs = shouldInvokeWithNode ? [bin, ...finalArgs] : finalArgs;
  const commandDisplay = [command, ...spawnArgs].join(' ');

  return await new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    let p;
    try {
      p = spawn(command, spawnArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      finish({
        ok: false,
        code: null,
        stdout,
        stderr: String(error?.message || error),
        data: null,
        command: commandDisplay,
      });
      return;
    }

    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', (error) => {
      finish({
        ok: false,
        code: null,
        stdout,
        stderr: String(error?.message || error),
        data: null,
        command: commandDisplay,
      });
    });

    p.on('close', (code) => {
      const parsed = parsePossiblyPrefixedJson(stdout);

      finish({
        ok: code === 0,
        code,
        stdout,
        stderr,
        data: parsed,
        command: commandDisplay,
      });
    });
  });
}
