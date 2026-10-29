import { t, tn } from '../i18n/index.js';
import { cctvSourceLabelText, cctvSourceMessageText } from './cctvFrames.js';

import { createCctvVideoSurface } from './cctvVideo.js';
export function _calBadgeLabel(badge) {
  switch (badge) {
    case 'calibrated':
      return t('CALIBRATED');
    case 'curated':
      return t('CURATED');
    case 'raw-prior':
      return t('RAW PRIOR');
    default:
      return '--';
  }
}

/** Pure panel projection; camera selection, media and calibration stay with their owners. */
export function presentCctvPanel(state, enabled) {
  const cameras = state?.cameras || [];
  const activeId = state?.activeCameraId || '';
  const activeCamera = state?.activeCamera || null;
  let meta;
  if (activeCamera) {
    const provider = cctvSourceLabelText(
      activeCamera.sourceLabel || activeCamera.provider || 'Configured Source',
    );
    const statusMsg = activeCamera.sourceMessage
      ? ` · ${cctvSourceMessageText(activeCamera.sourceMessage)}`
      : '';
    // A partner-supplied feed inside a pack names its owner here.
    const credit = activeCamera.credit ? ` · ${activeCamera.credit}` : '';
    const calBadge = activeCamera.calBadge
      ? _calBadgeLabel(activeCamera.calBadge)
      : '';
    const projLabel = state?.showProjection !== false ? t('MONITOR') : t('OFF');
    meta = t(
      '{city} · HDG {heading} · FOV {fov} · RANGE {range}m · {projection}{calBadge} · {provider}{status}',
      {
        city: activeCamera.city,
        heading: `${Math.round(activeCamera.headingDeg)}°`,
        fov: `${Math.round(activeCamera.fovDeg)}°`,
        range: Math.round(activeCamera.rangeM),
        projection: projLabel,
        calBadge: calBadge ? ` · ${calBadge}` : '',
        provider,
        status: `${credit}${statusMsg}`,
      },
    );
  } else if (cameras.length > 0) {
    meta = enabled
      ? tn(
          cameras.length,
          '{count} camera loaded · click a camera to activate',
          '{count} cameras loaded · click a camera to activate',
        )
      : tn(
          cameras.length,
          '{count} camera loaded · enable CCTV to activate',
          '{count} cameras loaded · enable CCTV to activate',
        );
  } else {
    meta = t('Enable CCTV to load camera intersections');
  }
  const coverage = state?.coverageMode || (state?.showCoverage ? 'on' : 'off');
  const dirty = !!activeCamera?.calDirty;
  return {
    enabled,
    cameras,
    activeId,
    activeCamera,
    meta,
    coverage,
    autoHop: !!state?.autoHop,
    projection: state?.showProjection !== false,
    calibrationMode: !!state?.calibrationMode,
    qualityLabel: dirty
      ? t('CAL · EDITED (UNSAVED)')
      : t('CAL · {badge}', { badge: _calBadgeLabel(activeCamera?.calBadge) }),
    quality: dirty ? 'edited' : activeCamera?.calBadge || '',
  };
}

