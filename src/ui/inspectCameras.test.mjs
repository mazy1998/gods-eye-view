import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';
import { expandApplicationHtml } from '../../build/application-html.js';
import { ContextControls } from './contextControls.js';
import { createDrawerNavigation } from './drawerNavigation.js';
import { createStateChannel } from '../app/stateChannel.js';
import { PanelChrome, SHARE_PANEL_STATE_SPECS } from './panelChrome.js';
import { StyleManager } from './applicationShell.js';
import { CctvControls } from './cctvControls.js';
import { initMobileShell } from './mobileShell.js';
import { flushViews } from './ownerState.js';

function fixture(t) {
  const html = expandApplicationHtml(
    readFileSync(new URL('../../index.html', import.meta.url), 'utf8'),
  );
  const template = document.createElement('template');
  template.innerHTML = html;
  container.append(template.content.querySelector('#right-context-rail'));
  const byId = (id) => document.getElementById(id);
  const calls = [];
  const controls = new ContextControls({
    elements: {
      _globalContextPanel: byId('global-context-panel'),
      _globalContextFlightsBtn: byId('global-context-flights-btn'),
      _globalContextMissionsBtn: byId('global-context-missions-btn'),
      _globalContextCamerasBtn: byId('global-context-cameras-btn'),
      _contextModeStandby: byId('context-mode-standby'),
      _contextFlightsView: byId('context-flights-view'),
      _contextMissionsView: byId('context-missions-view'),
      _contextCamerasView: byId('context-cameras-view'),
    },
    installations: {},
    actions: {
      getCockpit: () => null,
      claimVisualAuthority: () => calls.push('claim'),
      syncDetection: () => calls.push('detection'),
      scheduleLayout() {},
      setPanelCollapsed() {},
      showToast: () => calls.push('toast'),
    },
  });
  t.after(() => controls.stop());
  return { byId, calls, controls };
}

test('Cameras changes only the shown tab during an active or pending Context session', (t) => {
  const { byId, calls, controls } = fixture(t);
  for (const mode of ['flights', 'space-missions']) {
    controls._contextMode = mode;
    controls._contextModeChanging = true;
    controls._contextSessionSnapshot = { retained: mode };
    const snapshot = controls._contextSessionSnapshot;
    const generation = controls._contextModeGeneration;
    byId('global-context-cameras-btn').click();
    assert.equal(controls._contextMode, mode);
    assert.equal(controls._contextModeGeneration, generation);
    assert.equal(controls._contextSessionSnapshot, snapshot);
    assert.equal(controls._contextModeChanging, true);
    assert.equal(byId('context-cameras-view').hidden, false);
    assert.equal(byId('context-flights-view').hidden, true);
    assert.equal(byId('context-missions-view').hidden, true);
    assert.equal(byId('context-mode-standby').hidden, true);
    assert.equal(
      byId('global-context-cameras-btn').getAttribute('aria-selected'),
      'true',
    );
    // The pending mode can finish without taking the shown Cameras tab back.
    controls._contextModeChanging = false;
    controls._syncContextModeButtons();
    assert.equal(byId('context-cameras-view').hidden, false);
    calls.length = 0;
    byId('global-context-cameras-btn').click();
    assert.deepEqual(
      calls,
      [],
      'no detection, authority, staging or restore operation',
    );
    controls.showInspectTab('context');
    assert.equal(
      byId(
        mode === 'flights' ? 'context-flights-view' : 'context-missions-view',
      ).hidden,
      false,
    );
    assert.equal(controls._contextSessionSnapshot, snapshot);
  }
});

