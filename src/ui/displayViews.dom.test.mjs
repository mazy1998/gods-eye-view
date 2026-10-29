// The Display views call the shared Display operations while connected; a
// control a caller retains after disconnection and disposal is inert, as the
// native binder's removed listeners left it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { mountView } = await import('./mountView.js');
const { mountDisplayViews, connectDisplayViews } =
  await import('./displayViews.js');
const { createStateChannel } = await import('../app/stateChannel.js');
const { displayDefaults } = await import('./displayViews/displayDefaults.js');

test('retained Display controls stop calling operations once disconnected and disposed', (t) => {
  container.innerHTML = `
    <div class="pp-toggle-group" data-display-group="hud"></div>
    <div class="pp-toggle-group" data-display-group="detection"></div>
    <div class="pp-toggle-group" data-display-group="scope"></div>
    <span data-display-view="clean-view" hidden></span>`;
  t.after(() => container.replaceChildren());
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  const actions = {
    toggleHud: record('toggleHud'),
    cycleDetection: record('cycleDetection'),
    setScopeFeather: record('setScopeFeather'),
    setFade: record('setFade'),
    toggleCleanView: record('toggleCleanView'),
  };
  const channel = createStateChannel(() => displayDefaults);
  const mounted = [];
  const views = mountDisplayViews((component, options) => {
    const view = mountView(component, options);
    mounted.push(view);
    return view;
  });
  const disconnect = connectDisplayViews(views, { channel, actions });
  const hud = document.getElementById('hud-toggle');
  const detection = document.getElementById('detection-toggle');
  const feather = document.getElementById('scope-feather-slider');
  const clean = document.getElementById('clean-view-toggle');
  const fade = document.getElementById('detection-fade-slider');
  const outside = document.getElementById('detection-opacity-slider');
  // An event handler that throws reaches the window, not the dispatcher.
  const errors = [];
  const onError = (event) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  t.after(() => window.removeEventListener('error', onError));

  hud.click();
  assert.deepEqual(calls, [['toggleHud']]);

  disconnect();
  for (const view of mounted) view.dispose();
  calls.length = 0;
  hud.click();
  detection.click();
  feather.value = '40';
  feather.dispatchEvent(new Event('input', { bubbles: true }));
  clean.click();
  for (const slider of [fade, outside]) {
    slider.value = '9';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(errors, []);
});
