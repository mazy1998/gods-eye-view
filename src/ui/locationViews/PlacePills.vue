<script setup>
defineProps({
  kind: String,
  items: Array,
  selected: [String, Number],
  onChoose: Function,
});
</script>

<template>
  <button
    v-for="item in items"
    :key="item.id"
    type="button"
    :class="[
      kind === 'city' ? 'location-pill' : 'poi-pill',
      { active: item.id === selected },
    ]"
    :data-location-id="kind === 'city' ? item.id : undefined"
    :data-poi-index="kind === 'poi' ? item.id : undefined"
    :aria-pressed="item.id === selected"
    @click="onChoose?.(item.id)"
  >
    <span v-if="kind === 'poi'" class="poi-pill-key" aria-hidden="true">{{
      item.keyHint
    }}</span>
    <span :class="kind === 'poi' ? 'poi-pill-name' : undefined">{{
      item.label
    }}</span>
  </button>
</template>
