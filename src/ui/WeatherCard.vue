<script setup>
import StatusBadge from './primitives/StatusBadge.vue';
import WeatherBlocks from './WeatherBlocks.vue';
defineProps({
  card: { type: Object, required: true },
  open: Function,
  activate: Function,
  rangeInput: Function,
  rangeChange: Function,
});
</script>
<template>
  <article
    class="rail-card weather-card"
    :class="{ 'is-open': card.open }"
    :data-card-id="card.id"
    :data-open="String(card.open)"
  >
    <button
      type="button"
      class="rail-card-header"
      :aria-controls="card.bodyId"
      :aria-expanded="String(card.open)"
      @click="open(card.id)"
    >
      <span class="rail-card-labels"
        ><span class="rail-card-heading"
          ><span class="data-icon" aria-hidden="true" :hidden="!card.icon">{{
            card.icon || ''
          }}</span
          ><span class="rail-card-title rail-card-nowrap" :title="card.title">{{
            card.title
          }}</span></span
        ><StatusBadge
          class="rail-card-badge weather-coverage"
          appearance="plain"
          :label="card.badge || ''"
          :hidden="!card.badge" /></span
      ><span class="rail-card-disclosure" aria-hidden="true">{{
        card.open ? '▾' : '▸'
      }}</span
      ><span
        class="rail-card-compact"
        :class="{ status: card.compactStatus }"
        :hidden="card.open"
        >{{ card.compact || '' }}</span
      >
    </button>
    <div class="rail-card-body" :id="card.bodyId" :hidden="!card.open">
      <WeatherBlocks
        :blocks="card.blocks"
        :card-id="card.id"
        :activate="activate"
        :range-input="rangeInput"
        :range-change="rangeChange"
      />
    </div>
  </article>
</template>
