import test from 'node:test';
import assert from 'node:assert/strict';
// The real dock view in a real DOM: import the jsdom helper before Vue.
import { container } from '../../testSupport/componentDom.mjs';
import { controlledClock, installAncestorVisibility } from './testDom.mjs';

installAncestorVisibility(window);

const { createVoiceControl } = await import('../control.js');
const { createGevActionRunner } = await import('../gevActions.js');
const { createVoiceCommands: bind } = await import('../sessionCommands.js');
const { createVoiceCommands: compose } = await import('../commands.js');
const { createProviderCommands } = await import('../providerCommands.js');
const { createVoicePanelHost } = await import('./host.js');

/** A clean body for each scenario; the shared fixture container stays. */
function installPanelDom(t) {
  t.after(() => {
    document.body.className = '';
    for (const node of [...document.body.children])
      if (node !== container) node.remove();
    document.activeElement?.blur?.();
  });
  return document;
}

/**
 * Dispatch a real event; `target` names a descendant it starts from. A
 * listener's exception reaches the caller, as a direct handler call would.
 */
function fire(element, type, { target, ...init } = {}) {
  const node =
    target && target !== element && element.contains(target) ? target : element;
  const Event_ =
    type === 'click'
      ? MouseEvent
      : type.startsWith('key')
        ? KeyboardEvent
        : Event;
  let thrown = null;
  const onError = (event) => {
    thrown ??= { error: event.error };
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    node.dispatchEvent(
      new Event_(type, { bubbles: true, cancelable: true, ...init }),
    );
  } finally {
    window.removeEventListener('error', onError);
  }
  if (thrown) throw thrown.error;
}

function factory(instances, { stopError = null, native = false } = {}) {
  return (hooks) => {
    const input = {
      pushToTalkKeyHeld: false,
      setMicrophoneEnabled() {},
      releasePushToTalkKey() {
        this.pushToTalkKeyHeld = false;
      },
      resetSession() {},
    };
    const controller = native
      ? {
          input,
          _input: input,
          _turns: { observeSpeech() {} },
          status: 'idle',
          dc: null,
          sendTextCommand(text) {
            if (!text) return false;
            hooks.emit({
              type: 'pointer',
              pointer: { kind: 'here', label: 'Typed target' },
            });
          },
          createAudio(options) {
            this.audioCallbacks = options;
            return {
              pending: false,
              play() {},
              clearPlayback() {},
              close() {},
            };
          },
          handleMessage() {},
          userActivityOpen: false,
          pendingTools: 0,
          isActive: () => true,
        }
      : {};
    const adapter = {
      controller,
      capabilities: { pushToTalk: true },
      starts: 0,
      stops: 0,
      bindControls() {},
      start() {
        this.starts++;
        if (native) {
          hooks.emit({ type: 'state', state: 'connecting' });
          controller.audio = controller.createAudio({ pushToTalk: false });
          hooks.emit({ type: 'state', state: 'connecting' });
          // Native open-mic startup marks presentation pending before speech.
          controller.userTurnPending = true;
        }
        hooks.emit({ type: 'state', state: 'listening' });
      },
      stop() {
        this.stops++;
        if (stopError) throw stopError;
      },
      sendText: () => false,
      sendMapEvent() {},
      getStartOptions: () => ({ pushToTalk: false }),
      hooks,
      input,
    };
    instances.push(adapter);
    return adapter;
  };
}
function mounted(t, options = {}) {
  const doc = installPanelDom(t);
  const clock = controlledClock();
  const host = createVoicePanelHost({
    storage: options.storage ?? null,
    clock,
    readCockpitState: options.readCockpitState,
  });
  const instances = [];
  const commands = bind({
    runner: options.runner ?? (async () => ({ ok: true })),
    dataManager: { layers: new Map() },
    createSession: factory(instances, options),
    panelHost: host,
    nativePanelProvider: options.native
      ? (options.nativeProvider ?? 'gemini')
      : null,
  });
  t.after(() => {
    try {
      commands.session.destroy();
    } catch {}
    host.destroy();
  });
  return { doc, clock, host, instances, commands, ui: commands.ui };
}

