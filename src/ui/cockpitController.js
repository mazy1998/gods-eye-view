/** Coordinate Cockpit lifecycle through supplied aircraft, terrain, rendering and briefing operations. */
import { createStateChannel } from '../app/stateChannel.js';
import {
  readAircraftInfo,
  dispatchCockpitModeChanged,
  toggleTrackedTr3b,
  syncTr3bToggle,
  syncEntry,
  navigateContext,
  _adoptTrackedEntity,
  enter,
  exit,
} from './cockpitTrackingController.js';
import { update } from './cockpitCamera.js';
import {
  updateHud,
  updateRoute,
  syncWeatherToggle,
  setVisionMode,
  cycleVisionMode,
  clearPredictiveRoute,
} from './cockpitInstruments.js';
import { emptyContextReadout, updateContext } from './cockpitContext.js';
import {
  emptyBriefView,
  setBriefView,
  showBriefPage,
  setBriefAutoRotate,
  startBriefRotation,
  stopBriefRotation,
  updateLocalPosition,
  maybeRefreshRegionalBrief,
  renderRegionalBriefStatus,
  renderRegionalBrief,
} from './cockpitBriefing.js';
import {
  handleSignalClick,
  renderCockpitSignals,
  pushCockpitSignal,
  updateCockpitSignals,
} from './cockpitSignals.js';
import {
  scheduleContextLayout,
  setContextCollapsed,
  setSignalCollapsed,
  syncContextLayout,
  syncSignalLayout,
} from './cockpitLayout.js';
import { onKeyDown } from './cockpitInput.js';
import * as Cesium from 'cesium';

