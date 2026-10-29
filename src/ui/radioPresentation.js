/** Render Radio state without making playback or Context decisions. */
import { t } from '../i18n/index.js';

export function renderRadioState(state) {
  if (this.destroyed || !state || !this._radioPanel) return;
  const lifecycle = this.actions.getLifecycle() || null;
  const lifecycleState =
    lifecycle?.lifecycleState || (state.enabled ? 'enabled' : 'disabled');
  state = {
    ...state,
    enabled: lifecycle ? lifecycle.enabled : state.enabled,
    lifecycleState,
    lifecycleUncertain: lifecycle?.uncertain || false,
  };
  this._radioState = state;
  const enabled = Boolean(state.enabled);
  const transitioning =
    lifecycleState === 'enabling' || lifecycleState === 'disabling';
  const uncertain = Boolean(state.lifecycleUncertain);
  const interactive = enabled && !transitioning && !uncertain;
  const selected = state.selected || null;
  const hasStations = state.filteredCount > 0;
  const activePlayback = ['playing', 'buffering'].includes(state.audioState);
  document
    .getElementById('title-bar')
    ?.classList.toggle('radio-broadcasting', state.audioState === 'playing');
  this._radioPanel.classList.toggle('radio-enabled', enabled);
  this._radioPanel.classList.toggle('lifecycle-uncertain', uncertain);
  this._contextRadioDock?.classList.toggle('active', enabled);
  if (this._contextRadioToggleBtn) {
    this._contextRadioToggleBtn.classList.toggle('active', enabled);
  }
  this._syncContextRadioLauncherState();
  this._radioLayerState?.classList.toggle('active', enabled);
  const lifecycleLabel =
    lifecycleState === 'enabling' ? t('ENABLING') : t('DISABLING');
  if (this._radioLayerState) {
    this._radioLayerState.textContent = transitioning
      ? lifecycleLabel
      : uncertain
        ? t('UNCERTAIN')
        : state.loading
          ? t('SYNC')
          : enabled
            ? `${state.filteredCount}/${state.stationCount}`
            : t('OFF');
  }
  const enableLabel = uncertain
    ? t('RECONCILE')
    : enabled
      ? t('DISABLE')
      : t('ENABLE');
  const enableAria = uncertain
    ? t('Reconcile Radio — lifecycle uncertain')
    : enabled
      ? t('Disable Radio')
      : t('Enable Radio');
  if (this._contextRadioMiniEnableBtn) {
    this._contextRadioMiniEnableBtn.classList.toggle('active', enabled);
    this._contextRadioMiniEnableBtn.setAttribute(
      'aria-pressed',
      String(enabled),
    );
    this._contextRadioMiniEnableBtn.textContent = transitioning
      ? lifecycleLabel
      : enableLabel;
    this._contextRadioMiniEnableBtn.setAttribute('aria-label', enableAria);
    this._contextRadioMiniEnableBtn.disabled = false;
    this._contextRadioMiniEnableBtn.setAttribute(
      'aria-disabled',
      String(transitioning),
    );
    this._contextRadioMiniEnableBtn.setAttribute(
      'aria-busy',
      String(transitioning),
    );
  }
  if (this._cockpitRadioEnableBtn) {
    this._cockpitRadioEnableBtn.classList.toggle('active', enabled);
    this._cockpitRadioEnableBtn.setAttribute('aria-pressed', String(enabled));
    this._cockpitRadioEnableBtn.textContent = transitioning
      ? lifecycleLabel
      : enableLabel;
    this._cockpitRadioEnableBtn.setAttribute('aria-label', enableAria);
    this._cockpitRadioEnableBtn.disabled = false;
    this._cockpitRadioEnableBtn.setAttribute(
      'aria-disabled',
      String(transitioning),
    );
    this._cockpitRadioEnableBtn.setAttribute(
      'aria-busy',
      String(transitioning),
    );
  }

  const tunerAvailable = interactive && state.filteredCount > 0;
  this._radioTunerView.static = Boolean(state.tuningStatic);
  this._paintRadioView();
  if (tunerAvailable) this._refreshRadioTunerBand?.();
  if (!tunerAvailable && this._radioTunerDragging) {
    this._radioTunerDragging = false;
    this._radioTunerDragSnapshot = null;
    this._radioTunerStations = [];
    this._radioTunerView.static = false;
    this._radioTunerView.dragging = false;
  }
  if (!tunerAvailable) {
    this._radioTunerStations = [];
    this._radioTunerPool = [];
    this._radioTunerBandSignature = '';
    this._radioTunerSelectedId = null;
  }

  if (this._contextRadioMiniPrevBtn)
    this._contextRadioMiniPrevBtn.disabled = !interactive || !hasStations;
  if (this._contextRadioMiniNextBtn)
    this._contextRadioMiniNextBtn.disabled = !interactive || !hasStations;
  if (this._cockpitRadioPrevBtn)
    this._cockpitRadioPrevBtn.disabled = !interactive || !hasStations;
  if (this._cockpitRadioNextBtn)
    this._cockpitRadioNextBtn.disabled = !interactive || !hasStations;
  const playbackAction = activePlayback
    ? t('Pause')
    : state.audioState === 'paused'
      ? t('Resume')
      : t('Play');
  const playTargetWord = selected ? t('selected') : t('nearest');
  const playAria = t('{action} {target} radio station', {
    action: playbackAction,
    target: playTargetWord,
  });
  if (this._contextRadioMiniPlayBtn) {
    this._contextRadioMiniPlayBtn.disabled = !interactive || !hasStations;
    this._contextRadioMiniPlayBtn.classList.toggle('active', activePlayback);
    this._contextRadioMiniPlayBtn.textContent = activePlayback ? 'Ⅱ' : '▶';
    this._contextRadioMiniPlayBtn.setAttribute('aria-label', playAria);
    this._contextRadioMiniPlayBtn.title = playbackAction;
  }
  if (this._cockpitRadioPlayBtn) {
    this._cockpitRadioPlayBtn.disabled = !interactive || !hasStations;
    this._cockpitRadioPlayBtn.classList.toggle('active', activePlayback);
    this._cockpitRadioPlayBtn.textContent = activePlayback ? 'Ⅱ' : '▶';
    this._cockpitRadioPlayBtn.setAttribute('aria-label', playAria);
    this._cockpitRadioPlayBtn.title = playbackAction;
  }
  if (this._radioVolume && document.activeElement !== this._radioVolume)
    this._radioVolumeDraft = String(Math.round(state.volume * 100));
  this._paintRadioView();
  if (
    this._contextRadioMiniVolume &&
    document.activeElement !== this._contextRadioMiniVolume
  ) {
    this._contextRadioMiniVolume.value = String(Math.round(state.volume * 100));
  }
  if (this._contextRadioMiniVolume)
    this._contextRadioMiniVolume.disabled = !interactive;
  if (this._contextRadioMiniVolumeValue) {
    this._contextRadioMiniVolumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  }
  if (
    this._cockpitRadioVolume &&
    document.activeElement !== this._cockpitRadioVolume
  ) {
    this._cockpitRadioVolume.value = String(Math.round(state.volume * 100));
  }
  if (this._cockpitRadioVolume)
    this._cockpitRadioVolume.disabled = !interactive;
  if (this._cockpitRadioVolumeValue) {
    this._cockpitRadioVolumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  }
  if (this._contextRadioMiniStation) {
    this._contextRadioMiniStation.textContent = uncertain
      ? t('RADIO STATE UNCERTAIN')
      : selected?.name ||
        (state.loading ? t('SYNCING DIRECTORY') : t('RADIO READY'));
  }
  if (this._cockpitRadioStation) {
    this._cockpitRadioStation.textContent = uncertain
      ? t('UNCERTAIN')
      : selected?.name || (state.loading ? t('SYNCING') : t('READY'));
  }
  if (
    !enabled &&
    !transitioning &&
    !this.actions.preservePanelStateDuringClear() &&
    !this._radioPanel.classList.contains('collapsed')
  ) {
    this.actions.setPanelCollapsed('radio-panel', true);
  }
  this.actions.scheduleLayout();
}