test('actual control default remains opt-out; panel markup has unique controlled panes and an outside alert', (t) => {
  const doc = installPanelDom(t);
  const baseline = createVoiceControl();
  assert.equal(baseline.voicePanel, null);
  const ui = createVoiceControl({ reset: true, panel: true });
  assert.equal(doc.getElementById('gev-voice-panel'), ui.voicePanel);
  assert.equal(
    ui.voiceSettingsButton.getAttribute('aria-controls'),
    ui.voicePanel.id,
  );
  assert.equal(ui.previewTab.getAttribute('aria-controls'), ui.previewPanel.id);
  assert.equal(
    ui.settingsTab.getAttribute('aria-controls'),
    ui.voiceSettingsPanel.id,
  );
  assert.equal(ui.previewPanel.contains(ui.card), true);
  assert.equal(
    ui.voicePanel.contains(ui.root.querySelector('.gev-voice-error-tray')),
    false,
  );
  assert.equal(ui.root.querySelectorAll('#gev-voice-card').length, 1);
});

test('actual binder/card has launcher toggle, idempotent tabs, focus and disabled Preview', (t) => {
  const { ui, commands, doc } = mounted(t);
  fire(ui.voiceSettingsButton, 'click');
  assert.equal(commands.voicePanel.snapshot().settingsOpen, true);
  fire(ui.voiceSettingsButton, 'click');
  assert.equal(commands.voicePanel.snapshot().panelOpen, false);
  fire(ui.settingsTab, 'click');
  fire(ui.settingsTab, 'keydown', { key: 'End' });
  assert.equal(commands.voicePanel.snapshot().settingsOpen, true);
  fire(ui.settingsTab, 'click');
  assert.equal(commands.voicePanel.snapshot().settingsOpen, true);
  commands.voicePanel.select('preview');
  commands.voiceCard.handle({
    type: 'transcript',
    role: 'assistant',
    final: true,
    text: 'A visible reply',
  });
  const dismiss = ui.root.querySelector('#gev-voice-card-dismiss');
  dismiss.focus();
  fire(dismiss, 'click');
  assert.equal(ui.card.hidden, true);
  assert.equal(commands.voicePanel.snapshot().panelOpen, true);
  assert.equal(doc.activeElement?.id, ui.previewTab.id);
  fire(ui.voicePanel, 'keydown', { key: 'Escape', target: doc.activeElement });
  assert.equal(commands.voicePanel.snapshot().panelOpen, false);
  commands.voicePanel.select('settings');
  ui.voicePreviewInput.checked = false;
  fire(ui.voicePreviewInput, 'change');
  commands.voicePanel.select('preview');
  commands.voiceCard.handle({
    type: 'transcript',
    role: 'assistant',
    final: true,
    text: 'A hidden reply',
  });
  assert.equal(ui.card.hidden, true);
  assert.equal(ui.previewEmpty.textContent, 'Preview is off.');
  ui.previewTab.focus();
  fire(ui.voicePanel, 'keydown', { key: 'Escape' });
  assert.equal(doc.activeElement, ui.voiceSettingsButton);
  commands.voiceCard.handle({
    type: 'transcript',
    role: 'assistant',
    final: true,
    text: 'Later reply',
  });
  assert.equal(commands.voicePanel.snapshot().panelOpen, false);
});

