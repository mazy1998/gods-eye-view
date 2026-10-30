import { createStateChannel } from '../app/stateChannel.js';

/** Own a timeline drag, its stable tick mapping and coalesced commit without DOM. */
export function createRailTimelineState({
  onCommit = () => {},
  onPreview = () => {},
  onStep = () => {},
  onLatest = () => {},
  onPlay = () => {},
} = {}) {
  let props = {
    ticks: [],
    index: 0,
    mode: 'latest',
    playing: false,
    readout: '',
    disabled: true,
  };
  let ticks = [];
  let index = 0;
  let readout = '';
  let dragging = false;
  let timer = null;
  let pending = null;
  let destroyed = false;
  const channel = createStateChannel(() => ({
    ticks,
    index,
    readout,
    disabled: Boolean(props.disabled),
    previousDisabled: Boolean(props.disabled || props.index <= 0),
    nextDisabled: Boolean(
      props.disabled || props.index >= props.ticks.length - 1,
    ),
    mode: props.mode,
    playing: Boolean(props.playing),
  }));
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const commit = () => {
    cancel();
    const value = pending;
    pending = null;
    if (!destroyed && value && !props.disabled)
      onCommit(value.tick, value.index);
  };
  const update = (nextProps) => {
    if (destroyed) return;
    props = nextProps;
    if (props.disabled) {
      cancel();
      pending = null;
      dragging = false;
    }
    if (!dragging) {
      ticks = [...props.ticks];
      index = Math.max(0, Math.min(props.index, ticks.length - 1));
      readout = props.readout || '';
    }
    channel.publish();
  };
  const preview = (value) => {
    if (destroyed || props.disabled) return;
    dragging = true;
    index = Number(value);
    const tick = ticks[index];
    if (!tick) return;
    pending = { tick, index };
    const text = onPreview(tick, index);
    if (typeof text === 'string') readout = text;
    channel.publish();
    if (timer === null) timer = setTimeout(commit, 150);
  };
  const change = (value = index) => {
    if (destroyed || props.disabled) return;
    const nextIndex = Number(value);
    pending = { tick: ticks[nextIndex], index: nextIndex };
    dragging = false;
    commit();
    update(props);
  };
  const reset = () => {
    cancel();
    pending = null;
    dragging = false;
    update(props);
  };
  const act = (fn) => {
    if (destroyed) return;
    reset();
    if (!props.disabled) fn();
  };
  return {
    channel,
    update,
    preview,
    change,
    reset,
    // The slider may have moved since the last input event; commit where it
    // is now, read through the ticks the drag started with.
    blur: (value) => {
      if (dragging) change(Number.isFinite(value) ? value : index);
    },
    step: (direction) => act(() => onStep(direction)),
    latest: () => act(onLatest),
    play: () => act(onPlay),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      channel.destroy();
    },
  };
}
