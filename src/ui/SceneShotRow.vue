<script setup>
import { onBeforeUnmount } from 'vue';
import ActionButton from './primitives/ActionButton.vue';
import { shotMetadata } from './scenePresentation.js';
import { t } from '../i18n/index.js';
const props = defineProps({
  scene: Object,
  shot: Object,
  selected: String,
  draft: Object,
  actions: Object,
});
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
const run = (name, ...args) => {
  if (alive) props.actions[name](...args);
};
</script>
<template>
  <div
    class="scene-shot-row"
    :class="{ active: selected === shot.id }"
    :data-scene-shot-id="shot.id"
  >
    <div class="scene-shot-top">
      <div
        class="scene-shot-label"
        :title="t('Double-click to rename')"
        @click="run('selectShot', shot.id)"
        @dblclick="
          run(
            'beginRename',
            scene.id,
            shot.id,
            shot.displayTitle || shot.title,
            $event.currentTarget,
          )
        "
      >
        <input
          v-if="draft?.shotId === shot.id && draft.sceneId === scene.id"
          class="scene-shot-rename"
          type="text"
          :aria-label="t('Shot name')"
          :value="draft.value"
          @click.stop
          @dblclick.stop
          v-on="{
            input: draft.inputEvent,
            blur: draft.blur,
            keydown: draft.key,
          }"
        />
        <template v-else>{{ shot.displayTitle || shot.title }}</template>
      </div>
      <div class="scene-shot-actions">
        <ActionButton
          class="scene-shot-btn"
          size="compact"
          :label="t('LOAD')"
          @click="run('load', scene.id, shot.id)"
        />
        <ActionButton
          class="scene-shot-btn scene-shot-danger"
          size="compact"
          variant="danger"
          :label="t('Delete shot')"
          @click="run('deleteShot', scene.id, shot.id)"
        />
      </div>
    </div>
    <div class="scene-shot-meta">{{ shotMetadata(shot) }}</div>
  </div>
</template>
