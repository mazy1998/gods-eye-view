import { createVoiceDockState } from './dockState.js';

/*
 * The voice dock is a Vue view of its owner (VoiceDockView). Hosts that call
 * the exported binder with their own control factory supply plain handles
 * with no dock; for them this module attaches a dock owner whose painter
 * writes those handles, field by field, as each painter wrote them before.
 */

const setText = (node, text) => {
  if (node && node.textContent !== text) node.textContent = text;
};
const setAttr = (node, name, value) => {
  if (!node) return;
  if (value === null || value === undefined) node.removeAttribute?.(name);
  else if (node.getAttribute?.(name) !== value)
    node.setAttribute?.(name, value);
};
const setData = (node, name, value) => {
  if (!node?.dataset) return;
  if (value === null || value === undefined) delete node.dataset[name];
  else if (node.dataset[name] !== value) node.dataset[name] = value;
};

/**
 * Apply the dock owner's changed fields to the template. Only fields that
 * changed since the last paint are written, as each painter used to write.
 */
/** Snapshots copy the provider list, so compare it by its entries. */
function sameProviders(a = [], b = []) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.value === b[index]?.value && item.label === b[index]?.label,
    )
  );
}

function paintVoiceDock(ui, state, previous) {
  const changed = (...keys) => keys.some((key) => state[key] !== previous[key]);
  const providersChanged = !sameProviders(state.providers, previous.providers);
  const { root } = ui;
  if (changed('status')) setData(root, 'status', state.status);
  if (changed('speaker')) setData(root, 'speaker', state.speaker);
  if (changed('pushToTalk')) setData(root, 'pushToTalk', state.pushToTalk);
  if (changed('microphone')) setData(root, 'microphone', state.microphone);
  if (changed('provider')) setData(root, 'provider', state.provider);
  if (changed('providerChoice'))
    setData(root, 'providerChoice', state.providerChoice);
  if (changed('rowGrace'))
    setData(root, 'rowGrace', state.rowGrace ? 'true' : null);
  if (changed('errorDismissed'))
    root?.classList?.toggle?.('error-dismissed', state.errorDismissed);
  if (changed('statusLabel')) setText(ui.status, state.statusLabel);
  if (changed('detail')) setText(ui.detail, state.detail);
  if (changed('detailTitle') && ui.detail) ui.detail.title = state.detailTitle;
  if (changed('errorDetail')) setText(ui.errorDetail, state.errorDetail);
  if (changed('buttonLabel'))
    setAttr(ui.button, 'aria-label', state.buttonLabel);
  if (changed('buttonPressed'))
    setAttr(ui.button, 'aria-pressed', state.buttonPressed);
  if (changed('micLabel')) setText(ui.buttonLabel, state.micLabel);
  if (changed('hint')) setText(ui.helpDetail, state.hint);
  if (ui.providerSelect) {
    const doc = ui.providerSelect.ownerDocument;
    if (providersChanged && ui.providerSelect.replaceChildren && doc) {
      ui.providerSelect.replaceChildren(
        ...state.providers.map(({ value, label }) => {
          const option = doc.createElement('option');
          option.value = value;
          option.textContent = label;
          return option;
        }),
      );
    }
    if (providersChanged || changed('providerValue'))
      ui.providerSelect.value = state.providerValue;
    if (changed('providerTitle')) ui.providerSelect.title = state.providerTitle;
  }
  if (changed('providerVisible') && ui.providerField)
    ui.providerField.hidden = !state.providerVisible;
  if (ui.tierButton) {
    if (changed('tierLabel')) setText(ui.tierButton, state.tierLabel);
    if (changed('tierPressed'))
      setAttr(ui.tierButton, 'aria-pressed', String(state.tierPressed));
    if (changed('tierTitle')) ui.tierButton.title = state.tierTitle;
    if (changed('tierHidden')) ui.tierButton.hidden = state.tierHidden;
  }
  if (ui.costValue) {
    if (changed('costText')) setText(ui.costValue, state.costText);
    if (changed('costLevel')) setData(ui.costValue, 'level', state.costLevel);
    if (changed('costTitle')) ui.costValue.title = state.costTitle;
    if (changed('costHidden')) ui.costValue.hidden = state.costHidden;
  }
  if (ui.costWarning) {
    if (changed('warningHidden')) ui.costWarning.hidden = state.warningHidden;
    if (changed('warningText')) setText(ui.costWarning, state.warningText);
    if (changed('warningTitle')) ui.costWarning.title = state.warningTitle;
    if (changed('warningLevel'))
      setData(ui.costWarning, 'level', state.warningLevel);
  }
  if (ui.voicePanel) {
    if (changed('panelHidden')) ui.voicePanel.hidden = state.panelHidden;
    if (changed('panelView')) setData(ui.voicePanel, 'view', state.panelView);
    if (changed('previewHidden') && ui.previewPanel)
      ui.previewPanel.hidden = state.previewHidden;
    if (changed('settingsHidden') && ui.voiceSettingsPanel)
      ui.voiceSettingsPanel.hidden = state.settingsHidden;
    if (changed('open', 'view', 'panelView')) {
      setAttr(
        ui.voiceSettingsButton,
        'aria-expanded',
        String(state.open && state.view === 'settings'),
      );
      [ui.previewTab, ui.settingsTab].forEach((tab, index) => {
        if (!tab) return;
        const selected = state.view === (index === 0 ? 'preview' : 'settings');
        tab.setAttribute?.('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
    }
    if (changed('previewEmptyHidden') && ui.previewEmpty)
      ui.previewEmpty.hidden = state.previewEmptyHidden;
    if (changed('previewEmptyText'))
      setText(ui.previewEmpty, state.previewEmptyText);
    if (changed('timeoutStatus'))
      setText(ui.voiceTimeoutStatus, state.timeoutStatus);
    if (changed('previewChecked') && ui.voicePreviewInput)
      ui.voicePreviewInput.checked = state.previewChecked;
    if (changed('previewNote')) setText(ui.voicePreviewNote, state.previewNote);
    if (changed('timeoutNote')) setText(ui.voiceTimeoutNote, state.timeoutNote);
    if (changed('timeoutValue') && ui.voiceTimeoutSelect)
      ui.voiceTimeoutSelect.value = state.timeoutValue;
    if (ui.voiceTimeoutInput) {
      if (changed('customText')) ui.voiceTimeoutInput.value = state.customText;
      if (changed('customHidden'))
        ui.voiceTimeoutInput.hidden = state.customHidden;
    }
  }
}

/**
 * Give a supplied control without a dock an owner and its handle painter. A
 * control that already has a dock (the default Vue control) is returned as is.
 * @param {object} ui the control handles a host supplied
 * @returns {object} the same handles, with `dock` and a `dispose` that releases it
 */
export function attachCompatibleDock(ui) {
  if (!ui || ui.dock) return ui;
  const dock = createVoiceDockState();
  // Paint every field once now, so a value equal to the dock's default (one
  // provider, cost controls on) still reaches the supplied handles; later
  // changes are painted field by field.
  // The provider list and choice are the exception: a host's own options stay
  // until the binder supplies providers, as before.
  paintVoiceDock(ui, dock.state, {
    providers: dock.state.providers,
    providerValue: dock.state.providerValue,
  });
  let painted = dock.state;
  const unsubscribe = dock.channel.subscribe(({ state, initial }) => {
    if (initial) return;
    paintVoiceDock(ui, state, painted);
    painted = state;
  });
  const dispose = ui.dispose;
  ui.dock = dock;
  ui.dispose = () => {
    unsubscribe();
    dock.channel.destroy();
    dispose?.call(ui);
  };
  return ui;
}
