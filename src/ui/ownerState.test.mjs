import test from 'node:test';
import assert from 'node:assert/strict';
import { computed, effectScope } from 'vue';
import { createStateChannel } from '../app/stateChannel.js';
import { flushViews, useOwnerState } from './ownerState.js';

function owner() {
  const state = { style: 'normal', options: { bloom: false } };
  const channel = createStateChannel(() => state);
  return { state, channel };
}

test('a view reads the current snapshot and follows each publication synchronously', () => {
  const { state, channel } = owner();
  const scope = effectScope();
  const { visual, label } = scope.run(() => {
    const visual = useOwnerState(channel);
    return { visual, label: computed(() => visual.value.style.toUpperCase()) };
  });
  assert.equal(label.value, 'NORMAL');
  state.style = 'noir';
  assert.equal(
    label.value,
    'NORMAL',
    'nothing changes until the owner publishes',
  );
  channel.publish({ type: 'settings-changed' });
  assert.equal(visual.value.style, 'noir');
  assert.equal(label.value, 'NOIR');
  scope.stop();
});

test('the view cannot change owner state: the ref is read-only and the snapshot frozen', () => {
  const { state, channel } = owner();
  const scope = effectScope();
  const visual = scope.run(() => useOwnerState(channel));
  assert.throws(() => {
    visual.value = { style: 'retro' };
  }, /read-only/);
  assert.throws(() => {
    visual.value.style = 'retro';
  }, TypeError);
  assert.throws(() => {
    visual.value.options.bloom = true;
  }, TypeError);
  assert.equal(state.style, 'normal');
  assert.equal(state.options.bloom, false);
  assert.equal(visual.value.style, 'normal');
  scope.stop();
});

test('disposing the view unsubscribes it, so a late publication cannot reach it', () => {
  const { state, channel } = owner();
  const scope = effectScope();
  const visual = scope.run(() => useOwnerState(channel));
  scope.stop();
  state.style = 'thermal';
  assert.equal(channel.publish({ type: 'late' }), true);
  assert.equal(visual.value.style, 'normal');
  // The owner later destroys its channel; publications then stop entirely.
  channel.destroy();
  assert.equal(channel.publish({ type: 'later' }), false);
  assert.equal(visual.value.style, 'normal');
});

test('owner state needs a scope that will release it', () => {
  const { channel } = owner();
  assert.throws(() => useOwnerState(channel), /component or effect scope/);
});

test('flushViews is the documented wait for painted owner state', async () => {
  assert.equal(typeof flushViews, 'function');
  await flushViews();
});