test('actual facade remount keeps failed-save live preferences/view and manual close, with no restore writes or focus theft', async (t) => {
  const doc = installPanelDom(t);
  const writes = [];
  const storage = {
    getItem: () => null,
    setItem(key, value) {
      writes.push([key, value]);
      throw Error('blocked');
    },
  };
  const host = createVoicePanelHost({ storage });
  const instances = [];
  const commands = createProviderCommands(
    {
      runner: async () => ({}),
      dataManager: { layers: new Map() },
      supportedProviders: ['openai', 'gemini'],
    },
    {
      bind: (options) => bind({ ...options, panelHost: host }),
      factories: { openai: factory(instances), gemini: factory(instances) },
      storage,
    },
  );
  t.after(() => {
    commands.destroy();
    host.destroy();
  });
  const old = commands.ui;
  commands.voicePanel.select('settings');
  old.voicePreviewInput.checked = false;
  fire(old.voicePreviewInput, 'change');
  old.voiceTimeoutInput.value = '7';
  old.voiceTimeoutSelect.value = 'custom';
  fire(old.voiceTimeoutSelect, 'change');
  const preferenceWrites = () =>
    writes.filter(([key]) => key.startsWith('godsEyeView.voice.')).length;
  assert.equal(preferenceWrites(), 2);
  old.providerSelect.value = 'gemini';
  fire(old.providerSelect, 'change');
  assert.notEqual(commands.ui, old);
  assert.equal(old.root.isConnected, false);
  assert.equal(commands.voicePanel.snapshot().settingsOpen, true);
  assert.deepEqual(commands.getVoicePreferences(), {
    previewEnabled: false,
    minutes: 7,
    previewPersisted: false,
    timeoutPersisted: false,
  });
  assert.equal(commands.ui.voicePreviewInput.checked, false);
  assert.match(commands.ui.voiceTimeoutNote.textContent, /could not be saved/);
  assert.equal(preferenceWrites(), 2);
  assert.equal(doc.activeElement, commands.ui.providerSelect);
  commands.ui.voicePreviewInput.checked = true;
  fire(commands.ui.voicePreviewInput, 'change');
  commands.voicePanel.close();
  await commands.start();
  const retired = instances[1];
  commands.ui.providerSelect.value = 'openai';
  fire(commands.ui.providerSelect, 'change');
  await commands.start();
  assert.equal(commands.session.isActive(), true);
  retired.hooks.emit({
    type: 'transcript',
    role: 'assistant',
    text: 'Retired output',
    final: true,
  });
  const emit = instances[2].hooks.emit;
  emit({
    type: 'transcript',
    role: 'assistant',
    text: 'Current output after remount',
    final: true,
  });
  assert.equal(commands.voicePanel.snapshot().panelOpen, false);
  emit({ type: 'interruption', reason: 'user-speech' });
  emit({
    type: 'transcript',
    role: 'assistant',
    text: 'Reply after genuine input',
    final: true,
  });
  assert.equal(commands.voicePanel.snapshot().previewVisible, true);
});

test('explicit successful mic Stop closes; failed Stop idle and startup error do not', async (t) => {
  const good = mounted(t);
  await good.commands.session.start();
  good.commands.voicePanel.select('settings');
  fire(good.ui.button, 'click');
  assert.equal(good.commands.voicePanel.snapshot().panelOpen, false);
  const error = Error('stop failed');
  const bad = mounted(t, { stopError: error });
  await bad.commands.session.start();
  bad.commands.voicePanel.select('settings');
  assert.throws(
    () => fire(bad.ui.button, 'click'),
    (value) => value === error,
  );
  assert.equal(bad.commands.session.state, 'idle');
  assert.equal(bad.commands.voicePanel.snapshot().settingsOpen, true);
  bad.instances[0].hooks.emit({
    type: 'state',
    state: 'error',
    detail: 'startup failed',
  });
  assert.equal(bad.commands.voicePanel.snapshot().settingsOpen, true);
});

test('reentrant manual choice/new start during Stop cannot close the successor choice', async (t) => {
  const f = mounted(t);
  await f.commands.session.start();
  f.commands.voicePanel.select('settings');
  const unsubscribe = f.commands.session.subscribe((event) => {
    if (event.type === 'state' && event.state === 'idle')
      f.commands.voicePanel.select('preview');
  });
  fire(f.ui.button, 'click');
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, true);
  assert.equal(f.commands.voicePanel.snapshot().view, 'preview');
  unsubscribe();
});

test('integrated inactivity rechecks held PTT at expiry, then normal stop closes on later quiet expiry', async (t) => {
  const f = mounted(t, { native: true });
  await f.commands.session.start();
  f.commands.voicePanel.select('settings');
  f.ui.voiceTimeoutInput.value = '1';
  f.ui.voiceTimeoutSelect.value = 'custom';
  fire(f.ui.voiceTimeoutSelect, 'change');
  f.instances[0].input.pushToTalkKeyHeld = true;
  f.clock.advance(60000);
  assert.equal(f.instances[0].stops, 0);
  f.instances[0].input.releasePushToTalkKey();
  f.clock.advance(60000);
  assert.equal(f.instances[0].stops, 1);
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, false);
});