export function _renderCctvState(state) {
  if (this.destroyed) return;
  if (
    !state?.enabled ||
    !this.actions.isEnabled() ||
    state?.activeCameraId !== this._cctvState?.activeCameraId
  ) {
    this._calibrationEdit?.(false);
  }
  this._cctvState = state || null;
  const enabled = !!state?.enabled && !!this.actions.isEnabled();
  const activeId = state?.activeCameraId || '';
  this._selectedCameraId = activeId;
  const activeCamera = state?.activeCamera || null;

  // Auto-expand the panel when the active camera CHANGES to a new non-null
  // id while the layer is enabled. Covers click-on-globe, panel controls,
  // and voice (selectCamera/cycleCamera/focusNearest all notify through
  // this subscription). The last-seen guard keeps routine notifications
  // from re-expanding a panel the user deliberately collapsed, and timed
  // auto-hop transitions only expand on the first activation so the panel
  // does not pop open on every hop.
  const effectiveActiveId = enabled ? activeId || null : null;
  const isFirstActivation = this._lastSeenCctvActiveId === null;
  if (
    effectiveActiveId &&
    effectiveActiveId !== this._lastSeenCctvActiveId &&
    (!state?.autoHop || isFirstActivation)
  ) {
    this.actions.setPanelCollapsed('cctv-panel', false, {
      explicit: Boolean(state?.explicitSelection),
    });
  }
  this._lastSeenCctvActiveId = effectiveActiveId;

  this._updateCctvSyncChip(state?.loading, enabled);

  this._presentation = presentCctvPanel(state, enabled);
  this._syncCctvCalReadout(enabled, activeCamera);

  const liveIntent = enabled && !!activeCamera?.isVideo;
  if (this._cctvVideo) {
    this._cctvVideo.hidden = !liveIntent;
    if (this._cctvFrame) this._cctvFrame.hidden = liveIntent;
    const visible =
      liveIntent &&
      !document.hidden &&
      !this._cctvPanel?.classList.contains('collapsed');
    if (!visible || this._cctvVideoCameraId !== activeId) {
      this._cctvVideoSurface?.stop();
      this._cctvVideoSurface = null;
    }
    this._cctvVideoCameraId = activeId;
    if (visible && !this._cctvVideoSurface) {
      this._cctvVideoSurface = createCctvVideoSurface(this._cctvVideo, () =>
        this.cctv.getActiveVideoElement?.(),
      );
    }
  }

  if (this._cctvFrame && !liveIntent) {
    const nextSrc = enabled ? activeCamera?.frameUrl : null;
    const nextCameraId = enabled ? activeCamera?.id || '' : '';
    const cameraChanged = this._cctvFrame.dataset.cameraId !== nextCameraId;
    const frameLoading = this._cctvFrame.dataset.loading === 'true';
    // A same-camera refresh waits for the current image to settle. Replacing
    // src every 10 seconds can cancel a slow but healthy decode forever and
    // leave SNAPSHOT · OK beside a blank/loading preview. Camera changes are
    // immediate so navigation never waits on the prior camera's request.
    if (
      nextSrc &&
      (cameraChanged ||
        (!frameLoading && this._cctvFrame.dataset.currentSrc !== nextSrc))
    ) {
      this._queueCctvFrame(nextSrc, nextCameraId, cameraChanged);
    }
    if (!nextSrc) {
      this._clearCctvFrame();
    }
  } else if (liveIntent) {
    this._clearCctvFrame();
  }

  this._syncCctvSourceBadge(activeCamera, enabled);
  this._pushCctvView();
  this._typeCctvSummary(
    state?.summary ||
      t('Enable CCTV to start camera-linked intelligence summaries.'),
  );
}

export function _typeCctvSummary(text) {
  if (this.destroyed || !this._cctvSummary) return;
  const nextText = String(text || '').trim() || t('No summary available.');
  if (nextText === this._lastCctvSummaryText) return;
  this._lastCctvSummaryText = nextText;

  clearInterval(this._cctvSummaryTypingTimer);
  this._summaryText = '';
  this._pushCctvView();
  let idx = 0;
  this._cctvSummaryTypingTimer = setInterval(() => {
    if (this.destroyed) return;
    idx += 3;
    if (idx >= nextText.length) {
      this._summaryText = nextText;
      this._pushCctvView();
      clearInterval(this._cctvSummaryTypingTimer);
      this._cctvSummaryTypingTimer = null;
      return;
    }
    this._summaryText = nextText.slice(0, idx);
    this._pushCctvView();
  }, 20);
}

export function _updateCctvSyncChip(loading, enabled) {
  if (this.destroyed) return;
  if (!this._cctvSyncChip || !this._cctvSyncLabel || !this._cctvSyncProgress)
    return;
  const total = Number(loading?.total) || 0;
  const loaded = Math.max(0, Math.min(Number(loading?.loaded) || 0, total));
  const busy = !!enabled && !!loading?.active && total > 0;

  if (busy) {
    clearTimeout(this._cctvChipHideTimer);
    this._cctvChipHideTimer = null;
    this._cctvChipWasBusy = true;
    this.actions.setSplitFlapText(this._cctvSyncLabel, t('loading frames'));
    // The counter is left plain on purpose: it ticks every few frames
    // during a grid load, and flapping it would read as a slot machine.
    this._cctvSyncProgress.textContent = `${loaded}/${total}`;
    this._cctvSyncChip.classList.add('visible');
    return;
  }

  if (this._cctvChipWasBusy && enabled && total > 0) {
    // Load just completed — flash the final count, then auto-hide.
    this._cctvChipWasBusy = false;
    this.actions.setSplitFlapText(this._cctvSyncLabel, t('camera grid ready'));
    this._cctvSyncProgress.textContent = `${total}/${total}`;
    this._cctvSyncChip.classList.add('visible');
    clearTimeout(this._cctvChipHideTimer);
    this._cctvChipHideTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      this._cctvChipHideTimer = null;
      this._cctvSyncChip.classList.remove('visible');
    }, 1500);
    return;
  }

  if (!this._cctvChipHideTimer) {
    this._cctvChipWasBusy = false;
    this._cctvSyncChip.classList.remove('visible');
  }
}
