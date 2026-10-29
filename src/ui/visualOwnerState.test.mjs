import test from 'node:test';
import assert from 'node:assert/strict';
import { StyleManager } from './applicationShell.js';
import { AircraftDisplay } from './aircraftDisplay.js';
import { createMapStackChannel } from './mapStackChannel.js';
import {
  DISPLAY_CONTROLS,
  VisualSettings,
  sanitizeRangeValue,
} from './visualSettings.js';

function replaceDocument(t, value) {
  const previous = globalThis.document;
  globalThis.document = value;
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

/** A VisualSettings with fake services and whichever elements a case passes. */
function visualOwner(t, { elements = {}, syncs = [] } = {}) {
  replaceDocument(t, {
    documentElement: {
      dataset: {},
      style: { setProperty() {}, removeProperty() {} },
    },
    body: { classList: { contains: () => false } },
    getElementById: () => null,
  });
  return new VisualSettings({
    viewer: { scene: {} },
    elements,
    operations: { _syncShareState: () => syncs.push('share') },
    services: {
      governorRequestRender() {},
      holdContinuousRender() {},
      releaseContinuousRender() {},
      getDetectionTuning: () => ({ allocationStrategy: 'ELASTIC' }),
      getDetectionMode: () => 'OFF',
      isScopeMaskEnabled: () => false,
      getScopeMaskFeather: () => 0.2,
      getScopeTerminusOverride: () => null,
      setKeyholeFadeTuning() {},
      isCelestialRingStyleSupported: (style) => style === 'normal',
    },
    readHud: () => ({ visible: true, getVariant: () => 'tactical' }),
    readModels3d: () => ({ enabled: true, mode: 'proximity' }),
    readCleanView: () => false,
    readCelestialRing: () => null,
    readDataManager: () => null,
  });
}

test('a written value lands where its range input would put it', () => {
  const density = DISPLAY_CONTROLS.densityPct;
  assert.equal(sanitizeRangeValue(60, density), 50, 'snaps to step 25');
  assert.equal(sanitizeRangeValue(62.5, density), 75, 'a tie rounds up');
  assert.equal(sanitizeRangeValue(130, density), 100, 'clamps to max');
  assert.equal(sanitizeRangeValue('abc', density), 50, 'unparsable → midpoint');
  assert.equal(sanitizeRangeValue('7.6', DISPLAY_CONTROLS.fadePct), 8);
  assert.equal(sanitizeRangeValue(-4, DISPLAY_CONTROLS.fadePct), 0);
  assert.equal(sanitizeRangeValue(39.9, { min: 0, max: 39, step: 2 }), 38);
});

test('the owner keeps Display values, sanitized as their sliders hold them', (t) => {
  // The Display and Look views render these values (S11b-1, S11b-2); the
  // owner no longer paints or reads any slider.
  const owner = visualOwner(t);
  for (const [name, { value }] of Object.entries(DISPLAY_CONTROLS))
    assert.equal(owner._controlValue(name), value, `${name} starts at markup`);
  assert.equal(owner._setControlValue('sharpenPct', 73.4), 73);
  assert.equal(owner._controlValue('sharpenPct'), 73);
  assert.equal(owner._setControlValue('fadePct', 55), 40, 'clamped to its range');
  assert.equal(owner._controlValue('fadePct'), 40);
});

test('share state and detection state read the owner, with no slider in the page', (t) => {
  const owner = visualOwner(t);
  owner._setControlValue('sharpenPct', 63);
  owner._setControlValue('densityPct', 75);
  owner._setControlValue('fadePct', 12);
  owner._setControlValue('outsideOpacityPct', 30);
  const { options } = owner._readShareState();
  assert.equal(options.sharpenIntensity, 63);
  assert.equal(options.detectionFadePct, 12);
  assert.equal(options.detectionOutsideOpacityPct, 30);
  assert.deepEqual(
    [owner.getDetectionState().densityPct, owner.getDetectionState().fadePct],
    [75, 12],
  );
  const visual = owner.getVisualState();
  assert.equal(visual.sharpen.intensity, 63);
  assert.deepEqual(
    [visual.detection.density, visual.detection.fadePct, visual.detection.outsideOpacityPct],
    [75, 12, 30],
  );
});

test('story shots keep their visual state; views get the display settings too', (t) => {
  const owner = visualOwner(t);
  // Scenes store getVisualState() in every shot, so its shape is pinned.
  assert.deepEqual(Object.keys(owner.getVisualState()), [
    'style',
    'bloom',
    'sharpen',
    'hud',
    'detection',
    'scope',
    'mapStack',
    'styleParams',
  ]);
  const view = owner.getViewState();
  assert.deepEqual(
    Object.keys(view).slice(-4),
    ['celestial', 'sonar', 'models3d', 'cleanView'],
  );
  assert.deepEqual(view.celestial, { enabled: false, eligible: true });
  assert.deepEqual(Object.keys(view.sonar).sort(), [
    'enabled',
    'intensity',
    'opacity',
    'range',
    'rings',
    'sector',
  ]);
  assert.deepEqual(view.models3d, { enabled: true, mode: 'proximity' });
  assert.equal(view.cleanView, false);
  const seen = [];
  owner.channel.subscribe(({ state }) => seen.push(state));
  assert.deepEqual(seen[0], owner.getViewState(), 'the channel carries the view state');
});

test('sonar changes reach views once, without a share sync', (t) => {
  const syncs = [];
  const owner = visualOwner(t, { syncs });
  owner._syncCyberSonarControl = () => {};
  const seen = [];
  owner.channel.subscribe(({ state }) => seen.push(state.sonar), { emitCurrent: false });
  owner._setCyberSonarEnabled(!owner.getViewState().sonar.enabled);
  owner._setCyberSonarSetting('rings', 5);
  owner._setCyberSonarSetting('rings', 5);
  assert.equal(seen.length, 2, 'an unchanged setting publishes nothing');
  assert.equal(seen[1].rings, 5);
  assert.deepEqual(syncs, [], 'share links are not touched');
});

test('aircraft model changes notify their owner on every path', (t) => {
  replaceDocument(t, { getElementById: () => null });
  const changes = [];
  const display = new AircraftDisplay({
    elements: {},
    readDataManager: () => null,
    layout: () => {},
    onChange: () => changes.push([display._models3dEnabled, display._models3dMode]),
  });
  display._models3dModeBtns = [];
  display._setModels3dEnabled(false);
  display._setModels3dMode('all');
  display._syncModels3dFromLayerState({
    options: { flights: { models3d: true, models3dMode: 'proximity' } },
  });
  assert.deepEqual(changes, [
    [false, 'proximity'],
    [false, 'all'],
    [true, 'proximity'],
  ]);
});

test('clean view publishes the visual channel, not the share state', (t) => {
  const classes = new Set();
  replaceDocument(t, {
    body: {
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      },
    },
  });
  const calls = [];
  const shell = {
    _scheduleLeftPanelLayout() {},
    _syncShareState: () => calls.push('share'),
    _visualSettings: { publishState: () => calls.push('visual') },
  };
  StyleManager.prototype.toggleCleanView.call(shell, true);
  assert.ok(classes.has('ui-clean-view'));
  assert.deepEqual(calls, ['visual']);
});

