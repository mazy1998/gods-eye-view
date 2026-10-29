import { createStateChannel } from '../app/stateChannel.js';
import { formatCoordinateLabel } from '../search/coordinateParser.js';

const DEGREES = 180 / Math.PI;
const pad = (value) => String(value).padStart(2, '0');

/** "UTC 2026-10-29 12:26", the HUD's clock to the minute. */
export function formatUtcMinute(date) {
  // i18n-ignore: a clock in the HUD's notation
  return `UTC ${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * The status bar's readouts: the camera's position, as the HUD reads it, and
 * the UTC clock. It samples while the page is visible and publishes only
 * what changed.
 * @param {object} options
 * @param {{positionCartographic?: {latitude: number, longitude: number}}} options.camera
 * @param {Document} [options.document]
 * @param {() => Date} [options.now]
 * @param {number} [options.intervalMs]
 */
export function createStatusReadout({
  camera,
  document: doc = globalThis.document,
  now = () => new Date(),
  intervalMs = 500,
}) {
  let state = { coordinates: '', utc: '' };
  const channel = createStateChannel(() => state);

  function sample() {
    if (doc?.hidden) return;
    const position = camera?.positionCartographic;
    const next = {
      coordinates:
        position &&
        Number.isFinite(position.latitude) &&
        Number.isFinite(position.longitude)
          ? formatCoordinateLabel(
              position.latitude * DEGREES,
              position.longitude * DEGREES,
            )
          : '',
      utc: formatUtcMinute(now()),
    };
    if (next.coordinates === state.coordinates && next.utc === state.utc)
      return;
    state = next;
    channel.publish({ type: 'readout-changed' });
  }

  sample();
  const timer = setInterval(sample, intervalMs);
  return {
    channel,
    sample,
    destroy() {
      clearInterval(timer);
      channel.destroy();
    },
  };
}