test('None cancels integrated app timer and unknown custom hosts never guess expiry', async (t) => {
  const native = mounted(t, { native: true });
  await native.commands.session.start();
  native.ui.voiceTimeoutSelect.value = '0';
  fire(native.ui.voiceTimeoutSelect, 'change');
  native.clock.advance(600000);
  assert.equal(native.instances[0].stops, 0);
  assert.equal(native.commands.getVoicePreferences().minutes, 0);
  const unknown = mounted(t);
  await unknown.commands.session.start();
  unknown.clock.advance(600000);
  assert.equal(unknown.instances[0].stops, 0);
  assert.match(unknown.ui.voiceTimeoutStatus.textContent, /unavailable/);
});

test('transient native OpenAI response activity does not announce connection unavailability', async (t) => {
  const f = mounted(t, { native: true, nativeProvider: 'openai' });
  await f.commands.session.start();
  f.ui.voiceTimeoutInput.value = '1';
  f.ui.voiceTimeoutSelect.value = 'custom';
  fire(f.ui.voiceTimeoutSelect, 'change');
  f.instances[0].controller._turns.observeSpeech({ type: 'response.created' });
  assert.equal(f.ui.voiceTimeoutStatus.textContent, '');
  f.clock.advance(60000);
  assert.equal(f.instances[0].stops, 0, 'unknown output still prevents expiry');
  f.instances[0].controller._turns.observeSpeech({
    type: 'output_audio_buffer.cleared',
  });
  f.clock.advance(60000);
  assert.equal(f.instances[0].stops, 1, 'known quiet output permits expiry');
});

test('native factory with custom controller remains uninstrumented despite panel opt-in', (t) => {
  installPanelDom(t);
  let inspected = 0;
  const commands = compose({
    panel: true,
    panelStorage: null,
    runner: async () => ({}),
    dataManager: { layers: new Map() },
    createController: (options) => ({
      ui: options.ui,
      get _turns() {
        inspected++;
        throw Error('custom internal getter');
      },
      start() {},
      stop() {},
      sendTextCommand() {},
      notifyMapEvent() {},
      syncCostUi() {},
      bindPushToTalkShortcut() {},
      toggleVoiceTier() {},
    }),
  });
  t.after(() => commands.session.destroy());
  assert.equal(inspected, 0);
  assert.equal(commands.getVoicePanelState().activity.known, false);
  assert.equal(inspected, 0);
});

test('native connecting phases retain output observation; idle starts before first speech and waits for drain', async (t) => {
  const f = mounted(t, { native: true });
  await f.commands.session.start();
  const adapter = f.instances[0];
  const controller = adapter.controller;
  assert.equal(
    f.commands.getVoicePanelState().inactivity.eligible,
    true,
    'open microphone presentation-pending is not admitted speech',
  );
  controller.audio.pending = true;
  controller.handleMessage({});
  f.clock.advance(300000);
  assert.equal(adapter.stops, 0);
  assert.equal(f.commands.getVoicePanelState().activity.outputBusy, true);
  controller.audio.pending = false;
  controller.audioCallbacks.onDrain();
  f.clock.advance(300000);
  assert.equal(adapter.stops, 1);
});

async function directActions(
  t,
  { storage = null, delayExit = false, exposePanel = true } = {},
) {
  installPanelDom(t);
  let f, releaseExit;
  const state = { active: true, exits: 0, visual: [] };
  const styleManager = {
    getCockpitState: () => ({ active: state.active }),
    controlCockpit(action) {
      assert.equal(action, 'exit');
      state.exits++;
      state.active = false;
      const result = { ok: true, state: { active: false } };
      return delayExit
        ? new Promise((resolve) => {
            releaseExit = () => resolve(result);
          })
        : result;
    },
    setPanelCollapsed(...args) {
      state.visual.push(args);
    },
  };
  const runner = createGevActionRunner({
    viewer: {
      clock: { onTick: { addEventListener: () => () => {} } },
      scene: { canvas: { addEventListener() {}, removeEventListener() {} } },
      camera: { moveEnd: { addEventListener() {} } },
    },
    styleManager,
    dataManager: { layers: new Map(), getAll: () => [] },
    readVoicePanelOperation: () =>
      exposePanel ? f?.commands.captureVoicePanelOperation() : undefined,
  });
  f = mounted(t, { native: true, runner, storage });
  await f.commands.session.start();
  return {
    ...f,
    runner,
    state,
    run: f.instances[0].hooks.runAction,
    releaseExit: () => releaseExit(),
  };
}

