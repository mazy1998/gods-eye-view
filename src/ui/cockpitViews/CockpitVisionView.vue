<script setup>
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { cockpitVisionLabels } from '../cockpitVisionLabels.js';
const props = defineProps({
  mode: { type: String, required: true },
  onPrevious: { type: Function, required: true },
  onCurrent: { type: Function, required: true },
  onNext: { type: Function, required: true },
});
const shown = computed(() => cockpitVisionLabels(props.mode));
</script>
<template>
  <button
    id="cockpit-vision-previous"
    class="cockpit-vision-nav"
    type="button"
    :aria-label="t('Previous cockpit vision style')"
    :title="t('Previous vision style')"
    @click="onPrevious"
  >
    <span class="material-symbols-outlined" aria-hidden="true"
      >chevron_left</span
    >
    <small>{{ t('PREV') }}</small>
  </button>
  <button
    id="cockpit-vision-current"
    class="cockpit-vision-current"
    type="button"
    :data-cockpit-vision="mode"
    :aria-label="
      t('Current cockpit vision style: {style}. Activate for next style.', {
        style: shown.name,
      })
    "
    :title="t('Current style: {style} — click for next', { style: shown.name })"
    @click="onCurrent"
  >
    <small>{{ t('CURRENT') }}</small>
    <strong id="cockpit-vision-current-label" aria-live="polite">{{
      shown.label
    }}</strong>
  </button>
  <button
    id="cockpit-vision-next"
    class="cockpit-vision-nav"
    type="button"
    :aria-label="t('Next cockpit vision style')"
    :title="t('Next vision style')"
    @click="onNext"
  >
    <small>{{ t('NEXT') }}</small>
    <span class="material-symbols-outlined" aria-hidden="true"
      >chevron_right</span
    >
  </button>
</template>
