import { mountView } from './mountView.js';
import CctvPanelView from './CctvPanelView.vue';
import { presentCctvPanel } from './cctvPresentation.js';
import { t } from '../i18n/index.js';
import {
  _clearCctvFrame,
  _queueCctvFrame,
  _settleCctvFrame,
  _syncCctvSourceBadge,
} from './cctvFrames.js';
import {
  _activeCctvCameraId,
  _resetCctvCalibration,
  _beginCctvCalValueEdit,
  _syncCctvCalReadout,
} from './cctvCalibration.js';
import {
  paintNativeCctvView,
  _renderCctvState,
  _typeCctvSummary,
  _updateCctvSyncChip,
} from './cctvPresentation.js';
import { _initCctvPanel } from './cctvBindings.js';

/** Own camera-panel interaction and presentation; receive the camera port and application actions. */
export class CctvControls {
  constructor({ elements, cctv, actions }) {
    Object.assign(this, elements);
    this.cctv = cctv;
    this.actions = actions;
    this.destroyed = false;
    this.listeners = new AbortController();
    this._cctvUnsubscribe = null;
    this._cctvState = null;
    this._cctvSummaryTypingTimer = null;
    this._lastCctvSummaryText = '';
    this._lastSeenCctvActiveId = null;
    this._cctvChipHideTimer = null;
    this._cctvChipWasBusy = false;
    this._cctvFrameRequestToken = 0;
    this._cctvFramePreloader = null;
    this._calibrationEdit = null;
    this._calibrationDraft = null;
    this._selectedCameraId = '';
    this._actionGeneration = 0;
    this._pickerFilter = '';
    this._calibrationOpen = false;
    this._summaryText = t(
      'Enable CCTV to start camera-linked intelligence summaries.',
    );
    this._sourceBadge = { label: t('SOURCE · UNKNOWN'), frameState: 'idle' };
    this._presentation = presentCctvPanel(null, false);
    this._calibrationFields = [];
    this._mountCctvView();
    this._initCctvPanel();
    if (this._cctvVideo && typeof MutationObserver !== 'undefined') {
      this._videoVisibilityObserver = new MutationObserver(() =>
        this._renderCctvState(this._cctvState),
      );
      if (this._cctvPanel)
        this._videoVisibilityObserver.observe(this._cctvPanel, {
          attributes: true,
          attributeFilter: ['class', 'hidden'],
        });
      this.listen(document, 'visibilitychange', () =>
        this._renderCctvState(this._cctvState),
      );
    }
  }
  _mountCctvView() {
    if (!this._cctvPanel && !this._cctvSelect && !this._cctvEnableBtn) return;
    // Without the Vue mount point (a host passing its own controls, with or
    // without their panel), the native painter keeps those controls current.
    const body = this._cctvPanel?.querySelector('#cctv-controls-body');
    if (!body) {
      this._panelView = {
        update: (props) => paintNativeCctvView.call(this, props),
        dispose() {},
      };
      this._pushCctvView();
      return;
    }
    this._panelView = mountView(CctvPanelView, {
      parent: body,
      props: this._viewProps(),
    });
    const ids = {
      _cctvAdjustBtn: 'cctv-adjust-btn',
      _cctvAutoHopBtn: 'cctv-auto-hop-btn',
      _cctvCalReadout: 'cctv-cal-readout',
      _cctvCalibResetBtn: 'cctv-calib-reset-btn',
      _cctvCalibSaveBtn: 'cctv-calib-save-btn',
      _cctvCoverageBtn: 'cctv-coverage-btn',
      _cctvEnableBtn: 'cctv-enable-btn',
      _cctvFocusBtn: 'cctv-focus-btn',
      _cctvFrame: 'cctv-frame',
      _cctvFrameWrap: 'cctv-frame-wrap',
      _cctvVideo: 'cctv-video',
      _cctvNearestBtn: 'cctv-nearest-btn',
      _cctvNextBtn: 'cctv-next-btn',
      _cctvPrevBtn: 'cctv-prev-btn',
      _cctvProjectionBtn: 'cctv-projection-btn',
      _cctvSelect: 'cctv-camera-select',
    };
    for (const [key, id] of Object.entries(ids))
      this[key] = body.querySelector(`#${id}`);
    this.listen(body.querySelector('#cctv-camera-filter'), 'input', (event) => {
      this._pickerFilter = event.target.value;
      this._pushCctvView();
    });
  }
  _viewProps() {
    return {
      view: this._presentation,
      source: this._sourceBadge,
      fields: this._calibrationFields,
      ...this._calibrationEditProps(),
      summary: this._summaryText,
      filter: this._pickerFilter,
      calibrationOpen: this._calibrationOpen,
      toggleCalibration: (open) => {
        this._calibrationOpen = open;
        this._pushCctvView();
      },
    };
  }
  /**
   * The open calibration editor's props: new only when the draft or its value
   * changes, so a repaint of the same camera or its summary leaves the field,
   * and a value it natively holds, alone until Enter or blur commits it.
   */
  _calibrationEditProps() {
    const edit = this._calibrationDraft;
    const shown = this._calibrationShown;
    if (shown && shown.edit === edit && shown.value === edit?.value)
      return shown.props;
    const finish = (commit, event) => {
      if (edit && edit === this._calibrationDraft) {
        if (commit && typeof event?.target?.value === 'string')
          edit.value = event.target.value;
        this._calibrationEdit?.(commit);
      }
    };
    const props = {
      edit: edit ? { ...edit } : null,
      inputEdit: (value) => {
        if (edit && edit === this._calibrationDraft) edit.value = value;
      },
      blurEdit: (event) => finish(true, event),
      keyEdit: (event) => {
        if (event.key === 'Enter') finish(true, event);
        else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
        event.stopPropagation();
      },
    };
    this._calibrationShown = { edit, value: edit?.value, props };
    return props;
  }
  _pushCctvView() {
    if (!this.destroyed) this._panelView?.update(this._viewProps());
  }
  listen(target, type, handler, options = {}) {
    target?.addEventListener(type, handler, {
      ...options,
      signal: this.listeners.signal,
    });
  }
  getState() {
    return this._cctvState;
  }
  connect() {
    this._cctvUnsubscribe?.();
    this._cctvUnsubscribe = null;
    if (this.destroyed) return;
    this._cctvUnsubscribe = this.cctv.subscribe?.((state) =>
      this._renderCctvState(state),
    );
    if (this.cctv.getUIState) this._renderCctvState(this.cctv.getUIState());
  }
  _clearCctvFrame(...args) {
    return _clearCctvFrame.call(this, ...args);
  }
  _queueCctvFrame(...args) {
    return _queueCctvFrame.call(this, ...args);
  }
  _settleCctvFrame(...args) {
    return _settleCctvFrame.call(this, ...args);
  }
  _syncCctvSourceBadge(...args) {
    return _syncCctvSourceBadge.call(this, ...args);
  }
  _activeCctvCameraId(...args) {
    return _activeCctvCameraId.call(this, ...args);
  }
  _resetCctvCalibration(...args) {
    return _resetCctvCalibration.call(this, ...args);
  }
  _beginCctvCalValueEdit(...args) {
    return _beginCctvCalValueEdit.call(this, ...args);
  }
  _syncCctvCalReadout(...args) {
    return _syncCctvCalReadout.call(this, ...args);
  }
  _renderCctvState(...args) {
    return _renderCctvState.call(this, ...args);
  }
  _typeCctvSummary(...args) {
    return _typeCctvSummary.call(this, ...args);
  }
  _updateCctvSyncChip(...args) {
    return _updateCctvSyncChip.call(this, ...args);
  }
  _initCctvPanel(...args) {
    return _initCctvPanel.call(this, ...args);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._cctvVideoSurface?.stop();
    this._videoVisibilityObserver?.disconnect();
    this._actionGeneration++;
    this.listeners.abort();
    this._cctvUnsubscribe?.();
    this._cctvUnsubscribe = null;
    this._calibrationEdit?.(false);
    this._clearCctvFrame();
    clearInterval(this._cctvSummaryTypingTimer);
    clearTimeout(this._cctvChipHideTimer);
    this._cctvSummaryTypingTimer = null;
    this._cctvChipHideTimer = null;
    this._cctvSyncChip?.classList.remove('visible');
    this._panelView?.dispose();
  }
}