export class CockpitViewController {
  constructor(
    viewer,
    {
      services,
      onVisionChange = null,
      getInitialVisionMode = null,
      onCameraTakeover = null,
      isEntryAllowed = null,
      onEntered = null,
      onExited = null,
      restoreTrackingFrame = null,
    } = {},
  ) {
    this.viewer = viewer;
    this.services = services;
    this.destroyed = false;
    this.disposed = false;
    this.active = false;
    this.trackedEntity = null;
    this.trackedEntityWasShown = true;
    this.heading = null;
    this.lastFrameMs = 0;
    this.lastCameraUpdateMs = 0;
    this.lastHudUpdateMs = 0;
    this.lastContextUpdateMs = 0;
    this.lastGroundProbeMs = 0;
    this.contextNavigationDeadlineMs = 0;
    this.surfaceWaitStartedMs = 0;
    this.surfaceAcquiring = false;
    this.surfaceFallback = false;
    this.lastCompassSignature = '';
    this.entry = document.getElementById('cockpit-entry');
    this.tr3bToggle = document.getElementById('tr3b-toggle');
    this._tr3bSignature = null;
    this.mapViewButton = document.getElementById('map-view-switch');
    this.resetGlobeButton = document.getElementById('cockpit-reset-globe');
    this.hud = document.getElementById('cockpit-hud');
    this.entryFocusOrigin = null;
    this.callsign = document.getElementById('cockpit-callsign');
    this.speed = document.getElementById('cockpit-speed-value');
    this.speedRim = document.getElementById('cockpit-speed-rim');
    this.speedRimValue = document.getElementById('cockpit-speed-rim-value');
    this.speedRimTicks = Array.from(
      document.querySelectorAll('[data-speed-rim-tick]'),
    );
    this.altitude = document.getElementById('cockpit-altitude-value');
    this.altitudeRim = document.getElementById('cockpit-altitude-rim');
    this.altitudeRimValue = document.getElementById(
      'cockpit-altitude-rim-value',
    );
    this.altitudeRimTicks = Array.from(
      document.querySelectorAll('[data-altitude-rim-tick]'),
    );
    this.headingValue = document.getElementById('cockpit-heading-value');
    this.compassTape = document.getElementById('cockpit-compass-tape');
    this.clock = document.getElementById('cockpit-clock');
    this.position = document.getElementById('cockpit-position');
    this.aircraftMeta = document.getElementById('cockpit-aircraft-meta');
    this.route = document.getElementById('cockpit-route');
    this.routeFrom = document.getElementById('cockpit-route-from');
    this.routeTo = document.getElementById('cockpit-route-to');
    this.routeStatus = document.getElementById('cockpit-route-status');
    this.routeDirection = document.getElementById('cockpit-route-direction');
    this.routeDirectionLabel = document.getElementById(
      'cockpit-route-direction-label',
    );
    this.visionMode = 'optical';
    this.visionChannel = createStateChannel(() => ({ mode: this.visionMode }));
    this.onVisionChange = onVisionChange;
    this.getInitialVisionMode =
      typeof getInitialVisionMode === 'function'
        ? getInitialVisionMode
        : () => 'optical';
    this.onCameraTakeover = onCameraTakeover;
    this.onEntered = onEntered;
    this.onExited = onExited;
    this.restoreTrackingFrame =
      typeof restoreTrackingFrame === 'function'
        ? restoreTrackingFrame
        : () => false;
    this.isEntryAllowed =
      typeof isEntryAllowed === 'function' ? isEntryAllowed : () => true;
    this.context = document.getElementById('cockpit-context');
    // The weather toggle's state: set by a click and by every state the
    // weather effects report. A click asks for the opposite of it.
    this.weatherEnabled = false;
    this.contextCollapsed = false;
    // The Contact panel's last derived readout; a lost contact holds it.
    this.contextReadout = emptyContextReadout();
    this.contactChannel = createStateChannel(() => this.contactView());
    this._contactSignature = '';
    this.signalStream = document.getElementById('cockpit-signal-stream');
    this.signalList = document.getElementById('cockpit-signal-list');
    this.signalToggle = document.getElementById('cockpit-signal-toggle');
    this.briefKicker = document.getElementById('cockpit-brief-kicker');
    this.briefSubtitle = document.getElementById('cockpit-brief-subtitle');
    this.briefPrevious = document.getElementById('cockpit-brief-previous');
    this.briefNext = document.getElementById('cockpit-brief-next');
    this.briefAutoToggle = document.getElementById('cockpit-brief-auto');
    this.briefPosition = document.getElementById('cockpit-brief-position');
    this.briefSource = document.getElementById('cockpit-brief-source');
    this.briefPages = Array.from(
      document.querySelectorAll('[data-cockpit-brief-page]'),
    );
    this.briefTabs = Array.from(
      document.querySelectorAll('[data-cockpit-brief-index]'),
    );
    // What the briefing's News and Local pages show.
    this.briefView = emptyBriefView();
    this.briefChannel = createStateChannel(() => this.briefView);
    this._briefSignature = '';
    // Each rolling readout's last text and value and when it last rolled:
    // a new value rolls from these, at most once per 220 ms.
    this.rollingReadouts = { speed: {}, altitude: {}, heading: {} };
    this.signalCollapsed = false;
    this.signalUserCollapsed = false;
    this.signalItems = [];
    this.signalSignatures = new Map();
    this.briefPageIndex = 0;
    this.briefAutoRotateEnabled = false;
    this.briefTimer = null;
    this.lastAircraftInfo = null;
    this.regionalBrief = null;
    // Where the regional brief stands for the current subject: null before a
    // request, 'loading', 'unavailable', or 'loaded' with regionalBrief set.
    this.regionalBriefStatus = null;
    this.regionalBriefAnchor = null;
    this.regionalBriefFetchedAt = 0;
    this.regionalBriefAbort = null;
    this.regionalBriefRequestToken = 0;
    this.regionalBriefSubjectId = null;
    this.contextLayoutFrame = null;
    this.contextLayoutStamp = null;
    this.scratchTarget = new Cesium.Cartesian3();
    this.cockpitAnchor = new Cesium.Cartesian3();
    this.cockpitAnchorValid = false;
    this.scratchCamera = new Cesium.Cartesian3();
    this.scratchAdvance = new Cesium.Cartesian3();
    this.scratchCorrection = new Cesium.Cartesian3();
    this.scratchForward = new Cesium.Cartesian3();
    this.scratchHorizontal = new Cesium.Cartesian3();
    this.scratchUp = new Cesium.Cartesian3();
    this.scratchLocal = new Cesium.Cartesian3();
    this.scratchEnu = new Cesium.Matrix4();
    this.scratchAnchorCartographic = new Cesium.Cartographic();
    this.scratchCameraCartographic = new Cesium.Cartographic();
    this.scratchTargetCartographic = new Cesium.Cartographic();
    this._listenerRemovers = [];

    // Camera mutations belong before scene update/culling. Changing the camera
    // from preRender makes 3D Tiles discover a new view after traversal and can
    // create a self-sustaining refinement loop under a moving cockpit camera.
    this._listenerRemovers.push(
      viewer.scene.preUpdate.addEventListener(() => this.update()),
      viewer.trackedEntityChanged.addEventListener(() => {
        if (this.active) this._adoptTrackedEntity(performance.now());
        else this.syncEntry();
      }),
    );
    this._listen(this.entry, 'click', () => this.enter());
    this._listen(this.tr3bToggle, 'click', () => this.toggleTrackedTr3b());
    this._listen(this.mapViewButton, 'click', () => this.exit());
    this._listen(window, 'gev:cockpit-weather-state', (event) => {
      this.syncWeatherToggle(event?.detail?.enabled !== false);
    });
    this._listen(this.signalToggle, 'click', () =>
      this.setSignalCollapsed(!this.signalCollapsed, { user: true }),
    );
    this._listen(this.signalList, 'click', (event) =>
      this.handleSignalClick(event),
    );
    this._listen(this.briefPrevious, 'click', () =>
      this.showBriefPage(this.briefPageIndex - 1, { manual: true }),
    );
    this._listen(this.briefNext, 'click', () =>
      this.showBriefPage(this.briefPageIndex + 1, { manual: true }),
    );
    this._listen(this.briefAutoToggle, 'click', () => {
      this.setBriefAutoRotate(!this.briefAutoRotateEnabled);
    });
    this.briefTabs.forEach((button) =>
      this._listen(button, 'click', () => {
        this.showBriefPage(Number(button.dataset.cockpitBriefIndex), {
          manual: true,
        });
      }),
    );
    this._listen(document, 'visibilitychange', () => {
      if (document.hidden) this.stopBriefRotation();
      else if (this.briefAutoRotateEnabled) this.startBriefRotation();
    });
    this._listen(window, 'resize', () => this.scheduleContextLayout());
    this._listen(document, 'keydown', (event) => this.onKeyDown(event), true);
  }

