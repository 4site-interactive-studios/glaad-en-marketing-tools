#!/usr/bin/env node
/**
 * Regenerates the EN Marketing Tools import files and the block thumbnails by
 * running the REAL importer app (the private email-to-en-marketing-tools
 * repo, checked out beside this one) in a headless browser:
 *
 *   dist/en/en-blocks-import.json     EN block import (thumbnails point at upload/'s files)
 *   dist/en/en-template-import.json   EN template import
 *   dist/en/export-manifest.json      what was exported, from which src/
 *   upload/thumbnail-*.png, upload/placeholder.png
 *
 * Driving the app, rather than calling its modules, is deliberate: the app is
 * what anyone else would use, and thumbnails only render in a browser.
 *
 * Settings (environment variables):
 *   IMPORTER_DIR      importer checkout      default ../email-to-en-marketing-tools
 *   EN_CLIENT_ID      GLAAD's EN client      default 10109
 *   EN_OWNER_ID       EN owner user ID       default 0 (placeholder until GLAAD's is known)
 *   EN_FOLDER_ID      EN folder ID           default 0 (root folder)
 *   GLAAD_ASSET_ROOT  EN image folder URL    default GLAAD's 10109 folder
 *   TEMPLATE_NAME     EN template name       default "GLAAD Email Template"
 *
 * Needs Playwright with Chromium: `npm install` here, then once
 * `npx playwright install chromium`.
 */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import {
  BLOCKS_JSON,
  EN_ASSET_ROOT,
  MANIFEST,
  ROOT,
  TEMPLATE_JSON,
  UPLOAD,
  blockNames,
  referencedAssets,
  sourceHash,
} from './lib/shared.mjs';

const IMPORTER_DIR = resolve(ROOT, process.env.IMPORTER_DIR || '../email-to-en-marketing-tools');
const CLIENT_ID = Number(process.env.EN_CLIENT_ID ?? 10109);
const OWNER_ID = Number(process.env.EN_OWNER_ID ?? 0);
const FOLDER_ID = Number(process.env.EN_FOLDER_ID ?? 0);
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'GLAAD Email Template';
const APP_PORT = Number(process.env.IMPORTER_PORT || 5179);
const SRC_PORT = Number(process.env.SOURCE_PORT || 8643);
// The app will not compile without an owner above 0, so a 0 placeholder is
// entered as 1 and written back as 0 in the downloaded JSON.
const APP_OWNER_ID = OWNER_ID > 0 ? OWNER_ID : 1;

if (!existsSync(join(IMPORTER_DIR, 'node_modules', 'vite'))) {
  console.error(`export-en: no importer at ${IMPORTER_DIR} (or its npm install is missing). Set IMPORTER_DIR.`);
  process.exit(1);
}

function loadPlaywright() {
  const bases = [ROOT, IMPORTER_DIR];
  try {
    bases.push(execSync('npm root -g', { encoding: 'utf8' }).trim());
  } catch {
    /* no global npm root */
  }
  for (const base of bases) {
    try {
      return createRequire(join(base, 'noop.js'))('playwright');
    } catch {
      /* try the next place */
    }
  }
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    console.error('export-en: Playwright not found. Run `npm install` here, then `npx playwright install chromium`.');
    process.exit(1);
  }
}

const TYPES = { '.mjml': 'text/plain', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function serveRepo() {
  const server = createServer((req, res) => {
    const file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(SRC_PORT, '127.0.0.1', () => ok(server)));
}

const up = async (url) => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};

async function startImporter() {
  const url = `http://localhost:${APP_PORT}/`;
  if (await up(url)) return { url, child: null };
  const child = spawn(process.execPath, [join(IMPORTER_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(APP_PORT), '--strictPort'], {
    cwd: IMPORTER_DIR,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    if (await up(url)) return { url, child };
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error(`importer dev server did not start on port ${APP_PORT}`);
}

const server = await serveRepo();
const { url: appUrl, child } = await startImporter();
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const tmp = mkdtempSync(join(tmpdir(), 'glaad-export-'));

/**
 * One import of src/main.mjml in the app. Requests to GLAAD's EN image folder
 * are answered from upload/, so the app behaves as if everything there were
 * already uploaded: its thumbnail probe (run once, at import) finds
 * thumbnail-<block>.png and the block JSON points at it instead of EN's
 * generic placeholder.png.
 */
async function importInApp() {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  await context.route(
    (url) => url.href.startsWith(`${EN_ASSET_ROOT}/`),
    (route) => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
      const file = join(UPLOAD, name);
      if (!existsSync(file)) return route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
      return route.fulfill({
        status: 200,
        contentType: TYPES[extname(file)] ?? 'application/octet-stream',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: readFileSync(file),
      });
    },
  );
  const page = await context.newPage();
  await page.goto(appUrl);

  const urlField = page.getByPlaceholder(/github\.com\/org\/repo/);
  await urlField.fill(`http://127.0.0.1:${SRC_PORT}/src/main.mjml`);
  await urlField.press('Enter');
  const label = page.getByPlaceholder('e.g. CLF — Spring Appeal');
  await label.waitFor({ timeout: 30000 });
  await label.fill('GLAAD EN Marketing Tools');

  // Account values go in AFTER the fetch: the app pre-selects TPL's preset on
  // load, and only this order replaces every TPL value.
  await page.locator('button[title="EN account settings"]').click();
  const settings = page.locator('div.fixed.inset-0').filter({ hasText: 'Owner user ID' });
  const field = (t) => settings.locator('label', { hasText: t }).locator('input').first();
  await field('Client ID').fill(String(CLIENT_ID));
  await field('Owner user ID').fill(String(APP_OWNER_ID));
  await field('Folder ID').fill(String(FOLDER_ID));
  await field('Asset root URL').fill(EN_ASSET_ROOT);
  await page.keyboard.press('Escape');
  if (await settings.isVisible()) await settings.click({ position: { x: 5, y: 5 } });

  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Compile MJML/.test(x.textContent));
    return b && !b.disabled;
  }, null, { timeout: 30000 });
  await page.getByRole('button', { name: /Compile MJML & Analyze/ }).click();
  await page.getByRole('button', { name: 'Export…' }).waitFor({ timeout: 120000 });
  await page.locator('label', { hasText: 'Template name' }).locator('input').fill(TEMPLATE_NAME);

  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Export for Engaging Networks' });
  const tab = (name) => dialog.getByRole('button', { name: new RegExp(`^${name}( \\(|$)`) }).first();
  // Download stays disabled while the export builds and the thumbnail probe runs.
  const ready = () =>
    page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Download');
      return b && !b.disabled;
    }, null, { timeout: 180000 });
  const save = async (trigger, dest) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), trigger.click()]);
    await dl.saveAs(dest);
  };
  return { context, dialog, tab, ready, save };
}

