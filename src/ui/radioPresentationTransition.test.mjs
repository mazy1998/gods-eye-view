import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radioDomFixture } from '../testSupport/radioDomFixture.mjs';
const { RadioControls } = await import('./radioControls.js');

for (const lifecycleState of ['enabling', 'disabling']) {
  test(`Radio render survives the ${lifecycleState} transition`, () => {
    const f = radioDomFixture();
    const controls = new RadioControls({ elements: f.elements, view: f.view,
      radio: {endTuning() {}}, actions: {
        getLifecycle: () => ({lifecycleState, enabled: lifecycleState === 'disabling', uncertain: false}),
        preservePanelStateDuringClear: () => false, scheduleLayout() {}, setPanelCollapsed() {},
      },
    });
    try {
      assert.doesNotThrow(() => controls._renderRadioState({enabled: false, categories: [], filteredCount: 0, stationCount: 0, audioState: 'idle', volume: 0.8}));
      for (const enable of [f.elements._radioEnableBtn, f.elements._contextRadioMiniEnableBtn, f.elements._cockpitRadioEnableBtn]) {
        assert.equal(enable.getAttribute('aria-busy'), 'true');
        assert.equal(enable.textContent, lifecycleState.toUpperCase());
        assert.equal(enable.disabled, false, 'busy stays focusable');
      }
    } finally {controls.destroy(); f.dispose();}
  });
}
