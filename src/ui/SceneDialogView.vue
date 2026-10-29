<script setup>
import { onBeforeUnmount } from 'vue';
import ActionButton from './primitives/ActionButton.vue';
import SceneDetailsView from './SceneDetailsView.vue';
import SceneFileChooser from './SceneFileChooser.vue';
import { t } from '../i18n/index.js';
const props = defineProps({ view: Object, close: Function });
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
const call = (name, ...args) => {
  if (alive) props.view.actions[name]?.(...args);
};
const cancel = () => {
  if (alive) props.close();
};
</script>
<template>
  <dialog
    data-director-dialog
    class="director-sharing-dialog stories-dialog gev-surface"
    :aria-label="view.title"
    @cancel.prevent="cancel"
  >
    <h2>{{ view.title }}</h2>
    <p v-if="view.context" class="stories-dialog-context">{{ view.context }}</p>
    <div class="stories-dialog-body">
      <p v-for="(text, index) in view.texts" :key="index">{{ text }}</p>
      <SceneDetailsView
        v-if="view.details"
        :draft="view.details"
        :call="call"
        :input="(key, value) => call('inputDetail', key, value)"
      />
      <template v-if="view.mode === 'share'">
        <SceneFileChooser
          name="files"
          :label="t('Choose data-pack files')"
          :chosen="view.files"
          @change="call('chooseAssets')"
        />
        <SceneFileChooser
          name="folder"
          :label="t('Or choose a data-pack folder')"
          :chosen="view.folder"
          directory
          @change="call('chooseAssets')"
        />
      </template>
    </div>
    <p role="status">{{ view.status }}</p>
    <div class="stories-dialog-actions">
      <ActionButton :label="t('Cancel')" @click="cancel" />
      <ActionButton
        v-if="view.actions.applyImport"
        data-director-apply-import
        :label="t('Apply import')"
        :disabled="view.applyDisabled"
        @click="call('applyImport')"
      />
      <ActionButton
        v-if="view.actions.applyDetails"
        data-director-apply-details
        :label="t('Apply details')"
        @click="call('applyDetails')"
      />
      <ActionButton
        v-if="view.actions.shareJson"
        :label="t('Download scene JSON')"
        @click="call('shareJson')"
      />
      <ActionButton
        v-if="view.actions.shareBundle"
        :label="t('Download asset bundle')"
        @click="call('shareBundle')"
      />
    </div>
  </dialog>
</template>
