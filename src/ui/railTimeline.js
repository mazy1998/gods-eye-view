import { formatUtcDayMonth, t } from '../i18n/index.js';
import { createSlider } from './slider.js';
import { createRailTimelineState } from './railTimelineState.js';
const set = (node, key, value) => {
  if (node[key] !== value) node[key] = value;
};
/**
 * "HH:MM UTC" of a time, or '' when it is not one. Computed on its own rather
 * than cut from the dated readout: the localized day and month vary in length
 * ("3/9" in Spanish, "09-03" in English).
 */
export const utcClock = (tick) =>
  Number.isFinite(Date.parse(tick))
    ? `${new Date(tick).toISOString().slice(11, 16)} UTC`
    : '';
const utc = (tick) =>
  Number.isFinite(Date.parse(tick))
    ? `${formatUtcDayMonth(tick)} ${utcClock(tick)}`
    : '';

/** Stable native transport with local preview and a coalesced 150 ms drag commit. */
export function createRailTimeline({
  container,
  document = container?.ownerDocument,
  sliderClassName = '',
  heading = true,
  onCommit = () => {},
  onPreview = () => {},
  onStep = () => {},
  onLatest = () => {},
  onPlay = () => {},
} = {}) {
  if (!document?.createElement || !container) return null;
  const root = document.createElement('section');
  root.className = 'rail-timeline';
  const row = document.createElement('div');
  row.className = 'rail-timeline-track';
  const makeButton = (label, title, parent) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'data-toggle-chip';
    node.textContent = label;
    node.title = title;
    parent.appendChild(node);
    return node;
  };
  const previous = makeButton('‹', t('Earlier observation'), row);
  const slider = createSlider({
    documentRef: document,
    className: sliderClassName,
    min: '0',
    max: '0',
    step: '1',
    value: '0',
    ariaLabel: t('Observed history'),
  });
  row.appendChild(slider);
  const next = makeButton('›', t('Later observation'), row);
  const controls = document.createElement('div');
  controls.className = 'rail-timeline-controls';
  const latest = makeButton(
    t('Latest'),
    t('Newest frame per product'),
    controls,
  );
  const play = makeButton(t('Play'), t('Replay observed history'), controls);
  const readout = document.createElement('span');
  readout.className = 'rail-timeline-readout';
  controls.appendChild(readout);
  const label = document.createElement('div');
  label.className = 'panel-title';
  label.textContent = t('Observed history');
  const endpoints = document.createElement('div');
  endpoints.className = 'rail-timeline-endpoints';
  const oldest = document.createElement('span');
  const newest = document.createElement('span');
  endpoints.appendChild(oldest);
  endpoints.appendChild(newest);
  row.appendChild(endpoints);
  if (heading) root.appendChild(label);
  root.appendChild(row);
  root.appendChild(controls);
  container.appendChild(root);
  const owner = createRailTimelineState({
    onCommit,
    onPreview,
    onStep,
    onLatest,
    onPlay,
  });
  const unsubscribe = owner.channel.subscribe(
    ({ state }) => {
      set(slider, 'max', String(Math.max(0, state.ticks.length - 1)));
      set(slider, 'value', String(state.index));
      const value = utc(state.ticks[state.index]);
      if (slider.getAttribute('aria-valuetext') !== value)
        slider.setAttribute('aria-valuetext', value);
      set(oldest, 'textContent', utcClock(state.ticks[0]));
      set(newest, 'textContent', utcClock(state.ticks.at(-1)));
      set(readout, 'textContent', state.readout);
      for (const node of [slider, latest, play])
        set(node, 'disabled', state.disabled);
      set(previous, 'disabled', state.previousDisabled);
      set(next, 'disabled', state.nextDisabled);
      set(
        latest,
        'className',
        `data-toggle-chip${state.mode === 'latest' ? ' active' : ''}`,
      );
      set(
        play,
        'className',
        `data-toggle-chip${state.playing ? ' active' : ''}`,
      );
      set(play, 'textContent', state.playing ? t('Pause') : t('Play'));
      for (const [node, active] of [
        [latest, state.mode === 'latest'],
        [play, state.playing],
      ])
        if (node.getAttribute('aria-pressed') !== String(active))
          node.setAttribute('aria-pressed', String(active));
    },
    { emitCurrent: false },
  );
  const bindings = [
    [slider, 'input', () => owner.preview(slider.value)],
    [slider, 'change', () => owner.change(slider.value)],
    [slider, 'pointercancel', owner.reset],
    [slider, 'blur', owner.blur],
    [previous, 'click', () => owner.step(-1)],
    [next, 'click', () => owner.step(1)],
    [latest, 'click', owner.latest],
    [play, 'click', owner.play],
  ];
  for (const [node, event, handler] of bindings)
    node.addEventListener(event, handler);
  return {
    update: owner.update,
    destroy() {
      unsubscribe();
      owner.destroy();
      for (const [node, event, handler] of bindings)
        node.removeEventListener(event, handler);
      root.remove();
    },
  };
}
