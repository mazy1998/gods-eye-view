import '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceControl } from './control.js';
import { createVoiceCommands } from './sessionCommands.js';

for (const injected of [true, false]) {
  test(`session binder paints and disposes the ${injected ? 'injected native' : 'Vue'} reply card`, (t) => {
    const mounted = createVoiceControl();
    let ui = mounted;
    if (injected) {
      const root = mounted.root.cloneNode(true);
      mounted.dispose();
      document.body.append(root);
      ui = {
        root,
        button: root.querySelector('#gev-voice-button'),
        status: root.querySelector('#gev-voice-status'),
        detail: root.querySelector('#gev-voice-detail'),
        card: root.querySelector('#gev-voice-card'),
      };
      assert.equal(ui.connectCard, undefined);
    }
    let emit;
    const commands = createVoiceCommands({
      resetExisting: false,
      runner: async () => ({ ok: true }),
      createControl: () => ui,
      createSession(hooks) {
        emit = hooks.emit;
        return { start() {}, stop() {}, sendText() {}, sendMapEvent() {} };
      },
    });
    t.after(() => commands.session.destroy());
    const query = (id) => ui.root.querySelector(`#gev-voice-card-${id}`);
    const dismiss = query('dismiss');
    const notes = query('notes');
    const live = query('live');
    const text = '<strong>Provider reply</strong> & source';
    assert.equal(ui.card.hidden, true);
    emit({ type: 'transcript', role: 'assistant', text, final: true });
    assert.equal(commands.voiceCard.snapshot().visible, true);
    assert.equal(ui.card.hidden, false);
    assert.equal(query('assistant-text').textContent, text);
    assert.equal(live.textContent, text);
    assert.equal(ui.card.querySelector('strong'), null);
    emit({
      type: 'action-call',
      name: 'fly_to_location',
      callId: 'one',
      arguments: { query: 'Harbor' },
    });
    emit({
      type: 'action-result',
      name: 'fly_to_location',
      callId: 'one',
      result: {
        ok: true,
        display: {
          title: 'Harbor',
          lines: [text],
          chips: [{ label: 'partial' }],
          sources: [{ label: text }],
        },
      },
    });
    assert.equal(query('result-title').textContent, 'Harbor');
    assert.ok(query('lines').textContent.includes(text));
    assert.ok(query('note-list').textContent.includes(text));
    notes.querySelector('summary').click();
    assert.equal(notes.open, true);
    assert.equal(commands.voiceCard.channel.getSnapshot().notesOpen, true);
    commands.voiceCard.setEnabled(false);
    assert.equal(ui.card.hidden, true);
    commands.voiceCard.setEnabled(true);
    assert.equal(ui.card.hidden, false);
    assert.equal(query('notes'), notes);
    assert.equal(notes.open, true);
    assert.equal(query('live'), live);
    assert.equal(query('dismiss'), dismiss);
    dismiss.click();
    assert.equal(ui.card.hidden, true);
    assert.equal(commands.voiceCard.snapshot().visible, false);
    assert.equal(live.textContent, commands.voiceCard.snapshot().announce);
    commands.session.destroy();
    assert.equal(ui.root.isConnected, false);
    const after = ui.card.textContent;
    emit({
      type: 'transcript',
      role: 'assistant',
      text: 'Late reply',
      final: true,
    });
    assert.equal(ui.card.textContent, after);
    assert.equal(commands.voiceCard.hideTimer, null);
  });
}
