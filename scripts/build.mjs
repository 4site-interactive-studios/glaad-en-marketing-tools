#!/usr/bin/env node
/**
 * Builds every output that can be made from src/ alone:
 *
 *   dist/local/  main.mjml, styles.css, main.html, assets/  (relative paths)
 *   dist/en/     main.mjml, styles.css, main.html           (GLAAD's EN image URLs)
 *   both:        example-<id>.mjml / .html for each example email in
 *                src/examples.mjs, composed from the catalog's blocks
 *   upload/      every image the template references
 *
 * The EN import JSON in dist/en/ and the thumbnails in upload/ come from the
 * importer app (npm run export-en); this script never deletes them.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSETS,
  DIST_EN,
  DIST_LOCAL,
  FILES_JSON,
  MANIFEST,
  ROOT,
  SOURCE_FILES,
  UPLOAD,
  composeExample,
  exampleStem,
  readJson,
  readSource,
  referencedAssets,
  toEnPaths,
} from './lib/shared.mjs';

const { EXAMPLES } = await import('../src/examples.mjs');
const MJML = join(ROOT, 'node_modules', '.bin', 'mjml');
const compile = (input, output) =>
  execFileSync(MJML, [input, '-o', output, '--config.allowIncludes=true', '--config.validationLevel=skip'], {
    stdio: 'inherit',
  });

const assets = referencedAssets();
const missing = assets.filter((a) => !existsSync(join(ASSETS, a)));
if (missing.length) {
  console.error(`build: src/main.mjml references images that are not in src/assets/: ${missing.join(', ')}`);
  process.exit(1);
}

// The flat dist/ layout this repo had before 2026-11-16.
for (const old of ['main.html', 'main.mjml', 'styles.css', 'assets']) rmSync(join(ROOT, 'dist', old), { recursive: true, force: true });

// dist/local: the working files as they are, plus a compiled preview.
rmSync(DIST_LOCAL, { recursive: true, force: true });
mkdirSync(join(DIST_LOCAL, 'assets'), { recursive: true });
for (const f of SOURCE_FILES) writeFileSync(join(DIST_LOCAL, f), readSource(f));
for (const a of assets) copyFileSync(join(ASSETS, a), join(DIST_LOCAL, 'assets', a));
compile(join(DIST_LOCAL, 'main.mjml'), join(DIST_LOCAL, 'main.html'));

// dist/en: the same files pointed at GLAAD's EN image folder.
mkdirSync(DIST_EN, { recursive: true });
for (const f of SOURCE_FILES) writeFileSync(join(DIST_EN, f), toEnPaths(readSource(f)));
compile(join(DIST_EN, 'main.mjml'), join(DIST_EN, 'main.html'));

// Example emails, composed from the catalog's blocks, in both path forms.
// dist/en is never cleaned (it holds the EN export), so examples no longer
// in src/examples.mjs are removed by name.
const stems = new Set(EXAMPLES.map((e) => exampleStem(e.id)));
for (const f of readdirSync(DIST_EN)) {
  const m = /^(example-[^.]+)\.(?:mjml|html)$/.exec(f);
  if (m && !stems.has(m[1])) rmSync(join(DIST_EN, f));
}
for (const example of EXAMPLES) {
  const stem = exampleStem(example.id);
  const mjml = composeExample(example);
  writeFileSync(join(DIST_LOCAL, `${stem}.mjml`), mjml);
  compile(join(DIST_LOCAL, `${stem}.mjml`), join(DIST_LOCAL, `${stem}.html`));
  writeFileSync(join(DIST_EN, `${stem}.mjml`), toEnPaths(mjml));
  compile(join(DIST_EN, `${stem}.mjml`), join(DIST_EN, `${stem}.html`));
}

// upload/: referenced images, plus whatever the last EN export added (thumbnails).
mkdirSync(UPLOAD, { recursive: true });
const fromExport = new Set(readJson(MANIFEST)?.uploadsFromExport ?? []);
for (const f of readdirSync(UPLOAD)) {
  if (!assets.includes(f) && !fromExport.has(f)) rmSync(join(UPLOAD, f));
}
for (const a of assets) copyFileSync(join(ASSETS, a), join(UPLOAD, a));

// dist/files.json: the file lists index.html shows and zips.
const listDir = (dir, prefix = '') =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listDir(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
    .sort();
const withSize = (dir, names) => names.map((name) => ({ name, bytes: statSync(join(dir, name)).size }));
const uploads = withSize(UPLOAD, listDir(UPLOAD));
const files = {
  note: 'Written by npm run build for index.html.',
  uploads,
  local: withSize(DIST_LOCAL, listDir(DIST_LOCAL)),
  en: withSize(DIST_EN, listDir(DIST_EN)),
  examples: EXAMPLES.map((e) => ({ id: e.id, title: e.title, file: `${exampleStem(e.id)}.html` })),
};
writeFileSync(FILES_JSON, `${JSON.stringify(files, null, 2)}\n`);

console.log(`build: dist/local, dist/en and upload/ written (${assets.length} images, ${uploads.length} upload files, ${EXAMPLES.length} example emails)`);
