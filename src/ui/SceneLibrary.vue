<script setup>
import { tn } from '../i18n/index.js';
defineProps({
  scenes: Array,
  selected: String,
  running: Boolean,
  select: Function,
});
</script>
<template>
  <div class="stories-library">
    <button
      v-for="scene in scenes"
      :key="scene.id"
      type="button"
      class="stories-recipe"
      :class="{ active: scene.id === selected }"
      :aria-pressed="String(scene.id === selected)"
      :disabled="running"
      :data-scene-recipe-id="scene.id"
      @click="select(scene.id)"
    >
      <span>{{ scene.title }}</span>
      <small>{{
        tn(scene.shots.length, '{count} shot', '{count} shots')
      }}</small>
    </button>
  </div>
</template>
