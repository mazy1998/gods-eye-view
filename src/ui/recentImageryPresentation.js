import { formatNumber, msg, t, tn, translateKnown } from '../i18n/index.js';
import { PRODUCTS, hhmm } from '../layers/recentImagery/model.js';
import { displayDay, displayMetres } from '../layers/recentImagery/display.js';
import { formatQuantity } from './unitLabels.js';
import { pointerOwnerName } from '../data/pointerOwnerNames.js';
const OVERVIEW_MIN_BOX_KM = 25;
const ESRI_NOTE = msg('Imagery on Esri · Google 3D returns when cleared');

// The layer keeps its notices and box refusals in English (AI tools read the
// same snapshot); translate the ones we write, show anything else as it came.
const LAYER_NOTICES = new Set([
  ESRI_NOTE,
  msg('Box and images cleared'),
  msg('Esri map unavailable · no swipe'),
  msg('Swipe needs a globe map'),
  msg('Imagery stays on Esri · CLEAR to use Google 3D'),
  // Box refusals the layer writes itself (layers/recentImagery/index.js).
  msg('Point the camera at the ground to use the view'),
  msg('That point cannot anchor a box'),
]);
// Refusals with a value in them (layers/recentImagery/model.js and
// imageryBoxTool.js); fixed refusals there are msg() text for translateKnown.
const TOO_LARGE = /^(Box|View) is ([\d,]+) km wide · limit ([\d,]+) km$/;
const POLAR = /^Imagery stops at ±([\d.]+)° latitude$/;
const POINTER_BUSY = /^(.+) is using the pointer — close it first$/;

/**
 * The notice line in the UI language: notices and box refusals arrive in
 * English. Exported for tests.
 * @param {string} text
 * @returns {string}
 */
