<script setup>
import SceneShotRow from './SceneShotRow.vue';
import { t } from '../i18n/index.js';
defineProps({
  scene: Object,
  selected: String,
  draft: Object,
  actions: Object,
  revision: Number,
});
</script>
<template>
  <div id="scene-shot-list" class="scene-shot-list">
    <div v-if="!scene?.shots.length" class="scene-shot-empty">
      {{ t('No shots yet. Use CAPTURE SHOT to save current look.') }}
    </div>
    <SceneShotRow
      v-for="shot in scene?.shots || []"
      :key="`${revision}:${shot.id}`"
      :scene="scene"
      :shot="shot"
      :selected="selected"
      :draft="draft"
      :actions="actions"
    />
  </div>
</template>