test('actual runner applies exact timeout directly and reports live-unsaved truth, invalid/cancelled attempts stay inert', async (t) => {
  const f = await directActions(t);
  const result = await f.run('set_voice_inactivity_timeout', { minutes: 7 });
  assert.equal(result.applied, true);
  assert.equal(result.persisted, false);
  assert.equal(result.minutes, 7);
  assert.match(result.say, /could not be saved/);
  assert.equal(f.commands.getVoicePreferences().minutes, 7);
  const invalid = await f.run('set_voice_inactivity_timeout', { minutes: 7.5 });
  assert.equal(invalid.applied, false);
  assert.equal(f.commands.getVoicePreferences().minutes, 7);
  const abort = new AbortController();
  abort.abort();
  const cancelled = await f.runner(
    'set_voice_inactivity_timeout',
    { minutes: 2 },
    { signal: abort.signal },
  );
  assert.equal(cancelled.cancelled, true);
  assert.equal(f.commands.getVoicePreferences().minutes, 7);
  const operation = f.commands.captureVoicePanelOperation();
  f.commands.session.stop();
  assert.equal(operation.setMinutes(2).cancelled, true);
});

test('named voice settings exits Cockpit directly; Preview stays disabled and visual presets stay separate from Scenes', async (t) => {
  const f = await directActions(t);
  const result = await f.run('set_panel_open', {
    panelId: 'voice-settings',
    open: true,
  });
  assert.equal(f.state.exits, 1);
  assert.equal(result.settingsOpen, true);
  f.ui.voicePreviewInput.checked = false;
  fire(f.ui.voicePreviewInput, 'change');
  const preview = await f.run('set_panel_open', {
    panelId: 'voice control',
    open: true,
  });
  assert.equal(preview.view, 'preview');
  assert.equal(preview.previewEnabled, false);
  assert.equal(f.commands.getVoicePreferences().previewEnabled, false);
  for (const panelId of [
    'visual styles',
    'visual preset',
    'visual presets',
    'scenes',
  ])
    await f.run('set_panel_open', { panelId, open: true });
  assert.equal(f.state.exits, 1);
  assert.deepEqual(
    f.state.visual.map(([id]) => id),
    ['control-panel', 'control-panel', 'control-panel', 'scene-panel'],
  );
  await assert.rejects(
    () => f.run('set_panel_open', { panelId: 'settings', open: true }),
    /Unknown panel: settings/,
  );
  assert.equal(
    f.state.visual.length,
    4,
    'an unnamed settings target never guesses a panel',
  );
});

test('canonical exit reveals requested voice UI; newer manual choice or Stop defeats pending reveal', async (t) => {
  const f = await directActions(t, { delayExit: true });
  const pending = f.run('control_cockpit', {
    action: 'exit',
    voicePanel: 'settings',
  });
  f.commands.voicePanel.select('preview');
  f.releaseExit();
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(f.state.active, false);
  assert.equal(result.exit.ok, true);
  assert.equal(result.cockpitExited, true);
  assert.match(result.say, /Cockpit exited/);
  assert.equal(f.commands.voicePanel.snapshot().view, 'preview');
  f.state.active = true;
  const alias = f.run('control_cockpit', {
    action: 'leave cockpit',
    voicePanel: 'settings',
  });
  f.releaseExit();
  assert.equal((await alias).settingsOpen, true);
  f.commands.voicePanel.select('preview');
  f.state.active = true;
  const stopped = f.run('control_cockpit', {
    action: 'quit cockpit',
    voicePanel: 'settings',
  });
  f.commands.session.stop();
  f.releaseExit();
  await assert.rejects(stopped, { name: 'AbortError' });
  assert.equal(f.commands.voicePanel.snapshot().view, 'preview');
});

test('unavailable host refuses direct voice operations before Cockpit or preference effects', async (t) => {
  const f = await directActions(t, { exposePanel: false });
  const timeout = await f.run('set_voice_inactivity_timeout', { minutes: 1 });
  assert.equal(timeout.unavailable, true);
  assert.equal(timeout.applied, false);
  const panel = await f.run('set_panel_open', {
    panelId: 'voice-settings',
    open: true,
  });
  assert.equal(panel.unavailable, true);
  assert.equal(f.state.exits, 0);
  assert.equal(f.commands.getVoicePreferences().minutes, 5);
});