for (const [mode, buttonId, key] of [
  ['flights', 'global-context-flights-btn', 'ArrowRight'],
  ['space-missions', 'global-context-missions-btn', 'ArrowLeft'],
]) {
  for (const gesture of ['click', 'keyboard']) {
    test(`${gesture} returns from Cameras to running ${mode} without ending its session`, async (t) => {
      const { byId, controls, calls } = fixture(t);
      controls._contextMode = mode;
      const snapshot = { retained: mode };
      controls._contextSessionSnapshot = snapshot;
      const generation = controls._contextModeGeneration;
      const requested = [];
      controls._selectContextMode = async (next) => {
        requested.push(next);
        controls._contextMode = next;
        controls._syncContextModeButtons();
        return true;
      };
      controls.showInspectTab('cameras');
      calls.length = 0;
      if (gesture === 'click') byId(buttonId).click();
      else
        byId('global-context-cameras-btn').dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true }),
        );
      await Promise.resolve();
      assert.deepEqual(requested, []);
      assert.deepEqual(calls, []);
      assert.equal(controls._contextMode, mode);
      assert.equal(controls._contextSessionSnapshot, snapshot);
      assert.equal(controls._contextModeGeneration, generation);
      assert.equal(byId('context-cameras-view').hidden, true);
      assert.equal(byId(buttonId).getAttribute('aria-selected'), 'true');
      // Clicking the mode that is now shown keeps its existing exit gesture.
      byId(buttonId).click();
      await Promise.resolve();
      assert.deepEqual(requested, [null]);
      assert.equal(byId('context-mode-standby').hidden, false);
    });
  }
}

test('parent-panel reveals cannot reclaim Cameras when a mode finishes or a drawer borrows', (t) => {
  const { byId, controls } = fixture(t);
  controls._contextMode = 'flights';
  const sheets = [];
  const owner = {
    _contextControls: controls,
    _mobileShell: { setSheet: (sheet) => sheets.push(sheet) },
  };
  const reveal = (id) =>
    StyleManager.prototype._revealInspectCameraPanel.call(owner, id);
  assert.equal(reveal('cctv-panel'), true);
  assert.equal(byId('context-cameras-view').hidden, false);
  assert.equal(reveal('global-context-panel'), false);
  assert.equal(byId('context-cameras-view').hidden, false);
  assert.equal(controls._contextMode, 'flights');
  assert.equal(reveal('street-level-panel'), true);
  assert.deepEqual(sheets, ['inspect', 'inspect']);
});

test('reopening phone Inspect preserves Cameras without staging a tracked contact', async (t) => {
  const { controls } = fixture(t);
  const requested = [];
  const owner = {
    _contextControls: controls,
    getContextModeState: () => controls.getContextModeState(),
    getAircraftTrackingTarget: () => ({ id: 'tracked-aircraft' }),
    setContextMode: async (mode) => {
      requested.push(mode);
      return { ok: true };
    },
  };
  controls.showInspectTab('cameras');
  assert.equal(
    await StyleManager.prototype._onMobileTabOpened.call(owner, 'inspect'),
    false,
  );
  assert.deepEqual(requested, []);
  controls.showInspectTab('context');
  assert.equal(
    await StyleManager.prototype._onMobileTabOpened.call(owner, 'inspect'),
    true,
  );
  assert.deepEqual(requested, ['contacts']);
});

test('tab keyboard includes Cameras and teardown leaves retained tabs inert', (t) => {
  const { byId, controls } = fixture(t);
  const missions = byId('global-context-missions-btn');
  const cameras = byId('global-context-cameras-btn');
  missions.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
  );
  assert.equal(document.activeElement, cameras);
  assert.equal(byId('context-cameras-view').hidden, false);
  controls.stop();
  controls._shownContextTab = null;
  cameras.click();
  assert.equal(controls._shownContextTab, null);
});

test('folding CCTV hides its complete body while keeping its header reachable', (t) => {
  const { byId } = fixture(t);
  const style = document.createElement('style');
  style.textContent = readFileSync(
    new URL('./styles/camera-views.css', import.meta.url),
    'utf8',
  );
  document.head.append(style);
  const panel = byId('cctv-panel');
  panel.classList.remove('collapsed');
  assert.notEqual(getComputedStyle(byId('cctv-controls-body')).display, 'none');
  panel.classList.add('collapsed');
  assert.equal(getComputedStyle(byId('cctv-controls-body')).display, 'none');
  assert.notEqual(
    getComputedStyle(panel.querySelector('.panel-header')).display,
    'none',
  );
});

