<script setup>
import { t } from '../i18n/index.js';
defineProps({
  label: String,
  name: String,
  chosen: String,
  directory: Boolean,
});
defineEmits(['change']);
</script>
<template>
  <label class="stories-file-chooser">
    <span>{{ label }}</span>
    <input
      type="file"
      :aria-label="label"
      :data-scene-assets="name"
      multiple
      :webkitdirectory="directory ? '' : undefined"
      @change="$emit('change', name)"
    />
    <span class="stories-file-row" aria-hidden="true"
      ><span>{{ t('Choose files') }}</span
      ><span>{{ chosen || t('No file chosen') }}</span></span
    >
  </label>
</template>
