import { t } from '../i18n/index.js';
import { mountView } from '../ui/mountView.js';
import { createVoiceDockState } from './dockState.js';
import VoiceDockView from './VoiceDockView.vue';

/**
 * Short state label for the narrow voice heading. The `voice` context lets
 * languages use shorter words; unknown states show upper-cased.
 * @param {string} status machine state (dataset.status)
 * @returns {string}
 */
export function voiceStatusLabel(status) {
  switch (status) {
    case 'idle':
      return t('OFF', { context: 'voice' });
    case 'connecting':
      return t('CONNECTING', { context: 'voice' });
    case 'listening':
      return t('LISTENING', { context: 'voice' });
    case 'executing':
      return t('EXECUTING', { context: 'voice' });
    case 'error':
      return t('ERROR', { context: 'voice' });
    default:
      return String(status || '').toUpperCase();
  }
}

const controlsByRoot = new WeakMap();

/** Build the voice control independently of its connection backend. */
export function createVoiceControl({ reset = false, panel = false } = {}) {
  let root = document.getElementById('gev-voice-control');
  if (root && reset) {
    controlsByRoot.get(root)?.dispose();
    root.remove();
    root = null;
  }
  if (root && controlsByRoot.has(root)) return controlsByRoot.get(root);
  // A control this module did not mount has no owner to repaint it.
  root?.remove();
  const dock = createVoiceDockState();
  const commandDock = document.getElementById('command-dock');
  const view = mountView(VoiceDockView, {
    parent: commandDock || document.body,
    props: {
      state: dock.state,
      panel,
      dismissError: () => dock.set({ errorDismissed: true }),
    },
  });
  // Paint every owner change before the setter returns, so focus moves and
  // visibility checks that follow see the new state.
  const unsubscribe = dock.channel.subscribe(({ state }) =>
    view.update({ state }),
  );
  root = view.element;
  if (commandDock) {
    const locationBar = document.getElementById('location-bar');
    const controlPanel = document.getElementById('control-panel');
    // The shell's header may hold the location tray; its place in the dock
    // keeps this order for its return.
    if (locationBar?.parentNode === commandDock)
      commandDock.insertBefore(locationBar, root);
    if (controlPanel) commandDock.appendChild(controlPanel);
  }
  const cardConnections = new Set();
  const controls = {
    root,
    dock,
    // The card has its own owner/channel; dock publications never copy its state.
    connectCard(channel) {
      const unsubscribeCard = channel.subscribe(({ state }) =>
        view.update({ cardState: state }),
      );
      const disconnect = () => {
        unsubscribeCard();
        cardConnections.delete(disconnect);
      };
      cardConnections.add(disconnect);
      return disconnect;
    },
    voicePanel: root.querySelector('#gev-voice-panel'),
    previewPanel: root.querySelector('#gev-voice-preview-panel'),
    voiceSettingsPanel: root.querySelector('#gev-voice-settings-panel'),
    previewTab: root.querySelector('#gev-voice-preview-tab'),
    settingsTab: root.querySelector('#gev-voice-settings-tab'),
    voiceSettingsButton: root.querySelector('#gev-voice-settings-button'),
    voiceSettingsClose: root.querySelector('#gev-voice-settings-close'),
    previewEmpty: root.querySelector('#gev-voice-preview-empty'),
    voicePreviewInput: root.querySelector('#gev-voice-preview-enabled'),
    voicePreviewNote: root.querySelector('#gev-voice-preview-note'),
    voiceTimeoutSelect: root.querySelector('#gev-voice-timeout-select'),
    voiceTimeoutInput: root.querySelector('#gev-voice-timeout-input'),
    voiceTimeoutNote: root.querySelector('#gev-voice-timeout-note'),
    voiceTimeoutStatus: root.querySelector('#gev-voice-timeout-status'),
    providerField: root.querySelector('#gev-voice-provider-field'),
    providerSelect: root.querySelector('#gev-voice-provider'),
    button: root.querySelector('#gev-voice-button'),
    buttonLabel: root.querySelector('.gev-mic-label'),
    status: root.querySelector('#gev-voice-status'),
    detail: root.querySelector('#gev-voice-detail'),
    helpDetail: root.querySelector('.gev-voice-help-detail'),
    errorDetail: root.querySelector('#gev-voice-error-detail'),
    tierButton: root.querySelector('#gev-voice-tier'),
    costValue: root.querySelector('#gev-voice-cost-value'),
    costWarning: root.querySelector('#gev-voice-cost-warning'),
    card: root.querySelector('#gev-voice-card'),
  };
  controls.dispose = () => {
    for (const disconnect of cardConnections) disconnect();
    unsubscribe();
    dock.channel.destroy();
    view.dispose();
    controlsByRoot.delete(root);
  };
  controlsByRoot.set(root, controls);
  return controls;
}
