import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { initMobileShell } = await import('./mobileShell.js');
const { createAppearance } = await import('./appearance.js');
const { createStateChannel } = await import('../app/stateChannel.js');
const { createShellChrome } = await import('./shellChrome.js');
const { PanelChrome, SHARE_PANEL_STATE_SPECS } =
  await import('./panelChrome.js');

function fixture(
  t,
  {
    desktop = false,
    realPanels = false,
    settingsSurface = null,
    frames = null,
  } = {},
) {
  container.innerHTML = `<div id="left-panel-stack"><section id="data-panel" class="collapsed"><button>Layers control</button><section id="directions-controls-body"><button>Set A</button></section></section><section id="scene-panel" class="collapsed"><button id="scene-stop">Stop</button></section></div>
    <div id="right-context-rail">${['weather-panel', 'recent-imagery-panel', 'global-context-panel', 'cctv-panel', 'street-level-panel', 'pp-toggles'].map((id) => `<section id="${id}" class="collapsed"><button>${id}</button></section>`).join('')}</div>
    <div id="command-dock"><section id="location-bar" class="collapsed"><input id="location-search"><button>Place</button></section></div>
    <div id="tools-home"><section id="geo-import-group"><input type="file"></section><section id="draw-group"><button>Draw</button></section></div>
    <section id="radio-panel" class="collapsed"><button>Radio</button></section><div id="corner-actions"><button id="provider-launcher">Providers</button><div id="locale-picker"><button>Language</button></div></div><div id="desktop-search"></div>`;
  t.mock.method(HTMLElement.prototype, 'getClientRects', () => [
    { width: 20, height: 20 },
  ]);
  const nodes = new Map(
    [...container.querySelectorAll('[id]')].map((node) => [node.id, node]),
  );
  const parents = new Map(
    [...nodes].map(([id, node]) => [id, node.parentNode]),
  );
  const media = new EventTarget();
  media.matches = !desktop;
  const resize = (matches) => {
    media.matches = matches;
    media.dispatchEvent(Object.assign(new Event('change'), { matches }));
  };
  let owner;
  const chrome = realPanels
    ? new PanelChrome({
        elements: {},
        operations: {
          _syncContextRadioLauncherState() {},
          _syncCctvPanelViewport() {},
        },
        readHud: () => ({ visible: false, getVariant: () => 'tactical' }),
        readCockpit: () => null,
        readShareLinks: () => null,
        readInitialShare: () => null,
        readScrollRestoreOwner: () => null,
        readDisplayScrollTop: () => 0,
        readSharedCollapsed: (id) => owner?.sharedCollapsed(id),
      })
    : null;
  const panel = chrome?.channel ?? createStateChannel(() => ({}));
  const appearance = createAppearance({ storage: null });
  const entries = [];
  let shares = 0;
  owner = initMobileShell({
    matchMedia: () => media,
    ResizeObserverImpl: null,
    requestFrame: (callback) => {
      if (frames) frames.push(callback);
      else callback();
      return 1;
    },
    panelChannel: panel,
    settingsSurface,
    restoreOrder: SHARE_PANEL_STATE_SPECS.map((spec) => spec.id),
    appearance,
    onTabOpened: (sheet) => entries.push(sheet),
    onSheetsClosed: () => shares++,
    setPanelCollapsed(id, collapsed) {
      if (chrome)
        chrome.setPanelCollapsed(id, collapsed, {
          persist: false,
          syncShare: false,
        });
      else nodes.get(id)?.classList.toggle('collapsed', collapsed);
    },
  });
  t.after(() => {
    owner.destroy();
    panel.destroy();
    appearance.destroy();
  });
  const tab = (name) =>
    document.querySelector(`#mobile-tab-bar [data-mobile-sheet="${name}"]`);
  const destination = (name) =>
    document.querySelector(`[data-mobile-destination="${name}"]`);
  const host = () => document.getElementById('mobile-sheet-panels');
  return {
    owner,
    chrome,
    nodes,
    parents,
    resize,
    panel,
    appearance,
    entries,
    shares: () => shares,
    tab,
    destination,
    host,
  };
}

