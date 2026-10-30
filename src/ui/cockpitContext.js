/** Contact readouts and nearby-signal presentation for the Cockpit controller. */
import * as Cesium from 'cesium';
import { formatNumber, getLocale, t, tn } from '../i18n/index.js';
import { unitLabel } from './unitLabels.js';
import {
  bearingBetweenCoordinates,
  formatCockpitContextScope,
  relativeBearing,
  resolveCockpitContextReadout,
} from '../cockpitMath.js';
import { formatCockpitDistance } from './cockpitPresentation.js';

/** The Context scope line in the active language (see cockpitMath.js). */
const LOCALIZED_CONTEXT_SCOPE = Object.freeze({
  window: ({ label, radiusKm }) =>
    t('{label} · {radius} AIR/SEA WINDOW', {
      label,
      radius: `${radiusKm === null ? '—' : formatNumber(radiusKm)}\u00a0${getLocale().startsWith('zh-') ? unitLabel('km') : unitLabel('km').toUpperCase()}`,
    }),
  installations: ({ scope, coverage }) =>
    t('{scope} · INSTALLATIONS {coverage}', { scope, coverage }),
});

/**
 * What the Contact panel shows before any contact: hidden, with its resting
 * placeholders and both navigation controls available.
 */
export function emptyContextReadout() {
  return {
    visible: false,
    state: null,
    scope: t('CONTACTS · 250 KM'),
    canPrevious: true,
    canNext: true,
    cohorts: [],
    nearest: t('NO AVAILABLE EXAMPLE'),
    nearestLabel: '',
    distance: '—',
    distanceLabel: '',
    relative: null,
    bearing: '—',
    uncertainty: t('AVAILABLE INPUTS ONLY · NOT AN ALL-CLEAR'),
    updated: '--:--:--Z',
  };
}

