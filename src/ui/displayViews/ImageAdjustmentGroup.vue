<script setup>
/**
 * Look → an image adjustment (Bloom or Sharpen): its toggle and intensity.
 * Renders inside its group wrapper; VisualSettings owns the values.
 */
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { msg } from '../../i18n/marker.js';
import { displayDefaults } from './displayDefaults.js';

const props = defineProps({
  kind: { type: String, required: true },
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const KINDS = {
  bloom: {
    icon: '✨',
    label: msg('Bloom'),
    title: msg('Bloom / Glow'),
    aria: msg('Bloom intensity'),
    max: 200,
    toggle: 'toggleBloom',
    set: 'setBloomIntensity',
  },
  sharpen: {
    icon: '🔍',
    label: msg('Sharpen'),
    title: msg('Sharpening'),
    aria: msg('Sharpen intensity'),
    max: 100,
    toggle: 'toggleSharpen',
    set: 'setSharpenIntensity',
  },
};
const spec = computed(() => KINDS[props.kind]);
const adjustment = computed(
  () =>
    (props.state ?? displayDefaults)[props.kind] ?? displayDefaults[props.kind],
);
const act = (name, ...args) => props.actions?.[name]?.(...args);
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{ active: adjustment.enabled }"
    :id="`${kind}-toggle`"
    :title="t(spec.title)"
    :aria-pressed="String(adjustment.enabled)"
    @click="act(spec.toggle)"
  >
    <span class="pp-icon">{{ spec.icon }}</span>
    <span class="pp-label">{{ t(spec.label) }}</span>
  </button>
  <div
    class="pp-slider-row"
    :class="{ visible: adjustment.enabled }"
    :id="`${kind}-slider-row`"
  >
    <span class="pp-slider-mini-label" aria-hidden="true">{{
      t('Intensity')
    }}</span>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      :id="`${kind}-intensity-slider`"
      min="0"
      :max="spec.max"
      :value="adjustment.intensity"
      :aria-label="t(spec.aria)"
      @input="act(spec.set, parseInt($event.target.value, 10))"
    />
    <span class="pp-slider-value" :id="`${kind}-intensity-value`">{{
      `${adjustment.intensity}%`
    }}</span>
  </div>
</template>
