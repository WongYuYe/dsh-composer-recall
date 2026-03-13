import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const staticCopies = [
  'assets/phaser',
  'vendor/phaser.min.js',
  'openclaw.config.js',
  'docs/preview.png',
  'mock-alarm.json',
  'mock-outdoor.json',
  'mock-rest.json',
  'mock-status.json',
  'mock-task-stats-empty.json',
  'mock-task-stats.json',
];

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function cleanDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

async function copyPathToDist(relPath) {
  const src = path.join(__dirname, relPath);
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    await Promise.all(entries.map((entry) => copyPathToDist(path.join(relPath, entry.name))));
    return;
  }

  const dest = path.join(distDir, relPath);
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function buildAsset(relPath, loader) {
  const src = path.join(__dirname, relPath);
  const source = await fs.readFile(src, 'utf8');
  const result = await transform(source, {
    loader,
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    target: loader === 'css' ? 'chrome100' : 'es2020',
  });
  const ext = path.extname(relPath);
  const base = path.basename(relPath, ext);
  const hashed = `${base}.${hashContent(result.code)}${ext}`;
  const outPath = path.join(distDir, 'assets', hashed);
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, result.code, 'utf8');
  return `./assets/${hashed}`;
}

function minifyHtml(html) {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\n+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceVersionedAssetReference(html, sourcePath, builtPath) {
  const pattern = new RegExp(`${escapeRegExp(sourcePath)}(?:\\?[^"'\\s>]*)?`, 'g');
  return html.replace(pattern, builtPath);
}

async function buildIndex({ stylesCss, phaserMapJs, appJs }) {
  let html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replaceAll('./styles.css', stylesCss);
  html = replaceVersionedAssetReference(html, './phaser-map.js', phaserMapJs);
  html = replaceVersionedAssetReference(html, './app.js', appJs);
  html = minifyHtml(html);
  await fs.writeFile(path.join(distDir, 'index.html'), html, 'utf8');
}

async function main() {
  await cleanDir(distDir);
  const appJs = await buildAsset('app.js', 'js');
  const phaserMapJs = await buildAsset('phaser-map.js', 'js');
  const stylesCss = await buildAsset('styles.css', 'css');

  for (const file of staticCopies) {
    await copyPathToDist(file);
  }

  await buildIndex({ stylesCss, phaserMapJs, appJs });
}

await main();
