import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
import { revealLayerDetails } from './data.js';

test('Local ADS-B details reveal Radio, then focus and scroll the shared receiver after hosting', async (t) => {
  container.innerHTML =
    '<button id="details">Details</button><section id="radio-panel" class="collapsed"><div id="sdr-radio-card"><button id="sdr-connect-btn">Connect</button></div></section>';
  const frames = [];
  t.mock.method(window, 'requestAnimationFrame', (fn) => frames.push(fn));
  document.getElementById('details').focus();
  const scrolls = [];
  const card = document.getElementById('sdr-radio-card');
  card.scrollIntoView = (options) =>
    scrolls.push([document.activeElement.id, options]);
  const calls = [];
  const owner = {
    setPanelCollapsed(id, collapsed, options) {
      calls.push([id, collapsed, options]);
      document.getElementById(id).classList.remove('collapsed');
      return true;
    },
  };
  assert.equal(revealLayerDetails(owner, 'sdr-radio-card'), true);
  assert.deepEqual(calls, [['radio-panel', false, { explicit: true }]]);
  await Promise.resolve();
  assert.deepEqual(scrolls, []);
  frames.shift()();
  assert.deepEqual(scrolls, [['sdr-connect-btn', { block: 'start' }]]);
  assert.equal(document.getElementById('sdr-radio-card'), card);
  revealLayerDetails(owner, 'sdr-radio-card');
  document.getElementById('details').focus();
  await Promise.resolve();
  frames.shift()();
  assert.equal(scrolls.length, 1, 'a later user focus choice is respected');
  revealLayerDetails(owner, 'sdr-radio-card');
  document.getElementById('details').blur();
  await Promise.resolve();
  frames.shift()();
  assert.equal(
    document.activeElement.id,
    'sdr-connect-btn',
    'host moves losing focus to BODY still hand it to the receiver',
  );
});

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
