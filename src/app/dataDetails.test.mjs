import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
import { revealLayerDetails } from './data.js';

test('phone Directions details keep the shared view in the Tools destination', () => {
  container.innerHTML =
    '<section id="directions-controls-body" tabindex="-1"></section>';
  const section = document.getElementById('directions-controls-body');
  const destinations = [];
  section.scrollIntoView = (options) => {
    assert.deepEqual(options, { block: 'nearest' });
    assert.equal(document.activeElement, section);
  };
  const owner = {
    _mobileShell: {
      channel: { getSnapshot: () => ({ active: true }) },
      setDestination: (destination) => destinations.push(destination),
    },
    _drawer: { open: () => assert.fail('the phone owns presentation') },
  };
  assert.equal(revealLayerDetails(owner, 'directions-controls-body'), true);
  assert.deepEqual(destinations, ['tools']);
});

for (const [panelId, controlId] of [
  ['cctv-panel', 'cctv-enable-btn'],
  ['street-level-panel', 'sl-status'],
]) {
  test(`${panelId} details focus and scroll the retained toggle after revealing`, () => {
    container.innerHTML = `<button id="origin">Details</button><section id="${panelId}" hidden><button id="${controlId}">OFF</button></section>`;
    const panel = document.getElementById(panelId);
    const control = document.getElementById(controlId);
    document.getElementById('origin').focus();
    let scrolled = false;
    control.scrollIntoView = (options) => {
      assert.deepEqual(options, { block: 'nearest' });
      assert.equal(document.activeElement, control);
      assert.equal(panel.hidden, false);
      scrolled = true;
    };
    const owner = {
      setPanelCollapsed(id, collapsed, options) {
        assert.equal(id, panelId);
        assert.equal(collapsed, false);
        assert.deepEqual(options, { explicit: true });
        panel.hidden = false;
        return 'revealed';
      },
    };
    assert.equal(revealLayerDetails(owner, panelId), 'revealed');
    assert.equal(document.activeElement, control);
    assert.equal(document.getElementById(controlId), control);
    assert.ok(scrolled);
  });
}
