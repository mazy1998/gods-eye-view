import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';
const { createAwarenessLayer } = await import('gods-eye-view/layers/awareness');

test('published awareness layer renders readiness without ApplicationShell and updates/disposes its native panel', async (t) => {
  container.innerHTML = '<aside id="military-awareness-panel"></aside>';
  const panel = container.querySelector('aside');
  const services = {
    geometry: {},
    navigation: {},
    render: { holdContinuousRender() {}, releaseContinuousRender() {} },
  };
  const layer = createAwarenessLayer({ services, source: {} });
  t.after(() => layer.destroy());
  await layer.enable();
  assert.match(panel.textContent, /ready/i);
  await layer.disable();
  assert.match(panel.textContent, /off/i);
  await layer.enable();
  assert.match(panel.textContent, /ready/i);
  layer.destroy();
  assert.equal(panel.children.length, 0);
  assert.equal(panel.isConnected, true);
});

test('a shell view claims rendering without a second layer owner and releases native rendering on dispose', async (t) => {
  const { mountContactsPanel } = await import('../../ui/contactsPanel.js');
  const { mountView } = await import('../../ui/mountView.js');
  container.innerHTML = '<aside id="military-awareness-panel"></aside>';
  const panel = container.querySelector('aside');
  const layer = createAwarenessLayer({
    services: {
      geometry: {},
      navigation: {},
      render: { holdContinuousRender() {}, releaseContinuousRender() {} },
    },
    source: {},
  });
  t.after(() => layer.destroy());
  await layer.enable();
  const view = mountContactsPanel(mountView, { panel, awareness: layer });
  assert.equal(panel.querySelectorAll('.military-awareness-standby').length, 1);
  await layer.disable();
  assert.match(panel.textContent, /off/i);
  view.dispose();
  view.dispose();
  assert.equal(panel.querySelectorAll('.military-awareness-standby').length, 1);
  await layer.enable();
  assert.match(panel.textContent, /ready/i);
});