test('drawer reveals and restores the same nested camera panels without sharing its borrows', (t) => {
  const { byId, controls } = fixture(t);
  let restoring = false;
  const panels = () =>
    Object.fromEntries(
      [...container.querySelectorAll('[data-panel-id]')].map((node) => [
        node.id,
        { collapsed: node.classList.contains('collapsed') },
      ]),
    );
  const channel = createStateChannel(() => ({ panels: panels(), restoring }));
  const setPanelCollapsed = (id, collapsed, options = {}) => {
    byId(id).classList.toggle('collapsed', collapsed);
    channel.publish({
      type: options.explicit && !collapsed ? 'panel-revealed' : 'panel-changed',
      panelId: id,
    });
  };
  const drawer = createDrawerNavigation({
    document,
    panelChannel: channel,
    setPanelCollapsed,
    restoreOrder: SHARE_PANEL_STATE_SPECS.map((spec) => spec.id),
    onRevealPanel: (id) => {
      if (['cctv-panel', 'street-level-panel'].includes(id))
        controls.showInspectTab('cameras');
    },
  });
  container.append(drawer.host);
  t.after(() => {
    drawer.destroy();
    channel.destroy();
  });
  const camera = byId('cctv-panel');
  const street = byId('street-level-panel');
  drawer.open('inspect');
  assert.equal(
    byId('context-cameras-view').hidden,
    true,
    'opening Inspect does not select Cameras or a mode',
  );
  assert.equal(camera.parentElement.id, 'context-cameras-view');
  assert.equal(street.parentElement.id, 'context-cameras-view');
  assert.equal(drawer.sharedCollapsed('cctv-panel'), true);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.equal(
    byId('context-cameras-view').hidden,
    false,
    'repeated reveal selects the hidden tab',
  );
  controls.showInspectTab('context');
  restoring = true;
  for (const id of ['global-context-panel', 'cctv-panel', 'street-level-panel'])
    byId(id).classList.add('collapsed');
  street.classList.remove('collapsed');
  channel.publish({ type: 'panel-changed' });
  restoring = false;
  channel.publish({
    type: 'panels-restored',
    panelIds: ['global-context-panel', 'cctv-panel', 'street-level-panel'],
  });
  assert.equal(byId('context-cameras-view').hidden, false);
  assert.equal(drawer.channel.getSnapshot().destination, 'inspect');
  drawer.close();
  assert.equal(byId('cctv-panel'), camera);
  assert.equal(byId('street-level-panel'), street);
  assert.equal(camera.parentElement.id, 'context-cameras-view');
  assert.equal(
    street.classList.contains('collapsed'),
    false,
    'restored preference survives closing the drawer',
  );
});

