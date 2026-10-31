import { radioCardView } from './radioCardView.js';
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

/** Paint supplied native handles from the same projection as the mounted card. */
export function paintNativeRadioView({ state, tuner, slot, volume, pending }) {
  const view = radioCardView(state);
  const text = (node, value) => {
    if (node) node.textContent = value;
  };
  const disable = (node, value) => {
    if (node) node.disabled = value;
  };
  if (this._radioEnableBtn) {
    text(this._radioEnableBtn, view.enableLabel);
    this._radioEnableBtn.classList.toggle('active', view.enabled);
    this._radioEnableBtn.setAttribute('aria-pressed', String(view.enabled));
    this._radioEnableBtn.setAttribute('aria-label', view.enableAria);
    this._radioEnableBtn.setAttribute(
      'aria-busy',
      String(view.transitioning || pending),
    );
    this._radioEnableBtn.setAttribute(
      'aria-disabled',
      String(view.transitioning || pending),
    );
  }
  if (this._radioFilter) {
    const signature = JSON.stringify(view.categories);
    if (signature !== this._radioCategorySignature) {
      this._radioFilter.replaceChildren(
        ...view.categories.map((category) => {
          const option =
            this._radioFilter.ownerDocument.createElement('option');
          option.value = category.id;
          const label = t('{category} ({count})', {
            category: category.label,
            count: category.count,
          });
          option.textContent = `● ${label}`;
          option.setAttribute('aria-label', label);
          option.dataset.radioColor = category.color;
          option.style.color = category.color;
          return option;
        }),
      );
      this._radioCategorySignature = signature;
    }
    this._radioFilter.value = view.filter;
    this._radioFilter.style.color = view.filterColor;
    this._radioFilter.disabled = view.filterDisabled;
  }
  text(this._radioStationName, view.name);
  text(this._radioStationMeta, view.meta);
  text(this._radioStationTags, view.tags);
  if (this._radioStationHomepage) {
    this._radioStationHomepage.hidden = !view.homepage;
    if (view.homepage) this._radioStationHomepage.href = view.homepage;
    else this._radioStationHomepage.removeAttribute('href');
  }
  for (const node of [
    this._radioPrevBtn,
    this._radioNextBtn,
    this._radioPlayBtn,
  ])
    disable(node, view.transportDisabled);
  if (this._radioPlayBtn) {
    text(this._radioPlayBtn, view.playLabel);
    this._radioPlayBtn.classList.toggle('active', view.activePlayback);
    this._radioPlayBtn.setAttribute('aria-label', view.playAria);
  }
  disable(this._radioStopBtn, view.stopDisabled);
  disable(this._radioVolume, !view.interactive);
  if (this._radioVolume && document.activeElement !== this._radioVolume)
    this._radioVolume.value = volume;
  text(this._radioVolumeValue, `${volume}%`);
  text(this._radioPlaybackState, view.statusText);
  this._radioPlaybackState?.classList.toggle('error', view.statusError);
  if (this._radioTuner) {
    this._radioTuner.hidden = !view.tunerAvailable;
    this._radioTuner.classList.toggle('is-static', Boolean(tuner.static));
    this._radioTuner.classList.toggle('is-dragging', Boolean(tuner.dragging));
    this._radioTuner.style.setProperty(
      '--radio-tuner-ratio',
      tuner.ratio || '0',
    );
    const scale = this._radioTuner.querySelector('.radio-tuner-scale');
    if (scale) {
      scale.style.setProperty(
        '--radio-tuner-tick-pitch',
        `${tuner.pitchPx || 0}px`,
      );
      scale.replaceChildren(
        ...(tuner.ticks || []).map((tick) => {
          const node = scale.ownerDocument.createElement('span');
          node.className = `radio-tuner-tick${tick.current ? ' is-current' : ''}`;
          node.style.left = `${tick.xPx}px`;
          node.dataset.stationIndex = tick.stationIndex;
          node.textContent = tick.label;
          return node;
        }),
      );
    }
  }
  if (this._radioTunerSlider) {
    this._radioTunerSlider.disabled = !view.tunerAvailable;
    this._radioTunerSlider.max = String(tuner.max || 0);
    this._radioTunerSlider.value = slot;
    this._radioTunerSlider.setAttribute(
      'aria-valuetext',
      tuner.aria || t('No station available'),
    );
  }
  text(this._radioTunerBandLabel, view.band);
  text(this._radioTunerValue, tuner.value || t('DRAG TO TUNE'));
  text(this._radioTunerStation, tuner.station || t('ALL · DRAG THE NEEDLE'));
}
