import test from 'node:test';
import assert from 'node:assert/strict';
import { readShellSource } from '../testSupport/readShellSource.mjs';
import { StyleManager } from './applicationShell.js';
import { PanelChrome } from './panelChrome.js';
import { VisualSettings } from './visualSettings.js';

function replaceDocument(t, value) {
  const prior = globalThis.document;
  globalThis.document = value;
  t.after(() => {
    globalThis.document = prior;
  });
}

function classList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (value) => values.has(value),
    toggle(value, force = !values.has(value)) {
      if (force) values.add(value);
      else values.delete(value);
      return force;
    },
  };
}

test('visual settings publish through the shell share sync and stop at destroy', (t) => {
  replaceDocument(t, {
    documentElement: { dataset: {} },
    getElementById: () => null,
  });
  let shareSyncs = 0;
  const shell = {
    _disposed: false,
    _shareState: {
      publish() {
        shareSyncs += 1;
      },
    },
  };
  const sync = () => StyleManager.prototype._syncShareState.call(shell);
  const hud = { visible: true, getVariant: () => 'tactical' };
  const owner = new VisualSettings({
    viewer: { scene: {} },
    elements: {},
    operations: { _syncShareState: sync },
    services: {
      governorRequestRender() {},
      holdContinuousRender() {},
      releaseContinuousRender() {},
      getDetectionTuning: () => ({ allocationStrategy: 'ELASTIC' }),
      getDetectionMode: () => 'OFF',
      isScopeMaskEnabled: () => false,
      getScopeMaskFeather: () => 0.2,
    },
    readHud: () => hud,
    readDataManager: () => null,
  });
  shell._visualSettings = owner;
  const seen = [];
  owner.channel.subscribe(({ state, change }) =>
    seen.push({ style: state.style, hud: state.hud, change }),
  );
  assert.deepEqual(seen[0].style, 'normal');
  owner.activeStyle = 'noir';
  owner._syncShareState();
  // A shell-owned change (setHudVisible, display controls) syncs the same way.
  hud.visible = false;
  sync();
  assert.equal(shareSyncs, 2);
  assert.deepEqual(seen.slice(1), [
    {
      style: 'noir',
      hud: { visible: true, variant: 'tactical' },
      change: { type: 'visual-changed' },
    },
    {
      style: 'noir',
      hud: { visible: false, variant: 'tactical' },
      change: { type: 'visual-changed' },
    },
  ]);
  sync();
  assert.equal(seen.length, 3, 'a sync with nothing changed publishes nothing');
  owner.destroy();
  hud.visible = true;
  sync();
  assert.equal(seen.length, 3, 'a destroyed owner publishes nothing');
  assert.equal(shareSyncs, 4, 'the share sync itself is unchanged');
});

test('panel chrome publishes every panel when a collapse button syncs, and stops at destroy', (t) => {
  const panels = [
    { id: 'data-panel', classList: classList(['collapsed']) },
    {
      id: 'weather-panel',
      classList: classList(['collapsed', 'layout-auto-collapsed']),
    },
    { id: 'scene-panel', classList: classList(['dock-pinned']) },
  ];
  for (const panel of panels) {
    panel.querySelectorAll = () => [];
    panel.querySelector = () => null;
  }
  replaceDocument(t, {
    getElementById: () => null,
    querySelectorAll: (selector) =>
      selector === '[data-panel-id]' ? panels : [],
  });
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
  const seen = [];
  chrome.channel.subscribe(({ state, change }) => seen.push({ state, change }));
  panels[0].classList.toggle('collapsed', false);
  chrome._syncPanelCollapseButton(panels[0]);
  assert.deepEqual(seen.at(-1), {
    state: {
      panels: {
        'data-panel': { collapsed: false, autoCollapsed: false, pinned: false },
        'weather-panel': {
          collapsed: true,
          autoCollapsed: true,
          pinned: false,
        },
        'scene-panel': { collapsed: false, autoCollapsed: false, pinned: true },
      },
      restoring: false,
    },
    change: { type: 'panel-changed', panelId: 'data-panel' },
  });
  chrome.destroy();
  chrome._syncPanelCollapseButton(panels[0]);
  assert.equal(seen.length, 2);
});

test('shell disposal releases its views before any owner stops or destroys a channel', () => {
  const source = readShellSource();
  const start = source.indexOf('  async dispose() {');
  const body = source.slice(start, source.indexOf('\n  }\n', start));
  const at = (pattern) => {
    const index = body.indexOf(pattern);
    assert.ok(index > 0, `dispose() calls ${pattern}`);
    return index;
  };
  const views = at('for (const view of this._views) view.dispose();');
  assert.ok(views > at('this._disposed = true;'));
  for (const later of [
    'this._navigation.stop();',
    'this._panelChrome.destroy();',
    'this._visualSettings.stop();',
    'await this._contextControls.restoreForDisposal();',
    'this._layerBindings.disconnect();',
    'this._visualSettings.destroy();',
  ])
    assert.ok(views < at(later), `views are released before ${later}`);
  assert.ok(
    at('await this._contextControls.restoreForDisposal();') <
      at('this._layerBindings.disconnect();'),
    'the layer channel ends in phase 2',
  );
});

test('every share sync publishes the visual channel, whoever made the change', () => {
  // HUD, display controls and VisualSettings all end in the shell's one share
  // sync; that hub publishes the visual channel too.
  const published = [];
  const shell = {
    _disposed: false,
    _shareState: { publish: (change) => published.push(['share', change]) },
    _visualSettings: {
      publishState: () => published.push(['visual']),
    },
  };
  StyleManager.prototype._syncShareState.call(shell);
  assert.deepEqual(published, [
    ['visual'],
    ['share', { type: 'settings-changed' }],
  ]);
  shell._disposed = true;
  StyleManager.prototype._syncShareState.call(shell);
  assert.equal(published.length, 2, 'a disposed shell publishes nothing');
  const source = readShellSource();
  const hud = source.slice(source.indexOf('  setHudVisible(mode) {'));
  assert.match(
    hud.slice(0, hud.indexOf('\n  }\n')),
    /this\.hud\.setMode\(normalized\);[\s\S]*this\._syncShareState\(\);/,
  );
});
