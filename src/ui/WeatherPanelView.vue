<script setup>
import WeatherCard from './WeatherCard.vue';
import WeatherTimeline from './WeatherTimeline.vue';
import { t } from '../i18n/index.js';
defineProps({
  cards: Array,
  observed: Array,
  scope: String,
  timeline: Object,
  timelineActions: Object,
  hidden: Boolean,
  showTimeline: Boolean,
  open: Function,
  activate: Function,
  rangeInput: Function,
  rangeChange: Function,
});
</script>
<template>
  <section
    class="weather-readout weather-controls gev-surface"
    :hidden="hidden"
    :aria-label="t('Active weather')"
  >
    <div class="weather-cards">
      <WeatherCard
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :open="open"
        :activate="activate"
        :range-input="rangeInput"
        :range-change="rangeChange"
      />
    </div>
    <section
      class="weather-observed-group"
      :hidden="!showTimeline"
      :aria-label="t('Observed history')"
    >
      <h3 class="panel-title">{{ t('Observed history') }}</h3>
      <div class="weather-observed-scope">{{ scope }}</div>
      <div class="weather-timeline-block" :hidden="!showTimeline">
        <WeatherTimeline :state="timeline" :actions="timelineActions" />
      </div>
      <div class="weather-cards">
        <WeatherCard
          v-for="card in observed"
          :key="card.id"
          :card="card"
          :open="open"
          :activate="activate"
          :range-input="rangeInput"
          :range-change="rangeChange"
        />
      </div>
    </section>
  </section>
</template>