for (const phone of [false, true]) {
  test(`${phone ? 'phone' : 'drawer'} restore keeps an enabled camera visible without sharing its host borrow`, async (t) => {
    const { byId, controls } = fixture(t);
    let drawer;
    let mobile;
    const chrome = new PanelChrome({
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
      readSharedCollapsed: (id) =>
        drawer?.sharedCollapsed(id) ?? mobile?.sharedCollapsed(id),
    });
    const media = new EventTarget();
    media.matches = phone;
    if (phone)
      mobile = initMobileShell({
        documentRef: document,
        matchMedia: () => media,
        panelChannel: chrome.channel,
        setPanelCollapsed: (...args) => chrome.setPanelCollapsed(...args),
        MutationObserverImpl: null,
        ResizeObserverImpl: null,
        requestFrame: () => {},
      });
    const shell = { _contextControls: controls, _mobileShell: mobile };
    drawer = createDrawerNavigation({
      document,
      panelChannel: chrome.channel,
      setPanelCollapsed: (...args) => chrome.setPanelCollapsed(...args),
      restoreOrder: SHARE_PANEL_STATE_SPECS.map((spec) => spec.id),
      phone: media,
      onRevealPanel: (id) =>
        StyleManager.prototype._revealInspectCameraPanel.call(shell, id),
    });
    container.append(drawer.host);
    const camera = {
      id: 'active-camera',
      city: 'Austin',
      name: 'Camera',
      headingDeg: 30,
      fovDeg: 44,
      rangeM: 145,
    };
    const state = {
      enabled: true,
      activeCameraId: camera.id,
      activeCamera: camera,
      cameras: [camera],
    };
    const cameraControls = new CctvControls({
      elements: { _cctvPanel: byId('cctv-panel') },
      cctv: { getUIState: () => state },
      actions: {
        isEnabled: () => true,
        syncViewport() {},
        setPanelCollapsed: (...args) => chrome.setPanelCollapsed(...args),
      },
    });
    t.after(() => {
      cameraControls.destroy();
      mobile?.destroy();
      drawer.destroy();
      chrome.destroy();
    });
    cameraControls.connect();
    const restored = {
      specs: [
        { id: 'cctv-panel', collapsed: false },
        { id: 'street-level-panel', collapsed: true },
        { id: 'global-context-panel', collapsed: true },
      ],
    };
    for (const child of ['cctv-panel', 'street-level-panel']) {
      const specs = restored.specs.map((spec) => ({
        ...spec,
        collapsed: spec.id === 'global-context-panel' || spec.id !== child,
      }));
      chrome._restorePanelState({ specs });
      await flushViews();
      assert.equal(
        byId('global-context-panel').classList.contains('collapsed'),
        false,
      );
      assert.equal(byId('context-cameras-view').hidden, false);
      for (const id of ['cctv-panel', 'street-level-panel']) {
        assert.equal(byId(id).parentElement.id, 'context-cameras-view');
        assert.equal(document.querySelectorAll(`#${id}`).length, 1);
      }
      if (phone) assert.equal(mobile.getSheet(), 'inspect');
      assert.equal(byId('cctv-enable-btn').textContent.trim(), 'CCTV on');
      assert.equal(
        chrome
          ._buildSharePanelState()
          .specs.find((spec) => spec.id === 'global-context-panel').collapsed,
        true,
      );
    }
    if (phone) mobile.setSheet(null);
    else drawer.close();
    assert.equal(
      byId('global-context-panel').classList.contains('collapsed'),
      true,
    );
    assert.equal(
      byId('street-level-panel').classList.contains('collapsed'),
      false,
    );
  });
}

for (const [panelId, anchorId] of [
  ['cctv-panel', 'global-context-cameras-btn'],
  ['street-level-panel', 'sl-status'],
])
  test(`${panelId} reveals land on its visible entry control`, async (t) => {
    const { byId, controls } = fixture(t);
    const chrome = new PanelChrome({
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
    });
    const drawer = createDrawerNavigation({
      document,
      panelChannel: chrome.channel,
      setPanelCollapsed: (...args) => chrome.setPanelCollapsed(...args),
      restoreOrder: SHARE_PANEL_STATE_SPECS.map((spec) => spec.id),
      onRevealPanel: (id) => {
        if (id === panelId) controls.showInspectTab('cameras');
      },
    });
    container.append(drawer.host);
    t.after(() => {
      drawer.destroy();
      chrome.destroy();
    });
    const scrolls = [];
    byId(anchorId).scrollIntoView = (options) =>
      scrolls.push(['entry', options]);
    byId(panelId).scrollIntoView = () => scrolls.push(['body']);
    chrome.setPanelCollapsed(panelId, false, { explicit: true });
    await flushViews();
    assert.ok(scrolls.length > 0);
    assert.ok(
      scrolls.every(
        ([target, options]) => target === 'entry' && options.block === 'start',
      ),
    );
  });

