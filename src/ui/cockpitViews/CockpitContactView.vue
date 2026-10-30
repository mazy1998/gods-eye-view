<script setup>
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
const props = defineProps({
  contact: { type: Object, required: true },
  onPrevious: { type: Function, required: true },
  onNext: { type: Function, required: true },
  onToggle: { type: Function, required: true },
  onWeather: { type: Function, required: true },
});
/** Each cohort's count cell, in the panel's fixed order with its source. */
const COHORTS = [
  { id: 'flights', label: () => t('FLT'), source: 'OpenSky' },
  { id: 'military', label: () => t('MIL'), source: 'adsb.lol' },
  // AIS is a protocol name, shown as written.
  { id: 'ais-live-vessels', label: null, source: 'AISStream' },
  {
    id: 'military-installations',
    label: () => t('SITE'),
    source: 'OpenStreetMap',
  },
];
const cohorts = computed(() =>
  COHORTS.map((cohort) => ({
    ...cohort,
    shown: props.contact.cohorts.find((item) => item.id === cohort.id),
  })),
);
const weatherLabel = computed(() =>
  props.contact.weatherEnabled
    ? t('Disable cockpit weather effects')
    : t('Enable cockpit weather effects'),
);
</script>
<template>
  <header class="cockpit-context-header">
    <div>
      <span class="cockpit-context-kicker">{{ t('CONTACT') }}</span>
      <strong id="cockpit-context-subject">{{ contact.scope }}</strong>
    </div>
    <nav class="cockpit-context-actions" :aria-label="t('Contact navigation')">
      <button
        id="cockpit-context-previous"
        type="button"
        :aria-label="t('Previous — prior visited contact in the 250 km window')"
        :title="t('Previous — prior visited contact in the 250 km window')"
        :disabled="!contact.canPrevious"
        @click="onPrevious"
      >
        <span class="material-symbols-outlined" aria-hidden="true"
          >skip_previous</span
        >
      </button>
      <button
        id="cockpit-context-next"
        type="button"
        :aria-label="t('Next — nearest unvisited contact in the 250 km window')"
        :title="t('Next — nearest unvisited contact in the 250 km window')"
        :disabled="!contact.canNext"
        @click="onNext"
      >
        <span class="material-symbols-outlined" aria-hidden="true"
          >skip_next</span
        >
      </button>
      <button
        id="cockpit-context-toggle"
        type="button"
        :aria-label="
          contact.collapsed
            ? t('Expand Contact panel')
            : t('Collapse Contact panel')
        "
        :aria-expanded="String(!contact.collapsed)"
        :title="
          contact.collapsed
            ? t('Expand contact panel')
            : t('Collapse contact panel')
        "
        @click="onToggle"
      >
        <span
          v-if="contact.collapsed"
          class="material-symbols-outlined"
          aria-hidden="true"
          >chevron_right</span
        ><span v-else class="material-symbols-outlined" aria-hidden="true"
          >chevron_left</span
        >
      </button>
    </nav>
    <span class="cockpit-context-qualifier">{{ t('CONTEXT ONLY') }}</span>
  </header>
  <div
    class="cockpit-context-cohorts"
    role="list"
    :aria-label="t('Nearby cohort counts')"
  >
    <div
      v-for="cohort in cohorts"
      :key="cohort.id"
      role="listitem"
      :data-context-cohort="cohort.id"
      :class="{ unknown: cohort.shown?.unknown }"
    >
      <span v-if="cohort.label">{{ cohort.label() }}</span
      ><span v-else translate="no">AIS</span
      ><strong>{{ cohort.shown?.count ?? '—' }}</strong
      ><small translate="no">{{ cohort.source }}</small>
    </div>
  </div>
  <div class="cockpit-context-nearest">
    <span
      id="cockpit-context-direction"
      class="material-symbols-outlined"
      :class="{ unknown: contact.relative === null }"
      :style="{ transform: `rotate(${contact.relative ?? 0}deg)` }"
      aria-hidden="true"
      >navigation</span
    >
    <div>
      <small>{{ t('NEAREST OBSERVED / MAPPED') }}</small>
      <strong
        id="cockpit-context-nearest-label"
        :aria-label="contact.nearestLabel || undefined"
        >{{ contact.nearest }}</strong
      >
    </div>
    <span id="cockpit-context-bearing">{{ contact.bearing }}</span>
    <span
      id="cockpit-context-distance"
      :aria-label="contact.distanceLabel || undefined"
      >{{ contact.distance }}</span
    >
  </div>
  <footer class="cockpit-context-footer">
    <span id="cockpit-context-uncertainty">{{ contact.uncertainty }}</span>
    <button
      id="cockpit-weather-toggle"
      class="cockpit-context-weather"
      type="button"
      :aria-label="weatherLabel"
      :aria-pressed="String(contact.weatherEnabled)"
      :title="weatherLabel"
      @click="onWeather"
    >
      <span>{{ t('WX') }}</span>
      <strong id="cockpit-weather-state">{{
        contact.weatherEnabled ? t('ON') : t('OFF')
      }}</strong>
    </button>
    <time id="cockpit-context-updated">{{ contact.updated }}</time>
  </footer>
</template>