test('voice timeout change preserves a pending voice reveal', async (t) => {
  const f = await directActions(t, { delayExit: true });
  const pending = f.run('control_cockpit', {
    action: 'exit',
    voicePanel: 'settings',
  });
  const timeout = await f.run('set_voice_inactivity_timeout', { minutes: 0 });
  assert.equal(timeout.minutes, 0);
  assert.equal(timeout.applied, true);
  f.releaseExit();
  const result = await pending;
  assert.equal(result.settingsOpen, true);
  assert.equal(f.commands.getVoicePreferences().minutes, 0);
});

test('active provider output reveals Preview after done; manual choice wins until genuine input, replays do not reset idle', async (t) => {
  const f = mounted(t, { native: true, nativeProvider: 'openai' });
  await f.commands.session.start();
  const emit = f.instances[0].hooks.emit;
  const reply = (text, responseId = 'r1', extra = {}) =>
    emit({
      type: 'transcript',
      role: 'assistant',
      text,
      responseId,
      final: true,
      ...extra,
    });
  emit({ type: 'completion', responseId: 'r1' });
  reply('Late answer');
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, true);
  const timer = f.commands.voiceCard.hideTimer;
  reply('Late answer');
  reply('Late', 'r1', { final: false });
  assert.equal(f.commands.voiceCard.hideTimer, timer);
  assert.equal(f.commands.voiceCard.state.assistant, 'Late answer');
  f.commands.voicePanel.close();
  emit({
    type: 'transcript',
    role: 'user',
    text: 'advisory caption',
    final: false,
  });
  f.commands.voiceCard.handle({ type: 'dismiss' });
  const advisory = f.commands.voiceCard.state.user;
  emit({
    type: 'interruption',
    reason: 'user-speech',
    preserveAdvisoryCaption: true,
  });
  assert.equal(f.commands.voiceCard.state.dismissed, true);
  assert.equal(f.commands.voiceCard.state.user, advisory);
  reply('Older reply', 'r2');
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, false);
  emit({ type: 'interruption', reason: 'user-speech' });
  reply('A reply with no newest-request attribution', 'older-id');
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, true);
  f.commands.voicePanel.select('settings');
  reply('Another reply', 'r3');
  assert.equal(f.commands.voicePanel.snapshot().settingsOpen, true);
  f.commands.voicePanel.close();
  f.commands.voiceCard.handle({ type: 'dismiss' });
  f.commands.sendTextCommand('Show the typed target');
  reply('Typed reply', 'typed-id');
  assert.equal(f.commands.voicePanel.snapshot().previewVisible, true);
  assert.equal(f.commands.voiceCard.state.dismissed, false);
  assert.equal(f.commands.voiceCard.state.pointer.label, 'Typed target');
  f.commands.session.stop();
  reply('Stopped stale output', 'r4');
  assert.equal(f.commands.voiceCard.state.assistant, null);
  f.commands.session.destroy();
  reply('Disposed stale output', 'r5');
  assert.equal(f.commands.voicePanel.snapshot().panelOpen, false);
});

test('Preview off and actual Cockpit state suppress automatic presentation without enabling preference', async (t) => {
  let cockpit = false;
  const f = mounted(t, {
    native: true,
    readCockpitState: () => ({ active: cockpit }),
  });
  await f.commands.session.start();
  const emit = f.instances[0].hooks.emit;
  const reply = (text) =>
    emit({ type: 'transcript', role: 'assistant', text, final: true });
  reply('Visible');
  f.ui.previewTab.focus();
  cockpit = true;
  window.dispatchEvent(new Event('gev:cockpit-mode-changed'));
  assert.equal(f.ui.voicePanel.hidden, true);
  assert.equal(f.doc.activeElement, f.ui.voiceSettingsButton);
  f.commands.voicePanel.select('settings', { focus: true });
  assert.equal(f.doc.activeElement, f.ui.settingsTab);
  f.commands.voicePanel.select('preview', { focus: true });
  assert.equal(f.doc.activeElement, f.ui.voiceSettingsButton);
  const outside = f.doc.createElement('button');
  f.doc.body.appendChild(outside);
  outside.focus();
  window.dispatchEvent(new Event('gev:cockpit-mode-changed'));
  assert.equal(f.doc.activeElement, outside);
  assert.equal(f.commands.voicePanel.snapshot().previewVisible, false);
  reply('Suppressed in Cockpit');
  assert.equal(f.ui.voicePanel.hidden, true);
  f.commands.voicePanel.close();
  cockpit = false;
  window.dispatchEvent(new Event('gev:cockpit-mode-changed'));
  assert.equal(f.ui.voicePanel.hidden, true);
  f.ui.voicePreviewInput.checked = false;
  fire(f.ui.voicePreviewInput, 'change');
  emit({ type: 'interruption', reason: 'user-speech' });
  reply('Preference stays off');
  assert.equal(f.ui.voicePanel.hidden, true);
  assert.equal(f.commands.getVoicePreferences().previewEnabled, false);
});

