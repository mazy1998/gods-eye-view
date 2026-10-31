import { t, tn } from '../i18n/index.js';
import { cctvSourceLabelText, cctvSourceMessageText } from './cctvFrames.js';

import { createCctvVideoSurface } from './cctvVideo.js';
function _calBadgeLabel(badge) {
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

/** The picker's closing line for the cameras the view leaves out. */
function outsideNoteText(count) {
  return tn(
    count,
    '{count} more camera outside this view · pan or zoom out',
    '{count} more cameras outside this view · pan or zoom out',
  );
}

/** Pure panel projection; camera selection, media and calibration stay with their owners. */
export function presentCctvPanel(state, enabled) {
  // The light index, not `state.cameras`: reading that builds every camera's
  // full state, which a large catalog cannot afford on each notification.
  const cameras = state?.cameraIndex || state?.cameras || [];
  // The picker lists what is in view; the catalog is every camera.
  const catalogCount = Number.isFinite(state?.count)
    ? state.count
    : cameras.length;
  // Cameras the view leaves out get one closing line, so a short list does
  // not read as the whole catalog. A disabled layer has no view.
  const outside = enabled ? Math.max(0, catalogCount - cameras.length) : 0;
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
  } else if (catalogCount > 0) {
    meta = enabled
      ? tn(
          catalogCount,
          '{count} camera loaded · click a camera to activate',
          '{count} cameras loaded · click a camera to activate',
        )
      : tn(
          catalogCount,
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
    catalogCount,
    outsideCount: outside,
    outsideNote: outside ? outsideNoteText(outside) : '',
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
  if (this.destroyed || !this._panelView) return;
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

/** Native host adapter; camera/media/calibration state stays in CctvControls. */
export function paintNativeCctvView(props) {
  const { view, source, fields, edit, summary } = props;
  const node = (key, id) =>
    this[key] || this._cctvPanel?.querySelector(`#${id}`);
  const text = (el, value) => {
    if (el) el.textContent = value;
  };
  // The picker lists the cameras in view; the step and focus controls work
  // on the whole catalog.
  const noCamera = !view.enabled || !view.cameras.length;
  const noCatalog = !view.enabled || !view.catalogCount;
  if (this._cctvSelect) {
    const select = this._cctvSelect;
    const doc = select.ownerDocument ?? document;
    const cameras = view.cameras;
    const { activeId, activeCamera } = view;
    // The list keeps its identity until the view or the active camera
    // changes, so an unchanged list skips the per-option comparison. A
    // focused picker is not rebuilt under the user; blur re-renders it.
    const picking = doc.activeElement === select;
    const outside = view.outsideCount;
    const shouldRebuild =
      !picking &&
      (this._cctvSelectSource !== cameras ||
        this._cctvSelectOutside !== outside) &&
      (this._cctvSelectOutside !== outside ||
        select.options.length !== cameras.length + (outside ? 1 : 0) ||
        cameras.some((cam, idx) => select.options[idx]?.value !== cam.id));
    if (!picking) {
      this._cctvSelectSource = cameras;
      this._cctvSelectOutside = outside;
    }
    if (shouldRebuild) {
      const options = doc.createDocumentFragment();
      for (const camera of cameras) {
        const option = doc.createElement('option');
        option.value = camera.id;
        option.textContent = `${camera.city} · ${camera.name}`;
        options.appendChild(option);
      }
      if (outside) {
        const note = doc.createElement('option');
        note.value = '';
        note.disabled = true;
        note.dataset.cctvOutside = '';
        note.textContent = view.outsideNote;
        options.appendChild(note);
      }
      select.replaceChildren(options);
    }
    select.disabled = noCamera;
    // A deferred rebuild can miss a camera activated meanwhile (auto-hop,
    // voice); add it so the picker does not go blank.
    if (
      picking &&
      activeId &&
      activeCamera &&
      ![...select.options].some((option) => option.value === activeId)
    ) {
      const option = doc.createElement('option');
      option.value = activeId;
      option.textContent = `${activeCamera.city} · ${activeCamera.name}`;
      select.prepend(option);
      // The added camera is one fewer outside the view.
      const note = [...select.options].find(
        (entry) => entry.dataset?.cctvOutside !== undefined,
      );
      if (note) {
        const left = Math.max(
          0,
          view.catalogCount - (select.options.length - 1),
        );
        if (left) note.textContent = outsideNoteText(left);
        else note.remove();
      }
    }
    // The active camera is always one of the listed records.
    if (activeId && activeCamera) select.value = activeId;
    else if (!activeId)
      // With nothing in view, the closed picker says where the cameras are.
      // A focused picker keeps its old options, so it only clears.
      select.selectedIndex =
        !picking && cameras.length === 0 && outside ? 0 : -1;
  }
  for (const el of [this._cctvNearestBtn, this._cctvPrevBtn, this._cctvNextBtn])
    if (el) el.disabled = noCatalog;
  if (this._cctvFocusBtn)
    this._cctvFocusBtn.disabled = noCatalog || !view.activeId;
  const toggle = (el, active, label, disabled) => {
    if (!el) return;
    el.classList.toggle('active', active);
    el.textContent = label;
    el.disabled = disabled;
    el.setAttribute('aria-pressed', String(active));
  };
  toggle(
    this._cctvEnableBtn,
    view.enabled,
    view.enabled ? t('CCTV ON') : t('CCTV OFF'),
    false,
  );
  toggle(
    this._cctvCoverageBtn,
    view.coverage !== 'off',
    view.coverage === 'viewshed'
      ? t('VIEWSHED ON')
      : view.coverage === 'on'
        ? t('COVERAGE ON')
        : t('COVERAGE OFF'),
    !view.enabled,
  );
  toggle(
    this._cctvAutoHopBtn,
    view.autoHop,
    view.autoHop ? t('AUTO HOP ON') : t('AUTO HOP OFF'),
    !view.enabled,
  );
  toggle(
    this._cctvProjectionBtn,
    view.projection,
    view.projection ? t('PROJECTION ON') : t('PROJECTION OFF'),
    !view.enabled,
  );
  const canCalibrate = view.enabled && !!view.activeCamera;
  toggle(
    this._cctvAdjustBtn,
    view.calibrationMode && canCalibrate,
    view.calibrationMode ? t('ADJUST ON') : t('ADJUST'),
    !canCalibrate,
  );
  if (this._cctvCalibSaveBtn)
    this._cctvCalibSaveBtn.disabled =
      !canCalibrate || !view.activeCamera?.calDirty;
  if (this._cctvCalibResetBtn) this._cctvCalibResetBtn.disabled = !canCalibrate;
  text(node('_cctvMeta', 'cctv-meta'), view.meta);
  text(node('_cctvSummaryText', 'cctv-summary'), summary);
  const badge = node('_cctvSourceBadge', 'cctv-source-badge');
  text(badge, source.label);
  if (badge) badge.dataset.frameState = source.frameState;
  const quality = node('_cctvQualityChip', 'cctv-quality-chip');
  text(quality, view.qualityLabel);
  if (quality) quality.dataset.calBadge = view.quality;
  if (!this._cctvCalReadout) return;
  for (const field of fields) {
    let chip = this._cctvCalReadout.querySelector(
      `[data-cal-field="${field.id}"]`,
    );
    if (!chip) {
      chip = this._cctvCalReadout.ownerDocument.createElement('button');
      chip.type = 'button';
      chip.className = 'cctv-cal-value';
      chip.dataset.calField = field.id;
      this._cctvCalReadout.append(chip);
    }
    chip.disabled = !canCalibrate;
    chip.title = field.title;
    if (edit?.fieldId !== field.id) {
      text(chip, field.text);
      continue;
    }
    if (chip.querySelector('input')) continue;
    const input = chip.ownerDocument.createElement('input');
    input.type = 'number';
    input.className = 'cctv-cal-input';
    input.step = field.step;
    input.value = edit.value;
    input.setAttribute('aria-label', field.label);
    text(chip, field.label);
    chip.append(input);
    this.listen(input, 'click', (event) => event.stopPropagation());
    this.listen(input, 'input', () => props.inputEdit(input.value));
    this.listen(input, 'keydown', props.keyEdit);
    this.listen(input, 'blur', props.blurEdit);
  }
}
