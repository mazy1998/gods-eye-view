<script setup>
/**
 * Look → the selected style's parameters, one slider per uniform: the style
 * VisualSettings publishes as `parameterStyle` (Cockpit's vision stage while
 * one is active), or the map style for a state without one. Renders inside
 * #param-sliders (styleManager._sliderContainer), within the panel Cockpit's
 * portal moves. VisualSettings owns the values (setStyleParam).
 */
import { computed, useTemplateRef } from 'vue';
import { formatNumber, t } from '../../i18n/index.js';
import { STYLES } from '../visualPresets.js';
import { sliderFill } from './sliderFill.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
/** A slider value in the UI language: 0.85 in English, 0,85 in Spanish. */
const formatParam = (value, digits) =>
  formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
const rows = computed(() => {
  const state = props.state;
  const style =
    state && 'parameterStyle' in state ? state.parameterStyle : state?.style;
  const uniforms = STYLES[style]?.uniforms;
  if (!uniforms || style === 'normal') return [];
  const values = state.styleParams?.[style] ?? {};
  return Object.entries(uniforms).map(([name, metadata]) => {
    const digits = metadata.max <= 1 ? 2 : 1;
    return {
      style,
      name,
      label: metadata.label,
      min: metadata.min,
      max: metadata.max,
      step: metadata.max <= 1 ? '0.01' : '0.1',
      value: values[name],
      text: formatParam(Number(values[name]), digits),
      fill: sliderFill(values[name], metadata.min, metadata.max),
    };
  });
});
// Vue leaves listeners on rows it has replaced or disposed. Only a slider the
// view still renders writes, so a retired row a caller holds stays inert, as
// the generated rows' removed listeners left it.
const liveSliders = useTemplateRef('parameter-slider');
const set = (row, event) => {
  if (!liveSliders.value?.includes(event.currentTarget)) return;
  props.actions?.setStyleParam?.(
    row.style,
    row.name,
    parseFloat(event.currentTarget.value),
  );
};
</script>

<template>
  <div
    v-for="row in rows"
    :key="`${row.style}:${row.name}`"
    class="param-slider-row"
  >
    <span class="param-label">{{ t(row.label) }}</span>
    <input
      ref="parameter-slider"
      type="range"
      class="gev-quantitative-slider param-slider"
      :min="row.min"
      :max="row.max"
      :step="row.step"
      :value="row.value"
      :style="row.fill"
      :aria-label="t(row.label)"
      @input="set(row, $event)"
    />
    <span class="param-value">{{ row.text }}</span>
  </div>
</template>
