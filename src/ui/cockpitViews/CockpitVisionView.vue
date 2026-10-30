<script setup>
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
const props = defineProps({
  mode: { type: String, required: true },
  onPrevious: { type: Function, required: true },
  onCurrent: { type: Function, required: true },
  onNext: { type: Function, required: true },
});
/** Each vision style's short label and its spoken name. */
const LABELS = {
  optical: () => t('NORMAL'),
  crt: () => t('CRT'),
  nvg: () => t('NVG'),
  thermal: () => t('FLIR'),
  anime: () => t('ANIME'),
  noir: () => t('NOIR'),
  snow: () => t('SNOW'),
};
const NAMES = {
  optical: () => t('Normal'),
  crt: () => t('CRT'),
  nvg: () => t('Night vision'),
  thermal: () => t('Thermal'),
  anime: () => t('Anime'),
  noir: () => t('Noir'),
  snow: () => t('Snow'),
};
const label = computed(() => (LABELS[props.mode] ?? LABELS.optical)());
const name = computed(() => (NAMES[props.mode] ?? NAMES.optical)());
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
        style: name,
      })
    "
    :title="t('Current style: {style} — click for next', { style: name })"
    @click="onCurrent"
  >
    <small>{{ t('CURRENT') }}</small>
    <strong id="cockpit-vision-current-label" aria-live="polite">{{
      label
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
