import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../testSupport/componentDom.mjs';

const { createStateChannel } = await import('../app/stateChannel.js');
const { createShellChrome } = await import('./shellChrome.js');
const { createStatusReadout, formatUtcMinute } =
  await import('./statusReadout.js');
const { mountView } = await import('./mountView.js');
const { flushViews } = await import('./ownerState.js');
const { default: ShellHeader } = await import('./ShellHeader.vue');

/** Today's chrome at home, the shell's slots, and an `active` channel. */
function fixture() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="home">
       <div id="title-bar"></div>
       <nav id="top-center-actions">
         <button id="clear-selected-layers"></button><button id="share-btn"></button>
         <button id="tilt-map-view"></button><button id="north-up-view"></button><button id="reset-globe-view"></button>
       </nav>
       <div id="command-dock"><div id="location-bar"><div id="popover"><div class="location-search-wrap"></div><div class="gev-location-results"></div></div></div></div>
     </div>
     <div id="slots">
       <div id="brand"></div><div id="search"></div><div id="places"></div>
       <div id="actions"></div><div id="map"></div>
     </div>`,
  );
  let active = false;
  const channel = createStateChannel(() => ({ active }));
  const byId = (id) => () => document.getElementById(id);
  const node = (selector) => () => document.querySelector(selector);
  const chrome = createShellChrome({
    channel,
    placements: [
      [byId('title-bar'), byId('brand')],
      [node('.location-search-wrap'), byId('search')],
      [node('.gev-location-results'), byId('search')],
      [byId('location-bar'), byId('places')],
      [byId('top-center-actions'), byId('actions')],
      [byId('north-up-view'), byId('map')],
      [byId('tilt-map-view'), byId('map')],
      [byId('reset-globe-view'), byId('map')],
    ],
  });
  const home = document.getElementById('home').innerHTML;
  return {
    chrome,
    home,
    setActive(next) {
      active = next;
      channel.publish({ type: 'active-changed' });
    },
    cleanup() {
      chrome.destroy();
      channel.destroy();
      document.getElementById('home')?.remove();
      document.getElementById('slots')?.remove();
    },
  };
}

const ids = (id) =>
  [...document.getElementById(id).children].map(
    (node) => node.id || node.className,
  );

test('the shell holds today’s chrome while active and puts every node back exactly while it rests', (t) => {
  const { home, setActive, cleanup } = fixture();
  t.after(cleanup);
  const share = document.getElementById('share-btn');
  setActive(true);
  assert.deepEqual(ids('brand'), ['title-bar']);
  assert.deepEqual(ids('search'), [
    'location-search-wrap',
    'gev-location-results',
  ]);
  assert.deepEqual(ids('places'), ['location-bar']);
  assert.deepEqual(ids('actions'), ['top-center-actions']);
  assert.deepEqual(ids('map'), [
    'north-up-view',
    'tilt-map-view',
    'reset-globe-view',
  ]);
  assert.deepEqual(
    [...document.getElementById('top-center-actions').children].map(
      (node) => node.id,
    ),
    ['clear-selected-layers', 'share-btn'],
  );
  assert.equal(
    document.getElementById('share-btn'),
    share,
    'moved, not cloned',
  );
  assert.equal(share.parentElement.parentElement.id, 'actions');
  // Idempotent while active.
  setActive(true);
  assert.deepEqual(ids('map').length, 3);
  // Phones and Cockpit: everything is home, in today's order and markup.
  setActive(false);
  assert.equal(document.getElementById('home').innerHTML, home);
  for (const slot of ['brand', 'search', 'places', 'actions', 'map'])
    assert.deepEqual(ids(slot), []);
  // And back again.
  setActive(true);
  assert.deepEqual(ids('places'), ['location-bar']);
});

test('destroy returns every node home', () => {
  const { chrome, home, setActive, cleanup } = fixture();
  setActive(true);
  chrome.destroy();
  chrome.destroy();
  assert.equal(document.getElementById('home').innerHTML, home);
  setActive(true);
  assert.deepEqual(ids('brand'), [], 'a destroyed placement stays home');
  cleanup();
});

test('destroy leaves a node its owner removed out of the document and returns the rest', () => {
  const { chrome, setActive, cleanup } = fixture();
  setActive(true);
  const results = document.querySelector('.gev-location-results');
  // Disposal removes the views (the results among them) and the header,
  // whose slots hold the rest, before the chrome.
  results.remove();
  document.getElementById('slots').remove();
  chrome.destroy();
  assert.equal(results.isConnected, false);
  assert.doesNotMatch(
    document.getElementById('home').innerHTML,
    /gev-shell-home/,
    'no placeholder is left behind',
  );
  assert.equal(document.getElementById('title-bar').parentElement.id, 'home');
  assert.equal(
    document.getElementById('north-up-view').parentElement.id,
    'top-center-actions',
  );
  cleanup();
});

test('the status readout shows the camera position and the UTC minute, publishing only changes', () => {
  const camera = {
    positionCartographic: {
      latitude: (30.2672 * Math.PI) / 180,
      longitude: (-97.7431 * Math.PI) / 180,
    },
  };
  let now = new Date(Date.UTC(2026, 9, 29, 12, 26, 5));
  const readout = createStatusReadout({
    camera,
    now: () => now,
    intervalMs: 60_000,
  });
  const seen = [];
  readout.channel.subscribe(({ state }) => seen.push(state), {
    emitCurrent: false,
  });
  assert.deepEqual(readout.channel.getSnapshot(), {
    coordinates: '30.2672° N, 97.7431° W',
    utc: 'UTC 2026-10-29 12:26',
  });
  now = new Date(Date.UTC(2026, 9, 29, 12, 26, 40));
  readout.sample();
  assert.equal(seen.length, 0, 'the same minute and position publish nothing');
  now = new Date(Date.UTC(2026, 9, 29, 12, 27, 0));
  readout.sample();
  assert.equal(seen.at(-1).utc, 'UTC 2026-10-29 12:27');
  camera.positionCartographic = undefined;
  readout.sample();
  assert.equal(seen.at(-1).coordinates, '');
  readout.destroy();
  assert.equal(
    formatUtcMinute(new Date(Date.UTC(2026, 0, 2, 3, 4))),
    'UTC 2026-01-02 03:04',
  );
});

test('the header counts the layers the Layers footer counts', async () => {
  let layers = [
    { id: 'flights', enabled: true, showInTogglePanel: true },
    { id: 'ships', enabled: false, showInTogglePanel: true },
    { id: 'event', enabled: true, showInTogglePanel: false },
  ];
  const channel = createStateChannel(() => ({ layers }));
  const host = document.createElement('div');
  document.body.append(host);
  const view = mountView(ShellHeader, {
    parent: host,
    props: { layers: channel, state: { active: true } },
  });
  const count = () => host.querySelector('.gev-header-count').textContent;
  assert.equal(count(), '1 layer active');
  layers = [...layers, { id: 'cctv', enabled: true, showInTogglePanel: true }];
  channel.publish();
  await flushViews();
  assert.equal(count(), '2 layers active');
  view.update({ state: { active: false } });
  assert.equal(host.querySelector('#gev-header').hidden, true);
  view.dispose();
  channel.destroy();
  host.remove();
});

test('the header search opens no tray, and the voice dock never takes the tray back from the header', () => {
  const shell = readFileSync(
    new URL('./applicationShell.js', import.meta.url),
    'utf8',
  );
  assert.match(
    shell,
    /_openLocationSearch: \(\) => \{\s*if \(this\._locationSearch\?\.closest\('#gev-header'\)\) return;/,
  );
  const voice = readFileSync(
    new URL('../voice/control.js', import.meta.url),
    'utf8',
  );
  assert.match(
    voice,
    /if \(locationBar\?\.parentNode === commandDock\)\s*commandDock\.insertBefore\(locationBar, root\);/,
  );
});

test('the readouts sample only while the status bar shows, fresh on its return', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let now = new Date(Date.UTC(2026, 9, 29, 12, 26, 0));
  let reads = 0;
  const camera = {
    positionCartographic: { latitude: 0.5283, longitude: -1.7059 },
  };
  const readout = createStatusReadout({
    camera,
    now: () => {
      reads++;
      return now;
    },
    intervalMs: 500,
    active: false,
  });
  const utc = () => readout.channel.getSnapshot().utc;
  assert.equal(utc(), 'UTC 2026-10-29 12:26', 'one reading at creation');
  now = new Date(Date.UTC(2026, 9, 29, 12, 27, 0));
  t.mock.timers.tick(2000);
  assert.equal(utc(), 'UTC 2026-10-29 12:26', 'no sampling while hidden');
  readout.setActive(true);
  assert.equal(utc(), 'UTC 2026-10-29 12:27', 'fresh at once on return');
  now = new Date(Date.UTC(2026, 9, 29, 12, 28, 0));
  t.mock.timers.tick(500);
  assert.equal(utc(), 'UTC 2026-10-29 12:28', 'samples while shown');
  readout.setActive(false);
  now = new Date(Date.UTC(2026, 9, 29, 12, 29, 0));
  t.mock.timers.tick(2000);
  assert.equal(utc(), 'UTC 2026-10-29 12:28', 'stops when hidden again');
  readout.setActive(true);
  assert.equal(utc(), 'UTC 2026-10-29 12:29');
  readout.destroy();
  const before = reads;
  t.mock.timers.tick(2000);
  readout.setActive(true);
  assert.equal(reads, before, 'inert after disposal');
});

test("the shell starts and stops the readouts with the drawer's active state", () => {
  const source = readFileSync(
    new URL('./applicationShell.js', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /createStatusReadout\(\{[\s\S]*?active: this\._drawer\.channel\.getSnapshot\(\)\.active,[\s\S]*?\}\)/,
  );
  assert.match(source, /this\._statusReadout\?\.setActive\(state\.active\)/);
});
