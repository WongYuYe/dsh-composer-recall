import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const staticCopies = [
  'assets/phaser',
  'vendor/phaser.min.js',
  'openclaw.config.js',
  'docs/preview.png',
];

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

function outputPathToAssetRef(outputPath) {
  const relativePath = path.relative(distDir, outputPath).split(path.sep).join('/');
  return `./${relativePath}`;
}

async function buildJsEntries() {
  const result = await build({
    absWorkingDir: __dirname,
    entryPoints: {
      app: 'app.js',
      'phaser-map': 'phaser-map.js',
    },
    bundle: true,
    charset: 'utf8',
    entryNames: '[name].[hash]',
    format: 'esm',
    legalComments: 'none',
    metafile: true,
    minify: true,
    outdir: path.join(distDir, 'assets'),
    target: ['es2020'],
    write: true,
  });

  const entryOutputs = Object.entries(result.metafile.outputs)
    .filter(([, output]) => output.entryPoint)
    .reduce((acc, [outputPath, output]) => {
      const key = path.basename(output.entryPoint, path.extname(output.entryPoint));
      acc[key] = outputPathToAssetRef(outputPath);
      return acc;
    }, {});

  return {
    appJs: entryOutputs.app,
    phaserMapJs: entryOutputs['phaser-map'],
  };
}

async function buildCssEntry() {
  const result = await build({
    absWorkingDir: __dirname,
    bundle: true,
    charset: 'utf8',
    entryNames: '[name].[hash]',
    entryPoints: {
      styles: 'styles.css',
    },
    legalComments: 'none',
    loader: {
      '.css': 'css',
    },
    metafile: true,
    minify: true,
    outdir: path.join(distDir, 'assets'),
    target: ['chrome100'],
    write: true,
  });

  const cssOutput = Object.keys(result.metafile.outputs).find((outputPath) => outputPath.endsWith('.css'));
  if (!cssOutput) {
    throw new Error('CSS build did not emit an output file.');
  }

  return outputPathToAssetRef(cssOutput);
}

async function main() {
  await cleanDir(distDir);
  const [{ appJs, phaserMapJs }, stylesCss] = await Promise.all([
    buildJsEntries(),
    buildCssEntry(),
  ]);

  for (const file of staticCopies) {
    await copyPathToDist(file);
  }

  await buildIndex({ stylesCss, phaserMapJs, appJs });
}

await main();
