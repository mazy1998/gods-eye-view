import { formatNumber, t, msg } from '../i18n/index.js';

/** Shortest-wrap signed degrees, for heading offsets typed as absolute values. */
const signedNormalizeDeg = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Field definitions for the CCTV click-to-edit pose readout. Chips DISPLAY the
 * camera's EFFECTIVE pose (not raw offsets — "HDG 135.0°" instead of the old
 * "HEADING 0°" nonsense); typed values convert back to calibration offsets
 * against the frozen basePose. ΔN/ΔE stay offset-denominated (absolute lat/lon
 * typing is user-hostile).
 */
const CCTV_CAL_FIELDS = {
  heading: {
    label: msg('HDG'),
    unit: '°',
    decimals: 1,
    get: (cam) => cam.headingDeg,
    toPatch: (value, base) => ({
      headingDeg: signedNormalizeDeg(value - base.headingDeg),
    }),
  },
  pitch: {
    label: msg('PITCH'),
    unit: '°',
    decimals: 1,
    get: (cam) => cam.pitchDeg,
    toPatch: (value, base) => ({ pitchDeg: value - base.pitchDeg }),
  },
  fov: {
    label: msg('FOV'),
    unit: '°',
    decimals: 0,
    get: (cam) => cam.fovDeg,
    toPatch: (value, base) => ({ fovDeg: value - base.fovDeg }),
  },
  range: {
    label: msg('RANGE'),
    unit: 'm',
    decimals: 0,
    get: (cam) => cam.rangeM,
    toPatch: (value, base) => ({
      rangeScale: base.rangeM > 0 ? value / base.rangeM : 1,
    }),
  },
  height: {
    label: msg('HGT'),
    unit: 'm',
    decimals: 0,
    get: (cam) => cam.mountHeightM,
    toPatch: (value, base) => ({ heightM: value - base.mountHeightM }),
  },
  north: {
    label: msg('ΔN'),
    unit: 'm',
    decimals: 1,
    get: (cam) => cam.calibration?.offsetNorthM || 0,
    toPatch: (value) => ({ offsetNorthM: value }),
  },
  east: {
    label: msg('ΔE'),
    unit: 'm',
    decimals: 1,
    get: (cam) => cam.calibration?.offsetEastM || 0,
    toPatch: (value) => ({ offsetEastM: value }),
  },
};

const FIELD_TITLES = {
  heading: msg('Heading (compass °) — click to type'),
  pitch: msg('Pitch (° up/down) — click to type'),
  fov: msg('Horizontal FOV (°) — click to type'),
  range: msg('Range / monitor-plane distance (m) — click to type'),
  height: msg('Mount height above ground (m) — click to type'),
  north: msg('North offset from catalog position (m) — click to type'),
  east: msg('East offset from catalog position (m) — click to type'),
};

/** Chip text for one pose value: locale decimals, translated metre unit. */
function calValueText(field, value) {
  const options = {
    minimumFractionDigits: field.decimals,
    maximumFractionDigits: field.decimals,
  };
  if (field.unit === 'm') {
    // English keeps its compact "RANGE 120m"; other languages space the unit.
    const metres = formatNumber(Number(value), {
      useGrouping: false,
      ...options,
    });
    return `${t(field.label)} ${t('{value}m', { value: metres })}`;
  }
  const number = formatNumber(Number(value), {
    useGrouping: false,
    ...options,
  });
  return `${t(field.label)} ${number}${field.unit}`;
}

export function _activeCctvCameraId() {
  return this._cctvState?.activeCameraId || this._selectedCameraId || '';
}

export function _resetCctvCalibration() {
  const cameraId = this._activeCctvCameraId();
  if (!cameraId || !this.actions.setParams) return;
  this.actions.setParams(
    {
      selectedCameraId: cameraId,
      calibration: {
        cameraId,
        reset: true,
      },
    },
    { origin: 'user' },
  );
  this.actions.showToast(t('CCTV calibration reset'));
}

export function _beginCctvCalValueEdit(chip) {
  if (this.destroyed) return;
  this._calibrationEdit?.(false);
  const field = CCTV_CAL_FIELDS[chip.dataset.calField];
  const activeCamera = this._cctvState?.activeCamera;
  if (!field || !activeCamera?.basePose) return;
  const cameraId = this._activeCctvCameraId();
  const basePose = { ...activeCamera.basePose };
  this._calibrationDraft = {
    cameraId,
    fieldId: chip.dataset.calField,
    basePose,
    value: Number(field.get(activeCamera)).toFixed(field.decimals),
  };
  let finished = false;
  this._calibrationEdit = (commit) => {
    if (finished) return;
    finished = true;
    const typed = parseFloat(this._calibrationDraft?.value);
    this._calibrationEdit = null;
    this._calibrationDraft = null;
    if (
      commit &&
      !this.destroyed &&
      Number.isFinite(typed) &&
      this._cctvState?.enabled &&
      this.actions.isEnabled() &&
      cameraId === this._activeCctvCameraId() &&
      this.actions.setParams
    ) {
      this.actions.setParams(
        {
          selectedCameraId: cameraId,
          calibration: { cameraId, patch: field.toPatch(typed, basePose) },
        },
        { origin: 'user' },
      );
    }
    this._pushCctvView();
  };
  this._pushCctvView();
  // Synchronous mountView paint creates the editor before focus/select.
  const input = chip.querySelector('input');
  input?.focus();
  input?.select();
}

export function calibrationFields(enabled, activeCamera) {
  return Object.entries(CCTV_CAL_FIELDS).map(([id, field]) => {
    const value = enabled && activeCamera ? field.get(activeCamera) : null;
    return {
      id,
      label: t(field.label),
      title: t(FIELD_TITLES[id]),
      step: field.decimals ? '0.1' : '1',
      text: Number.isFinite(value)
        ? calValueText(field, value)
        : `${t(field.label)} --`,
    };
  });
}

export function _syncCctvCalReadout(enabled, activeCamera) {
  this._calibrationFields = calibrationFields(enabled, activeCamera);
  this._pushCctvView();
}
