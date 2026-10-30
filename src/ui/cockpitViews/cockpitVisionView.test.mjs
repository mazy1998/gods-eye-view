import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';

const { mountView } = await import('../mountView.js');
const { mountCockpitVision } = await import('../cockpitVision.js');
const { createStateChannel } = await import('../../app/stateChannel.js');

test('vision controls show the current style and report the cycle', () => {
  const group = container.appendChild(document.createElement('div'));
  let mode = 'optical';
  const calls = [];
  const channel = createStateChannel(() => ({ mode }));
  const cockpit = {
    getVisionView: () => channel.getSnapshot(),
    subscribeVisionView: (listener, options) =>
      channel.subscribe(listener, options),
    cycleVisionMode: (direction) => calls.push(direction),
  };
  const mounted = mountCockpitVision(mountView, { group, cockpit });
  const current = group.querySelector('#cockpit-vision-current');
  assert.equal(
    group.querySelector('#cockpit-vision-current-label').textContent,
    'NORMAL',
  );
  assert.equal(current.dataset.cockpitVision, 'optical');
  assert.equal(
    current.getAttribute('aria-label'),
    'Current cockpit vision style: Normal. Activate for next style.',
  );
  mode = 'thermal';
  channel.publish();
  assert.equal(
    group.querySelector('#cockpit-vision-current-label').textContent,
    'FLIR',
  );
  assert.equal(current.dataset.cockpitVision, 'thermal');
  assert.equal(current.title, 'Current style: Thermal — click for next');
  for (const id of [
    'cockpit-vision-previous',
    'cockpit-vision-current',
    'cockpit-vision-next',
  ])
    group.querySelector(`#${id}`).click();
  assert.deepEqual(calls, [-1, 1, 1]);
  mounted.dispose();
  assert.equal(group.childNodes.length, 0);
});
