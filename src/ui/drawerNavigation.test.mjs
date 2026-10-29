import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../testSupport/componentDom.mjs';

const { createStateChannel } = await import('../app/stateChannel.js');
const { DRAWER_DESTINATIONS, createDrawerNavigation } =
  await import('./drawerNavigation.js');
const { PanelChrome, SHARE_PANEL_STATE_SPECS } =
  await import('./panelChrome.js');
const { flushViews } = await import('./ownerState.js');

const ORDER = SHARE_PANEL_STATE_SPECS.map((spec) => spec.id);

/**
 * Today's stacks and panels, with a PanelChrome-shaped channel over them, or
 * with PanelChrome itself owning them (`chrome`).
 */
function fixture({ phone = false, chrome = false } = {}) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="left-panel-stack">
       <div id="data-panel" data-panel-id="data-panel" class="panel-collapsible collapsed"></div>
       <div id="scene-panel" data-panel-id="scene-panel" class="panel-collapsible collapsed"></div>
     </div>
     <aside id="right-context-rail">
       <div id="pp-toggles" data-panel-id="pp-toggles" class="panel-collapsible collapsed"><div id="param-slider-panel"></div></div>
       <div id="cctv-panel" data-panel-id="cctv-panel" class="panel-collapsible collapsed"></div>
       <div id="weather-panel" data-panel-id="weather-panel" class="panel-collapsible" hidden></div>
       <div id="global-context-panel" data-panel-id="global-context-panel" class="panel-collapsible collapsed">
         <section id="radio-panel" data-panel-id="radio-panel" class="panel-collapsible collapsed"></section>
       </div>
     </aside>
     <div id="corner-actions"></div>`,
  );
  let restoring = false;
  const read = () => {
    const panels = {};
    for (const node of document.querySelectorAll('[data-panel-id]'))
      panels[node.id] = {
        collapsed: node.classList.contains('collapsed'),
        autoCollapsed: node.classList.contains('layout-auto-collapsed'),
        pinned: false,
      };
    return { panels, restoring };
  };
  const panelChannel = createStateChannel(read);
  const calls = [];
  const setPanelCollapsed = (id, collapsed, options) => {
    calls.push([id, collapsed, options]);
    document.getElementById(id).classList.toggle('collapsed', collapsed);
    panelChannel.publish({ type: 'panel-changed', panelId: id });
  };
  const listeners = new Set();
  const media = {
    matches: phone,
    addEventListener: (type, listener) => listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
    set(matches) {
      this.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
  const owner = chrome
    ? new PanelChrome({
        elements: {},
        operations: {
          _syncContextRadioLauncherState() {},
          _syncCctvPanelViewport() {},
        },
        readHud: () => ({ visible: true, getVariant: () => 'tactical' }),
        readCockpit: () => null,
        readShareLinks: () => null,
        readInitialShare: () => null,
        readScrollRestoreOwner: () => null,
        readDisplayScrollTop: () => 0,
        readSharedCollapsed: (id) => drawer.sharedCollapsed(id),
      })
    : null;
  const drawer = createDrawerNavigation({
    document,
    panelChannel: owner?.channel ?? panelChannel,
    setPanelCollapsed: owner
      ? (id, collapsed, options) =>
          owner.setPanelCollapsed(id, collapsed, options)
      : setPanelCollapsed,
    restoreOrder: ORDER,
    phone: media,
  });
  document.body.append(drawer.host);
  // As PanelChrome restores a share or history state: the listed panels only.
  const restore = (expanded, panelIds = ORDER) => {
    const restored = panelIds.filter((id) => document.getElementById(id));
    restoring = true;
    for (const id of restored)
      setPanelCollapsed(id, !expanded.includes(id), {});
    restoring = false;
    panelChannel.publish({ type: 'panels-restored', panelIds: restored });
  };
  return {
    drawer,
    chrome: owner,
    panelChannel,
    setPanelCollapsed,
    calls,
    media,
    restore,
  };
}

const hosted = (drawer) => [...drawer.host.children].map((node) => node.id);
const destination = (drawer) => drawer.channel.getSnapshot().destination;

test('opening moves the very same panels into the drawer, expanded, and closing puts them back', (t) => {
  const { drawer, calls } = fixture();
  t.after(() => drawer.destroy());
  const panel = document.getElementById('data-panel');
  assert.equal(drawer.open('layers'), true);
  assert.deepEqual(hosted(drawer), [
    'data-panel',
    'weather-panel',
    'radio-panel',
  ]);
  assert.equal(
    document.getElementById('data-panel'),
    panel,
    'moved, not cloned',
  );
  assert.equal(panel.classList.contains('collapsed'), false);
  assert.deepEqual(calls, [
    ['data-panel', false, { persist: false, syncShare: false }],
  ]);
  drawer.close();
  assert.equal(panel.parentElement.id, 'left-panel-stack');
  assert.equal(panel.classList.contains('collapsed'), true);
  assert.equal(
    document.getElementById('weather-panel').parentElement.id,
    'right-context-rail',
  );
  assert.deepEqual(hosted(drawer), []);
  assert.equal(document.querySelectorAll('#data-panel').length, 1);
});

test('a change the user makes inside the drawer survives closing and is what share writes', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('stories');
  assert.equal(
    drawer.sharedCollapsed('scene-panel'),
    true,
    'borrowing is not shared',
  );
  setPanelCollapsed('scene-panel', true, { explicit: true });
  setPanelCollapsed('scene-panel', false, { explicit: true });
  assert.equal(drawer.sharedCollapsed('scene-panel'), true);
  setPanelCollapsed('scene-panel', true, { explicit: true });
  drawer.open('layers');
  assert.equal(
    document.getElementById('scene-panel').classList.contains('collapsed'),
    true,
  );
  assert.equal(drawer.sharedCollapsed('data-panel'), true);
  assert.equal(drawer.sharedCollapsed('scene-panel'), undefined);
});

test('share writing is byte-identical with any destination open', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  const chrome = new PanelChrome({
    elements: {},
    operations: {},
    readHud: () => ({ visible: true, getVariant: () => 'tactical' }),
    readCockpit: () => null,
    readShareLinks: () => null,
    readInitialShare: () => null,
    readScrollRestoreOwner: () => null,
    readDisplayScrollTop: () => 0,
    readSharedCollapsed: (id) => drawer.sharedCollapsed(id),
  });
  t.after(() => chrome.destroy());
  // The user had Cameras open before; it opened Inspect and stays expanded.
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  drawer.close();
  const written = () => JSON.stringify(chrome._buildSharePanelState());
  const closed = written();
  for (const { id } of DRAWER_DESTINATIONS) {
    drawer.open(id);
    assert.equal(written(), closed, `${id} open`);
  }
  drawer.close();
  assert.equal(written(), closed);
});

test('a panel expanded elsewhere opens its destination; Radio opens Layers', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'inspect');
  assert.ok(hosted(drawer).includes('cctv-panel'));
  setPanelCollapsed('param-slider-panel', false, {});
  assert.equal(
    destination(drawer),
    'inspect',
    'not a data-panel-id panel here',
  );
  setPanelCollapsed('pp-toggles', false, {});
  assert.equal(destination(drawer), 'map');
  // Radio lives under Layers: expanding it there moves the one Radio panel
  // out of Context, and closing puts it back inside Context.
  setPanelCollapsed('radio-panel', false, {});
  assert.equal(destination(drawer), 'layers');
  const radio = document.getElementById('radio-panel');
  assert.equal(radio.parentElement, drawer.host);
  assert.equal(document.querySelectorAll('#radio-panel').length, 1);
  drawer.close();
  assert.equal(radio.parentElement.id, 'global-context-panel');
});

test("Radio's home in Layers is the Audio group, after its layer row, and expanding it shows it there", async (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  document
    .getElementById('data-panel')
    .insertAdjacentHTML(
      'beforeend',
      '<section data-layer-group="Weather"><div data-layer-id="wind"></div></section><section data-layer-group="Audio"><div data-layer-id="radio"></div></section>',
    );
  const radio = document.getElementById('radio-panel');
  const home = radio.previousSibling;
  const shown = [];
  // The Layers list's own reveal shows a group its filter or tab hides; the
  // scroll waits for that paint.
  const reveal = (event) => shown.push(`reveal ${event.detail}`);
  document.addEventListener('gev:focus-layer-row', reveal);
  t.after(() => document.removeEventListener('gev:focus-layer-row', reveal));
  radio.scrollIntoView = (options) =>
    shown.push(radio.parentElement.dataset.layerGroup, options);
  setPanelCollapsed('radio-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'layers');
  assert.deepEqual(shown, ['reveal radio']);
  await flushViews();
  assert.deepEqual(shown, ['reveal radio', 'Audio', { block: 'nearest' }]);
  const audio = document.querySelector('[data-layer-group="Audio"]');
  assert.deepEqual(
    [...audio.children].map((node) => node.id || node.dataset.layerId),
    ['radio', 'radio-panel'],
  );
  assert.ok(drawer.host.contains(radio));
  assert.equal(document.querySelectorAll('#radio-panel').length, 1);
  drawer.close();
  assert.equal(radio.previousSibling, home, 'back in its place in Context');
});

test("a publication during the drawer's own borrowing cannot move it elsewhere", (t) => {
  const { drawer } = fixture();
  t.after(() => drawer.destroy());
  // Another panel changed before the borrow's publication reports it.
  document.getElementById('cctv-panel').classList.remove('collapsed');
  drawer.open('layers');
  assert.equal(destination(drawer), 'layers');
  assert.deepEqual(hosted(drawer), [
    'data-panel',
    'weather-panel',
    'radio-panel',
  ]);
  drawer.close();
  assert.equal(
    document.getElementById('data-panel').classList.contains('collapsed'),
    true,
  );
});

test('a rail restoring an auto-collapsed panel does not open the drawer', (t) => {
  const { drawer, panelChannel } = fixture();
  t.after(() => drawer.destroy());
  const panel = document.getElementById('cctv-panel');
  panel.classList.add('layout-auto-collapsed');
  panelChannel.publish({ type: 'panel-changed' });
  panel.classList.remove('collapsed', 'layout-auto-collapsed');
  panelChannel.publish({ type: 'panel-changed' });
  assert.equal(destination(drawer), null);
});

test('a share restore opens the first expanded hosted panel in share order, once (K9)', (t) => {
  const { drawer, restore } = fixture();
  t.after(() => drawer.destroy());
  const opened = [];
  drawer.channel.subscribe(
    ({ change }) =>
      change?.type === 'opened' && opened.push(change.destination),
    { emitCurrent: false },
  );
  restore(['scene-panel', 'data-panel', 'cctv-panel']);
  assert.deepEqual(opened, ['layers']);
  assert.equal(
    document.getElementById('scene-panel').classList.contains('collapsed'),
    false,
    'the others keep their flags',
  );
  restore([]);
  assert.equal(destination(drawer), null);
});

test("a restore into the open destination becomes the borrowed panel's own state", (t) => {
  const { drawer, restore } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('layers');
  assert.equal(drawer.sharedCollapsed('data-panel'), true, 'borrowed');
  restore(['data-panel'], ['data-panel']);
  assert.equal(destination(drawer), 'layers');
  assert.equal(drawer.sharedCollapsed('data-panel'), false, 'share writes it');
  drawer.close();
  assert.equal(
    document.getElementById('data-panel').classList.contains('collapsed'),
    false,
    'closing keeps the restored panel open',
  );
});

test('a restore that switches destinations keeps what it set on the panel it leaves', (t) => {
  const { drawer, restore } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('inspect');
  // Data comes before CCTV in share order, so the restore opens Layers.
  restore(['data-panel', 'cctv-panel'], ['data-panel', 'cctv-panel']);
  assert.equal(destination(drawer), 'layers');
  assert.equal(
    document.getElementById('cctv-panel').classList.contains('collapsed'),
    false,
    'giving Inspect back keeps the restored CCTV open',
  );
  assert.equal(drawer.sharedCollapsed('cctv-panel'), undefined);
});

test('a share restored after stored preferences opened a destination at startup keeps its flags', (t) => {
  const { drawer, restore } = fixture();
  t.after(() => drawer.destroy());
  // Stored preferences leave Context expanded, so startup opens Inspect.
  document.getElementById('global-context-panel').classList.remove('collapsed');
  drawer.followPanels();
  assert.equal(destination(drawer), 'inspect');
  assert.equal(drawer.sharedCollapsed('cctv-panel'), true, 'borrowed');
  restore(['cctv-panel']);
  assert.equal(destination(drawer), 'inspect');
  assert.equal(drawer.sharedCollapsed('cctv-panel'), false, 'share writes it');
  assert.equal(drawer.sharedCollapsed('global-context-panel'), true);
  drawer.close();
  const collapsed = (id) =>
    document.getElementById(id).classList.contains('collapsed');
  assert.equal(collapsed('cctv-panel'), false, 'the restored CCTV stays open');
  assert.equal(collapsed('global-context-panel'), true);
});

test('an expanded Radio shows Layers at startup and back at desktop width, not the Context it expanded', async (t) => {
  const { drawer, media, restore } = fixture();
  t.after(() => drawer.destroy());
  // Expanding Radio expands Context too, as its owner at home.
  for (const id of ['radio-panel', 'global-context-panel'])
    document.getElementById(id).classList.remove('collapsed');
  const radio = document.getElementById('radio-panel');
  let shown = 0;
  radio.scrollIntoView = () => shown++;
  drawer.followPanels();
  assert.equal(destination(drawer), 'layers');
  assert.ok(drawer.host.contains(radio));
  await flushViews();
  assert.equal(shown, 1, 'and shows it there');
  media.set(true);
  media.set(false);
  assert.equal(destination(drawer), 'layers');
  restore(['radio-panel', 'global-context-panel']);
  assert.equal(destination(drawer), 'layers', 'a restore picks it too');
});

test('stored or restored state never opens a destination for a panel that is not shown', (t) => {
  const { drawer } = fixture();
  t.after(() => drawer.destroy());
  // The weather panel starts expanded but hidden until its layers are on.
  drawer.followPanels();
  assert.equal(destination(drawer), null);
});

test('a weather panel appearing with the drawer closed opens Layers; another open destination stays', async (t) => {
  const { drawer } = fixture();
  t.after(() => drawer.destroy());
  const weather = document.getElementById('weather-panel');
  drawer.open('stories');
  weather.hidden = false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(destination(drawer), 'stories');
  drawer.close();
  weather.hidden = true;
  await new Promise((resolve) => setTimeout(resolve, 0));
  weather.hidden = false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(destination(drawer), 'layers');
});

test('the drawer rests on phones and in Cockpit, and Cockpit exit restores it', async (t) => {
  const { drawer, media, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('inspect');
  document.body.classList.add('cockpit-mode');
  window.dispatchEvent(
    new CustomEvent('gev:cockpit-mode-changed', { detail: { active: true } }),
  );
  assert.deepEqual(drawer.channel.getSnapshot(), {
    destination: null,
    active: false,
  });
  assert.equal(
    document.getElementById('cctv-panel').parentElement.id,
    'right-context-rail',
  );
  assert.equal(drawer.toggle('layers'), false, 'nothing opens while resting');
  document.body.classList.remove('cockpit-mode');
  window.dispatchEvent(
    new CustomEvent('gev:cockpit-mode-changed', { detail: { active: false } }),
  );
  assert.equal(destination(drawer), 'inspect');
  // The class alone, as a synthetic Cockpit sets it, rests the drawer too.
  document.body.classList.add('cockpit-mode');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(drawer.channel.getSnapshot().active, false);
  assert.equal(
    document.getElementById('cctv-panel').parentElement.id,
    'right-context-rail',
  );
  document.body.classList.remove('cockpit-mode');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(destination(drawer), 'inspect');
  media.set(true);
  assert.deepEqual(drawer.channel.getSnapshot(), {
    destination: null,
    active: false,
  });
  assert.deepEqual(hosted(drawer), []);
  // A panel the user expands on the phone opens its destination back on desktop.
  setPanelCollapsed('scene-panel', false, { explicit: true });
  assert.equal(destination(drawer), null);
  media.set(false);
  assert.equal(drawer.channel.getSnapshot().active, true);
  assert.equal(destination(drawer), 'stories');
});

test('an external open after moving to another destination shows the panel again: Data, Scenes, Radio', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  // Voice, Context's launcher and the Layers menu ask PanelChrome to show a
  // panel. Once expanded, a panel stays expanded when another destination
  // replaces its own, so the request is a reveal, not a collapse change.
  for (const [id, expected] of [
    ['data-panel', 'layers'],
    ['scene-panel', 'stories'],
    ['radio-panel', 'layers'],
  ]) {
    chrome.setPanelCollapsed(id, false, { explicit: true });
    assert.equal(destination(drawer), expected, id);
    drawer.open('inspect');
    chrome.setPanelCollapsed(id, false, { explicit: true });
    assert.equal(destination(drawer), expected, `${id} again`);
  }
  // Restoring or collapsing is not a request to show.
  drawer.open('inspect');
  chrome.setPanelCollapsed('data-panel', false, { restore: true });
  chrome.setPanelCollapsed('scene-panel', true, { explicit: true });
  assert.equal(destination(drawer), 'inspect');
});

test("a Cockpit round trip through PanelChrome's hooks leaves the panels' own state", (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => {
    document.body.classList.remove('cockpit-mode');
    drawer.destroy();
    chrome.destroy();
  });
  const collapsed = (id) =>
    document.getElementById(id).classList.contains('collapsed');
  const stored = () => JSON.stringify({ ...window.localStorage });
  const before = stored();
  drawer.open('layers');
  assert.equal(collapsed('data-panel'), false, 'Layers borrows Data');
  // Entry and exit as the shell wires them: the class first, then the panel
  // hooks around PanelChrome's snapshot and restoration, then the event.
  document.body.classList.add('cockpit-mode');
  drawer.suspend();
  chrome.enterCockpit();
  window.dispatchEvent(
    new CustomEvent('gev:cockpit-mode-changed', { detail: { active: true } }),
  );
  assert.equal(drawer.channel.getSnapshot().active, false);
  document.body.classList.remove('cockpit-mode');
  chrome.exitCockpit();
  drawer.resume();
  window.dispatchEvent(
    new CustomEvent('gev:cockpit-mode-changed', { detail: { active: false } }),
  );
  assert.equal(destination(drawer), 'layers');
  assert.equal(collapsed('data-panel'), false, 'Layers borrows Data again');
  drawer.close();
  assert.equal(collapsed('data-panel'), true);
  assert.equal(stored(), before, 'no stored preference changed');
});

test('the shell suspends the drawer before Cockpit snapshots and resumes it after Cockpit restores', () => {
  const shell = readFileSync(
    new URL('./applicationShell.js', import.meta.url),
    'utf8',
  );
  assert.match(
    shell,
    /this\._drawer\?\.suspend\(\);\s*this\._panelChrome\.enterCockpit\(\);/,
  );
  assert.match(
    shell,
    /this\._panelChrome\.exitCockpit\(\);\s*this\._drawer\?\.resume\(\);/,
  );
});

test('the rail and drawer paint each change before the operation that made it returns', () => {
  const shell = readFileSync(
    new URL('./applicationShell.js', import.meta.url),
    'utf8',
  );
  assert.match(
    shell,
    /this\._drawer\.channel\.subscribe\(\(\{ state \}\) => \{\s*for \(const view of views\) view\.update\(\{ state \}\);/,
  );
  for (const view of ['ShellRail.vue', 'ShellDrawer.vue']) {
    const source = readFileSync(new URL(`./${view}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /useOwnerState/, `${view} paints from props`);
    assert.match(source, /state: \{ type: Object, default: null \}/);
  }
});