test('a details sheet switch measures credit clearance after its position settles', async (t) => {
  const frames = [];
  const priorHeight = Object.getOwnPropertyDescriptor(
    globalThis,
    'innerHeight',
  );
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    value: 844,
  });
  let sheetTop = 461;
  t.mock.method(HTMLElement.prototype, 'getBoundingClientRect', function () {
    return this.id === 'mobile-sheet'
      ? { top: sheetTop, height: 844 - sheetTop }
      : { top: 844, height: 0 };
  });
  const f = fixture(t, { frames });
  t.after(() => {
    if (priorHeight)
      Object.defineProperty(globalThis, 'innerHeight', priorHeight);
    else delete globalThis.innerHeight;
  });
  f.owner.setSheet('layers');
  f.resize(true);
  f.owner.setSheet('inspect', { revealPanelId: 'street-level-panel' });
  assert.equal(
    document.body.style.getPropertyValue('--mobile-sheet-cover'),
    '383px',
  );
  sheetTop = 263;
  for (const frame of frames.splice(0)) frame();
  assert.equal(
    document.body.style.getPropertyValue('--mobile-sheet-cover'),
    '581px',
  );
});

test('four tabs move the original destination nodes and restore them through desktop crossings', (t) => {
  const f = fixture(t);
  assert.deepEqual(
    [...document.querySelectorAll('.mobile-tab-label')].map(
      (node) => node.textContent,
    ),
    ['Layers', 'Inspect', 'Search', 'More'],
  );
  f.tab('layers').click();
  assert.deepEqual(
    [...f.host().children].map((node) => node.id),
    ['data-panel', 'weather-panel', 'recent-imagery-panel', 'radio-panel'],
  );
  assert.equal(f.host().firstElementChild, f.nodes.get('data-panel'));
  assert.equal(f.tab('layers').getAttribute('aria-expanded'), 'true');
  f.tab('inspect').click();
  assert.deepEqual(
    [...f.host().children].map((node) => node.id),
    ['global-context-panel', 'cctv-panel', 'street-level-panel'],
  );
  assert.equal(
    f.nodes.get('data-panel').parentNode,
    f.parents.get('data-panel'),
  );
  f.resize(false);
  assert.equal(f.owner.getSheet(), null);
  assert.equal(document.querySelector('.gev-phone-shell').hidden, true);
  for (const [id, node] of f.nodes)
    assert.equal(node.parentNode, f.parents.get(id), id);
  f.resize(true);
  f.tab('search').click();
  assert.equal(document.activeElement, f.nodes.get('location-search'));
  assert.equal(document.querySelectorAll('#location-search').length, 1);
  f.owner.destroy();
  for (const [id, node] of f.nodes)
    assert.equal(node.parentNode, f.parents.get(id), id);
  assert.equal(document.getElementById('mobile-sheet'), null);
});

test('More destinations reuse native controls and the existing appearance owner', async (t) => {
  const f = fixture(t);
  f.tab('more').click();
  assert.deepEqual(
    [...f.host().children].map((node) => node.id),
    ['pp-toggles'],
  );
  f.destination('stories').click();
  assert.equal(f.host().firstElementChild, f.nodes.get('scene-panel'));
  assert.ok(document.getElementById('scene-stop').closest('#mobile-sheet'));
  f.destination('tools').click();
  assert.deepEqual(
    [...f.host().children].map((node) => node.id),
    ['geo-import-group', 'draw-group', 'directions-controls-body'],
  );
  f.destination('settings').click();
  assert.equal(document.querySelectorAll('#gev-appearance-settings').length, 1);
  assert.equal(f.host().children.length, 0);
  assert.equal(
    f.nodes.get('corner-actions').parentNode,
    f.parents.get('corner-actions'),
  );
  document
    .querySelector('#gev-appearance-settings [role="radio"][value="light"]')
    ?.click();
  // Segment values are owner inputs, never duplicated phone state.
  const light = [
    ...document.querySelectorAll('#gev-appearance-settings [role="radio"]'),
  ].find((node) => node.textContent.trim() === 'Light');
  light.click();
  assert.equal(f.appearance.get(), 'light');
  f.tab('more').click();
  assert.equal(document.querySelector('#gev-appearance-settings'), null);
  assert.equal(
    f.nodes.get('corner-actions').parentNode,
    f.parents.get('corner-actions'),
  );
});

