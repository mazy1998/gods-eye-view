import { t } from '../i18n/index.js';
import { createStateChannel } from '../app/stateChannel.js';

/** What the dock shows before any session, cost or panel code has run. */
export function initialVoiceDockState() {
  return {
    // Session (realtimeController, realtimeInput, sessionCommands).
    status: 'idle',
    speaker: 'idle',
    statusLabel: t('OFF', { context: 'voice' }),
    detail: t('VOICE STANDBY'),
    detailTitle: null,
    errorDetail: '',
    errorDismissed: false,
    pushToTalk: null,
    microphone: null,
    micLabel: t('ON/OFF'),
    hint: t('Hold Space to speak · tap Space to activate focused controls'),
    buttonPressed: null,
    buttonLabel: t(
      'Voice control — activate to toggle voice; hold Space to speak',
    ),
    // Provider (sessionCommands).
    provider: null,
    providers: [],
    providerValue: '',
    providerTitle: t('Changing provider reconnects voice if it is on.'),
    providerVisible: false,
    providerChoice: null,
    // Model tier and cost (realtimeCost, sessionCommands).
    tierLabel: t('STD'),
    tierPressed: false,
    tierTitle: t('Voice model tier — applies next session'),
    tierHidden: false,
    costText: '~$0.00',
    costLevel: 'ok',
    costTitle: t('Estimated session cost'),
    costHidden: false,
    warningText: '',
    warningTitle: null,
    warningLevel: null,
    warningHidden: true,
    // Panel presentation (manualPanel, host).
    panelHidden: true,
    panelView: null,
    view: 'preview',
    open: false,
    previewHidden: false,
    settingsHidden: true,
    previewEmptyHidden: false,
    previewEmptyText: t('Voice replies appear here.'),
    rowGrace: false,
    timeoutStatus: '',
    // Preferences as shown (preferences binding); the stored values stay in
    // the preference owner, and customText is the minutes field's draft.
    previewChecked: true,
    previewNote: '',
    timeoutNote: t('These preferences stay in this browser.'),
    timeoutValue: '5',
    customText: '5',
    customHidden: false,
  };
}

/**
 * The voice dock's one presentation owner. Session, cost, provider, panel and
 * preference code set fields here; the dock view renders them. Plain data
 * only: no transcripts, keys or tokens. The visualizer's per-frame levels are
 * deliberately not state; realtimeInput drives those bars directly.
 */
export function createVoiceDockState(overrides = {}) {
  let state = { ...initialVoiceDockState(), ...overrides };
  const channel = createStateChannel(() => state);
  return {
    channel,
    get state() {
      return state;
    },
    /** Merge a patch; publishes only when a field actually changes. */
    set(patch) {
      const changed = Object.keys(patch).filter(
        (key) => JSON.stringify(state[key]) !== JSON.stringify(patch[key]),
      );
      if (!changed.length) return false;
      state = { ...state, ...patch };
      channel.publish({ type: 'dock-changed', fields: changed });
      return true;
    },
  };
}
