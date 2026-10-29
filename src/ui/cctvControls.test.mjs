import assert from 'node:assert/strict';
import { test } from 'node:test';
import { container } from '../testSupport/componentDom.mjs';
const { CctvControls } = await import('./cctvControls.js');

function fixture(t) {
  const prior = globalThis.Image;
  const requests = [];
  globalThis.Image = class {
    constructor() {
      requests.push(this);
    }
  };
  t.after(() => {
    globalThis.Image = prior;
  });
  const panel = document.createElement('section');
  panel.innerHTML = '<div id="cctv-controls-body"></div>';
  container.appendChild(panel);
  const controls = new CctvControls({
    elements: { _cctvPanel: panel },
    cctv: {},
    actions: {
      isEnabled: () => true,
      syncViewport() {},
      setPanelCollapsed() {},
    },
  });
  t.after(() => controls.destroy());
  return { controls, requests };
}

test('a late image completion cannot replace a newer camera preview', (t) => {
  const { controls, requests } = fixture(t);
  controls._queueCctvFrame('first.jpg', 'a', true);
  const stale = requests[0].onload;
  controls._queueCctvFrame('second.jpg', 'b', true);
  assert.equal(requests[0].onload, null);
  requests[1].onload();
  stale();
  assert.equal(controls._cctvFrame.getAttribute('src'), 'second.jpg');
  assert.equal(controls._cctvFrame.dataset.cameraId, 'b');
});

test('failed refresh preserves settled pixels, but changing cameras clears them', (t) => {
  const { controls, requests } = fixture(t);
  controls._queueCctvFrame('first.jpg', 'a', true);
  requests[0].onload();
  controls._queueCctvFrame('refresh.jpg', 'a', false);
  requests[1].onerror();
  assert.equal(controls._cctvFrame.getAttribute('src'), 'first.jpg');
  assert.equal(controls._cctvFrameWrap.classList.contains('has-frame'), true);
  controls._queueCctvFrame('other.jpg', 'b', true);
  assert.equal(controls._cctvFrame.getAttribute('src'), null);
  assert.equal(controls._cctvFrameWrap.classList.contains('has-frame'), false);
});

test('destroy invalidates image callbacks and releases each subscription once', (t) => {
  const { controls, requests } = fixture(t);
  let unsubscribed = 0;
  controls.cctv.subscribe = () => () => {
    unsubscribed++;
  };
  controls.connect();
  controls.connect();
  assert.equal(unsubscribed, 1);
  controls._queueCctvFrame('first.jpg', 'a', true);
  const late = requests[0].onload;
  controls.destroy();
  controls.destroy();
  controls.connect();
  late();
  assert.equal(unsubscribed, 2);
  assert.equal(requests[0].onload, null);
  assert.equal(requests[0].onerror, null);
  assert.equal(controls._cctvFrame.getAttribute('src'), null);
  controls._queueCctvFrame('late.jpg', 'b', true);
  assert.equal(requests.length, 1);
});

function calibrationFixture(t) {
  const { controls } = fixture(t);
  const chip = controls._cctvCalReadout.querySelector(
    '[data-cal-field="heading"]',
  );
  const inputs = [];
  const begin = controls._beginCctvCalValueEdit.bind(controls);
  controls._beginCctvCalValueEdit = (chip) => {
    begin(chip);
    inputs.push(chip.querySelector('input'));
  };
  const patches = [];
  controls.actions.setParams = (params) => patches.push(params);
  controls.actions.setPanelCollapsed = () => {};
  controls._renderCctvState({
    enabled: true,
    activeCameraId: 'a',
    activeCamera: { id: 'a', headingDeg: 30, basePose: { headingDeg: 20 } },
  });
  const key = (name) =>
    Object.assign(new Event('keydown', { cancelable: true }), { key: name });
  return { controls, chip, inputs, patches, key };
}

