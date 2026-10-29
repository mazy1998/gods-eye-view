<script setup>
import { computed } from 'vue';
import TabList from './primitives/TabList.vue';
import ActionButton from './primitives/ActionButton.vue';
import SceneLibrary from './SceneLibrary.vue';
import SceneShotsView from './SceneShotsView.vue';
import { t } from '../i18n/index.js';
const props = defineProps({
  library: Object,
  presentation: Object,
  tab: String,
  draft: Object,
  actions: Object,
  listRevision: Number,
});
const selectedScene = computed(() =>
  props.library.scenes.find((s) => s.id === props.library.selectedSceneId),
);
const tabs = () => [
  {
    value: 'browse',
    label: t('Browse'),
    id: 'stories-browse-tab',
    controls: 'stories-browse',
  },
  {
    value: 'create',
    label: t('Create'),
    id: 'stories-create-tab',
    controls: 'stories-create',
  },
];
const percentage = computed(() =>
  Math.round(Math.max(0, Math.min(1, props.presentation.progress)) * 100),
);
</script>
<template>
  <div class="stories-controls gev-surface">
    <TabList
      :tabs="tabs()"
      :model-value="tab"
      :label="t('Stories')"
      @update:model-value="actions.setTab"
    />
    <div class="scene-controls">
      <select
        id="scene-select"
        class="gev-field"
        :aria-label="t('Scene recipe')"
        :value="library.selectedSceneId"
        :disabled="presentation.running"
        @change="actions.selectScene($event.target.value)"
      >
        <option
          v-for="scene in library.scenes"
          :key="scene.id"
          :value="scene.id"
        >
          {{ scene.title }}
        </option>
      </select>
    </div>
    <div class="scene-controls">
      <ActionButton
        id="scene-new-btn"
        class="scene-btn"
        :label="t('New scene')"
        :disabled="presentation.running"
        @click="actions.createScene"
      />
      <ActionButton
        id="scene-delete-btn"
        class="scene-btn scene-btn-danger"
        variant="danger"
        :label="t('Delete scene')"
        :disabled="presentation.running"
        @click="actions.deleteScene"
      />
    </div>
    <section
      id="stories-browse"
      role="tabpanel"
      aria-labelledby="stories-browse-tab"
      :hidden="tab !== 'browse'"
    >
      <SceneLibrary
        :scenes="library.scenes"
        :selected="library.selectedSceneId"
        :running="presentation.running"
        :select="actions.selectScene"
      />
    </section>
    <section
      id="stories-create"
      role="tabpanel"
      aria-labelledby="stories-create-tab"
      :hidden="tab !== 'create'"
    >
      <div class="scene-controls">
        <ActionButton
          id="scene-capture-btn"
          class="scene-btn"
          :label="t('CAPTURE SHOT')"
          :disabled="presentation.running"
          @click="actions.capture"
        />
        <ActionButton
          id="scene-update-shot-btn"
          class="scene-btn"
          :label="t('UPDATE SHOT')"
          :disabled="presentation.running"
          @click="actions.update"
        />
      </div>
      <SceneShotsView
        :revision="listRevision"
        :scene="selectedScene"
        :selected="library.selectedShotId"
        :draft="draft"
        :actions="actions"
      />
    </section>
    <div class="scene-controls" data-director-authoring>
      <ActionButton
        class="scene-btn"
        :label="t('EDIT DETAILS')"
        @click="actions.edit"
      />
      <ActionButton
        class="scene-btn"
        :label="t('SHARE SCENE')"
        @click="actions.share"
      />
    </div>
    <div class="scene-controls">
      <ActionButton
        id="scene-start-btn"
        class="scene-btn"
        :label="t('START')"
        :disabled="presentation.running"
        @click="actions.start"
      />
      <ActionButton
        id="scene-stop-btn"
        class="scene-btn scene-btn-danger"
        variant="danger"
        :label="t('STOP')"
        :disabled="!presentation.running"
        @click="actions.stop"
      />
      <ActionButton
        id="scene-next-btn"
        class="scene-btn"
        :label="t('NEXT')"
        :disabled="presentation.running"
        @click="actions.next"
      />
    </div>
    <div class="scene-progress">
      <div
        id="scene-progress-fill"
        :style="{ width: `${percentage}%` }"
        v-text="`${percentage}%`"
      ></div>
    </div>
    <div id="scene-status">{{ presentation.status }}</div>
    <div class="scene-controls">
      <ActionButton
        id="scene-export-btn"
        class="scene-btn"
        :label="t('EXPORT PRESETS')"
        :disabled="presentation.running"
        @click="actions.export"
      />
      <ActionButton
        id="scene-import-btn"
        class="scene-btn"
        :label="t('IMPORT')"
        :disabled="presentation.running"
        @click="actions.import"
      />
      <ActionButton
        id="scene-download-btn"
        class="scene-btn"
        :label="t('RUN LOG')"
        :disabled="!presentation.hasRun"
        @click="actions.download"
      />
      <input
        id="scene-import-file"
        type="file"
        accept="application/json,.json"
        hidden
        @change="actions.importFile($event.target)"
      />
    </div>
  </div>
</template>
