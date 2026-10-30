<script setup>
import { computed, nextTick, useTemplateRef } from 'vue';
import TabList from './primitives/TabList.vue';
import ActionButton from './primitives/ActionButton.vue';
import SceneLibrary from './SceneLibrary.vue';
import SceneShotsView from './SceneShotsView.vue';
import { t, tn } from '../i18n/index.js';
const props = defineProps({
  library: Object,
  presentation: Object,
  tab: String,
  draft: Object,
  actions: Object,
  listRevision: Number,
});
const playlistShots = computed(() =>
  props.library.scenes.reduce((count, scene) => count + scene.shots.length, 0),
);
const selectedScene = computed(() =>
  props.library.scenes.find((s) => s.id === props.library.selectedSceneId),
);
// Play runs every story, starting at the selected one and wrapping round.
const playsSummary = computed(
  () =>
    `${tn(
      props.library.scenes.length,
      'Plays {count} story',
      'Plays all {count} stories',
    )} · ${tn(playlistShots.value, '{count} shot', '{count} shots')}`,
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
const root = useTemplateRef('root');
// The link hides itself with Browse, so focus moves to the Create tab it
// selected rather than falling to the page.
async function openCreate() {
  props.actions.setTab('create');
  await nextTick();
  root.value?.querySelector('#stories-create-tab')?.focus();
}
const percentage = computed(() =>
  Math.round(Math.max(0, Math.min(1, props.presentation.progress)) * 100),
);
</script>
<template>
  <div ref="root" class="stories-controls gev-surface">
    <TabList
      :tabs="tabs()"
      :model-value="tab"
      :label="t('Stories')"
      @update:model-value="actions.setTab"
    />
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
      <div class="stories-selected">
        <strong>{{ selectedScene?.title ?? t('Playlist') }}</strong>
        <small>{{ playsSummary }}</small>
      </div>
      <div class="scene-controls stories-transport">
        <ActionButton
          id="scene-start-btn"
          class="scene-btn"
          :disabled="presentation.running"
          @click="actions.start"
          ><svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" /></svg
          >{{ t('Play') }}</ActionButton
        >
      </div>
      <!-- Play's own feedback ("Running…", "No shots to run") where it was
           pressed; the Create tab shows the same status. -->
      <div class="stories-browse-status">{{ presentation.status }}</div>
      <button type="button" class="stories-create-link" @click="openCreate">
        <span>{{ t('Create') }}</span>
        <span aria-hidden="true">→</span>
      </button>
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
      <div class="scene-controls stories-transport">
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
      <section class="stories-authoring" :aria-label="t('Scene recipe')">
        <h3>{{ t('Scene recipe') }}</h3>
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
      </section>
    </section>
  </div>
</template>