test('the map-stack channel follows settled activations and the status feed, and stops at destroy', () => {
  let active = 'esri-imagery';
  const subscribers = new Set();
  const controller = {
    getState: () => ({ activeId: active, status: 'ready', lastError: null, switchOrigin: 'manual', extra: () => {} }),
    getStacks: () => [
      { id: 'photoreal', label: 'Google 3D', shortLabel: '3D', kind: 'photoreal', available: false, unavailableReason: 'Needs a key', factory: () => {} },
      { id: 'esri-imagery', label: 'Esri', kind: 'imagery', available: true, unavailableReason: null },
    ],
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
  };
  const events = new EventTarget();
  const { channel, destroy } = createMapStackChannel({ controller, eventTarget: events });
  const seen = [];
  channel.subscribe(({ state, change }) => seen.push({ active: state.activeId, change }));
  assert.deepEqual(channel.getSnapshot().stacks[0], {
    id: 'photoreal',
    label: 'Google 3D',
    shortLabel: '3D',
    kind: 'photoreal',
    available: false,
    unavailableReason: 'Needs a key',
  });
  active = 'osm'; // a silent automatic fallback still settles
  for (const listener of subscribers) listener();
  events.dispatchEvent(new Event('gev:map-stack-changed'));
  assert.deepEqual(seen.slice(1), [
    { active: 'osm', change: { type: 'stack-settled' } },
    { active: 'osm', change: { type: 'stack-changed' } },
  ]);
  destroy();
  destroy();
  assert.equal(subscribers.size, 0);
  events.dispatchEvent(new Event('gev:map-stack-changed'));
  assert.equal(seen.length, 3);
});

test('share links encode the same options as before', (t) => {
  // The new display settings are views only (K11, S11a); none joins share state.
  assert.deepEqual(Object.keys(visualOwner(t)._readShareState().options), [
    'bloomIntensity',
    'bloomVersion',
    'sharpenIntensity',
    'hudVariant',
    'hudVisible',
    'detectionMode',
    'detectionDensity',
    'detectionAllocation',
    'detectionFadePct',
    'detectionOutsideOpacityPct',
    'celestialRingEnabled',
    'scopeEnabled',
    'scopeFeatherPct',
    'scopeTerminusPct',
    'mapStack',
  ]);
});
