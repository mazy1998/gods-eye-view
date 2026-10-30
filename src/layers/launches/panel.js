import * as Cesium from 'cesium';
import { t } from '../../i18n/index.js';
import {
  MISSION_CLOSE_VIEW_RANGE_M,
  MISSION_GLOBE_VIEW_RANGE_M,
} from './policy.js';
import { UNKNOWN_LAUNCH_STATUS } from './model.js';

export function createPanel({ state: layerState, services, parts, source }) {
  /**
   * Preserve the user's globe scale for roster previews while avoiding an
   * accidental surface-level fly-to when the list is opened from a close view.
   * @param {number} cameraHeight Current camera height above the ellipsoid.
   * @returns {number} Preview range in metres.
   */

  function missionHoverPreviewRange(cameraHeight) {
    const height = Number(cameraHeight);
    return Math.max(
      MISSION_CLOSE_VIEW_RANGE_M,
      Number.isFinite(height) ? height : MISSION_GLOBE_VIEW_RANGE_M,
    );
  }

  /**
   * Coordinate pointer and keyboard ownership of the temporary roster preview.
   * The most recent input owns the preview until it leaves, then any remaining
   * input resumes ownership. This lets keyboard focus take over from a pointer
   * resting on another row without losing that pointer preview on blur.
   * @param {{preview: (index: number) => void, clear: () => void}} handlers
   * @returns {{pointerEnter: (index: number) => void, pointerLeave: () => void,
   *   focus: (index: number) => void, blur: (nextIndex?: number|null) => void,
   *   reset: () => void}}
   */

  function createMissionRosterPreviewOwnership({ preview, clear }) {
    let pointerIndex = null;
    let focusIndex = null;
    let latestOwner = null;
    let activeIndex = null;

    const sync = () => {
      const nextIndex =
        latestOwner === 'pointer'
          ? (pointerIndex ?? focusIndex)
          : (focusIndex ?? pointerIndex);
      if (nextIndex === activeIndex) return;
      activeIndex = nextIndex;
      if (Number.isInteger(nextIndex)) preview(nextIndex);
      else clear();
    };

    return {
      pointerEnter(index) {
        pointerIndex = index;
        latestOwner = 'pointer';
        sync();
      },
      pointerLeave() {
        pointerIndex = null;
        if (latestOwner === 'pointer')
          latestOwner = focusIndex === null ? null : 'focus';
        sync();
      },
      focus(index) {
        focusIndex = index;
        latestOwner = 'focus';
        sync();
      },
      blur(nextIndex = null) {
        focusIndex = Number.isInteger(nextIndex) ? nextIndex : null;
        if (latestOwner === 'focus')
          latestOwner =
            focusIndex === null
              ? pointerIndex === null
                ? null
                : 'pointer'
              : 'focus';
        sync();
      },
      reset() {
        pointerIndex = null;
        focusIndex = null;
        latestOwner = null;
        activeIndex = null;
        clear();
      },
    };
  }

  /** Capture the exact mission identity owned by keyboard focus before a refresh. */

  function captureMissionRosterFocus(
    list,
    activeElement = globalThis.document?.activeElement,
  ) {
    const button = activeElement?.closest?.('[data-mission-roster-id]');
    if (!button || !list?.contains(button)) return null;
    const launchId = button.dataset.missionRosterId;
    return launchId ? { launchId } : null;
  }

  /** Restore focus by mission identity, or continue after the list if it departed. */

  function restoreMissionRosterFocus(list, snapshot, continuation) {
    if (!snapshot?.launchId) return 'none';
    const button = Array.from(
      list?.querySelectorAll?.('[data-mission-roster-id]') || [],
    ).find(
      (candidate) => candidate.dataset.missionRosterId === snapshot.launchId,
    );
    if (button) {
      button.focus({ preventScroll: true });
      return 'restored';
    }
    if (continuation?.focus) {
      continuation.focus({ preventScroll: true });
      return 'continued';
    }
    return 'none';
  }

  /** Resolve a pending preview against the current refresh, never a stale object. */

  function resolveMissionRosterPreviewLaunch(launches, launchId) {
    return (
      (launches || []).find((candidate) => candidate.id === launchId) || null
    );
  }

  /** Publish the Missions view with `patch` applied. */
  function publishMissionView(patch) {
    layerState._missionView = { ...layerState._missionView, ...patch };
    layerState._missionChannel.publish();
  }

  /** Publish the replay controls when anything they show has changed. */
  function publishMissionReplay(replay) {
    const current = layerState._missionView.replay;
    if (Object.keys(replay).every((key) => replay[key] === current[key]))
      return;
    publishMissionView({ replay });
  }

  /** A field's text, or '' when the source has nothing to show for it. */
  function fieldText(value) {
    return value !== null && value !== undefined && String(value).trim() !== ''
      ? String(value)
      : '';
  }

  /** Current distance and speed of the selected mission's satellite. */
  function missionTelemetry() {
    if (!layerState._selectedLaunchId || !layerState._dataSource)
      return { distance: '', speed: '', speedTitle: '' };
    layerState._lastPanelTelemetryMs = performance.now();
    const satellite = layerState._dataSource.entities.getById(
      `rocket-satellite:${layerState._selectedLaunchId}`,
    );
    const position = satellite?.position?.getValue(
      Cesium.JulianDate.now(layerState._declutterTime),
    );
    const altitudeM = position
      ? Cesium.Cartographic.fromCartesian(position)?.height
      : null;
    const speedMps = layerState._satelliteTelemetry.get(
      layerState._selectedLaunchId,
    )?.speedMps;
    return {
      distance: Number.isFinite(altitudeM)
        ? t('{value} KM', {
            value: Math.max(0, altitudeM / 1000).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            }),
          })
        : '',
      speed: Number.isFinite(speedMps)
        ? t('{value} KM/S', {
            value: (speedMps / 1000).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          })
        : '',
      speedTitle: Number.isFinite(speedMps)
        ? `${(speedMps * 3.6).toLocaleString(undefined, { maximumFractionDigits: 0 })} km/h`
        : '',
    };
  }

  function missionPayloadRows(launch) {
    return launch.payloads.slice(0, 5).map((payload, index) => ({
      key: String(index),
      name: `${payload.name ?? ''}${payload.amount > 1 ? ` ×${payload.amount}` : ''}`,
      detail: [
        payload.manufacturer,
        payload.operator && payload.operator !== payload.manufacturer
          ? payload.operator
          : null,
        Number.isFinite(payload.massKg)
          ? `${payload.massKg.toLocaleString()} KG`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      type: String(payload.type || t('UNSPECIFIED')),
      destination: String(
        payload.destination || launch.orbit?.name || t('UNAVAILABLE'),
      ),
    }));
  }

  function missionStageRows(launch) {
    return launch.recoveryStages.map((stage, index) => {
      const endpoint = stage.endpoint;
      const destination =
        stage.destination ||
        (endpoint?.accuracy === 'PAD / RTLS'
          ? launch.launchSite
          : t('UNAVAILABLE'));
      return {
        key: String(index),
        name: String(stage.name ?? ''),
        detail: [
          Number.isFinite(stage.flightNumber)
            ? t('FLIGHT {count}', {
                count: stage.flightNumber,
              })
            : null,
          stage.reused ? t('REUSED') : null,
          stage.recoveryType,
        ]
          .filter(Boolean)
          .join(' · '),
        status: String(stage.status ?? ''),
        destination: String(destination ?? ''),
        position: endpoint
          ? `${endpoint.lat.toFixed(2)}, ${endpoint.lon.toFixed(2)} · ${endpoint.accuracy}`
          : stage.downrangeKm > 0
            ? t('{value} KM DOWNRANGE', {
                value: stage.downrangeKm.toLocaleString(),
              })
            : t('POSITION UNAVAILABLE'),
      };
    });
  }

  function renderMissionPanel() {
    const launch = layerState._launches.find(
      (item) => item.id === layerState._selectedLaunchId,
    );
    if (!launch) {
      publishMissionView({
        detail: null,
        replay: parts.replay.replayControls(),
      });
      return;
    }
    const index = layerState._launches.indexOf(launch);
    const pathPresentation = parts.policyHelpers.missionPathPresentation(
      launch,
      layerState._replayTracks.has(launch.id),
    );
    publishMissionView({
      detail: {
        id: launch.id,
        title: parts.overlays.shortMissionLabel(launch.name, 32),
        provider: fieldText(launch.provider),
        // Launch Library status names are provider data, shown as sent; only
        // the fallback for a launch without one is ours to translate.
        status: fieldText(
          launch.status === UNKNOWN_LAUNCH_STATUS
            ? t(UNKNOWN_LAUNCH_STATUS)
            : launch.status,
        ),
        site: fieldText(
          launch.launchSite && launch.launchSite !== 'Unknown launch site'
            ? launch.launchSite
            : null,
        ),
        time: fieldText(launch.launchTime),
        orbit: fieldText(pathPresentation.orbit),
        ascent: String(pathPresentation.ascent ?? ''),
        ...missionTelemetry(),
        payloads: missionPayloadRows(launch),
        morePayloads:
          launch.payloads.length > 5
            ? t('+{count} additional payload records', {
                count: launch.payloads.length - 5,
              })
            : '',
        stages: missionStageRows(launch),
        position: `${index + 1} / ${layerState._launches.length}`,
        canPrevious: index > 0,
        canNext: index < layerState._launches.length - 1,
      },
      replay: parts.replay.replayControls(),
    });
    // The roster and the selected mission share the Context scroller.
    const panelScroller = layerState._missionRoster?.closest(
      ":root[data-ui-theme='cyber'] .cyber-panel-body, .global-context-panel-inner",
    );
    if (panelScroller) panelScroller.scrollTop = 0;
  }

  function renderMissionRoster() {
    const list = layerState._missionRoster?.querySelector(
      '[data-mission-roster-list]',
    );
    const focusSnapshot = captureMissionRosterFocus(list);
    layerState._missionRosterPreviewOwnership?.reset();
    const items = parts.policyHelpers
      .missionRosterEntries(layerState._launches)
      .map(({ launch, index }) => ({
        index,
        id: String(launch.id),
        label: parts.overlays.shortMissionLabel(launch.name, 27),
        provider: String(launch.provider || t('UNSPECIFIED OPERATOR')),
        date: launch.launchTime?.slice(0, 10) || t('DATE UNAVAILABLE'),
        color: parts.model.missionMarkerColor(launch).toCssColorString(),
      }));
    publishMissionView({
      roster: {
        revision: layerState._missionView.roster.revision + 1,
        loaded: true,
        count: layerState._launches.length,
        items,
      },
    });
    restoreMissionRosterFocus(
      list,
      focusSnapshot,
      layerState._missionRoster?.querySelector(
        '[data-mission-roster-focus-continuation]',
      ),
    );
  }

  function updateMissionTelemetry(force = false) {
    const detail = layerState._missionView.detail;
    if (
      !detail ||
      detail.id !== layerState._selectedLaunchId ||
      !layerState._dataSource
    )
      return;
    if (!force && performance.now() - layerState._lastPanelTelemetryMs < 250)
      return;
    const telemetry = missionTelemetry();
    if (Object.keys(telemetry).every((key) => telemetry[key] === detail[key]))
      return;
    publishMissionView({ detail: { ...detail, ...telemetry } });
  }

  function selectMissionAt(index) {
    const launch = layerState._launches[index];
    if (!launch) return;
    parts.selection.setSelectedMission(launch.id, true);
    parts.selection.focusMission(launch);
  }

  function clearMissionRosterPreviewState() {
    if (layerState._missionRosterHoverTimer)
      clearTimeout(layerState._missionRosterHoverTimer);
    layerState._missionRosterHoverTimer = null;
    const changed = layerState._hoveredRosterLaunchId !== null;
    layerState._hoveredRosterLaunchId = null;
    if (changed) parts.overlays.syncMissionOverlayEntries();
  }

  function clearMissionRosterHover() {
    if (layerState._missionRosterPreviewOwnership)
      layerState._missionRosterPreviewOwnership.reset();
    else clearMissionRosterPreviewState();
  }

  function scheduleMissionRosterPreview(index) {
    const launch = layerState._launches[index];
    if (!launch || layerState._selectedLaunchId) return;
    if (layerState._missionRosterHoverTimer)
      clearTimeout(layerState._missionRosterHoverTimer);
    layerState._hoveredRosterLaunchId = launch.id;
    parts.overlays.syncMissionOverlayEntries();
    layerState._missionRosterHoverTimer = setTimeout(() => {
      layerState._missionRosterHoverTimer = null;
      if (layerState._hoveredRosterLaunchId !== launch.id) return;
      const currentLaunch = resolveMissionRosterPreviewLaunch(
        layerState._launches,
        launch.id,
      );
      if (currentLaunch)
        parts.policyHelpers.previewMissionFromRoster(currentLaunch);
    }, 140);
  }

  function selectedMissionIndex() {
    return layerState._launches.findIndex(
      (item) => item.id === layerState._selectedLaunchId,
    );
  }

  const ownership = () => layerState._missionRosterPreviewOwnership;

  /** What the Missions roster and the selected mission's panel can ask for. */
  const missionPanelActions = Object.freeze({
    select: (index) => selectMissionAt(index),
    previous: () => selectMissionAt(selectedMissionIndex() - 1),
    next: () => selectMissionAt(selectedMissionIndex() + 1),
    deselect: () => parts.selection.setSelectedMission(null),
    focusSite() {
      const launch = layerState._launches[selectedMissionIndex()];
      if (launch) parts.selection.focusLaunchSite(launch);
    },
    replay() {
      if (layerState._selectedLaunchId)
        parts.replay.startMissionReplay(layerState._selectedLaunchId);
    },
    togglePause() {
      if (layerState._replayPaused) parts.replay.resumeMissionReplay();
      else parts.replay.pauseMissionReplay();
    },
    cancelReplay: () => parts.replay.stopMissionReplay(),
    setReplaySpeed: (value) => parts.replay.setReplaySpeed(value),
    pointerEnter: (index) => ownership()?.pointerEnter(index),
    pointerLeave: () => ownership()?.pointerLeave(),
    focus: (index) => ownership()?.focus(index),
    blur: (nextIndex) => ownership()?.blur(nextIndex),
  });

  function createMissionPanel() {
    if (layerState._missionRoster || typeof document === 'undefined') return;
    layerState._missionRoster = document.getElementById('space-mission-roster');
    if (layerState._missionRoster)
      layerState._missionRosterPreviewOwnership =
        createMissionRosterPreviewOwnership({
          preview: scheduleMissionRosterPreview,
          clear: clearMissionRosterPreviewState,
        });
  }

  /** Close the selected mission's panel when the layer is torn down. */
  function clearMissionPanel() {
    publishMissionView({ detail: null });
    layerState._missionRosterPreviewOwnership = null;
    layerState._missionRoster = null;
  }

  return {
    missionHoverPreviewRange,
    createMissionRosterPreviewOwnership,
    captureMissionRosterFocus,
    restoreMissionRosterFocus,
    resolveMissionRosterPreviewLaunch,
    publishMissionReplay,
    renderMissionPanel,
    renderMissionRoster,
    updateMissionTelemetry,
    selectMissionAt,
    clearMissionRosterPreviewState,
    clearMissionRosterHover,
    scheduleMissionRosterPreview,
    missionPanelActions,
    createMissionPanel,
    clearMissionPanel,
  };
}
