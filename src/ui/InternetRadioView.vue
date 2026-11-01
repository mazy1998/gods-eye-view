<script setup>
import { computed } from 'vue';
import { t } from '../i18n/index.js';
import { radioCardView } from './radioCardView.js';
import { sliderFill } from './displayViews/sliderFill.js';
const props = defineProps({
  state: { type: Object, default: () => ({}) },
  tuner: { type: Object, default: () => ({}) },
  slot: { type: Number, default: 0 },
  volume: { type: String, default: '80' },
  pending: Boolean,
});
const view = computed(() => radioCardView(props.state));
// Keep the category hue while the ported surface supplies readable text.
// Cyber leaves the category weight at 100%, preserving its existing palette.
const categoryTextColor = (color) =>
  color
    ? `color-mix(in srgb, ${color} var(--radio-tag-color-weight, 100%), var(--gev-text))`
    : undefined;
</script>
<template>
  <div class="radio-internet-section">
    <h3 class="radio-subsection-title">{{ t('Internet radio') }}</h3>
    <div class="radio-directory-row">
      <button
        id="radio-enable-btn"
        class="panel-layer-toggle"
        type="button"
        :class="{ active: view.enabled }"
        :aria-pressed="String(view.enabled)"
        :aria-label="view.enableAria"
        :aria-busy="String(view.transitioning || pending)"
        :aria-disabled="String(view.transitioning || pending)"
      >
        {{ view.enableLabel }}
      </button>
      <label class="radio-filter-label" for="radio-filter">{{
        t('STATION TAG')
      }}</label>
      <select
        class="gev-field"
        id="radio-filter"
        :aria-label="t('Filter stations by station tag')"
        :value="view.filter"
        :style="{ color: categoryTextColor(view.filterColor) }"
        :disabled="view.filterDisabled"
      >
        <option v-if="!view.categories.length" value="all">
          {{ t('All', { context: 'radio tag' }) }}
        </option>
        <option
          v-for="category in view.categories"
          :key="category.id"
          :value="category.id"
          :data-radio-color="category.color"
          :style="{ color: categoryTextColor(category.color) }"
          :aria-label="
            t('{category} ({count})', {
              category: category.label,
              count: category.count,
            })
          "
        >
          {{
            '● ' +
            t('{category} ({count})', {
              category: category.label,
              count: category.count,
            })
          }}
        </option>
      </select>
    </div>
    <div id="radio-station-card" class="radio-station-card" aria-live="polite">
      <strong id="radio-station-name">{{ view.name }}</strong>
      <span id="radio-station-meta">{{ view.meta }}</span>
      <span id="radio-station-tags">{{ view.tags }}</span>
    </div>
    <div
      id="radio-tuner"
      class="radio-tuner"
      :hidden="!view.tunerAvailable"
      :class="{ 'is-static': tuner.static, 'is-dragging': tuner.dragging }"
      :style="{ '--radio-tuner-ratio': tuner.ratio }"
    >
      <div class="radio-tuner-header">
        <span id="radio-tuner-band-label">{{ view.band }}</span>
        <output id="radio-tuner-value" for="radio-tuner-slider">{{
          tuner.value || t('DRAG TO TUNE')
        }}</output>
      </div>
      <div class="radio-tuner-dial">
        <div
          class="radio-tuner-scale"
          aria-hidden="true"
          :style="{ '--radio-tuner-tick-pitch': `${tuner.pitchPx || 0}px` }"
        >
          <span
            v-for="(tick, index) in tuner.ticks || []"
            :key="index"
            class="radio-tuner-tick"
            :class="{ 'is-current': tick.current }"
            :style="{ left: `${tick.xPx}px` }"
            :data-station-index="tick.stationIndex"
            >{{ tick.label }}</span
          >
        </div>
        <div
          id="radio-tuner-needle"
          class="radio-tuner-needle"
          aria-hidden="true"
        ></div>
        <input
          id="radio-tuner-slider"
          type="range"
          min="0"
          step="1"
          :aria-label="t('Tune available internet radio stations')"
          :max="tuner.max || 0"
          :value="slot"
          :aria-valuetext="tuner.aria || t('No station available')"
          :disabled="!view.tunerAvailable"
        />
      </div>
      <div class="radio-tuner-readout">
        <span id="radio-tuner-station">{{
          tuner.station || t('ALL · DRAG THE NEEDLE')
        }}</span>
        <span>{{ t('SNAPS TO AVAILABLE STATIONS') }}</span>
      </div>
    </div>
    <div class="radio-transport" role="group" :aria-label="t('Radio playback')">
      <button
        id="radio-prev-btn"
        type="button"
        :aria-label="t('Previous filtered station')"
        :disabled="view.transportDisabled"
      >
        {{ t('PREV') }}
      </button>
      <button
        id="radio-play-btn"
        type="button"
        :disabled="view.transportDisabled"
        :class="{ active: view.activePlayback }"
        :aria-label="view.playAria"
      >
        {{ view.playLabel }}
      </button>
      <button
        id="radio-next-btn"
        type="button"
        :aria-label="t('Next filtered station')"
        :disabled="view.transportDisabled"
      >
        {{ t('NEXT') }}
      </button>
      <button
        id="radio-stop-btn"
        type="button"
        :aria-label="t('Stop radio playback')"
        :disabled="view.stopDisabled"
      >
        {{ t('STOP') }}
      </button>
    </div>
    <label class="radio-volume-row" for="radio-volume">
      <span>{{ t('VOLUME') }}</span>
      <input
        id="radio-volume"
        class="gev-quantitative-slider"
        type="range"
        min="0"
        max="100"
        :aria-label="t('Radio volume')"
        :disabled="!view.interactive"
        :value="volume"
        :style="sliderFill(volume, 0, 100)"
      />
      <output
        id="radio-volume-value"
        class="gev-slider-value"
        for="radio-volume"
        >{{ `${volume}%` }}</output
      >
    </label>
    <div
      id="radio-playback-state"
      class="radio-playback-state"
      role="status"
      aria-live="polite"
      :class="{ error: view.statusError }"
    >
      {{ view.statusText }}
    </div>
    <div class="radio-links">
      <a
        id="radio-station-homepage"
        target="_blank"
        rel="noopener noreferrer"
        :href="view.homepage"
        :hidden="!view.homepage"
        >{{ t('STATION SITE') }}</a
      >
      <a
        href="https://www.radio-browser.info/"
        target="_blank"
        rel="noopener noreferrer"
        >{{ t('DIRECTORY: RADIO BROWSER') }}</a
      >
    </div>
    <p class="radio-privacy">
      {{
        t(
          'Audio connects directly to the broadcaster after you press play. Your IP is visible to that broadcaster.',
        )
      }}
    </p>
  </div>
</template>
