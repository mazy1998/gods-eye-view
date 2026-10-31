// Recording against the real HUD view: RecordingControls is built before the
// Display views mount (as in the shell), holds no HUD nodes, and its
// syncShareState publishes the HUD state the view paints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { mountView } = await import('./mountView.js');
const { mountDisplayViews, connectDisplayViews } =
  await import('./displayViews.js');
const { RecordingControls } = await import('./recordingControls.js');
const { createStateChannel } = await import('../app/stateChannel.js');
const { displayDefaults } = await import('./displayViews/displayDefaults.js');

function fixture(t) {
  container.innerHTML = `
    <div id="safe-frame-overlay"><div id="safe-frame-box"></div></div>
    <div class="pp-toggle-group" data-display-group="hud"></div>`;
  // Constructed first, as applicationShell does, before any view exists.
  let published = 0;
  const hud = {
    mode: 'off',
    variant: 'minimal',
    get visible() {
      return this.mode !== 'off';
    },
    getMode() {
      return this.mode;
    },
    getVariant() {
      return this.variant;
    },
    setMode(mode) {
      this.mode = mode;
    },
    setVariant(variant) {
      this.variant = variant;
    },
  };
  const channel = createStateChannel(() => ({
    ...displayDefaults,
    hud: { visible: hud.visible, variant: hud.getVariant() },
  }));
  const recording = new RecordingControls({
    syncShareState: () => {
      published++;
      channel.publish({ type: 'visual-changed' });
    },
  });
  recording.hud = hud;
  const views = [];
  const display = mountDisplayViews((component, options) => {
    const view = mountView(component, options);
    views.push(view);
    return view;
  });
  const unsubscribe = connectDisplayViews(display, { channel, actions: {} });
  t.after(() => {
    unsubscribe();
    for (const view of views) view.dispose();
    channel.destroy();
    container.replaceChildren();
    document.body.classList.remove('recording-mode');
  });
  const shown = () => ({
    active: document.getElementById('hud-toggle').classList.contains('active'),
    layout: document.getElementById('hud-layout-select').value,
  });
  return { recording, hud, shown, published: () => published };
}

test('recording entry and exit drive the mounted HUD view and restore the user HUD', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.shown(), { active: false, layout: 'minimal' });
  f.recording.setRecordingMode(true, { hudMode: 'minimal' });
  assert.equal(f.published(), 1);
  assert.deepEqual(f.shown(), { active: true, layout: 'minimal' });
  assert.equal(document.body.classList.contains('recording-mode'), true);
  // Re-entry keeps the first snapshot.
  f.recording.setRecordingMode(true, { hudMode: 'full' });
  assert.deepEqual(f.shown(), { active: true, layout: 'tactical' });
  f.recording.setRecordingMode(false);
  assert.deepEqual(f.shown(), { active: false, layout: 'minimal' });
  assert.equal(f.hud.getMode(), 'off');
  assert.equal(document.body.classList.contains('recording-mode'), false);
});

test('disposing an active recording session restores and paints the user HUD', (t) => {
  const f = fixture(t);
  f.recording.setRecordingMode(true, { hudMode: 'off' });
  assert.deepEqual(f.shown(), { active: false, layout: 'minimal' });
  f.hud.setMode('on');
  f.recording.setRecordingMode(true, { hudMode: 'minimal' });
  assert.deepEqual(f.shown(), { active: true, layout: 'minimal' });
  f.recording.destroy();
  assert.equal(f.hud.getMode(), 'off');
  assert.deepEqual(f.shown(), { active: false, layout: 'minimal' });
  // A destroyed owner ignores later calls without throwing.
  f.recording.setRecordingMode(true, { hudMode: 'minimal' });
  assert.deepEqual(f.shown(), { active: false, layout: 'minimal' });
});
