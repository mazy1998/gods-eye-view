<script setup>
import QuantitativeSlider from './primitives/QuantitativeSlider.vue';
import { formatUtcDayMonth, t } from '../i18n/index.js';
import { utcClock } from './railTimeline.js';
defineProps({
  state: { type: Object, required: true },
  actions: { type: Object, required: true },
});
const dated = (tick) =>
  Number.isFinite(Date.parse(tick))
    ? `${formatUtcDayMonth(tick)} ${utcClock(tick)}`
    : '';
</script>
<template>
  <section class="rail-timeline">
    <div class="rail-timeline-track">
      <button
        type="button"
        class="data-toggle-chip"
        :title="t('Earlier observation')"
        :disabled="state.previousDisabled"
        @click="actions.step(-1)"
      >
        {{ '‹' }}
      </button>
      <QuantitativeSlider
        class="weather-timeline"
        :min="0"
        :max="Math.max(0, state.ticks.length - 1)"
        :step="1"
        :model-value="state.index"
        :label="t('Observed history')"
        :value-text="dated(state.ticks[state.index])"
        :disabled="state.disabled"
        @update:model-value="actions.preview($event)"
        @change="actions.change($event.target.valueAsNumber)"
        @blur="actions.blur()"
        @pointercancel="actions.reset()"
      />
      <button
        type="button"
        class="data-toggle-chip"
        :title="t('Later observation')"
        :disabled="state.nextDisabled"
        @click="actions.step(1)"
      >
        {{ '›' }}
      </button>
      <div class="rail-timeline-endpoints">
        <span>{{ utcClock(state.ticks[0]) }}</span
        ><span>{{ utcClock(state.ticks.at(-1)) }}</span>
      </div>
    </div>
    <div class="rail-timeline-controls">
      <button
        type="button"
        class="data-toggle-chip"
        :class="{ active: state.mode === 'latest' }"
        :title="t('Newest frame per product')"
        :disabled="state.disabled"
        :aria-pressed="String(state.mode === 'latest')"
        @click="actions.latest()"
      >
        {{ t('Latest') }}
      </button>
      <button
        type="button"
        class="data-toggle-chip"
        :class="{ active: state.playing }"
        :title="t('Replay observed history')"
        :disabled="state.disabled"
        :aria-pressed="String(state.playing)"
        @click="actions.play()"
      >
        {{ state.playing ? t('Pause') : t('Play') }}
      </button>
      <span class="rail-timeline-readout">{{ state.readout }}</span>
    </div>
  </section>
</template>