try {
  // Pass 1: render every thumbnail. The FULL imagery + thumbnails set, never
  // the "Missing" one, which shrinks to nothing once files are uploaded.
  // Thumbnails are always rendered from the current source, never reused
  // from the asset root, so serving old ones from upload/ cannot leak in.
  const pass1 = await importInApp();
  await pass1.tab('Blocks').click();
  await pass1.ready();
  const zip = join(tmp, 'imagery.zip');
  await pass1.save(pass1.dialog.getByRole('button', { name: /^Block Imagery and Thumbnails/ }), zip);
  await pass1.context.close();

  const unzipped = join(tmp, 'imagery');
  execFileSync('unzip', ['-o', '-q', zip, '-d', unzipped]);
  const assets = new Set(referencedAssets());
  const uploadsFromExport = readdirSync(unzipped).filter((f) => !assets.has(f)).sort();
  for (const f of uploadsFromExport) copyFileSync(join(unzipped, f), join(UPLOAD, f));

  // Pass 2: import again with the fresh thumbnails in upload/, so the probe
  // finds every block's thumbnail, then download the two JSON files.
  const pass2 = await importInApp();
  await pass2.tab('Blocks').click();
  await pass2.ready();
  const blocksTmp = join(tmp, 'blocks.json');
  await pass2.save(pass2.dialog.getByRole('button', { name: 'Download', exact: true }), blocksTmp);
  await pass2.tab('Template').click();
  await pass2.ready();
  const templateTmp = join(tmp, 'template.json');
  await pass2.save(pass2.dialog.getByRole('button', { name: 'Download', exact: true }), templateTmp);
  await pass2.context.close();

  // Guard the account values: a TPL value here means the preset leaked.
  const blocks = readFileSync(blocksTmp, 'utf8');
  const template = readFileSync(templateTmp, 'utf8');
  const entries = [...JSON.parse(blocks), JSON.parse(template)];
  const wrong = entries.filter((e) => e.clientId !== CLIENT_ID || e.ownedBy !== APP_OWNER_ID || e.folderId !== FOLDER_ID);
  if (wrong.length) throw new Error(`${wrong.length} exported entries carry the wrong client/owner/folder (first: ${wrong[0].name})`);
  const generic = JSON.parse(blocks).filter((b) => !b.name.startsWith('Utility — ') && /placeholder\.png$/.test(b.thumbnail ?? ''));
  if (generic.length) throw new Error(`${generic.length} blocks exported with the generic placeholder thumbnail (first: ${generic[0].name})`);

  const withOwner = (text, count) => {
    if (OWNER_ID === APP_OWNER_ID) return text;
    const from = `"ownedBy": ${APP_OWNER_ID},`;
    const n = text.split(from).length - 1;
    if (n !== count) throw new Error(`expected ${count} "${from}" lines, found ${n}`);
    return text.split(from).join(`"ownedBy": ${OWNER_ID},`);
  };
  writeFileSync(BLOCKS_JSON, withOwner(blocks, entries.length - 1));
  writeFileSync(TEMPLATE_JSON, withOwner(template, 1));

  let importerCommit = 'unknown';
  try {
    importerCommit = execSync('git rev-parse --short HEAD', { cwd: IMPORTER_DIR, encoding: 'utf8' }).trim();
  } catch {
    /* not a git checkout */
  }
  const manifest = {
    note: 'Written by npm run export-en. check-sync compares sourceHash with src/ to catch stale exports.',
    exportedAt: new Date().toISOString(),
    sourceHash: sourceHash(),
    assetRoot: EN_ASSET_ROOT,
    clientId: CLIENT_ID,
    ownedBy: OWNER_ID,
    folderId: FOLDER_ID,
    templateName: TEMPLATE_NAME,
    importerCommit,
    blocks: blockNames().filter((n) => n !== 'Main Content'),
    uploadsFromExport,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `export-en: ${entries.length - 1} blocks + template exported (client ${CLIENT_ID}, owner ${OWNER_ID}, folder ${FOLDER_ID}); ${uploadsFromExport.length} thumbnail files added to upload/`,
  );
} finally {
  await browser.close();
  server.close();
  child?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
