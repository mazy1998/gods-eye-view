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
      <span class="stories-recipe-art" aria-hidden="true"
        ><span class="material-symbols-outlined">movie</span></span
      >
      <span class="stories-recipe-copy"
        ><span class="stories-recipe-title">{{ scene.title }}</span>
        <small>{{
          tn(scene.shots.length, '{count} shot', '{count} shots')
        }}</small></span
      >
      <span
        class="material-symbols-outlined stories-recipe-arrow"
        aria-hidden="true"
        >chevron_right</span
      >
    </button>
  </div>
</template>
