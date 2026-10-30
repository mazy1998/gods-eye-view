import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const { CctvControls } = await import('gods-eye-view/ui/cctv');

test('published CCTV native handles render catalog, pose, badges and commands, then dispose', (t) => {
  container.innerHTML =
    '<section><button id="enable"></button><select></select><button id="focus"></button><button id="coverage"></button><button id="adjust"></button><div id="cctv-cal-readout"></div><div id="cctv-source-badge"></div><div id="cctv-meta"></div><div id="cctv-quality-chip"></div><div id="cctv-summary"></div></section>';
  const panel = container.querySelector('section');
  const by = (s) => panel.querySelector(s);
  const elements = {
    _cctvPanel: panel,
    _cctvEnableBtn: by('#enable'),
    _cctvSelect: by('select'),
    _cctvFocusBtn: by('#focus'),
    _cctvCoverageBtn: by('#coverage'),
    _cctvAdjustBtn: by('#adjust'),
    _cctvCalReadout: by('#cctv-cal-readout'),
    _cctvMeta: by('#cctv-meta'),
    _cctvSourceBadge: by('#cctv-source-badge'),
    _cctvQualityChip: by('#cctv-quality-chip'),
    _cctvSummaryText: by('#cctv-summary'),
  };
  const camera = {
    id: 'a',
    name: '<Camera>',
    city: 'Austin',
    headingDeg: 30,
    pitchDeg: -10,
    fovDeg: 50,
    rangeM: 100,
    mountHeightM: 20,
    basePose: { headingDeg: 20 },
  };
  const state = {
    enabled: true,
    cameras: [camera],
    activeCameraId: 'a',
    activeCamera: camera,
    summary: 'Ready',
  };
  let notify;
  let unsubscribed = 0;
  let tick;
  const patches = [];
  t.mock.method(globalThis, 'setInterval', (fn) => {
    tick = fn;
    return 1;
  });
  t.mock.method(globalThis, 'clearInterval', () => {});
  const controls = new CctvControls({
    elements,
    cctv: {
      subscribe: (fn) => {
        notify = fn;
        return () => unsubscribed++;
      },
      getUIState: () => state,
    },
    actions: {
      isEnabled: () => true,
      syncViewport() {},
      setPanelCollapsed() {},
      setParams: (params) => patches.push(params),
    },
  });
  controls.connect();
  assert.equal(elements._cctvSelect.options.length, 1);
  assert.match(elements._cctvSelect.options[0].textContent, /<Camera>/);
  assert.equal(elements._cctvSelect.value, 'a');
  assert.equal(elements._cctvFocusBtn.disabled, false);
  assert.match(elements._cctvMeta.textContent, /Austin/);
  assert.equal(elements._cctvEnableBtn.textContent, 'CCTV ON');
  const chip = elements._cctvCalReadout.querySelector(
    '[data-cal-field="heading"]',
  );
  chip.click();
  const editor = chip.querySelector('input');
  assert.ok(editor);
  editor.value = '100';
  editor.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  assert.equal(patches.at(-1).calibration.patch.headingDeg, 80);
  tick();
  tick();
  assert.equal(elements._cctvSummaryText.textContent, 'Ready');
  notify({ ...state, coverageMode: 'viewshed' });
  assert.equal(elements._cctvCoverageBtn.textContent, 'VIEWSHED ON');
  controls.destroy();
  controls.destroy();
  const meta = elements._cctvMeta.textContent;
  notify({ ...state, activeCamera: { ...camera, city: 'Late' } });
  tick();
  chip.click();
  assert.equal(elements._cctvMeta.textContent, meta);
  assert.equal(unsubscribed, 1);
  assert.equal(chip.querySelector('input'), null);
});
