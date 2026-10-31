import { bindRadioControls } from './radioBindings.js';
import { renderRadioState, paintNativeRadioView } from './radioPresentation.js';

/** Own Radio DOM, tuner interaction and subscription; receive playback and application actions. */
export class RadioControls {
  constructor({ elements, radio, actions, canvas, view = null }) {
    Object.assign(this, elements);
    this._view = view;
    this._radioTunerView = {};
    this._radioEnablePending = false;
    // Which Cockpit utility disclosure is open: 'display', 'radio' or null.
    // The two are mutually exclusive; their launchers only reflect this.
    this._cockpitDisclosure = null;
    this.radio = radio;
    this.actions = actions;
    this.canvas = canvas;
    this.destroyed = false;
    this.listeners = new AbortController();
    this._radioUnsubscribe = null;
    this._radioState = null;
    this._radioCategorySignature = '';
    this._radioTunerStations = [];
    this._radioTunerPool = [];
    this._radioTunerDragging = false;
    this._radioTunerDragStartSlot = 0;
    this._radioTunerDragSnapshot = null;
    this._radioTunerLastSlot = 0;
    this._radioTunerDragDirection = 0;
    this._radioTunerCoordinate = 0;
    this._radioTunerSlot = 0;
    this._radioVolumeDraft = String(this._radioVolume?.value || 80);
    this._radioTunerPointerId = null;
    this._radioTunerKeyboardKey = null;
    this._radioTunerBandSignature = '';
    this._radioTunerSelectedId = null;
    this._radioTunerBandPinnedForNavigation = false;
    this._refreshRadioTunerBand = null;
    bindRadioControls.call(this);
  }

  /** The in-progress tuner slot belongs to this interaction owner. */
  _setRadioTunerSlot(value) {
    this._radioTunerSlot = Number(value) || 0;
    this._paintRadioView();
  }

  _paintRadioView() {
    if (this.destroyed) return;
    const props = {
      state: this._radioState || {},
      tuner: { ...this._radioTunerView },
      slot: this._radioTunerSlot,
      volume: this._radioVolumeDraft,
      pending: this._radioEnablePending,
    };
    if (this._view) this._view.update(props);
    else paintNativeRadioView.call(this, props);
  }

  listen(target, type, handler, options = {}) {
    target?.addEventListener(type, handler, {
      ...options,
      signal: this.listeners.signal,
    });
  }

  connect() {
    this._radioUnsubscribe?.();
    this._radioUnsubscribe = null;
    if (this.destroyed) return;
    this._radioUnsubscribe = this.radio.subscribe?.((state) =>
      this._renderRadioState(state),
    );
  }

  _renderRadioState(state) {
    renderRadioState.call(this, state);
  }

  /**
   * The scroller the Radio panel sits in: the Layers list while Layers hosts
   * it (the drawer body if its group is missing), otherwise the expanded
   * Context panel's (none while Context is closed).
   */
  _radioScroller() {
    const hosted = this._radioPanel?.closest?.(
      '.gev-drawer-body .data-toggle-list, .gev-drawer-body',
    );
    if (hosted) return hosted;
    const contextPanel = document.getElementById('global-context-panel');
    if (!contextPanel || contextPanel.classList.contains('collapsed'))
      return null;
    return (
      (document.documentElement?.dataset.uiTheme === 'cyber' &&
        contextPanel.querySelector('.cyber-panel-body')) ||
      contextPanel.querySelector('.global-context-panel-inner')
    );
  }

  /**
   * Reveal the newly enabled directory and transport in Radio's scroller without
   * moving focus, the page, or the globe. Only the expanded Enable path calls
   * this helper.
   * @param {HTMLElement} trigger Initiating Radio Enable button.
   * @returns {Promise<boolean>} Whether the internal scroller moved.
   */
  async _revealRadioControlsAfterExplicitEnable(trigger) {
    const scroller = this._radioScroller();
    const directory = this._radioPanel?.querySelector('.radio-directory-row');
    const transport = this._radioPanel?.querySelector('.radio-transport');
    if (!scroller || !directory || !transport || !this._radioState?.enabled)
      return false;

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    if (this.destroyed || !this._radioState?.enabled || !trigger?.isConnected)
      return false;

    const viewport = scroller.getBoundingClientRect();
    const directoryRect = directory.getBoundingClientRect();
    const transportRect = transport.getBoundingClientRect();
    const margin = 10;
    const minimum =
      scroller.scrollTop + transportRect.bottom - (viewport.bottom - margin);
    const maximum =
      scroller.scrollTop + directoryRect.top - (viewport.top + margin);
    const desired =
      minimum <= maximum
        ? Math.min(Math.max(scroller.scrollTop, minimum), maximum)
        : minimum;
    const next = Math.min(
      Math.max(0, scroller.scrollHeight - scroller.clientHeight),
      Math.max(0, desired),
    );
    if (Math.abs(next - scroller.scrollTop) < 1) return false;
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches;
    scroller.scrollTo({
      top: next,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.listeners.abort();
    this._radioUnsubscribe?.();
    this._radioUnsubscribe = null;
    const pointer = this._radioTunerPointerId;
    this._radioTunerPointerId = null;
    this._radioTunerDragging = false;
    this._radioTunerKeyboardKey = null;
    this._radioTunerDragSnapshot = null;
    this._radioTunerPool = [];
    this._radioTunerStations = [];
    this._radioTunerBandPinnedForNavigation = false;
    try {
      if (pointer !== null)
        this._radioTunerSlider?.releasePointerCapture(pointer);
    } catch {
      /* capture already released */
    }
    this._radioTunerView.dragging = false;
    this._radioTunerView.static = false;
    this._view = null;
    document
      .getElementById('title-bar')
      ?.classList.remove('radio-broadcasting');
    this.radio.endTuning();
  }
}
