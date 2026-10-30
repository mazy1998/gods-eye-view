import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

const { mountDisplayViews } = await import('./displayViews.js');
const { mountView } = await import('./mountView.js');
const { VisualSettings } = await import('./visualSettings.js');

function mountDisplay(t) {
  container.innerHTML = readFileSync(
    new URL('./templates/display-controls.html', import.meta.url),
    'utf8',
  );
  const views = mountDisplayViews((component, options) =>
    mountView(component, options),
  );
  t.after(() => {
    for (const view of Object.values(views).reverse()) {
      try {
        view.dispose?.();
      } catch {
        /* moved wrappers */
      }
    }
    container.innerHTML = '';
  });
  return views;
}

/** VisualSettings over the mounted panel, with the shell's tab owner. */
function visualSettings(t, setMapLookTab, setPanelCollapsed = () => {}) {
  const owner = new VisualSettings({
    viewer: { scene: {} },
    elements: {
      _sliderPanel: document.getElementById('param-slider-panel'),
      _ppToggles: document.getElementById('pp-toggles'),
      _sliderContainer: document.getElementById('param-sliders'),
    },
    operations: {
      _syncShareState() {},
      _scheduleRightPanelLayout() {},
      _syncPanelCollapseButton() {},
      setPanelCollapsed,
      setMapLookTab,
    },
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
    readDisplayPortalActive: () => false,
  });
  t.after(() => owner._lifetime?.dispose?.());
  return owner;
}

test('a style shortcut reveals its parameters on Look after another tab was chosen', (t) => {
  const views = mountDisplay(t);
  // The shell's tab owner.
  const setMapLookTab = (tab) => views.mapLook.update({ tab });
  setMapLookTab('map');
  const collapsed = [];
  const owner = visualSettings(t, setMapLookTab, (id, value) =>
    collapsed.push([id, value]),
  );
  const panel = document.getElementById('param-slider-panel');
  // The reveal keys 1–7 and voice set_visual_style reach through setStyle.
  panel.classList.add('active');
  owner._revealStyleParameters();

  assert.deepEqual(collapsed, [['pp-toggles', false]], 'Map & Look opens');
  const tabpanel = panel.closest('[role="tabpanel"]');
  assert.equal(tabpanel?.id, 'map-look-look');
  assert.equal(tabpanel.hidden, false);
});

/** Two animation frames: the reveal's measurement and scroll have run. */
const revealSettled = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );

test('a style reveal from a focused Display control hands focus to the first parameter it shows', async (t) => {
  const views = mountDisplay(t);
  const setMapLookTab = (tab) => views.mapLook.update({ tab });
  views.styleParameters.update({
    state: { style: 'thermal', styleParams: { thermal: {} } },
  });
  setMapLookTab('display');
  const display = document.getElementById('map-look-display');
  const control = document.getElementById('hud-toggle');
  control.focus();
  assert.equal(document.activeElement, control);
  const owner = visualSettings(t, setMapLookTab);
  const panel = document.getElementById('param-slider-panel');
  panel.classList.add('active');
  owner._revealStyleParameters();

  assert.equal(display.hidden, true);
  // At once the selected tab holds focus (jsdom runs no focus fix-up; a
  // browser would drop it to <body>)...
  assert.equal(
    document.activeElement,
    document.getElementById('map-look-look-tab'),
  );
  // ...and once the reveal has scrolled, which can leave the tabs out of
  // view, the first parameter it shows does.
  await revealSettled();
  assert.equal(
    document.activeElement,
    panel.querySelector('input[type="range"]'),
  );
});

test('a style reveal or tab change leaves focus outside the outgoing panel alone', async (t) => {
  const views = mountDisplay(t);
  const setMapLookTab = (tab) => views.mapLook.update({ tab });
  setMapLookTab('display');
  const outside = document.createElement('button');
  container.append(outside);
  outside.focus();
  setMapLookTab('map');
  assert.equal(document.activeElement, outside);

  const owner = visualSettings(t, setMapLookTab);
  document.getElementById('param-slider-panel').classList.add('active');
  owner._revealStyleParameters();
  await revealSettled();
  assert.equal(document.activeElement, outside);
});

test("a style reveal leaves focus in the voice dock's own tab panel alone", async (t) => {
  const views = mountDisplay(t);
  const setMapLookTab = (tab) => views.mapLook.update({ tab });
  views.styleParameters.update({
    state: { style: 'thermal', styleParams: { thermal: {} } },
  });
  setMapLookTab('map');
  const { default: VoiceDockView } = await import('../voice/VoiceDockView.vue');
  const { voiceCardView, initialVoiceCardState } =
    await import('../voice/voiceCardPresentation.js');
  const voice = mountView(VoiceDockView, {
    parent: container,
    props: {
      state: {
        view: 'preview',
        panelView: 'preview',
        previewHidden: false,
        settingsHidden: true,
      },
      panel: true,
      cardState: { ...voiceCardView(initialVoiceCardState()), visible: true },
      dismissError() {},
    },
  });
  t.after(() => voice.dispose());
  const dismiss = document.getElementById('gev-voice-card-dismiss');
  assert.equal(
    dismiss.closest('[role="tabpanel"]').id,
    'gev-voice-preview-panel',
  );
  dismiss.focus();
  const owner = visualSettings(t, setMapLookTab);
  document.getElementById('param-slider-panel').classList.add('active');
  owner._revealStyleParameters();
  await revealSettled();
  assert.equal(document.activeElement, dismiss);
});

test('a style reveal leaves focus that moved on before its scroll alone', async (t) => {
  const views = mountDisplay(t);
  const setMapLookTab = (tab) => views.mapLook.update({ tab });
  views.styleParameters.update({
    state: { style: 'thermal', styleParams: { thermal: {} } },
  });
  setMapLookTab('display');
  document.getElementById('hud-toggle').focus();
  const owner = visualSettings(t, setMapLookTab);
  document.getElementById('param-slider-panel').classList.add('active');
  owner._revealStyleParameters();
  const outside = document.createElement('button');
  container.append(outside);
  outside.focus();
  await revealSettled();
  assert.equal(document.activeElement, outside);
});

test('the open parameter panel on Look is not a second capped scroller', (t) => {
  const style = document.createElement('style');
  style.textContent = ['controls.css', 'map-look.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  t.after(() => style.remove());
  mountDisplay(t);
  document.getElementById('pp-toggles').classList.remove('collapsed');
  const panel = document.getElementById('param-slider-panel');
  panel.classList.add('active');
  assert.equal(panel.closest('[role="tabpanel"]')?.id, 'map-look-look');
  const computed = getComputedStyle(panel);
  assert.equal(computed.overflowY, 'visible');
  assert.equal(computed.maxHeight, 'none');
});
