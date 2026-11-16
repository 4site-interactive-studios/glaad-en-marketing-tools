#!/usr/bin/env node
/**
 * Every output must match the working files in src/. This prints a WARN for
 * each thing that does not, and says which command fixes it. It never fails
 * the build (TPL's convention); a clean run prints "0 warnings".
 *
 *   npm run build      → dist/local, dist/en MJML + HTML (catalog and example
 *                        emails), upload/ images
 *   npm run export-en  → dist/en EN import JSON, upload/ thumbnails
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import mjml2html from 'mjml';
import {
  ASSETS,
  BLOCKS_JSON,
  DIST_EN,
  DIST_LOCAL,
  EN_ASSET_ROOT,
  FILES_JSON,
  MANIFEST,
  ROOT,
  SOURCE_FILES,
  TEMPLATE_JSON,
  UPLOAD,
  assetPrefix,
  blockNames,
  composeExample,
  exampleStem,
  readJson,
  readSource,
  referencedAssets,
  sourceHash,
  toEnPaths,
} from './lib/shared.mjs';

const { EXAMPLES } = await import('../src/examples.mjs');
const warnings = [];
const warn = (msg, fix) => warnings.push(`WARN ${msg}${fix ? `  → run ${fix}` : ''}`);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const bytesEqual = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
const squash = (s) => s.replace(/\s+/g, '');
const BUILD = 'npm run build';
const EXPORT = 'npm run export-en';

// 1. MJML + CSS copies
for (const f of SOURCE_FILES) {
  if (read(join(DIST_LOCAL, f)) !== readSource(f)) warn(`dist/local/${f} differs from src/${f}`, BUILD);
  if (read(join(DIST_EN, f)) !== toEnPaths(readSource(f))) warn(`dist/en/${f} is not src/${f} with EN image paths`, BUILD);
}

// 1b. Example emails: each must be a fresh composition of the catalog's blocks
const stems = EXAMPLES.map((e) => exampleStem(e.id));
for (const example of EXAMPLES) {
  const stem = exampleStem(example.id);
  let composed;
  try {
    composed = composeExample(example);
  } catch (err) {
    warn(`src/examples.mjs: ${err.message}`);
    continue;
  }
  if (read(join(DIST_LOCAL, `${stem}.mjml`)) !== composed) warn(`dist/local/${stem}.mjml is not a fresh composition of the catalog`, BUILD);
  if (read(join(DIST_EN, `${stem}.mjml`)) !== toEnPaths(composed)) warn(`dist/en/${stem}.mjml is not a fresh composition with EN image paths`, BUILD);
}
for (const [dir, label] of [[DIST_LOCAL, 'dist/local'], [DIST_EN, 'dist/en']]) {
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const m = /^(example-[^.]+)\.(?:mjml|html)$/.exec(f);
    if (m && !stems.includes(m[1])) warn(`${label}/${f} belongs to no example in src/examples.mjs`, BUILD);
  }
}

// 2. Compiled HTML: recompile and compare, whitespace aside (the CLI pretty-prints)
const pages = ['main', ...stems];
for (const [dir, label] of [[DIST_LOCAL, 'dist/local'], [DIST_EN, 'dist/en']]) {
  for (const page of pages) {
    const html = read(join(dir, `${page}.html`));
    const mjmlFile = join(dir, `${page}.mjml`);
    if (!html || !existsSync(mjmlFile)) {
      warn(`${label}/${page}.html is missing`, BUILD);
      continue;
    }
    const fresh = await mjml2html(readFileSync(mjmlFile, 'utf8'), {
      validationLevel: 'skip',
      filePath: resolve(mjmlFile),
      ignoreIncludes: false,
    });
    if (squash(fresh.html) !== squash(html)) warn(`${label}/${page}.html is stale against ${label}/${page}.mjml`, BUILD);
  }
}
for (const page of pages) {
  for (const f of [`${page}.mjml`, `${page}.html`]) {
    if (/["'(]assets\//.test(read(join(DIST_EN, f)) ?? '')) warn(`dist/en/${f} still has a relative assets/ path`, BUILD);
  }
}

// 3. Images: same bytes in src, dist/local and upload; nothing stray
const assets = referencedAssets();
const manifest = readJson(MANIFEST);
const fromExport = new Set(manifest?.uploadsFromExport ?? []);
for (const a of assets) {
  if (!existsSync(join(ASSETS, a))) warn(`src/assets/${a} is referenced but missing`);
  if (!bytesEqual(join(ASSETS, a), join(DIST_LOCAL, 'assets', a))) warn(`dist/local/assets/${a} differs from src/assets/${a}`, BUILD);
  if (!bytesEqual(join(ASSETS, a), join(UPLOAD, a))) warn(`upload/${a} differs from src/assets/${a}`, BUILD);
}
if (existsSync(join(DIST_LOCAL, 'assets'))) {
  for (const f of readdirSync(join(DIST_LOCAL, 'assets'))) if (!assets.includes(f)) warn(`dist/local/assets/${f} is not referenced`, BUILD);
}
if (existsSync(UPLOAD)) {
  for (const f of readdirSync(UPLOAD)) if (!assets.includes(f) && !fromExport.has(f)) warn(`upload/${f} is neither referenced nor from the last EN export`, BUILD);
}
for (const f of fromExport) if (!existsSync(join(UPLOAD, f))) warn(`upload/${f} (from the last EN export) is missing`, EXPORT);
// Every uploaded file carries the template's declared prefix (GLAAD's EN
// image folder is shared with GLAAD's own files).
const prefix = assetPrefix();
if (!prefix) warn('src/main.mjml declares no assetPrefix in en-tools-config');
else if (existsSync(UPLOAD)) {
  for (const f of readdirSync(UPLOAD)) {
    if (!f.startsWith(prefix)) warn(`upload/${f} does not start with ${prefix}`, assets.includes(f) ? 'a rename in src/assets/' : EXPORT);
  }
}

// 4. EN import JSON: fresh, complete, pointed at the EN folder, no orphan tags
const blocks = readJson(BLOCKS_JSON);
const template = readJson(TEMPLATE_JSON);
if (!manifest || !blocks || !template) {
  warn('dist/en is missing the EN import JSON or its export-manifest.json', EXPORT);
} else {
  if (manifest.sourceHash !== sourceHash()) warn('EN import JSON and thumbnails are stale: src/ changed since the last export', EXPORT);
  if (manifest.assetRoot !== EN_ASSET_ROOT) warn(`EN import JSON was exported for ${manifest.assetRoot}, not ${EN_ASSET_ROOT}`, EXPORT);
  const exported = blocks.map((b) => b.name).filter((n) => !n.startsWith('Utility — '));
  const expected = blockNames().filter((n) => n !== 'Main Content');
  if (JSON.stringify(exported) !== JSON.stringify(expected)) {
    warn(`en-blocks-import.json blocks [${exported.join(', ')}] do not match src/main.mjml [${expected.join(', ')}]`, EXPORT);
  }
  for (const b of blocks) {
    if (!b.name.startsWith('Utility — ') && /placeholder\.png$/.test(b.thumbnail ?? '')) {
      warn(`en-blocks-import.json "${b.name}" uses EN's generic placeholder thumbnail, not its own`, EXPORT);
    }
  }
  for (const [label, entries] of [['en-blocks-import.json', blocks], ['en-template-import.json', [template]]]) {
    const text = JSON.stringify(entries);
    if (/["'(]assets\//.test(text)) warn(`${label} still has a relative assets/ path`, EXPORT);
    for (const m of text.matchAll(/https:\/\/[^"\\\s]*?rackcdn\.com\/[^"\\\s]+/g)) {
      const url = m[0];
      if (!url.startsWith(`${EN_ASSET_ROOT}/`)) warn(`${label} points at another EN folder: ${url}`, EXPORT);
      else if (!existsSync(join(UPLOAD, url.slice(EN_ASSET_ROOT.length + 1)))) warn(`${label} uses ${url.split('/').pop()}, which is not in upload/`, EXPORT);
    }
    for (const e of entries) {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const names = new Set(Object.keys(data?.replacements ?? {}));
      const tags = [...`${e.content}${JSON.stringify(data)}`.matchAll(/\{replacement~([^}]+)\}/g)].map((t) => t[1]);
      const orphans = [...new Set(tags.filter((t) => !names.has(t)))];
      if (orphans.length) warn(`${label} "${e.name}" has orphan tags: ${orphans.join(', ')}`, EXPORT);
    }
  }
}

// 5. The GitHub Pages preview (index.html): its upload list and every path it names
const files = readJson(FILES_JSON);
if (!files) warn('dist/files.json is missing', BUILD);
else {
  const walk = (dir, prefix = '') =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
          .sort()
      : [];
  for (const [key, dir, label] of [['uploads', UPLOAD, 'upload/'], ['local', DIST_LOCAL, 'dist/local/'], ['en', DIST_EN, 'dist/en/']]) {
    const listed = (files[key] ?? []).map((u) => `${u.name}:${u.bytes}`).join('|');
    const actual = walk(dir).map((f) => `${f}:${readFileSync(join(dir, f)).length}`).join('|');
    if (listed !== actual) warn(`dist/files.json does not match ${label}`, BUILD);
  }
  const listedExamples = JSON.stringify(files.examples ?? []);
  const expectedExamples = JSON.stringify(EXAMPLES.map((e) => ({ id: e.id, title: e.title, file: `${exampleStem(e.id)}.html` })));
  if (listedExamples !== expectedExamples) warn('dist/files.json does not list the examples in src/examples.mjs', BUILD);
}
const page = read(join(ROOT, 'index.html'));
if (!page) warn('index.html (the GitHub Pages preview) is missing');
else {
  const named = new Set([...page.matchAll(/["'`]((?:dist|upload)\/[^"'`$]*)["'`]/g)].map((m) => m[1]));
  for (const p of named) if (!existsSync(join(ROOT, p))) warn(`index.html names ${p}, which does not exist`);
}
if (!existsSync(join(ROOT, '.nojekyll'))) warn('.nojekyll is missing (GitHub Pages would run Jekyll over the repo)');

for (const w of warnings) console.log(w);
console.log(`check-sync: ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
