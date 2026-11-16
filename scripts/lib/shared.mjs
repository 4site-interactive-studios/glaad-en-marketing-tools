/**
 * One owner for the facts every script needs: where things live, which
 * images the template references, how a local path becomes an EN path, and
 * the fingerprint of the working files that every output must match.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = join(ROOT, 'src');
export const ASSETS = join(SRC, 'assets');
export const DIST_LOCAL = join(ROOT, 'dist', 'local');
export const DIST_EN = join(ROOT, 'dist', 'en');
export const UPLOAD = join(ROOT, 'upload');
export const MANIFEST = join(DIST_EN, 'export-manifest.json');
export const BLOCKS_JSON = join(DIST_EN, 'en-blocks-import.json');
export const TEMPLATE_JSON = join(DIST_EN, 'en-template-import.json');
/** Read by index.html (the GitHub Pages preview) to list upload/. */
export const FILES_JSON = join(ROOT, 'dist', 'files.json');

/** GLAAD's EN image folder (client 10109), from the CDN URLs in their live email. */
export const EN_ASSET_ROOT = (
  process.env.GLAAD_ASSET_ROOT ||
  'https://acb0a5d73b67fccd4bbe-c2d8138f0ea10a18dd4c43ec3aa4240a.ssl.cf5.rackcdn.com/10109'
).replace(/\/+$/, '');

/** The working files. Everything in dist/ and upload/ is generated from these. */
export const SOURCE_FILES = ['main.mjml', 'styles.css'];

const LOCAL_REF = /(["'(])assets\/([^"')\s]+)/g;

export const readSource = (name) => readFileSync(join(SRC, name), 'utf8');

/** Every image the working files reference, by filename (EN's folder is flat). */
export function referencedAssets() {
  const text = SOURCE_FILES.map(readSource).join('\n');
  return [...new Set([...text.matchAll(LOCAL_REF)].map((m) => m[2]))].sort();
}

/** Local `assets/x.png` → `<EN root>/x.png`. The same rewrite the importer applies at export. */
export const toEnPaths = (text) => text.replace(LOCAL_REF, (_, q, file) => `${q}${EN_ASSET_ROOT}/${file}`);

/** Fingerprint of the working files plus the bytes of every referenced image. */
export function sourceHash() {
  const h = createHash('sha256');
  for (const f of SOURCE_FILES) h.update(`file:${f}\n`).update(readSource(f));
  for (const a of referencedAssets()) {
    const p = join(ASSETS, a);
    h.update(`asset:${a}\n`).update(existsSync(p) ? readFileSync(p) : 'MISSING');
  }
  return h.digest('hex').slice(0, 16);
}

/** The template's declared assetPrefix (en-tools-config in main.mjml). */
export function assetPrefix() {
  const m = /<!--\s*en-tools-config\s*(\{[\s\S]*?\})\s*-->/.exec(readSource('main.mjml'));
  try {
    return (m && JSON.parse(m[1]).assetPrefix) || '';
  } catch {
    return '';
  }
}

/** Leaf START/END block names in the master template, in order. */
export function blockNames() {
  const text = readSource('main.mjml');
  const tokens = [...text.matchAll(/<!-- (START|END): (.+?) -->/g)];
  const stack = [];
  const leaves = [];
  for (const t of tokens) {
    if (t[1] === 'START') stack.push({ name: t[2], hasChild: false });
    else {
      const top = stack.pop();
      if (!top || top.name !== t[2]) continue;
      if (!top.hasChild) leaves.push(top.name);
      if (stack.length) stack[stack.length - 1].hasChild = true;
    }
  }
  return leaves;
}

export const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

/** Output filename stem for an example email: example-<id>.mjml / .html */
export const exampleStem = (id) => `example-${id}`;

/** The full START..END markup of every leaf block in main.mjml, by name. */
function blockRegions(text) {
  const regions = new Map();
  for (const name of blockNames()) {
    const start = text.indexOf(`<!-- START: ${name} -->`);
    const endTag = `<!-- END: ${name} -->`;
    const end = text.indexOf(endTag, start);
    if (start !== -1 && end !== -1) regions.set(name, text.slice(start, end + endTag.length));
  }
  return regions;
}

/**
 * One example email (src/examples.mjs) as MJML: main.mjml with its Main
 * Content replaced by the named blocks, in order, each copied verbatim from
 * the catalog and then given the recipe's overrides. Throws on an unknown
 * block or an override that does not match exactly once, so a renamed or
 * edited block breaks the build instead of silently changing an example.
 */
export function composeExample(example) {
  const text = readSource('main.mjml');
  const regions = blockRegions(text);
  const OPEN = '<!-- START: Main Content -->';
  const CLOSE = '<!-- END: Main Content -->';
  const open = text.indexOf(OPEN);
  const close = text.indexOf(CLOSE);
  if (open === -1 || close === -1) throw new Error('main.mjml has no Main Content markers');
  const body = example.blocks.map((item) => {
    const spec = typeof item === 'string' ? { block: item } : item;
    let markup = regions.get(spec.block);
    if (!markup) throw new Error(`example "${example.id}": no block named "${spec.block}" in main.mjml`);
    if (spec.text !== undefined) {
      const m = /(<mj-text\b[^>]*>)[\s\S]*?(<\/mj-text>)/.exec(markup);
      if (!m) throw new Error(`example "${example.id}": block "${spec.block}" has no mj-text for its text override`);
      markup = markup.slice(0, m.index) + m[1] + spec.text.replace(/\s+$/, '') + '\n        ' + m[2] + markup.slice(m.index + m[0].length);
    }
    for (const [find, replacement] of spec.replace ?? []) {
      const n = markup.split(find).length - 1;
      if (n !== 1) throw new Error(`example "${example.id}": "${find}" occurs ${n} times in block "${spec.block}" (needs exactly 1)`);
      markup = markup.replace(find, () => replacement);
    }
    return `    ${markup}`;
  });
  const composed = `${text.slice(0, open + OPEN.length)}\n\n${body.join('\n\n')}\n\n    ${text.slice(close)}`;
  return composed.replace(/<mj-title>[\s\S]*?<\/mj-title>/, `<mj-title>GLAAD example: ${example.title}</mj-title>`);
}