test('Provider Settings uses its ready dialog handlers and refuses unavailable or cancelled requests', async (t) => {
  const f = await directActions(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = (open, options) =>
    f.run('set_panel_open', { panelId: 'provider-settings', open }, options);
  assert.equal((await request(true)).unavailable, true);
  const doc = globalThis.document;
  const chip = doc.createElement('button');
  chip.id = 'key-setup-chip';
  const panel = doc.createElement('aside');
  panel.id = 'key-setup';
  panel.hidden = true;
  const close = doc.createElement('button');
  panel.appendChild(close);
  doc.body.append(chip, panel);
  const query = panel.querySelector.bind(panel);
  panel.querySelector = (selector) =>
    selector === '[data-key-setup-close]' ? close : query(selector);
  chip.click = () => fire(chip, 'click');
  close.click = () => fire(close, 'click');
  let frames = 0;
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    frames++;
    callback();
  };
  t.after(() => {
    if (previousFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousFrame;
  });
  const { initKeySetup } = await import('../../keySetup.js');
  let finishStatus;
  const pending = initKeySetup({
    documentRef: doc,
    fetchImpl: () =>
      new Promise((resolve) => {
        finishStatus = resolve;
      }),
  });
  assert.equal(
    (await request(true)).unavailable,
    true,
    'initializing is not ready',
  );
  finishStatus({
    ok: true,
    json: async () => ({ keys: [], setCount: 0, total: 1 }),
  });
  const setup = await pending;
  t.after(() => setup.destroy());
  doc.body.classList.add('cockpit-mode');
  assert.equal((await request(true)).unavailable, true);
  assert.equal(
    panel.hidden,
    true,
    'a concealed view cannot schedule a later surprise reveal',
  );
  doc.body.classList.remove('cockpit-mode');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(() => request(true, { signal: abort.signal }), {
    name: 'AbortError',
  });
  assert.equal(panel.hidden, true);
  assert.equal((await request(true)).ok, true);
  assert.equal(panel.hidden, false);
  assert.equal(panel.classList.contains('visible'), true);
  assert.equal((await request(true)).ok, true);
  assert.equal(frames, 1, 'repeated open reuses the dialog');
  assert.equal((await request(false)).ok, true);
  assert.equal(panel.classList.contains('visible'), false);
  t.mock.timers.tick(400);
  assert.equal(panel.hidden, true);
  assert.equal((await request(false)).ok, true);
  assert.equal(
    f.state.visual.length,
    0,
    'provider setup never opens a visual or scene panel',
  );
});

test('a minutes value the field holds survives dock repaints until its change commits', (t) => {
  const { ui, commands } = mounted(t);
  commands.voicePanel.select('settings');
  ui.voiceTimeoutSelect.value = 'custom';
  fire(ui.voiceTimeoutSelect, 'change');
  // Set without an input event (autofill, a script), then a cost tick and a
  // status repaint arrive before the field's change commits.
  ui.voiceTimeoutInput.value = '9';
  ui.dock.set({ costText: '~$0.10', costLevel: 'ok' });
  ui.dock.set({ detail: 'Listening' });
  assert.equal(ui.voiceTimeoutInput.value, '9');
  fire(ui.voiceTimeoutInput, 'change');
  assert.equal(commands.getVoicePreferences().minutes, 9);
  assert.equal(ui.voiceTimeoutInput.value, '9');
});
