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
function fixture({
  phone = false,
  chrome = false,
  isPhonePresenting,
  onRevealPanel,
} = {}) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="left-panel-stack">
       <div id="data-panel" data-panel-id="data-panel" class="panel-collapsible collapsed"></div>
       <div id="scene-panel" data-panel-id="scene-panel" class="panel-collapsible collapsed"></div>
     </div>
     <aside id="right-context-rail">
       <div id="pp-toggles" data-panel-id="pp-toggles" class="panel-collapsible collapsed"><div id="param-slider-panel"></div><div id="draw-group"></div><div id="geo-import-group"></div></div>
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
    panelChannel.publish(
      options?.presentation
        ? { type: 'panel-changed', panelId: id, presentation: true }
        : { type: 'panel-changed', panelId: id },
    );
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
    isPhonePresenting,
    onRevealPanel,
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
    [
      'data-panel',
      false,
      { persist: false, syncShare: false, presentation: true },
    ],
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

test('Tools hosts Import, then Draw, moved out of the Display panel and back', (t) => {
  const { drawer, calls } = fixture();
  t.after(() => drawer.destroy());
  const draw = document.getElementById('draw-group');
  assert.equal(drawer.open('tools'), true);
  assert.deepEqual(hosted(drawer), ['geo-import-group', 'draw-group']);
  assert.equal(
    document.getElementById('draw-group'),
    draw,
    'moved, not cloned',
  );
  assert.deepEqual(calls, [], 'no panel state changes');
  // Map borrows the Display panel with both groups back in their home.
  drawer.open('map');
  assert.deepEqual(hosted(drawer), ['pp-toggles']);
  assert.deepEqual(
    [...document.getElementById('pp-toggles').children].map((node) => node.id),
    ['param-slider-panel', 'draw-group', 'geo-import-group'],
  );
  drawer.close();
  assert.equal(draw.parentElement.id, 'pp-toggles');
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

test('Radio borrowed before the Layers list renders moves into the Audio group once it does', async (t) => {
  const { drawer } = fixture();
  t.after(() => drawer.destroy());
  // A stored preference opens Layers at startup, before its list mounts.
  drawer.open('layers');
  const radio = document.getElementById('radio-panel');
  assert.equal(radio.parentElement, drawer.host);
  const focus = document.createElement('button');
  radio.append(focus);
  focus.focus();
  document
    .getElementById('data-panel')
    .insertAdjacentHTML(
      'beforeend',
      '<section data-layer-group="Audio"><div data-layer-id="radio"></div></section>',
    );
  await Promise.resolve();
  const audio = document.querySelector('[data-layer-group="Audio"]');
  assert.equal(radio.parentElement, audio);
  assert.equal(document.activeElement, focus, 'focus moves with it');
  drawer.close();
  assert.equal(drawer.host.contains(radio), false);
});

test("a directly hosted panel's details scroll it into view in its open destination", async (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  // Weather has been on the map for a while, its panel collapsed.
  const weather = document.getElementById('weather-panel');
  weather.classList.add('collapsed');
  weather.hidden = false;
  await Promise.resolve();
  drawer.open('layers');
  setPanelCollapsed('weather-panel', true, {});
  const scrolled = [];
  weather.scrollIntoView = (options) => scrolled.push(options);
  // The Weather row's details arrow, with Layers already open.
  setPanelCollapsed('weather-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'layers');
  await flushViews();
  await flushViews();
  assert.deepEqual(scrolled.at(-1), { block: 'nearest' });
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

test("voice opening Context keeps Context shown while the drawer borrows Inspect's camera panels", (t) => {
  const revealed = [];
  const { drawer, chrome } = fixture({
    chrome: true,
    onRevealPanel: (id) => revealed.push(id),
  });
  t.after(() => drawer.destroy());
  // Voice expands Context from the closed drawer. Opening Inspect expands
  // the collapsed camera panels inside that panel's own notification, so
  // theirs are delivered after it.
  chrome.setPanelCollapsed('global-context-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'inspect');
  assert.equal(revealed.at(-1), 'global-context-panel');
  assert.equal(revealed.includes('cctv-panel'), false);
});

test('expanding Radio in Layers while Context is collapsed stays on Layers', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => drawer.destroy());
  drawer.open('layers');
  const seen = [];
  drawer.channel.subscribe(({ state }) => seen.push(state.destination));
  // PanelChrome expands Radio's collapsed Context first, to contain it.
  chrome.setPanelCollapsed('radio-panel', false, { explicit: true });
  assert.equal(destination(drawer), 'layers');
  assert.equal(seen.includes('inspect'), false, `went through ${seen}`);
  assert.equal(
    drawer.host.contains(document.getElementById('radio-panel')),
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

test('a share restore opens the first expanded hosted panel in share order, once', (t) => {
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

test('back at desktop width the drawer reopens what it showed before the phone layout', (t) => {
  const { drawer, media, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  // Display is expanded, so the panels alone would show Map.
  setPanelCollapsed('pp-toggles', false, { explicit: true });
  drawer.open('tools');
  media.set(true);
  assert.equal(destination(drawer), null);
  assert.equal(
    document.getElementById('draw-group').parentElement.id,
    'pp-toggles',
  );
  media.set(false);
  assert.equal(destination(drawer), 'tools');
  assert.ok(drawer.host.contains(document.getElementById('draw-group')));
  // With nothing open when the phone layout took over, the panels decide.
  drawer.close();
  media.set(true);
  media.set(false);
  assert.equal(destination(drawer), 'map');
  // A resize through the phone width delivered after it ends moves nothing.
  drawer.open('tools');
  media.set(false);
  media.set(false);
  assert.equal(destination(drawer), 'tools');
});

test('a share or history restore on the phone picks the destination back at desktop width', (t) => {
  const { drawer, media, restore } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('tools');
  media.set(true);
  assert.equal(destination(drawer), null);
  // Back or Forward restores an expanded Data panel on the phone.
  restore(['data-panel']);
  media.set(false);
  assert.equal(destination(drawer), 'layers', 'the first expanded panel');
  // A restore that expands nothing leaves the drawer closed.
  drawer.open('tools');
  media.set(true);
  restore([]);
  media.set(false);
  assert.equal(destination(drawer), null);
});

test("a restore on the phone leaves the restore's lead panel to the phone shell", (t) => {
  const revealed = [];
  const { drawer, panelChannel } = fixture({
    phone: true,
    onRevealPanel: (id) => revealed.push(id),
  });
  t.after(() => drawer.destroy());
  // An old link: the Visual Presets tray and CCTV expanded, Data collapsed,
  // led by the tray, as the phone shell presents it.
  for (const id of ['pp-toggles', 'cctv-panel'])
    document.getElementById(id).classList.remove('collapsed');
  panelChannel.publish({
    type: 'panels-restored',
    panelIds: ORDER,
    lead: 'pp-toggles',
  });
  assert.deepEqual(revealed, ['pp-toggles']);
  assert.equal(destination(drawer), null);
});

test('startup following on a phone leaves the panels to the phone shell', (t) => {
  const revealed = [];
  const { drawer } = fixture({
    phone: true,
    onRevealPanel: (id) => revealed.push(id),
  });
  t.after(() => drawer.destroy());
  // A stored preference left CCTV expanded and Data collapsed.
  document.getElementById('cctv-panel').classList.remove('collapsed');
  drawer.followPanels();
  assert.deepEqual(revealed, []);
  assert.equal(destination(drawer), null);
});

test('a phone layout that ends in Cockpit leaves no destination to reopen later', (t) => {
  const { drawer, media } = fixture();
  t.after(() => drawer.destroy());
  const cockpit = (active) => {
    document.body.classList.toggle('cockpit-mode', active);
    window.dispatchEvent(
      new CustomEvent('gev:cockpit-mode-changed', { detail: { active } }),
    );
  };
  drawer.open('tools');
  media.set(true);
  cockpit(true);
  media.set(false); // widened in Cockpit
  cockpit(false);
  // Nothing was open when Cockpit began, so its exit opens nothing.
  assert.equal(destination(drawer), null);
  drawer.open('layers');
  drawer.close();
  media.set(true);
  media.set(false);
  // Nothing was open when this phone layout began and no panel is shown.
  assert.equal(destination(drawer), null);
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

test('in Cockpit the camera panels stand in the visible left stack, and go back to Context after', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => {
    document.body.classList.remove('cockpit-mode');
    drawer.destroy();
    chrome.destroy();
  });
  // Their home is Context's Cameras view, inside the rail Cockpit hides.
  const cameras = document.createElement('section');
  cameras.id = 'context-cameras-view';
  document.getElementById('global-context-panel').append(cameras);
  const cctv = document.getElementById('cctv-panel');
  cameras.append(cctv);
  drawer.open('inspect');
  document.body.classList.add('cockpit-mode');
  drawer.suspend();
  chrome.enterCockpit();
  const stack = document.getElementById('left-panel-stack');
  assert.deepEqual(
    [...stack.children].map((node) => node.id),
    ['data-panel', 'cctv-panel', 'scene-panel'],
  );
  // Opening CCTV's details there shows it.
  chrome.setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.equal(cctv.parentElement, stack);
  document.body.classList.remove('cockpit-mode');
  chrome.exitCockpit();
  drawer.resume();
  assert.equal(destination(drawer), 'inspect');
  drawer.close();
  assert.equal(cctv.parentElement, cameras, 'home in Context again');
});

for (const [id, expandedBefore] of [
  ['cctv-panel', false],
  ['street-level-panel', true],
]) {
  test(`${id} ${expandedBefore ? 'expanded' : 'collapsed'} before Cockpit: hidden on entry, shown and focusable once opened, home and state restored on exit`, (t) => {
    const { drawer, chrome } = fixture({ chrome: true });
    // Cockpit's own rule for the camera panels in its left stack.
    const css = readFileSync(
      new URL('./styles/cockpit.css', import.meta.url),
      'utf8',
    );
    const rule = css.match(
      /body\.cockpit-mode\s+#left-panel-stack\s+>\s+:is\(#cctv-panel, #street-level-panel\)\.collapsed\s*\{[^}]*\}/,
    )?.[0];
    assert.ok(rule, 'the cockpit rule exists');
    const style = document.createElement('style');
    style.textContent = rule;
    document.head.append(style);
    t.after(() => {
      style.remove();
      document.body.classList.remove('cockpit-mode');
      drawer.destroy();
      chrome.destroy();
    });
    // Both camera panels at home in Context's Cameras view.
    const cameras = document.createElement('section');
    cameras.id = 'context-cameras-view';
    document.getElementById('global-context-panel').append(cameras);
    cameras.append(document.getElementById('cctv-panel'));
    cameras.insertAdjacentHTML(
      'beforeend',
      '<div id="street-level-panel" data-panel-id="street-level-panel" class="panel-collapsible collapsed"></div>',
    );
    const panel = document.getElementById(id);
    panel.insertAdjacentHTML(
      'beforeend',
      `<button class="panel-collapse-btn" data-collapse-target="${id}">+</button>`,
    );
    if (expandedBefore) chrome.setPanelCollapsed(id, false, {});
    const homeOrder = [...cameras.children].map((node) => node.id);
    document.body.classList.add('cockpit-mode');
    drawer.suspend();
    chrome.enterCockpit();
    assert.equal(panel.parentElement.id, 'left-panel-stack');
    assert.equal(panel.classList.contains('collapsed'), true);
    assert.equal(getComputedStyle(panel).display, 'none', 'hidden on entry');
    chrome.setPanelCollapsed(id, false, { explicit: true });
    assert.notEqual(getComputedStyle(panel).display, 'none');
    const button = panel.querySelector('.panel-collapse-btn');
    button.focus();
    assert.equal(document.activeElement, button);
    document.body.classList.remove('cockpit-mode');
    chrome.exitCockpit();
    drawer.resume();
    assert.equal(panel.parentElement, cameras, 'home in Context again');
    assert.deepEqual(
      [...cameras.children].map((node) => node.id),
      homeOrder,
    );
    assert.equal(
      panel.classList.contains('collapsed'),
      !expandedBefore,
      'its collapse state from before Cockpit',
    );
  });
}

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

test('a switch that takes the focused control away hands focus into the new destination', (t) => {
  const { drawer } = fixture();
  t.after(() => drawer.destroy());
  document
    .getElementById('scene-panel')
    .insertAdjacentHTML('beforeend', '<button id="scene-play"></button>');
  document
    .getElementById('data-panel')
    .insertAdjacentHTML('beforeend', '<input id="layer-search" />');
  document.body.insertAdjacentHTML('beforeend', '<button id="map"></button>');
  drawer.open('stories');
  document.getElementById('scene-play').focus();
  // The Layers shortcut, pressed on a Stories control.
  drawer.toggle('layers');
  assert.equal(destination(drawer), 'layers');
  assert.equal(document.activeElement.id, 'layer-search');
  // Focus outside the drawer stays where it is.
  document.getElementById('map').focus();
  drawer.toggle('stories');
  assert.equal(document.activeElement.id, 'map');
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

test('Tools borrows the one Directions root, updates it in place, returns it on phones and never resurrects a disposed view', (t) => {
  const { drawer, calls, media } = fixture();
  t.after(() => drawer.destroy());
  const home = document.getElementById('data-panel');
  const directions = document.createElement('section');
  directions.id = 'directions-controls-body';
  const input = document.createElement('input');
  input.value = 'retained route draft';
  directions.append(input);
  home.append(directions);
  const footer = document.createElement('footer');
  footer.id = 'tools-scene-import';
  home.append(footer);
  drawer.open('tools');
  assert.deepEqual(hosted(drawer), [
    'geo-import-group',
    'draw-group',
    'directions-controls-body',
    'tools-scene-import',
  ]);
  assert.equal(document.getElementById(directions.id), directions);
  assert.deepEqual(calls, [], 'moving a section claims no PanelChrome state');
  media.set(true);
  assert.equal(directions.parentNode, home);
  assert.equal(footer.parentNode, home);
  assert.equal(input.value, 'retained route draft');
  media.set(false);
  assert.equal(directions.parentNode, drawer.host);
  drawer.open('layers');
  assert.equal(directions.parentNode, home);
  assert.equal(home.parentNode, drawer.host);
  drawer.open('tools');
  directions.remove();
  drawer.close();
  assert.equal(document.getElementById(directions.id), null);
  assert.equal(directions.parentNode, null);
});

// The dock's Visual Presets tray retired into Map & Look. Links keep its
// entry: written exactly as a default session wrote it, and an old link that
// had it open opens Map & Look on Look, as the destination it leads with.
test('links still write the retired Visual Presets tray as a default session did', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  assert.equal(document.getElementById('control-panel'), null);
  const { specs } = chrome._buildSharePanelState();
  assert.deepEqual(specs[0], {
    id: 'control-panel',
    collapsed: true,
    pinned: false,
  });
});

test('an old link with the Visual Presets tray open opens Map & Look on Look', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  const tabs = [];
  chrome.showMapLookTab = (tab) => tabs.push(tab);
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  // The tray leads, before an expanded Data panel later in the order, and a
  // collapsed Map & Look entry in the same link does not close it again.
  chrome._restorePanelState({
    specs: [
      { id: 'control-panel', collapsed: false, pinned: false },
      { id: 'data-panel', collapsed: false },
      { id: 'pp-toggles', collapsed: true },
    ],
  });
  assert.equal(destination(drawer), 'map');
  assert.deepEqual(tabs, ['look']);
  assert.equal(
    document.getElementById('pp-toggles').classList.contains('collapsed'),
    false,
  );
  // A pinned tray was open too.
  drawer.open('inspect');
  chrome._restorePanelState({
    specs: [{ id: 'control-panel', collapsed: true, pinned: true }],
  });
  assert.equal(destination(drawer), 'map');
});

test('an old link restored at phone width with the tray open opens Map & Look back at desktop width', (t) => {
  const { drawer, chrome, media } = fixture({ chrome: true });
  const tabs = [];
  chrome.showMapLookTab = (tab) => tabs.push(tab);
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  const restoreOnPhone = () => {
    media.set(true);
    chrome._restorePanelState({
      specs: [
        { id: 'control-panel', collapsed: false, pinned: false },
        { id: 'data-panel', collapsed: false },
      ],
    });
  };
  restoreOnPhone();
  assert.deepEqual(tabs, ['look']);
  media.set(false);
  // As a desktop restore of the same link does.
  assert.equal(destination(drawer), 'map');

  // A panel expanded on the phone after the restore supersedes its lead.
  restoreOnPhone();
  chrome.setPanelCollapsed('data-panel', true);
  chrome.setPanelCollapsed('data-panel', false);
  media.set(false);
  assert.equal(destination(drawer), 'layers');
});

test("a default link's closed tray leaves the restore to the panels it opens", (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  const tabs = [];
  chrome.showMapLookTab = (tab) => tabs.push(tab);
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  chrome._restorePanelState({
    specs: [
      { id: 'control-panel', collapsed: true, pinned: false },
      { id: 'data-panel', collapsed: false },
    ],
  });
  assert.equal(destination(drawer), 'layers');
  assert.deepEqual(tabs, []);
});

test('temporary phone panel borrowing preserves the previous desktop destination', (t) => {
  let presenting = false;
  const { drawer, media, setPanelCollapsed } = fixture({
    isPhonePresenting: () => presenting,
  });
  t.after(() => drawer.destroy());
  drawer.open('stories');
  media.set(true);
  presenting = true;
  setPanelCollapsed('data-panel', false, { persist: false, syncShare: false });
  setPanelCollapsed('data-panel', true, { persist: false, syncShare: false });
  presenting = false;
  media.set(false);
  assert.equal(destination(drawer), 'stories');
});

/**
 * Layers and Stories with their legacy headers, behind the real disclosure
 * binding, and a drawer over them.
 */
async function collapseFixture(t) {
  const { bindPanelDisclosure } = await import('./panelDisclosure.js');
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="left-panel-stack">${['data-panel', 'scene-panel']
      .map(
        (id) =>
          `<div id="${id}" data-panel-id="${id}" class="panel-collapsible collapsed"><div class="panel-inner"><div class="panel-header"><span class="panel-title">${id}</span><button class="panel-collapse-btn" data-collapse-target="${id}">+</button></div></div></div>`,
      )
      .join('')}</div>`,
  );
  const panelChannel = createStateChannel(() => ({ panels: {} }));
  const setPanelCollapsed = (id, collapsed) => {
    const panel = document.getElementById(id);
    panel.classList.toggle('collapsed', collapsed);
    const button = document.querySelector(`[data-collapse-target="${id}"]`);
    button.textContent = collapsed ? '+' : '−';
    button.setAttribute('aria-expanded', String(!collapsed));
  };
  const disclosures = ['data-panel', 'scene-panel'].map((id) =>
    bindPanelDisclosure({
      panel: document.getElementById(id),
      buttons: [document.querySelector(`[data-collapse-target="${id}"]`)],
      onEscape() {},
      onChange: (collapsed) => setPanelCollapsed(id, collapsed),
    }),
  );
  const drawer = createDrawerNavigation({
    document,
    panelChannel,
    setPanelCollapsed,
    restoreOrder: ORDER,
  });
  document.body.append(drawer.host, drawer.headerActions);
  t.after(() => {
    drawer.destroy();
    for (const disclosure of disclosures) disclosure.destroy();
    drawer.headerActions.remove();
    document.getElementById('left-panel-stack')?.remove();
    delete document.documentElement.dataset.uiTheme;
  });
  return { drawer };
}

const flushObservers = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a hosted panel's own collapse control sits in the drawer header, open or collapsed", async (t) => {
  const { drawer } = await collapseFixture(t);
  const button = document.querySelector('[data-collapse-target="data-panel"]');
  const header = button.parentElement;
  let clicks = 0;
  button.addEventListener('click', () => clicks++);

  drawer.open('layers');
  assert.equal(button.parentElement, drawer.headerActions);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  // Collapsed in the drawer, it stays in the header, and expands again there.
  button.focus();
  button.click();
  assert.equal(
    document.getElementById('data-panel').classList.contains('collapsed'),
    true,
  );
  assert.equal(button.parentElement, drawer.headerActions);
  assert.equal(document.activeElement, button);
  button.click();
  assert.equal(
    document.getElementById('data-panel').classList.contains('collapsed'),
    false,
  );
  assert.equal(clicks, 2, 'the same button and listener');

  // Another destination takes its own control; this one goes home.
  drawer.open('stories');
  assert.equal(button.parentElement, header);
  assert.deepEqual(
    [...drawer.headerActions.children].map(
      (node) => node.dataset.collapseTarget,
    ),
    ['scene-panel'],
  );
  drawer.close();
  assert.equal(drawer.headerActions.children.length, 0);
});

test('Cyber keeps the collapse control in its panel header, and focus follows every move', async (t) => {
  const { drawer } = await collapseFixture(t);
  const button = document.querySelector('[data-collapse-target="data-panel"]');
  const header = button.parentElement;
  drawer.open('layers');
  button.focus();
  document.documentElement.dataset.uiTheme = 'cyber';
  await flushObservers();
  assert.equal(button.parentElement, header);
  assert.equal(document.activeElement, button);
  delete document.documentElement.dataset.uiTheme;
  await flushObservers();
  assert.equal(button.parentElement, drawer.headerActions);
  assert.equal(document.activeElement, button);
  drawer.destroy();
  assert.equal(button.parentElement, header);
});

test("PanelChrome keeps a hosted panel's moved collapse control truthful", async (t) => {
  const { drawer } = await collapseFixture(t);
  const chrome = new PanelChrome({
    elements: {},
    operations: {},
    readHud: () => ({ visible: true, getVariant: () => 'tactical' }),
    readCockpit: () => null,
    readShareLinks: () => null,
    readInitialShare: () => null,
    readScrollRestoreOwner: () => null,
    readDisplayScrollTop: () => 0,
  });
  t.after(() => chrome.destroy());
  drawer.open('layers');
  const panel = document.getElementById('data-panel');
  const button = document.querySelector('[data-collapse-target="data-panel"]');
  assert.equal(button.parentElement, drawer.headerActions);
  panel.classList.add('collapsed');
  chrome._syncPanelCollapseButton(panel);
  assert.equal(button.textContent, '+');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-label'), 'Expand data-panel');
  panel.classList.remove('collapsed');
  chrome._syncPanelCollapseButton(panel);
  assert.equal(button.textContent, '−');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test("Inspect's Context collapse control joins the drawer header; its sections keep theirs", async (t) => {
  const { drawer } = await collapseFixture(t);
  document
    .getElementById('left-panel-stack')
    .insertAdjacentHTML(
      'beforeend',
      ['global-context-panel', 'cctv-panel', 'street-level-panel']
        .map(
          (id) =>
            `<div id="${id}" data-panel-id="${id}" class="panel-collapsible"><div class="panel-inner"><div class="panel-header"><span class="panel-title">${id}</span><button class="panel-collapse-btn" data-collapse-target="${id}">▶</button></div></div></div>`,
        )
        .join(''),
    );
  const button = (id) =>
    document.querySelector(`[data-collapse-target="${id}"]`);
  drawer.open('inspect');
  assert.equal(
    button('global-context-panel').parentElement,
    drawer.headerActions,
  );
  for (const id of ['cctv-panel', 'street-level-panel'])
    assert.equal(button(id).parentElement.className, 'panel-header');
  drawer.close();
  assert.equal(
    button('global-context-panel').parentElement.className,
    'panel-header',
  );
});

test('the real Context header carries the collapse control the drawer looks for', () => {
  const template = document.createElement('template');
  template.innerHTML = readFileSync(
    new URL('./templates/context.html', import.meta.url),
    'utf8',
  );
  assert.ok(
    template.content.querySelector(
      '#global-context-panel .panel-header > .panel-collapse-btn[data-collapse-target="global-context-panel"]',
    ),
  );
});

test('nested Cameras hosting keeps the complete shared panel state byte-identical', (t) => {
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => {
    drawer.destroy();
    chrome.destroy();
  });
  const cameras = document.createElement('section');
  cameras.id = 'context-cameras-view';
  document.getElementById('global-context-panel').append(cameras);
  const panel = document.getElementById('cctv-panel');
  cameras.append(panel);
  const shared = () => JSON.stringify(chrome._buildSharePanelState());
  const before = shared();
  drawer.open('inspect');
  assert.equal(panel.parentElement, cameras);
  assert.ok(drawer.host.contains(panel));
  assert.equal(shared(), before);
  drawer.close();
  assert.equal(panel.parentElement, cameras);
  assert.equal(shared(), before);
});

const cctvCollapsed = () =>
  document.getElementById('cctv-panel').classList.contains('collapsed');

test('a switch from the open list keeps it open and declines the expansion it causes, even after it settles', async (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('layers');
  // The switch settles, then the camera activation expands the panel.
  drawer.noteLayerSwitch('cctv', true)(true);
  setPanelCollapsed('cctv-panel', false, {});
  await Promise.resolve();
  assert.equal(destination(drawer), 'layers', 'the list stays open');
  assert.ok(!hosted(drawer).includes('cctv-panel'));
  assert.ok(cctvCollapsed(), 'the panel is not left expanded out of sight');
});

test('after a switch from the list, a shortcut, a camera pick or voice still opens Inspect', async (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('layers');
  drawer.noteLayerSwitch('cctv', true)(true);
  setPanelCollapsed('cctv-panel', false, {});
  await Promise.resolve();
  // The camera owner asks to show the panel again, without explicit intent.
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect');
  assert.ok(hosted(drawer).includes('cctv-panel'));
});

test('without a switch from the open list, or with the drawer closed, the camera panel opens Inspect', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  drawer.open('layers');
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect');
  drawer.close();
  setPanelCollapsed('cctv-panel', true, {});
  drawer.noteLayerSwitch('cctv', true)();
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect');
});

test('a hold ends with its switch, a restore, a change of destination or switching off; details still opens the panel', (t) => {
  const { drawer, setPanelCollapsed, panelChannel, restore } = fixture();
  t.after(() => drawer.destroy());
  const start = () => {
    drawer.close();
    setPanelCollapsed('cctv-panel', true, {});
    drawer.open('layers');
    return drawer.noteLayerSwitch('cctv', true);
  };
  // A switch that did not take effect (refused, failed) lets go.
  start()(false);
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect', 'released');
  // A share or history restore that keeps Layers clears the hold.
  start();
  restore(['data-panel']);
  assert.equal(destination(drawer), 'layers');
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect', 'restored');
  start();
  drawer.open('map');
  drawer.open('layers');
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect', 'left the list');
  start();
  drawer.noteLayerSwitch('cctv', false);
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect', 'switched off');
  start();
  panelChannel.publish({ type: 'panel-revealed', panelId: 'cctv-panel' });
  assert.equal(destination(drawer), 'inspect', 'details reveals the panel');
});

test('a switch takes no hold on a camera panel that is already expanded', (t) => {
  const { drawer, setPanelCollapsed } = fixture();
  t.after(() => drawer.destroy());
  setPanelCollapsed('cctv-panel', false, {});
  drawer.open('layers');
  assert.ok(!cctvCollapsed(), 'expanded at home behind Layers');
  drawer.noteLayerSwitch('cctv', true);
  // Later shown from elsewhere: collapse and expand as a camera owner would.
  setPanelCollapsed('cctv-panel', true, {});
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(destination(drawer), 'inspect');
});

test('a declined expansion leaves the visible, shared and saved collapse in agreement', async (t) => {
  const priorStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  Object.defineProperty(globalThis, 'localStorage', {
    value: window.localStorage,
    configurable: true,
  });
  t.after(() => {
    if (priorStorage)
      Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else delete globalThis.localStorage;
  });
  localStorage.clear();
  const { drawer, chrome } = fixture({ chrome: true });
  t.after(() => drawer.destroy());
  const key = 'godsEyeView.v6.panelCollapsed.cctv-panel';
  // The saved preference starts collapsed, as in a session that left it so.
  localStorage.setItem(key, '1');
  drawer.open('layers');
  drawer.noteLayerSwitch('cctv', true)(true);
  // The real owner publishes before it saves; the decline must come last.
  chrome.setPanelCollapsed('cctv-panel', false, {});
  await Promise.resolve();
  assert.equal(destination(drawer), 'layers');
  assert.ok(cctvCollapsed(), 'visible');
  assert.equal(localStorage.getItem(key), '1', 'saved');
  const shared = chrome
    ._buildSharePanelState()
    .specs.find((spec) => spec.id === 'cctv-panel');
  assert.equal(shared?.collapsed ?? true, true, 'shared');
});

test("the drawer and phone sheet headers show every collapse control's state as − or +", () => {
  const css = readFileSync(
    new URL('./styles/shell.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /:is\(\.gev-drawer-panel-actions, #mobile-sheet-panel-actions\)\s*>\s*\.panel-collapse-btn::before\s*\{\s*content: '−';/,
  );
  assert.match(
    css,
    /:is\(\.gev-drawer-panel-actions, #mobile-sheet-panel-actions\)\s*>\s*\.panel-collapse-btn\[aria-expanded='false'\]::before\s*\{\s*content: '\+';/,
  );
});