test('programmatic repeated reveals route to the sheet without the manual Inspect transaction', (t) => {
  const f = fixture(t);
  for (let count = 0; count < 2; count++) {
    f.panel.publish({ type: 'panel-revealed', panelId: 'cctv-panel' });
    assert.equal(f.owner.getSheet(), 'inspect');
  }
  assert.deepEqual(f.entries, []);
  f.tab('layers').click();
  f.tab('inspect').click();
  assert.deepEqual(f.entries, ['layers', 'inspect']);
  f.panel.publish({ type: 'panel-revealed', panelId: 'scene-panel' });
  assert.equal(f.owner.channel.getSnapshot().destination, 'stories');
  assert.equal(f.owner.getSheet(), 'more');
  const scrolls = [];
  f.nodes.get('radio-panel').scrollIntoView = (options) =>
    scrolls.push(options);
  f.panel.publish({ type: 'panel-revealed', panelId: 'radio-panel' });
  assert.equal(f.owner.getSheet(), 'layers');
  assert.equal(f.nodes.get('radio-panel').parentNode, f.host());
  assert.deepEqual(scrolls, [{ block: 'nearest' }]);
  assert.equal(f.owner.reveal('missing-panel'), false);
});

test('borrowed preferences, native Escape and blocked modes keep their ownership', async (t) => {
  const f = fixture(t);
  f.tab('layers').click();
  assert.equal(f.owner.sharedCollapsed('data-panel'), true);
  f.nodes.get('data-panel').classList.add('collapsed');
  assert.equal(f.owner.sharedCollapsed('data-panel'), true);
  f.tab('search').click();
  const input = f.nodes.get('location-search');
  input.addEventListener('keydown', (event) => event.preventDefault(), {
    once: true,
  });
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(f.owner.getSheet(), 'search');
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(f.owner.getSheet(), null);
  f.tab('more').click();
  document.body.classList.add('scene-playback-mode');
  await Promise.resolve();
  assert.equal(f.owner.getSheet(), 'more');
  document.body.classList.add('recording-mode');
  await Promise.resolve();
  assert.equal(f.owner.getSheet(), 'more');
  assert.equal(f.owner.setDestination('settings'), false);
  f.owner.setSheet(null);
  f.tab('more').click();
  assert.equal(f.owner.channel.getSnapshot().destination, 'stories');
  document.body.classList.remove('scene-playback-mode');
  await Promise.resolve();
  assert.equal(f.owner.getSheet(), null);
  assert.equal(document.querySelector('.gev-phone-shell').hidden, true);
  document.body.classList.remove('recording-mode', 'scene-playback-mode');
  document.body.classList.add('ui-embed');
  await Promise.resolve();
  assert.equal(f.owner.setSheet('layers'), false);
  assert.equal(f.owner.getSheet(), null);
  assert.equal(document.querySelector('.gev-phone-shell').hidden, true);
  document.body.classList.remove('ui-embed');
});

test('phone and desktop chrome pass the same live search field between their homes', (t) => {
  const f = fixture(t, { desktop: true });
  let active = true;
  const desktop = createStateChannel(() => ({ active }));
  const chrome = createShellChrome({
    channel: desktop,
    placements: [
      [
        () => f.nodes.get('location-search'),
        () => f.nodes.get('desktop-search'),
      ],
    ],
  });
  t.after(() => {
    chrome.destroy();
    desktop.destroy();
  });
  assert.equal(f.nodes.get('location-search').parentNode.id, 'desktop-search');
  f.resize(true);
  active = false;
  desktop.publish({ type: 'responsive' });
  f.tab('search').click();
  assert.equal(
    f.nodes.get('location-search').closest('#mobile-sheet'),
    document.getElementById('mobile-sheet'),
  );
  f.resize(false);
  active = true;
  desktop.publish({ type: 'responsive' });
  assert.equal(f.nodes.get('location-search').parentNode.id, 'desktop-search');
  assert.equal(document.querySelectorAll('#location-search').length, 1);
});

test('disposed native content is not resurrected when its sheet closes', (t) => {
  const f = fixture(t);
  f.tab('layers').click();
  f.nodes.get('data-panel').remove();
  f.owner.setSheet(null);
  assert.equal(document.getElementById('data-panel'), null);
});

