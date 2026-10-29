import { clampScopeFeatherPct } from '../scopeMaskPolicy.js';
import { createFrameRateMonitor } from './frameRateMonitor.js';
import { bindApplicationShortcuts } from './visualInput.js';
import { bindDisplayControls } from './displayControls.js';
import { canonicalizeDensity } from '../data/detectionPolicy.js';

/** Own keyboard/display event subscriptions; settings remain with their state owners. */
export class DisplayBindings {
  constructor({
    viewer,
    services,
    elements,
    operations,
    readState,
    claimDetection,
  }) {
    Object.assign(
      this,
      { viewer, services, readState, claimDetection },
      elements,
      operations,
    );
  }
  get shareLinkManager() {
    return this.readState().shareLinkManager;
  }
  get hud() {
    return this.readState().hud;
  }
  get bloomEnabled() {
    return this.readState().bloomEnabled;
  }
  get sharpenEnabled() {
    return this.readState().sharpenEnabled;
  }
  get celestialRing() {
    return this.readState().celestialRing;
  }
  get celestialRingEnabled() {
    return this.readState().celestialRingEnabled;
  }
  get _models3dEnabled() {
    return this.readState()._models3dEnabled;
  }
  _initUI() {
    const { cycleDetectionMode } = this.services;
    this._applicationShortcuts?.destroy();
    this._frameRateMonitor?.destroy();
    this._frameRateMonitor = createFrameRateMonitor({
      viewer: this.viewer,
      documentRef: document,
    });
    this._applicationShortcuts = bindApplicationShortcuts({
      documentRef: document,
      searchInput: this._locationSearch,
      actions: {
        setStyle: (style) => this.setStyle(style, { userInitiated: true }),
        dismissSearch: () => this.closeLocationSearch(),
        toggleHud: () => {
          this.shareLinkManager?.claimRestoreLane?.('visual');
          this.hud.toggle();
          this._updateHudButtonState();
          this._syncShareState();
        },
        toggleOrbit: () => this._toggleOrbit(),
        toggleCleanView: () => this.toggleCleanView(),
        // The Layers destination where the drawer is in use; the panel itself
        // on phones and in Cockpit, where the drawer rests.
        toggleLayers: () =>
          this.toggleLayersDestination?.() ||
          document.getElementById('data-panel').classList.toggle('active'),
        cycleDetection: () => {
          this.shareLinkManager?.claimRestoreLane?.('visual');
          this.claimDetection();
          cycleDetectionMode();
          this._syncShareState();
        },
        toggleCctv: () => this._toggleCctvEnabled(),
      },
    });

    // Rebinding replaces the native binder only; the views stay connected.
    this._displayBinder?.destroy();
    // The Display controls' one lifetime: destroying it releases the native
    // binder and disconnects the Display views, whose controls then go inert.
    const binder = (this._displayBinder = bindDisplayControls({
      // The Display and Look groups are views calling displayActions
      // (S11b-1, S11b-2); the dock's style buttons stay native until the Map
      // & Look view takes them over (S11b-3), and the exit stays native.
      elements: {
        styleButtons: document.querySelectorAll('.style-btn'),
        cleanViewExitButton: this._cleanViewExitBtn,
      },
      actions: this.displayActions,
    }));
    this._displayControls = {
      destroy: () => {
        binder.destroy();
        this.disconnectDisplayViews?.();
      },
    };
  }

  /**
   * The Display operations, built once: the legacy control binder and the
   * Display views call the same functions, so neither holds its own path.
   */
  get displayActions() {
    const { setScopeMaskEnabled, setScopeMaskFeather, cycleDetectionMode } =
      this.services;
    this._displayActions ??= {
      setStyle: (style) => this.setStyle(style, { userInitiated: true }),
      toggleBloom: () => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this._setBloomEnabled(!this.bloomEnabled);
      },
      setBloomIntensity: (value) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this._setBloomIntensity(value);
      },
      toggleSharpen: () => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this._setSharpenEnabled(!this.sharpenEnabled);
      },
      setScopeEnabled: (enabled) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        setScopeMaskEnabled(enabled);
        this._syncShareState();
      },
      setScopeFeather: (value) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        const pct = clampScopeFeatherPct(value);
        setScopeMaskFeather(pct / 100);
        this._syncShareState();
      },
      setSharpenIntensity: (pct) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this._setControlValue('sharpenPct', pct);
        this._applySharpenIntensity(pct / 100);
        this._syncShareState();
      },
      setStyleParam: (style, name, value) =>
        this.setStyleParam(style, name, value),
      setHudLayout: (value) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this._setHudVariant(value, { applyVisualDefaults: true });
      },
      toggleCleanView: () => this.toggleCleanView(),
      exitCleanView: () => this.toggleCleanView(false),
      setDensity: (value) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this.claimDetection();
        const pct = canonicalizeDensity(value);
        this._setControlValue('densityPct', pct);
        this._applyDetectionDensityFromUi();
        this._syncShareState();
      },
      setAllocation: (value) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this.claimDetection();
        this._setDetectionAllocation(value);
      },
      setFade: (fadePct, outsideOpacityPct) => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        if (fadePct !== undefined) this._setControlValue('fadePct', fadePct);
        if (outsideOpacityPct !== undefined)
          this._setControlValue('outsideOpacityPct', outsideOpacityPct);
        this._applyDetectionFadeFromUi();
        this._syncShareState();
      },
      toggleCelestial: () => {
        const ringIsVisible = !!this.celestialRing?.visible;
        if (!this.celestialRingEnabled || !ringIsVisible) {
          this.setCelestialRingEnabled(true, { focus: true });
        } else {
          this.setCelestialRingEnabled(false);
        }
      },
      toggleHud: () => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this.hud.toggle();
        this._updateHudButtonState();
        this._syncShareState();
      },
      toggleSonar: () => this._setCyberSonarEnabled(),
      setSonarRings: (value) => this._setCyberSonarSetting('rings', value),
      setSonarRange: (value) => this._setCyberSonarSetting('range', value),
      setSonarIntensity: (value) =>
        this._setCyberSonarSetting('intensity', value),
      setSonarOpacity: (value) => this._setCyberSonarSetting('opacity', value),
      setSonarSector: (value) => this._setCyberSonarSetting('sector', value),
      cycleDetection: () => {
        this.shareLinkManager?.claimRestoreLane?.('visual');
        this.claimDetection();
        cycleDetectionMode();
        this._syncShareState();
      },
      toggleModels: () => {
        this._setModels3dEnabled(!this._models3dEnabled);
        this._syncModels3dModeRow();
      },
      setModelsMode: (mode) => this._setModels3dMode(mode),
    };
    return this._displayActions;
  }
  destroy() {
    this._applicationShortcuts?.destroy();
    this._applicationShortcuts = null;
    this._frameRateMonitor?.destroy();
    this._frameRateMonitor = null;
    this._displayControls?.destroy();
    this._displayControls = null;
  }
}