test('camera labels and provider chips read in the drawer language outside Cyber, and Cyber keeps its capitals', (t) => {
  const style = document.createElement('style');
  style.textContent = readFileSync(
    new URL('./styles/camera-views.css', import.meta.url),
    'utf8',
  );
  document.head.append(style);
  const host = document.createElement('div');
  host.className = 'gev-legacy-host';
  host.innerHTML = `<section id="context-cameras-view">
    <section id="cctv-panel"><div id="cctv-controls-body"><div class="camera-controls">
      <div class="cctv-controls">
        <button id="cctv-enable-btn" class="scene-btn">CCTV on</button>
        <button id="cctv-nearest-btn" class="gev-action-button scene-btn">NEAREST</button>
      </div>
      <span id="cctv-source-badge" class="gev-status-badge">SOURCE · LIVE</span>
      <div class="cctv-calibration-header">
        <button id="cctv-adjust-btn" class="scene-btn">ADJUST</button>
      </div>
      <div class="cctv-summary-label">SCENE SUMMARY</div>
    </div></div></section>
    <section id="street-level-panel">
      <div class="panel-header"><span class="panel-title">STREET LEVEL</span>
        <button id="sl-status" class="sl-status">OFF</button></div>
      <div id="sl-body"><div class="street-level-controls">
        <div class="sl-providers"><span class="cctv-summary-label">PROVIDERS</span>
          <div id="sl-provider-chips" class="sl-chips">
            <button class="gev-chip data-toggle-chip chip-active active" data-chip-id="mapillary">Mapillary</button>
            <button class="gev-chip data-toggle-chip chip-error" data-chip-id="google">Google Street View</button>
          </div></div>
        <button id="sl-nearest-btn" class="scene-btn sl-nearest-btn">Open Google Street View</button>
      </div></div>
    </section></section>`;
  document.body.append(host);
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    root.removeAttribute('lang');
    host.remove();
    style.remove();
  });
  const byId = (id) => getComputedStyle(document.getElementById(id));
  const chip = (id) =>
    getComputedStyle(document.querySelector(`[data-chip-id="${id}"]`));
  const title = () =>
    getComputedStyle(
      document.querySelector('#street-level-panel .panel-title'),
    );

  // Static labels lower their capitals; names and the CCTV acronym do not.
  for (const id of ['cctv-nearest-btn', 'sl-status'])
    assert.equal(byId(id).textTransform, 'lowercase', id);
  assert.equal(title().textTransform, 'lowercase');
  assert.equal(
    getComputedStyle(document.querySelector('.cctv-summary-label'))
      .textTransform,
    'lowercase',
  );
  for (const id of ['cctv-enable-btn', 'sl-nearest-btn'])
    assert.equal(byId(id).textTransform, 'none', id);
  assert.equal(chip('mapillary').textTransform, 'none');
  // Adjust and the badges use the drawer's sans face.
  assert.match(byId('cctv-adjust-btn').font, /--gev-font-sans/);
  assert.match(byId('cctv-source-badge').font, /--gev-font-sans/);
  // Chips share the Layers chip shape.
  assert.equal(chip('mapillary').minHeight, '32px');
  assert.equal(chip('mapillary').borderRadius, 'var(--gev-radius-sm)');

  root.dataset.uiTheme = 'cyber';
  assert.notEqual(byId('cctv-nearest-btn').textTransform, 'lowercase');
  assert.notEqual(chip('mapillary').minHeight, '32px');
  for (const id of ['cctv-enable-btn', 'sl-nearest-btn'])
    assert.equal(byId(id).textTransform, 'uppercase', id);
  assert.equal(chip('mapillary').textTransform, 'uppercase');
  assert.equal(chip('google').textTransform, 'uppercase');
  // Chinese wrote Google's name in mixed case before; it stays that way.
  root.lang = 'zh-CN';
  assert.equal(chip('google').textTransform, 'none');
  assert.equal(chip('mapillary').textTransform, 'uppercase');
});
