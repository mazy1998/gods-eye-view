/**
 * A slider's filled-track length as an inline style: how far its value sits
 * along its range, in units of the input's own width (cqw). Map & Look's sheet
 * paints the fill from it; elsewhere it is unused.
 * @param {number|string} value
 * @param {number|string} min
 * @param {number|string} max
 * @returns {{'--gev-slider-fill': string}}
 */
export function sliderFill(value, min, max) {
  const low = Number(min);
  const span = Number(max) - low;
  const raw = (Number(value) - low) / span;
  const fraction =
    span > 0 && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  return { '--gev-slider-fill': `${Math.round(fraction * 1000) / 10}cqw` };
}
