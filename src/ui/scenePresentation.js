/** Scene panel elements and text-only project presentation. */
import { formatNumber, msg, t } from '../i18n/index.js';

// Labels for what a shot stores; anything else shows as stored. Style names
// match STYLE_STATUS_LABELS in visualPresets.js, which this package cannot
// import (it pulls in the shaders).
const STYLE_LABELS = Object.freeze({
  normal: msg('NORMAL'),
  retro: msg('CRT'),
  surveillance: msg('NVG'),
  thermal: msg('FLIR'),
  anime: msg('ANIME'),
  noir: msg('NOIR'),
  snow: msg('SNOW'),
});

const DETECTION_MODE_LABELS = Object.freeze({
  OFF: msg('OFF'),
  SPARSE: msg('SPARSE'),
  BALANCED: msg('BALANCED'),
  DENSE: msg('DENSE'),
});

export function sceneElements(root = document) {
  const ids = {
    panel: 'scene-panel',
    body: 'scene-controls-body',
    select: 'scene-select',
    new: 'scene-new-btn',
    delete: 'scene-delete-btn',
    capture: 'scene-capture-btn',
    update: 'scene-update-shot-btn',
    shots: 'scene-shot-list',
    start: 'scene-start-btn',
    stop: 'scene-stop-btn',
    next: 'scene-next-btn',
    export: 'scene-export-btn',
    import: 'scene-import-btn',
    file: 'scene-import-file',
    download: 'scene-download-btn',
    status: 'scene-status',
    progress: 'scene-progress-fill',
    runtime: 'scene-runtime',
  };
  return Object.fromEntries(
    Object.entries(ids).map(([name, id]) => [name, root.getElementById(id)]),
  );
}

/** Translate stored shot metadata without changing its authored values. */
export function shotMetadata(shot) {
  const mode = shot.visual?.detection?.mode || 'OFF';
  const style = shot.visual?.style || 'normal';
  const styleLabel = STYLE_LABELS[style]
    ? t(STYLE_LABELS[style])
    : style.toUpperCase();
  const modeLabel = DETECTION_MODE_LABELS[mode]
    ? t(DETECTION_MODE_LABELS[mode])
    : mode;
  const seconds = (value) =>
    formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const timing = t('{duration}s + {hold}s', {
    duration: seconds(shot.durationSec),
    hold: seconds(shot.holdSec),
  });
  return `${styleLabel} · ${modeLabel} · ${timing}`;
}