test('phone restoration opens the first expanded panel and preserves the restored preference after close', (t) => {
  const f = fixture(t, { realPanels: true });
  assert.equal(f.owner.getSheet(), null);
  const style = document.createElement('style');
  style.textContent = '#left-panel-stack > #scene-panel { display: none }';
  container.append(style);
  assert.equal(getComputedStyle(f.nodes.get('scene-panel')).display, 'none');
  f.chrome._restorePanelState({
    specs: [{ id: 'scene-panel', collapsed: false }],
  });
  assert.equal(f.owner.getSheet(), 'more');
  assert.equal(f.owner.channel.getSnapshot().destination, 'stories');
  f.owner.setSheet(null);
  assert.equal(
    f.nodes.get('scene-panel').classList.contains('collapsed'),
    false,
  );
  f.chrome._restorePanelState({
    specs: [
      { id: 'scene-panel', collapsed: true },
      { id: 'cctv-panel', collapsed: false },
    ],
  });
  assert.equal(f.owner.getSheet(), 'inspect');
  f.owner.setSheet(null);
  assert.equal(
    f.nodes.get('cctv-panel').classList.contains('collapsed'),
    false,
  );
});

test('a restore during borrowing replaces the borrowed baseline, including an unchanged open panel', (t) => {
  const f = fixture(t, { realPanels: true });
  f.tab('layers').click();
  f.chrome._restorePanelState({
    specs: [
      { id: 'data-panel', collapsed: false },
      { id: 'scene-panel', collapsed: false },
    ],
  });
  f.owner.setSheet(null);
  const specs = f.chrome._buildSharePanelState().specs;
  assert.equal(specs.find((spec) => spec.id === 'data-panel').collapsed, false);
  assert.equal(
    specs.find((spec) => spec.id === 'scene-panel').collapsed,
    false,
  );
  f.resize(false);
  assert.equal(
    f.nodes.get('data-panel').classList.contains('collapsed'),
    false,
  );
});

test('a retired tray restore leads with Map and Look ahead of other expanded panels', (t) => {
  const f = fixture(t, { realPanels: true });
  const tabs = [];
  f.chrome.showMapLookTab = (tab) => tabs.push(tab);
  f.chrome._restorePanelState({
    specs: [
      { id: 'control-panel', collapsed: false },
      { id: 'data-panel', collapsed: false },
      { id: 'pp-toggles', collapsed: true },
    ],
  });
  assert.deepEqual(tabs, ['look']);
  assert.equal(f.owner.channel.getSnapshot().destination, 'map');
  assert.equal(f.owner.getSheet(), 'more');
  assert.equal(document.getElementById('control-panel'), null);
  f.owner.setSheet(null);
  assert.equal(
    f.nodes.get('pp-toggles').classList.contains('collapsed'),
    false,
  );
});

test('phone Settings mounts the shared sections and releases native content before returning to desktop', async (t) => {
  const { createSettingsSurface } =
    await import('./settings/settingsSurface.js');
  const actions = [];
  const surface = createSettingsSurface({
    openVoice: () => actions.push('voice'),
    closeLanguage: () => actions.push('language-close'),
  });
  t.after(() => surface.destroy());
  const f = fixture(t, { settingsSurface: surface });
  const picker = document.getElementById('locale-picker');
  const home = picker.parentNode;
  f.owner.setDestination('settings');
  assert.equal(document.querySelectorAll('.gev-settings').length, 1);
  assert.ok(picker.closest('.gev-settings-language'));
  surface.select('voice');
  await Promise.resolve();
  const button = [...document.querySelectorAll('.gev-settings button')].find(
    (node) => node.textContent === 'Voice Settings',
  );
  button.click();
  assert.deepEqual(actions, ['voice']);
  f.resize(false);
  assert.equal(document.querySelector('.gev-settings'), null);
  assert.equal(picker.parentNode, home);
  assert.equal(surface.channel.getSnapshot().section, 'voice');
  assert.deepEqual(actions, ['voice', 'language-close']);
});

test('opening voice settings releases the phone sheet before invoking the existing gear, without a mic click', async (t) => {
  const { StyleManager } = await import('./applicationShell.js');
  const f = fixture(t);
  f.owner.setDestination('settings');
  const gear = document.createElement('button');
  gear.id = 'gev-voice-settings-button';
  const mic = document.createElement('button');
  mic.id = 'gev-voice-button';
  container.append(gear, mic);
  let gears = 0;
  let microphones = 0;
  gear.addEventListener('click', () => {
    assert.equal(f.owner.getSheet(), null);
    gears++;
  });
  mic.addEventListener('click', () => microphones++);
  StyleManager.prototype._openVoiceSettings.call({ _mobileShell: f.owner });
  assert.equal(gears, 1);
  assert.equal(microphones, 0);
});
