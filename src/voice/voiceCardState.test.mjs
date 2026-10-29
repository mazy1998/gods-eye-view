import '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { createVoiceControl } = await import('./control.js');
const { VoiceCardControls } = await import('./voiceCard.js');

test('the card owner retains disclosure state across replies and presentation without restarting idle', (t) => {
  const ui = createVoiceControl();
  let schedules = 0;
  const card = new VoiceCardControls({
    root: ui.root,
    connectView: ui.connectCard,
    setTimer: () => ++schedules,
    clearTimer() {},
  });
  t.after(() => {
    card.destroy();
    ui.dispose();
  });
  card.handle({ type: 'interruption' });
  const scheduled = schedules;
  const notes = ui.root.querySelector('#gev-voice-card-notes');
  notes.querySelector('summary').click();
  assert.equal(notes.open, true);
  assert.equal(card.channel.getSnapshot().notesOpen, true);
  assert.ok(Object.isFrozen(card.channel.getSnapshot()));
  card.setPresented(false);
  card.setPresented(true);
  card.setEnabled(false);
  card.setEnabled(true);
  assert.equal(notes.open, true);
  assert.equal(schedules, scheduled);
  card.handle({
    type: 'transcript',
    role: 'assistant',
    text: 'Another answer',
    final: true,
  });
  assert.equal(notes.open, true);
  notes.querySelector('summary').click();
  assert.equal(notes.open, false);
  assert.equal(card.channel.getSnapshot().notesOpen, false);
  card.destroy();
  card.setNotesOpen(true);
  assert.equal(card.notesOpen, false);
});

for (const panel of [false, true]) {
  test(`card view keeps literal text, stable focus and synchronous publication (panel=${panel})`, (t) => {
    const ui = createVoiceControl({ panel });
    const payload =
      '<strong data-source="provider">literal provider text</strong> & source';
    let card;
    const seen = [];
    card = new VoiceCardControls({
      root: ui.root,
      connectView: ui.connectCard,
      setTimer: () => 1,
      clearTimer() {},
      onRender() {
        if (card) seen.push(ui.card.hidden === !card.snapshot().visible);
      },
    });
    t.after(() => {
      card.destroy();
      ui.dispose();
    });
    const before = [...ui.card.querySelectorAll('[id]')];
    card.handle({ type: 'interruption' });
    const dismiss = ui.root.querySelector('#gev-voice-card-dismiss');
    dismiss.focus();
    card.handle({
      type: 'transcript',
      role: 'assistant',
      text: payload,
      final: true,
    });
    assert.equal(
      ui.root.querySelector('#gev-voice-card-assistant-text').textContent,
      payload,
    );
    assert.equal(
      ui.root.querySelector('#gev-voice-card-live').textContent,
      payload,
    );
    assert.equal(ui.card.querySelector('strong, img, a, script'), null);
    assert.equal(document.activeElement, dismiss);
    card.handle({
      type: 'action-call',
      name: 'fly_to_location',
      callId: 'literal',
      arguments: {},
    });
    card.handle({
      type: 'action-result',
      name: 'fly_to_location',
      callId: 'literal',
      result: {
        ok: true,
        display: {
          title: 'Result',
          notes: [payload],
          sources: [{ label: payload }],
          chips: [{ label: 'stale' }, { label: 'stale' }],
          lines: [payload],
        },
      },
    });
    assert.equal(ui.card.querySelector('strong, img, a, script'), null);
    assert.equal(
      ui.root.querySelector('#gev-voice-card-chips').children.length,
      2,
    );
    for (const node of before)
      assert.equal(ui.root.querySelector(`#${node.id}`), node, node.id);
    assert.ok(seen.length > 2 && seen.every(Boolean));
    const text = ui.card.textContent;
    card.destroy();
    dismiss.click();
    card.handle({
      type: 'transcript',
      role: 'assistant',
      text: 'late',
      final: true,
    });
    assert.equal(ui.card.textContent, text);
  });
}

test('card interaction postpones idle, then hides and releases its subscription on disposal', (t) => {
  const ui = createVoiceControl();
  const pending = new Map();
  let next = 0;
  const card = new VoiceCardControls({
    root: ui.root,
    connectView: ui.connectCard,
    setTimer(fn) {
      pending.set(++next, fn);
      return next;
    },
    clearTimer(id) {
      pending.delete(id);
    },
  });
  t.after(() => {
    card.destroy();
    ui.dispose();
  });
  card.handle({ type: 'interruption' });
  // jsdom does not reliably invalidate :hover/:focus-within; control the
  // native interaction predicate here and check real focus in Chromium.
  let held = true;
  ui.card.matches = () => held;
  const fire = () => {
    const [id, fn] = [...pending][0];
    pending.delete(id);
    fn();
  };
  fire();
  assert.equal(ui.card.hidden, false);
  assert.equal(pending.size, 1);
  held = false;
  fire();
  assert.equal(ui.card.hidden, true);
  assert.equal(pending.size, 0);
  ui.dispose();
  card.destroy();
  assert.equal(card.channel.publish(), false);
});