test('closing with focus returns it to the opener, or to the rail button when the drawer opened another way', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  document.body.insertAdjacentHTML(
    'beforeend',
    `<button class="gev-rail-item" data-destination="stories"></button>
     <button id="opener"></button>`,
  );
  setPanelCollapsed('scene-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'stories');
  drawer.close({ focus: true });
  assert.equal(document.activeElement.dataset.destination, 'stories');
  const opener = document.getElementById('opener');
  drawer.open('stories', { focusReturn: opener });
  drawer.close({ focus: true });
  assert.equal(document.activeElement, opener);
});

test('destroy returns every panel and ends the channel', () => {
  const { drawer } = fixture();
  drawer.open('settings');
  assert.deepEqual(hosted(drawer), ['corner-actions']);
  drawer.destroy();
  drawer.destroy();
  assert.equal(
    document.getElementById('corner-actions').parentElement,
    document.body,
  );
  assert.equal(drawer.host.isConnected, false);
  assert.equal(drawer.channel.publish(), false);
});

test('every destination icon is in the icon font subset', () => {
  const html = readFileSync(
    new URL('../../index.html', import.meta.url),
    'utf8',
  );
  const subset = /icon_names=([a-z0-9_,]+)/.exec(html)[1].split(',');
  for (const { id, icon } of DRAWER_DESTINATIONS)
    assert.ok(subset.includes(icon), `${id}: ${icon}`);
});
