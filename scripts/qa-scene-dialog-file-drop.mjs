#!/usr/bin/env node
/**
 * qa-scene-dialog-file-drop — the SHARE SCENE dialog's file control accepts a
 * file dropped from the desktop, proved in a real browser.
 *
 * The production sharing owner opens its dialog with a native
 * input. Drop on the row's centre through CDP and assert the selected filename.
 * Run against a fresh app server with QA_BASE_URL=http://localhost:4183.
 * The isolated Vite-served fixture loads no map or provider.
 *
 * Needs the repository's puppeteer (devDependencies). Exit status 0 when the
 * drop selects the file, 1 otherwise.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';

const PAGE = `<!doctype html><html lang="en"><head><link rel="stylesheet" href="/style.css"></head><body>
<script type="module">
  import { createSceneSharing } from '/src/scenes/sharing.js';
  const project={version:6,scenes:[{id:'fixture',title:'File drop fixture',shots:[]}]};
  const sharing=createSceneSharing({
    _project:project,_selectedSceneId:'fixture',
    _bundleAssets:{snapshot:()=>new Map()},
    _dataPacks:{sourceIds:()=>[]},dataManager:{getAll:()=>[]},
  });
  window.openDialog=()=>{
    sharing.share();
    const files=document.querySelector('[data-director-dialog] input[type=file]');
    window.filesInput=files;
    const row=files.parentElement.lastElementChild;
    const r=row.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  };
  window.ready=true;
</script></body></html>`;

async function dropOn(client, x, y, file) {
  const data = { items: [], files: [file], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) {
    await client.send('Input.dispatchDragEvent', { type, x, y, data });
  }
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'qa-scene-dialog-drop-'));
  const pack = path.join(dir, 'pack.json');
  await writeFile(pack, '{}');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    // Vite serves the production owner/view modules; the isolated document keeps
    // unrelated app-wide drop handlers out of this native-input geometry check.
    await page.setRequestInterception(true);
    page.on('request', (request) =>
      request.resourceType() === 'document'
        ? request.respond({ status: 200, contentType: 'text/html', body: PAGE })
        : request.continue(),
    );
    await page.goto(process.env.QA_BASE_URL || 'http://localhost:4173');
    await page.waitForFunction(() => window.ready === true);
    const point = await page.evaluate(() => window.openDialog());
    const client = await page.createCDPSession();
    await dropOn(client, point.x, point.y, pack);
    const names = await page.evaluate(() =>
      [...window.filesInput.files].map((file) => file.name),
    );
    console.log(JSON.stringify({ names, errors }));
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
    if (names.length !== 1 || names[0] !== 'pack.json') {
      throw new Error(
        `expected the dropped pack.json to be selected, got ${JSON.stringify(names)}`,
      );
    }
    console.log('OK: a file dropped on the visible control is selected');
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