export function updateContext(info, heading) {
  if (!this.context) return;
  const previous = this.contextReadout;
  const snapshot =
    this.services.militaryAwarenessLayer.getContextSnapshot?.() || null;
  const trackedId = info.icao24 || info.id;
  const readout = resolveCockpitContextReadout({ snapshot, info });
  if (!readout.visible) {
    // Hidden keeps the last readout, as the hidden panel kept its numbers.
    this.contextReadout = { ...previous, visible: false };
    this.publishContactView();
    this.context.hidden = true;
    this.hud?.classList.remove('context-active');
    this.contextLayoutStamp = null;
    this.pushCockpitSignal(
      'context-status',
      'info',
      t('CONTEXT STANDBY'),
      t('ENABLE GLOBAL CONTEXT FOR PROXIMITY PINGS'),
    );
    return;
  }

  this.context.hidden = false;
  this.hud?.classList.add('context-active');
  const scope = formatCockpitContextScope(
    snapshot.subject.label || trackedId,
    snapshot.radiusM,
    snapshot.cohorts.find((cohort) => cohort.id === 'military-installations')
      ?.coverage,
    LOCALIZED_CONTEXT_SCOPE,
  );
  // Navigation stays wired in every state — the operator must always be able
  // to step off the current contact from the panel that hosts the controls.
  const canPrevious = Boolean(snapshot.navigation?.canPrevious);
  const canNext = Boolean(snapshot.navigation?.canNext);

  if (readout.contactLost) {
    // The subject left its source. Every number below is measured against a
    // position that stopped updating, so hold the last rendered readout and
    // say so instead of re-deriving stale geometry as if it were live.
    const enteringLost = previous.state !== 'lost';
    const uncertainty = t(
      'CONTACT LOST · LAST KNOWN READOUT · NOT AN ALL-CLEAR',
    );
    this.contextReadout = {
      ...previous,
      visible: true,
      state: 'lost',
      scope,
      canPrevious,
      canNext,
      uncertainty,
    };
    this.publishContactView();
    this.context.dataset.state = 'lost';
    // The cue changes the footer's height; re-run layout once on the way in
    // rather than every frame the contact stays lost.
    if (enteringLost) this.scheduleContextLayout();
    this.pushCockpitSignal(
      'context-status',
      'warning',
      t('CONTACT LOST · {subject}', {
        subject: snapshot.subject.label || snapshot.subject.id || 'SUBJECT',
      }),
      t('SUBJECT LEFT ITS FEED · READOUT HOLDING LAST KNOWN'),
    );
    return;
  }

  let unknownCount = 0;
  const nearest = [];
  const cohorts = [];
  for (const cohort of snapshot.cohorts) {
    const count = cohort.count === null ? '?' : String(cohort.count);
    const unknown = cohort.relationship === 'UNKNOWN';
    cohorts.push({ id: cohort.id, count, unknown });
    if (cohort.count === null) unknownCount += 1;
    for (const item of cohort.nearest) nearest.push({ ...item, cohort });
  }
  nearest.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const closest = nearest[0] || null;
  const closestLabel = this.services.formatAwarenessLabel(closest);
  const nearestText = closest
    ? t('{cohort} · {contact}', {
        cohort: closest.cohort.label.toUpperCase(),
        contact: closestLabel,
      })
    : t('NO AVAILABLE EXAMPLE');
  const nearestLabel =
    closest && closestLabel === '—'
      ? t('{cohort}, Unavailable', { cohort: closest.cohort.label })
      : nearestText;
  const distanceM = closest?.distanceM;
  const distance = Number.isFinite(distanceM)
    ? formatCockpitDistance(distanceM)
    : '—';
  const distanceLabel = Number.isFinite(distanceM)
    ? distance
    : t('Unavailable');

  // The arrow and BRG are nose-relative to the tracked aircraft. When the
  // subject is a vessel, an installation, or another aircraft, the rest of
  // this row is measured from that subject — so the aircraft-frame half is
  // dashed rather than presented alongside subject-frame distances as if the
  // two shared an origin.
  let relative = null;
  if (
    readout.aircraftRelative &&
    closest?.position &&
    Number.isFinite(info.latitude) &&
    Number.isFinite(info.longitude)
  ) {
    const cartographic = Cesium.Cartographic.fromCartesian(closest.position);
    const bearing = cartographic
      ? bearingBetweenCoordinates(
          info.latitude,
          info.longitude,
          Cesium.Math.toDegrees(cartographic.latitude),
          Cesium.Math.toDegrees(cartographic.longitude),
        )
      : null;
    relative = relativeBearing(bearing, heading);
  }
  const bearing =
    relative === null
      ? t('BRG —')
      : Math.abs(relative) < 8
        ? t('AHEAD')
        : t('{side} {angle}', {
            side: relative < 0 ? t('L') : t('R'),
            angle: `${String(Math.round(Math.abs(relative))).padStart(3, '0')}°`,
          });
  const uncertainty = unknownCount
    ? tn(
        unknownCount,
        '{count} INPUT UNKNOWN · NOT AN ALL-CLEAR',
        '{count} INPUTS UNKNOWN · NOT AN ALL-CLEAR',
      )
    : t('AVAILABLE INPUTS CURRENT · NOT AN ALL-CLEAR');
  const updated = Number.isFinite(snapshot.evaluatedAt)
    ? new Date(snapshot.evaluatedAt).toISOString().slice(11, 19) + 'Z'
    : '--:--:--Z';
  const state = unknownCount ? 'uncertain' : 'current';
  // The readout a lost contact holds: everything derived while it was live.
  this.contextReadout = {
    visible: true,
    state,
    scope,
    canPrevious,
    canNext,
    cohorts,
    nearest: nearestText,
    nearestLabel,
    distance,
    distanceLabel,
    relative,
    bearing,
    uncertainty,
    updated,
  };
  this.publishContactView();
  this.context.dataset.state = state;
  this.updateCockpitSignals(snapshot, unknownCount);
  if (this.contextLayoutStamp !== snapshot.evaluatedAt) {
    this.contextLayoutStamp = snapshot.evaluatedAt;
    this.scheduleContextLayout();
  }
}