  _listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    this._listenerRemovers.push(() =>
      target.removeEventListener(type, handler, options),
    );
  }

  readAircraftInfo() {
    return readAircraftInfo.call(this);
  }
  dispatchCockpitModeChanged(active, info) {
    return dispatchCockpitModeChanged.call(this, active, info);
  }
  toggleTrackedTr3b() {
    return toggleTrackedTr3b.call(this);
  }
  syncTr3bToggle(info) {
    return syncTr3bToggle.call(this, info);
  }
  syncEntry() {
    return syncEntry.call(this);
  }
  navigateContext(direction, options) {
    return navigateContext.call(this, direction, options);
  }
  /** The Contact panel's collapse control, while its view shows it. */
  get contextToggle() {
    return this.context?.querySelector('#cockpit-context-toggle') ?? null;
  }
  /** What the Contact panel shows: its readout, collapse and weather state. */
  contactView() {
    return {
      ...this.contextReadout,
      collapsed: this.contextCollapsed,
      weatherEnabled: this.weatherEnabled,
    };
  }
  getContactView() {
    return this.contactChannel.getSnapshot();
  }
  subscribeContactView(listener, options) {
    return this.contactChannel.subscribe(listener, options);
  }
  /** Publish the Contact panel when what it shows has changed. */
  publishContactView() {
    const signature = JSON.stringify(this.contactView());
    if (signature === this._contactSignature) return;
    this._contactSignature = signature;
    this.contactChannel.publish();
  }
  toggleContactPanel() {
    this.setContextCollapsed(!this.contextCollapsed);
  }
  /** Ask the weather effects for the opposite of the toggle's state. */
  toggleWeather() {
    const enabled = !this.weatherEnabled;
    this.syncWeatherToggle(enabled);
    window.dispatchEvent(
      new CustomEvent('gev:cockpit-weather-toggle', { detail: { enabled } }),
    );
  }
  _adoptTrackedEntity(nowMs, suppliedInfo) {
    return _adoptTrackedEntity.call(this, nowMs, suppliedInfo);
  }
  enter() {
    return enter.call(this);
  }
  exit(options) {
    return exit.call(this, options);
  }
  update() {
    return update.call(this);
  }
  updateHud(info, nowMs, forceContext) {
    return updateHud.call(this, info, nowMs, forceContext);
  }
  updateRoute(info) {
    return updateRoute.call(this, info);
  }
  syncWeatherToggle(enabled) {
    return syncWeatherToggle.call(this, enabled);
  }
  setVisionMode(mode, options) {
    return setVisionMode.call(this, mode, options);
  }
  cycleVisionMode(direction) {
    return cycleVisionMode.call(this, direction);
  }
  clearPredictiveRoute() {
    return clearPredictiveRoute.call(this);
  }
  updateContext(info, heading) {
    return updateContext.call(this, info, heading);
  }
  showBriefPage(index, options) {
    return showBriefPage.call(this, index, options);
  }
  setBriefAutoRotate(enabled) {
    return setBriefAutoRotate.call(this, enabled);
  }
  startBriefRotation(options) {
    return startBriefRotation.call(this, options);
  }
  stopBriefRotation() {
    return stopBriefRotation.call(this);
  }
  getVisionView() {
    return this.visionChannel.getSnapshot();
  }
  subscribeVisionView(listener, options) {
    return this.visionChannel.subscribe(listener, options);
  }
  getBriefView() {
    return this.briefChannel.getSnapshot();
  }
  subscribeBriefView(listener, options) {
    return this.briefChannel.subscribe(listener, options);
  }
  setBriefView(view) {
    return setBriefView.call(this, view);
  }
  updateLocalPosition(info) {
    return updateLocalPosition.call(this, info);
  }
  maybeRefreshRegionalBrief(info) {
    return maybeRefreshRegionalBrief.call(this, info);
  }
  renderRegionalBriefStatus(status, info) {
    return renderRegionalBriefStatus.call(this, status, info);
  }
  renderRegionalBrief(payload, info) {
    return renderRegionalBrief.call(this, payload, info);
  }
  renderCockpitSignals() {
    return renderCockpitSignals.call(this);
  }
  pushCockpitSignal(key, tone, title, detail, target) {
    return pushCockpitSignal.call(this, key, tone, title, detail, target);
  }
  updateCockpitSignals(snapshot, unknownCount) {
    return updateCockpitSignals.call(this, snapshot, unknownCount);
  }
  scheduleContextLayout() {
    return scheduleContextLayout.call(this);
  }
  setContextCollapsed(collapsed) {
    return setContextCollapsed.call(this, collapsed);
  }
  setSignalCollapsed(collapsed, options) {
    return setSignalCollapsed.call(this, collapsed, options);
  }
  syncContextLayout() {
    return syncContextLayout.call(this);
  }
  syncSignalLayout() {
    return syncSignalLayout.call(this);
  }
  onKeyDown(event) {
    return onKeyDown.call(this, event);
  }

  handleSignalClick(event) {
    return handleSignalClick.call(this, event);
  }

  /** Revoke new work before the shell awaits layer restoration. */
  stop() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.regionalBriefAbort?.abort();
    this.regionalBriefAbort = null;
    this.regionalBriefRequestToken += 1;
    this.stopBriefRotation();
    if (this.contextLayoutFrame !== null)
      cancelAnimationFrame(this.contextLayoutFrame);
    this.contextLayoutFrame = null;
    for (const removeListener of this._listenerRemovers.splice(0))
      removeListener?.();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.exit({ restoreTracking: false });
  }
}
