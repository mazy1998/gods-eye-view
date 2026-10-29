import { createVoiceControl, voiceStatusLabel } from './control.js';
import { attachCompatibleDock } from './dockCompat.js';
import { createVoiceSession } from './session.js';
import { VoiceCardControls } from './voiceCard.js';
import { connectCompatibleCard } from './cardCompat.js';
import { PointerReticle } from './pointerReticle.js';
import { VOICE_PROVIDERS } from './providerCapabilities.js';
import { msg, registerUnsavedWork, t } from '../i18n/index.js';

function createDefaultReticle(pointer) {
  const element = pointer?.element;
  const doc = element?.ownerDocument;
  if (!doc) return null;
  return new PointerReticle({
    doc,
    rectOf: () => element.getBoundingClientRect?.() || null,
  });
}

/** Bind common controls to a supplied voice-session adapter. */
export function createVoiceCommands({
  runner,
  dataManager,
  annotations = null,
  createSession,
  createController,
  backend,
  signal,
  debugSink,
  createControl = createVoiceControl,
  resetExisting = true,
  disposeRunner = true,
  provider,
  supportedProviders,
  onProviderChange,
  onSessionEvent,
  createCard = (options) => new VoiceCardControls(options),
  pointer = null,
  referents = null,
  createReticle = createDefaultReticle,
  panelHost = null,
  nativePanelProvider = null,
}) {
  if (resetExisting) window.__gevVoiceCommands?.stop?.({ removeUi: true });
  // A host's own control factory may supply plain handles without a dock.
  const ui = attachCompatibleDock(
    createControl({
      reset: true,
      ...(panelHost ? { panel: true } : {}),
    }),
  );
  let actionObserver;
  let panelMount;
  const session = createVoiceSession({
    runner,
    signal,
    createAdapter: (hooks) => {
      if (panelHost) actionObserver = panelHost.observeActions(hooks);
      return createSession({
        ...hooks,
        ...(actionObserver ? { runAction: actionObserver.runAction } : {}),
        runner,
        ui,
        dataManager,
        backend,
        debugSink,
        createController,
        pointer,
        radioLayer: dataManager?.layers?.get('radio')?.module || null,
      });
    },
  });
  const adapter = session.adapter;
  const capabilities = adapter.capabilities || {};
  const providerHandler = () => {
    // The choice shows at once, as the native select did; the owner decides.
    ui.dock?.set({ providerValue: ui.providerSelect.value });
    onProviderChange?.(ui.providerSelect.value);
  };
  if (ui.providerSelect && onProviderChange) {
    ui.dock?.set({
      ...(supportedProviders
        ? {
            providers: supportedProviders.map((name) => ({
              value: name,
              label: VOICE_PROVIDERS[name].label,
            })),
          }
        : {}),
      providerValue: provider,
      providerTitle: [
        t('Changing provider reconnects voice if it is on.'),
        capabilities.advisoryLimit,
      ]
        .filter(Boolean)
        .join(' '),
      provider,
    });
    ui.providerSelect.addEventListener('change', providerHandler);
  }
  const hasProviderChoice = Boolean(
    onProviderChange && supportedProviders?.length > 1,
  );
  ui.dock?.set({
    providerVisible: hasProviderChoice,
    providerChoice: String(hasProviderChoice),
    tierHidden: !capabilities.costControls,
    costHidden: !capabilities.costControls,
    ...(!capabilities.pushToTalk
      ? {
          buttonLabel: t('Toggle voice control'),
          hint: t('Activate to toggle voice'),
        }
      : {}),
  });
  // Retain the existing controller's inspection surface for browser tools.
  const controls = adapter.controller || session;
  controls.session = session;
  controls.ui = ui;
  const updateStatus = session.subscribe((event) => {
    if (event.type !== 'state') return;
    // States are machine values; only the label is translated.
    // The portable session reports 'Voice off' in English: show the idle
    // label instead. Other details are provider messages, shown as they come.
    const idle = event.state === 'idle';
    const detail = event.detail === 'Voice off' ? '' : event.detail;
    ui.dock?.set({
      status: event.state,
      statusLabel: voiceStatusLabel(event.state),
      detail: detail || (idle ? t('Voice off') : t('Voice active')),
      buttonPressed: String(session.isActive()),
      errorDetail:
        event.state === 'error'
          ? event.detail || t('Voice could not be started.')
          : '',
      ...(event.state === 'error' ? { errorDismissed: false } : {}),
    });
  });
  // Captions, plan and result card nested in the control; it only reads
  // provider-neutral session events.
  const card = ui.card
    ? createCard({
        root: ui.root,
        connectView:
          ui.connectCard ??
          ((channel) => connectCompatibleCard(ui.root, channel)),
        ...(panelHost ? { onRender: () => panelMount?.panel.sync() } : {}),
      })
    : null;
  panelMount = panelHost?.mount({
    ui,
    card,
    session,
    observer: actionObserver,
    nativeProvider: nativePanelProvider,
  });
  const updatePanel = panelMount ? session.subscribe(panelMount.handle) : null;
  const updateCard =
    card && !panelMount
      ? session.subscribe((event) => card.handle(event))
      : null;
  controls.voiceCard = card;
  if (panelMount) {
    controls.voicePanel = panelMount.panel;
    controls.captureVoicePanelOperation = panelMount.captureOperation;
    controls.getVoicePanelState = panelMount.snapshot;
    controls.getVoicePreferences = panelHost.snapshot;
  }
  // Point-and-ask: the reticle follows turn events; pointer and referents are
  // session-scoped, so a session that ends forgets both.
  const reticle = pointer ? createReticle(pointer) : null;
  const updatePointer = session.subscribe((event) => {
    reticle?.handle(event);
    if (event.type === 'state' && ['idle', 'error'].includes(event.state)) {
      pointer?.clear();
      referents?.clear();
      // Conversation memory ("those", "the last answer") ends with the
      // session.
      runner.resetConversation?.();
    }
  });
  controls.pointer = pointer;
  controls.referents = referents;
  // Forward last: a host observer may synchronously replace or stop this mount.
  const forwardEvents = onSessionEvent
    ? session.subscribe(onSessionEvent)
    : null;
  const annotationUnsubscribe = annotations?.onOutlineEvent?.((event) => {
    card?.outline(event);
    session.sendMapEvent({ type: 'map_annotation_outline', ...event });
  });
  // A reload (the language switch) ends the conversation: ask first.
  const unregisterUnsavedWork = registerUnsavedWork(() =>
    session.isActive() ? msg('the active voice session') : null,
  );
  const buttonHandler = () => {
    if (adapter.ignoreButtonClick?.()) return;
    if (session.isActive()) {
      const ticket = panelMount?.stopTicket();
      session.stop();
      panelMount?.closeAfterStop(ticket);
    } else void session.start({ pushToTalk: false });
  };
  ui.button.addEventListener('click', buttonHandler);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    ui.button.removeEventListener('click', buttonHandler);
    ui.providerSelect?.removeEventListener('change', providerHandler);
    unregisterUnsavedWork();
    annotationUnsubscribe?.();
    updateStatus();
    updateCard?.();
    updatePanel?.();
    panelMount?.destroy();
    actionObserver?.dispose();
    updatePointer();
    forwardEvents?.();
    reticle?.destroy();
    card?.destroy();
    if (disposeRunner) runner.dispose?.();
    ui.dispose?.();
    ui.root.remove();
  };
  session.signal.addEventListener('abort', cleanup, { once: true });
  if (session.disposed) cleanup();
  else adapter.bindControls?.();
  window.__gevVoiceCommands = controls;
  return controls;
}