export function localizeNotice(text) {
  if (!text) return '';
  if (LAYER_NOTICES.has(text)) return t(text);
  const polar = POLAR.exec(text);
  if (polar)
    return t('Imagery stops at ±{limit}° latitude', {
      limit: formatNumber(Number(polar[1]), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    });
  const busy = POINTER_BUSY.exec(text);
  if (busy)
    return t('{owner} is using the pointer — close it first', {
      owner: translateKnown(pointerOwnerName(busy[1])),
    });
  const tooLarge = TOO_LARGE.exec(text);
  if (!tooLarge) return translateKnown(text);
  const values = {
    size: formatQuantity(Number(tooLarge[2].replace(/,/g, '')), 'km', {
      useGrouping: true,
    }),
    limit: formatQuantity(Number(tooLarge[3].replace(/,/g, '')), 'km', {
      useGrouping: true,
    }),
  };
  return tooLarge[1] === 'Box'
    ? t('Box is {size} wide · limit {limit}', values)
    : t('View is {size} wide · limit {limit}', values);
}
const MODE_LABELS = [
  ['image', msg('IMAGE')],
  ['basemap', msg('VS BASEMAP')],
  ['ab', msg('A / B')],
];
const START_HERE_TITLES = {
  clear: msg('Newest low-cloud day for this box · scene cloud, not box cloud'),
  cloudy: msg('Newest day covering this box · cloudier than 20%'),
  partial: msg('Newest day with imagery for this box · partial coverage'),
  overview: msg('Newest daily overview for this box'),
};
const START_HERE_REASONS = {
  clear: msg('newest clear day'),
  cloudy: msg('newest day (cloudy)'),
  partial: msg('newest day (partial coverage)'),
  overview: msg('newest overview'),
};
const PLACEHOLDERS = {
  empty: msg('No imagery'),
  error: msg('Unavailable'),
  present: msg('Loading'),
};
export const sensorLine = (product) =>
  PRODUCTS[product]
    ? `${t(PRODUCTS[product].name)} · ${displayMetres(PRODUCTS[product].resolutionM)}`
    : product || '';
const utcTime = (iso) => (hhmm(iso) ? `${hhmm(iso)}Z` : '');
export const longerSideKm = (size) =>
  Math.max(Number(size?.width) || 0, Number(size?.height) || 0);
const kmText = (km) => {
  if (!Number.isFinite(km)) return '?';
  const digits = km >= 100 ? 0 : 1;
  return formatNumber(km, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

function coverageText(coverage) {
  if (coverage === 'full') return t('full', { context: 'coverage' });
  if (coverage === 'partial') return t('partial', { context: 'coverage' });
  return t('unknown');
}

function cloudText(candidate) {
  if (candidate.thumbnail?.status === 'empty') return t('no imagery');
  if (!candidate.cloud) return t('cloud unknown');
  const min = Math.round(candidate.cloud.min);
  const max = Math.round(candidate.cloud.max);
  return min === max
    ? t('{percent}% cloud', { percent: min })
    : t('{min}–{max}% cloud', { min, max });
}

export function countText(snapshot) {
  if (!snapshot.box) return t('NO BOX');
  if (snapshot.searching) return t('SEARCHING');
  return tn(snapshot.candidates.length, '{count} DAY', '{count} DAYS');
}

/** The one-line hint under the strip: the next thing to do, per state. */
function hintText(snapshot) {
  if (snapshot.zoomToFit) return t('Zoom in or draw a smaller box');
  if (!snapshot.box) return t('Select a box or use the view');
  if (snapshot.searching) return t('Searching the last 30 days');
  if (!snapshot.candidates.length) return t('No days to show for this box');
  const { mode, pins, shown } = snapshot;
  if (shown.swipe !== 'none') return t('Drag the divider · SWAP trades sides');
  if (mode === 'ab') {
    if (!pins.a.key && !pins.b.key)
      return t('← → preview · A or B pins the focused day');
    return t('← → preview the other side · A or B pins it');
  }
  if (pins.a.key) return t('S on another day replaces it · × unpins');
  return t('← → preview · S shows the focused day');
}

export function detailLines(snapshot) {
  const focus = snapshot.focus;
  const lines = [];
  if (snapshot.box)
    lines.push({
      id: 'box',
      text: t('Box {width} × {height} km', {
        width: kmText(snapshot.boxSizeKm?.width),
        height: kmText(snapshot.boxSizeKm?.height),
      }),
    });
  if (focus) {
    lines.push({ id: 'readout', text: snapshot.readout || '' });
    const times = [];
    if (focus.timeRange?.start) {
      const start = utcTime(focus.timeRange.start);
      const end = utcTime(focus.timeRange.end || focus.timeRange.start);
      times.push(
        t('Acquired {time}', {
          time: start === end ? start : `${start}–${end}`,
        }),
      );
    } else if (focus.thumbnail?.acquisitionTime)
      times.push(
        t('Acquired {time}', {
          time: utcTime(focus.thumbnail.acquisitionTime),
        }),
      );
    times.push(
      t('Coverage {coverage}', { coverage: coverageText(focus.coverage) }),
    );
    lines.push({ id: 'acquired', text: times.join(' · ') });
    (focus.granules || []).forEach((granule, index) => {
      const cloud = Number.isFinite(granule.cloud)
        ? ` · ${t('{percent}% cloud', { percent: Math.round(granule.cloud) })}`
        : '';
      lines.push({
        id: `granule-${index}`,
        text: `${granule.id || granule.product} · ${utcTime(granule.timeStart)}${cloud}`,
        muted: true,
      });
    });
  }
  const reason = START_HERE_REASONS[snapshot.recommended?.reason];
  if (reason)
    lines.push({
      id: 'start',
      text: t('START HERE · {reason}', { reason: t(reason) }),
    });
  for (const [index, note] of snapshot.notes.entries())
    lines.push({ id: `note-${index}`, text: note, muted: true });
  if (
    snapshot.sources.viirs &&
    snapshot.box &&
    longerSideKm(snapshot.boxSizeKm) > 0 &&
    longerSideKm(snapshot.boxSizeKm) < OVERVIEW_MIN_BOX_KM
  )
    lines.push({
      id: 'overview-scale',
      text: t('Daily overview shows little detail in a box this small'),
      muted: true,
    });
  lines.push({
    id: 'credit',
    text: t(
      'Imagery: NASA GIBS and Worldview · HLS (Sentinel-2, Landsat 8/9) and VIIRS',
    ),
    muted: true,
  });
  return lines;
}

export function slotImage(snapshot, slotId) {
  const pin = snapshot.pins[slotId];
  if (pin.key) return { ...pin, preview: false };
  if (snapshot.preview.slot === slotId && snapshot.preview.key)
    return { ...snapshot.preview, preview: true };
  return null;
}
export function exportTarget(snapshot, slotId) {
  if (slotId === 'b' && snapshot.mode !== 'ab') return null;
  const image = slotImage(snapshot, slotId);
  return image?.candidate && !image.sourceOff ? image.candidate : null;
}
/** Pure projection of the existing layer snapshot and panel-local progress. */
export function recentImageryView(snapshot, exportError, exporting) {
  const ab = snapshot.mode === 'ab';
  const warning = snapshot.boxError || snapshot.error || exportError;
  const notice = localizeNotice(
    warning || snapshot.notice || (snapshot.borrowedEsri ? ESRI_NOTE : ''),
  );
  return {
    notice,
    warning: Boolean(warning),
    hint: hintText(snapshot),
    modes: MODE_LABELS.map(([id, label]) => ({ id, label: t(label) })),
    cards: snapshot.candidates.map((candidate, index) => {
      const day = displayDay(candidate.day);
      const status = candidate.thumbnail?.status || 'unknown';
      const objectUrl = candidate.thumbnail?.objectUrl || null;
      const shown = status === 'present' && Boolean(objectUrl);
      const recommended = snapshot.recommended?.key === candidate.key;
      const state = candidate.pinned
        ? ab
          ? t('pinned {slot}', { slot: candidate.pinned.toUpperCase() })
          : candidate.pinned === 'a'
            ? t('shown')
            : ''
        : candidate.preview
          ? t('preview')
          : '';
      return {
        key: candidate.key,
        id: `ri-card-${index}`,
        focused: index === snapshot.focusIndex,
        pinned: Boolean(candidate.pinned),
        preview: Boolean(candidate.preview),
        status,
        imageUrl: shown ? objectUrl : null,
        placeholder: PLACEHOLDERS[status]
          ? t(PLACEHOLDERS[status])
          : t('Checking'),
        flag: candidate.preview
          ? t('PREVIEW')
          : candidate.pending
            ? t('LOADING')
            : '',
        recommended,
        startTitle: recommended
          ? t(
              START_HERE_TITLES[snapshot.recommended.reason] ||
                msg('Newest day with imagery for this box'),
            )
          : '',
        day,
        sensor: sensorLine(candidate.product),
        cloud: cloudText(candidate),
        aria: [
          day,
          sensorLine(candidate.product),
          cloudText(candidate),
          ...[recommended ? t('start here') : '', state].filter(Boolean),
        ].join(' · '),
        chips: ['a', 'b'].map((slotId) => {
          const live = slotId === 'a' || ab;
          return {
            slotId,
            label: slotId === 'a' ? (ab ? 'A' : t('SHOW')) : 'B',
            disabled: status === 'empty' || !live,
            active: candidate.pinned === slotId && live,
            reserved: !live,
            aria: ab
              ? t('Pin {day} as {slot}', { day, slot: slotId.toUpperCase() })
              : t('Show {day}', { day }),
          };
        }),
      };
    }),
    empty: snapshot.candidates.length
      ? ''
      : !snapshot.box
        ? t('No box')
        : snapshot.searching
          ? t('Searching')
          : snapshot.hiddenCount
            ? t('Every day is empty here')
            : !snapshot.sources.hls && !snapshot.sources.viirs
              ? t('Sources off')
              : t('No imagery'),
    slots: ['a', 'b'].map((slotId) => {
      const basemapRow = slotId === 'b' && !ab;
      const image = basemapRow ? null : slotImage(snapshot, slotId);
      const pinned = Boolean(image && !image.preview);
      let text = t('Not set');
      if (basemapRow) text = t('Basemap');
      else if (image?.label)
        text = [
          image.sourceOff ? t('Source off') : '',
          image.label,
          image.preview
            ? t('preview')
            : image.candidate && !image.drapable && !image.sourceOff
              ? t('loading')
              : '',
        ]
          .filter(Boolean)
          .join(' · ');
      return {
        slotId,
        tag: ab ? slotId.toUpperCase() : slotId === 'a' ? t('IMAGE') : t('VS'),
        text,
        pinned,
        lit: basemapRow
          ? snapshot.mode === 'basemap'
          : Boolean(image) && !image.sourceOff,
        state: pinned ? 'pinned' : image ? 'preview' : 'empty',
        unpin: ab
          ? t('Unpin {slot}', { slot: slotId.toUpperCase() })
          : t('Unpin the image'),
      };
    }),
    alpha: String(Math.round(snapshot.alpha * 100)),
    exports: ['a', 'b'].map((slotId) => ({
      slotId,
      label: ab
        ? t('EXPORT {slot}', { slot: slotId.toUpperCase() })
        : t('EXPORT'),
      title: ab
        ? t('Download {slot} as a PNG', { slot: slotId.toUpperCase() })
        : t('Download the image as a PNG'),
      disabled: !exportTarget(snapshot, slotId) || exporting.includes(slotId),
      reserved: slotId === 'b' && !ab,
    })),
    detailLines: detailLines(snapshot),
    compact: snapshot.focus ? snapshot.readout : t('Times, coverage, sources'),
    emptyDaysLabel: snapshot.showUnavailable
      ? t('HIDE EMPTY DAYS')
      : t('SHOW EMPTY DAYS · {count}', { count: snapshot.hiddenCount }),
  };
}
