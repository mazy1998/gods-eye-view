<script setup>
import { t, tn } from '../i18n/index.js';
defineProps({
  scenes: Array,
  selected: String,
  running: Boolean,
  select: Function,
});
// The app's own stories and the ones made or imported here, headed where
// the list moves from one to the other; the list keeps its playback order.
const group = (scene) => (scene.builtIn ? 'built-in' : 'own');
const headingBefore = (scenes, index) =>
  index === 0 || group(scenes[index]) !== group(scenes[index - 1])
    ? group(scenes[index]) === 'built-in'
      ? t('GEV stories')
      : t('Your stories')
    : null;
</script>
<template>
  <div class="stories-library">
    <template v-for="(scene, index) in scenes" :key="scene.id">
      <h3 v-if="headingBefore(scenes, index)" class="stories-library-heading">
        {{ headingBefore(scenes, index) }}
      </h3>
      <button
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
    </template>
  </div>
</template>