test('calibration commits against the captured camera base and releases its editor', (t) => {
  const { controls, chip, inputs, patches, key } = calibrationFixture(t);
  controls._beginCctvCalValueEdit(chip);
  inputs[0].value = '100';
  inputs[0].dispatchEvent(new Event('input'));
  controls._cctvState.activeCamera.basePose.headingDeg = 60;
  inputs[0].dispatchEvent(key('Enter'));
  inputs[0].dispatchEvent(new Event('blur'));
  assert.deepEqual(patches, [
    {
      selectedCameraId: 'a',
      calibration: { cameraId: 'a', patch: { headingDeg: 80 } },
    },
  ]);
  assert.equal(controls._calibrationEdit, null);
});

test('a camera switch cancels calibration before old blur can change the new camera', (t) => {
  const { controls, chip, inputs, patches } = calibrationFixture(t);
  controls._beginCctvCalValueEdit(chip);
  inputs[0].value = '100';
  inputs[0].dispatchEvent(new Event('input'));
  controls._renderCctvState({
    enabled: true,
    activeCameraId: 'b',
    activeCamera: { id: 'b', headingDeg: 200, basePose: { headingDeg: 190 } },
  });
  inputs[0].dispatchEvent(new Event('blur'));
  assert.deepEqual(patches, []);
  assert.equal(chip.querySelector('input'), null);
  assert.equal(chip.textContent, 'HDG 200.0°');
});

test('Escape claims calibration cancellation and disposal prevents late commits', (t) => {
  const { controls, chip, inputs, patches, key } = calibrationFixture(t);
  controls._beginCctvCalValueEdit(chip);
  inputs[0].value = '100';
  inputs[0].dispatchEvent(new Event('input'));
  const escape = key('Escape');
  inputs[0].dispatchEvent(escape);
  inputs[0].dispatchEvent(new Event('blur'));
  assert.equal(escape.defaultPrevented, true);
  controls._beginCctvCalValueEdit(chip);
  inputs[1].value = '120';
  inputs[1].dispatchEvent(new Event('input'));
  controls.destroy();
  inputs[1].dispatchEvent(new Event('blur'));
  assert.deepEqual(patches, []);
});

test('disposing during camera enable prevents the delayed focus and future clicks', async () => {
  const button = new EventTarget();
  let resolveEnable;
  let enables = 0;
  let focuses = 0;
  const controls = new CctvControls({
    elements: {
      _cctvPanel: { querySelector: () => null },
      _cctvNextBtn: button,
    },
    cctv: {},
    actions: {
      isEnabled: () => true,
      syncViewport() {},
      toggleEnabled() {
        enables++;
        return new Promise((resolve) => {
          resolveEnable = resolve;
        });
      },
      runExplicitFocus() {
        focuses++;
      },
    },
  });
  button.dispatchEvent(new Event('click'));
  controls.destroy();
  resolveEnable(true);
  await new Promise((resolve) => setImmediate(resolve));
  button.dispatchEvent(new Event('click'));
  assert.equal(enables, 1);
  assert.equal(focuses, 0);
});

test('null camera selection stays empty and Focus is disabled with a populated catalog', (t) => {
  const { controls } = fixture(t);
  controls._renderCctvState({
    enabled: true,
    cameras: [{ id: 'a', city: 'City', name: 'Camera' }],
  });
  assert.equal(controls._cctvSelect.options.length, 1);
  assert.equal(controls._cctvSelect.selectedIndex, -1);
  assert.equal(controls._cctvFocusBtn.disabled, true);
});

