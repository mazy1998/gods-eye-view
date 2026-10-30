import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
import { createStateChannel } from '../app/stateChannel.js';
const { SceneControls } = await import('gods-eye-view/ui/scenes');

test('published SceneControls renders and binds native host elements with no body mount', () => {
  container.innerHTML =
    '<section><select></select><div class="shots"></div><button class="capture"></button><button class="start"></button><button class="stop"></button><span class="status"></span><div class="progress"></div></section><div class="runtime"></div>';
  const panel = container.querySelector('section');
  const by = (s) => container.querySelector(s);
  const elements = {
    panel,
    select: by('select'),
    shots: by('.shots'),
    capture: by('.capture'),
    start: by('.start'),
    stop: by('.stop'),
    status: by('.status'),
    progress: by('.progress'),
    runtime: by('.runtime'),
  };
  const state = {
    scenes: [
      {
        id: 'a',
        title: '<Story>',
        shots: [{ id: 's', title: '<Shot>', durationSec: 2, holdSec: 1 }],
      },
    ],
    selectedSceneId: 'a',
    selectedShotId: 's',
    running: false,
    hasRun: false,
    progress: 0,
    status: 'Ready',
    runtime: '',
  };
  const channel = createStateChannel(() => state);
  const calls = [];
  const control = new SceneControls({
    elements,
    read: () => state,
    subscribe: (fn) => channel.subscribe(fn),
    actions: {
      capture: () => calls.push('capture'),
      start: (id) => {
        calls.push(id);
        state.running = true;
        channel.publish({ type: 'buttons-changed' });
      },
      stop: () => calls.push('stop'),
      load: (...ids) => calls.push(ids),
    },
  });
  assert.ok(control instanceof SceneControls);
  assert.equal(elements.select.options.length, 1);
  assert.equal(elements.select.options[0].textContent, '<Story>');
  assert.equal(by('.scene-shot-label').textContent, '<Shot>');
  assert.equal(panel.querySelector('story'), null);
  elements.capture.click();
  elements.start.click();
  assert.deepEqual(calls, ['capture', 'a']);
  assert.equal(elements.start.disabled, true);
  assert.equal(elements.stop.disabled, false);
  state.progress = 0.5;
  channel.publish({ type: 'progress-changed' });
  assert.equal(elements.progress.style.width, '50%');
  state.status = 'Updated';
  channel.publish({ type: 'status-changed' });
  assert.equal(elements.status.textContent, 'Updated');
  control.updateRuntime('Runtime');
  assert.equal(elements.runtime.textContent, 'Runtime');
  control.destroy();
  control.destroy();
  elements.capture.click();
  state.status = 'Late';
  channel.publish({ type: 'status-changed' });
  assert.deepEqual(calls, ['capture', 'a']);
  assert.equal(elements.status.textContent, 'Updated');
  assert.equal(elements.shots.children.length, 0);
});
