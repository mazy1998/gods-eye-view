<script setup>
/**
 * Display → Detection: the mode button (cycles OFF → SPARSE → BALANCED →
 * DENSE), density, allocation, fade and outside opacity. Renders inside its
 * group wrapper, which Cockpit's portal moves as a whole.
 */
import { computed, ref } from 'vue';
import { t } from '../../i18n/index.js';
import { msg } from '../../i18n/marker.js';
import { displayDefaults } from './displayDefaults.js';
import { sliderFill } from './sliderFill.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const detection = computed(() => (props.state ?? displayDefaults).detection);
const act = (name, ...args) => props.actions?.[name]?.(...args);
const on = computed(() => detection.value.mode !== 'OFF');
const LABELS = {
  SPARSE: msg('SPARSE'),
  BALANCED: msg('BALANCED'),
  DENSE: msg('DENSE'),
};
const label = computed(() => t(LABELS[detection.value.mode] ?? msg('DETECT')));
const ariaLabel = computed(() =>
  on.value
    ? t('Detection overlay: {mode}', {
        mode: String(detection.value.mode).toLowerCase(),
      })
    : t('Detection overlay: off'),
);
// Both fade sliders commit together, each with the value it shows. A slider a
// caller retains after the view is gone has no partner to read: do nothing.
const fade = ref(null);
const outside = ref(null);
const commitFade = () => {
  if (!fade.value || !outside.value) return;
  act(
    'setFade',
    parseInt(fade.value.value, 10),
    parseInt(outside.value.value, 10),
  );
};
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{
      active: on,
      panoptic: detection.mode === 'DENSE',
    }"
    id="detection-toggle"
    :title="t('Detection Overlay (D)')"
    :aria-label="ariaLabel"
    :aria-pressed="String(on)"
    @click="act('cycleDetection')"
  >
    <span class="pp-icon">▣</span>
    <span class="pp-label">{{ label }}</span>
  </button>
  <div
    class="pp-slider-row detection-slider-row"
    :class="{ visible: on }"
    id="detection-slider-row"
  >
    <label class="pp-slider-mini-label" for="detection-density-slider">{{
      t('Density')
    }}</label>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      id="detection-density-slider"
      min="0"
      max="100"
      step="25"
      :value="detection.density"
      :style="sliderFill(detection.density, 0, 100)"
      :aria-label="t('Detection label density')"
      @input="act('setDensity', $event.target.value)"
    />
    <span class="pp-slider-value" id="detection-density-value">{{
      `${detection.density}%`
    }}</span>
  </div>
  <div
    class="pp-slider-row detection-allocation-row"
    :class="{ visible: on }"
    id="detection-allocation-row"
  >
    <span class="pp-slider-mini-label">{{ t('Allocation') }}</span>
    <div
      class="gev-segmented pp-mode-seg detection-allocation-seg"
      role="radiogroup"
      :aria-label="t('Detection label allocation')"
    >
      <button
        v-for="[value, text] in [
          ['ELASTIC', msg('Elastic')],
          ['WEIGHTED', msg('Weighted')],
        ]"
        :key="value"
        class="gev-segment pp-mode-btn"
        :class="{ active: detection.allocation === value }"
        :id="`detection-allocation-${value.toLowerCase()}`"
        :data-allocation="value"
        role="radio"
        :aria-checked="String(detection.allocation === value)"
        @click="act('setAllocation', value)"
      >
        {{ t(text) }}
      </button>
    </div>
  </div>
  <div
    class="pp-slider-row detection-fade-row"
    :class="{ visible: on }"
    id="detection-fade-row"
  >
    <label class="pp-slider-mini-label" for="detection-fade-slider">{{
      t('Fade')
    }}</label>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      ref="fade"
      id="detection-fade-slider"
      min="0"
      max="40"
      step="1"
      :value="detection.fadePct"
      :style="sliderFill(detection.fadePct, 0, 40)"
      :aria-label="t('Detection fade distance')"
      :title="
        t(
          'World-overlay fade distance outside the keyhole as a percentage of its radius',
        )
      "
      @input="commitFade"
    />
    <span class="pp-slider-value" id="detection-fade-value">{{
      `${detection.fadePct}%`
    }}</span>
  </div>
  <div
    class="pp-slider-row detection-opacity-row"
    :class="{ visible: on }"
    id="detection-opacity-row"
  >
    <label class="pp-slider-mini-label" for="detection-opacity-slider">{{
      t('Outside')
    }}</label>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      ref="outside"
      id="detection-opacity-slider"
      min="0"
      max="100"
      step="1"
      :value="detection.outsideOpacityPct"
      :style="sliderFill(detection.outsideOpacityPct, 0, 100)"
      :aria-label="t('Detection opacity outside the keyhole')"
      :title="
        t('World-overlay label and card opacity beyond the fade distance')
      "
      @input="commitFade"
    />
    <span class="pp-slider-value" id="detection-opacity-value">{{
      `${detection.outsideOpacityPct}%`
    }}</span>
  </div>
</template>