test('camera search is owned, literal and preserves the active choice during notifications', (t) => {
  const { controls } = fixture(t);
  const cameras = [
    {
      id: 'a',
      city: 'City',
      name: '<img src=x onerror=alert(1)>',
      sourceLabel: 'Network A',
      sourceStatus: 'ok',
    },
    {
      id: 'b',
      city: 'City',
      name: 'Bridge',
      sourceLabel: 'Network B',
      sourceStatus: 'degraded',
    },
    {
      id: 'c',
      city: 'City',
      name: 'Junction',
      sourceLabel: 'Network C',
      sourceStatus: 'unknown',
    },
  ];
  const state = {
    enabled: true,
    cameras,
    activeCameraId: 'a',
    activeCamera: cameras[0],
  };
  controls._renderCctvState(state);
  const filter = controls._cctvPanel.querySelector('#cctv-camera-filter');
  filter.value = 'network b';
  filter.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(controls._pickerFilter, 'network b');
  assert.deepEqual(
    [...controls._cctvSelect.options].map((o) => o.value),
    ['a', 'b'],
  );
  assert.match(controls._cctvSelect.options[0].textContent, /<img src=x/);
  assert.match(
    controls._cctvSelect.options[1].textContent,
    /Network B · DEGRADED/,
  );
  assert.equal(controls._cctvSelect.querySelector('img'), null);
  controls._renderCctvState({ ...state });
  assert.equal(controls._cctvSelect.value, 'a');
  assert.equal(filter.value, 'network b');
});

test('a detached calibration input cannot finish a newer editor', (t) => {
  const { controls, chip, inputs, patches, key } = calibrationFixture(t);
  controls._beginCctvCalValueEdit(chip);
  const stale = inputs[0];
  controls._calibrationEdit(false);
  controls._beginCctvCalValueEdit(chip);
  const current = inputs[1];
  current.value = '120';
  current.dispatchEvent(new Event('input'));
  stale.dispatchEvent(new Event('blur'));
  stale.dispatchEvent(key('Enter'));
  assert.deepEqual(patches, []);
  assert.equal(controls._calibrationDraft.value, '120');
  assert.equal(chip.querySelector('input'), current);
  current.dispatchEvent(key('Enter'));
  assert.equal(patches[0].calibration.patch.headingDeg, 100);
});

test('ADJUST remains reachable while the advanced Calibration section is collapsed', (t) => {
  const { controls, patches } = calibrationFixture(t);
  controls._renderCctvState({ ...controls.getState(), calibrationMode: true });
  const toggle = controls._cctvPanel.querySelector(
    '[aria-controls="cctv-calibration-editor"]',
  );
  const editor = controls._cctvPanel.querySelector('#cctv-calibration-editor');
  const adjust = controls._cctvAdjustBtn;
  toggle.click();
  assert.equal(editor.hidden, false);
  toggle.click();
  assert.equal(editor.hidden, true);
  assert.equal(adjust.closest('[hidden]'), null);
  assert.equal(adjust.disabled, false);
  assert.equal(adjust.textContent.trim(), 'ADJUST ON');
  adjust.click();
  assert.deepEqual(patches, [{ calibrationMode: false }]);
  controls._renderCctvState({ ...controls.getState(), calibrationMode: false });
  assert.equal(adjust.textContent.trim(), 'ADJUST');
  assert.equal(adjust.closest('[hidden]'), null);
  assert.equal(editor.hidden, true);
});

for (const commit of ['Enter', 'blur'])
  test(`calibration ${commit} adopts a native value without an input event`, (t) => {
    const { controls, chip, inputs, patches, key } = calibrationFixture(t);
    controls._beginCctvCalValueEdit(chip);
    inputs[0].value = '100';
    inputs[0].dispatchEvent(
      commit === 'Enter' ? key('Enter') : new Event('blur'),
    );
    assert.equal(patches[0].calibration.patch.headingDeg, 80);
  });

test('summary typing follows the mounted view and stops before disposal can yield', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { controls } = fixture(t);
  const summary = document.getElementById('cctv-summary');
  controls._typeCctvSummary('<literal camera summary>');
  t.mock.timers.tick(20);
  assert.equal(summary.textContent, '<li');
  assert.equal(summary.children.length, 0);
  controls.destroy();
  assert.equal(controls._cctvSummaryTypingTimer, null);
  assert.equal(summary.isConnected, false);
  t.mock.timers.tick(200);
  assert.equal(summary.textContent, '<li');
  const unmounted = new CctvControls({ elements: {}, cctv: {}, actions: {} });
  try {
    unmounted._typeCctvSummary('No view');
    assert.equal(unmounted._cctvSummaryTypingTimer, null);
  } finally {
    unmounted.destroy();
  }
});
