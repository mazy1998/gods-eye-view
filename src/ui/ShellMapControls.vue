<script setup>
// Map controls at the bottom right: today's North, Tilt and Home buttons,
// moved into this stack (see shellChrome.js). No zoom buttons: the app has
// none today.
import { t } from '../i18n/index.js';

defineProps({
  // The drawer's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
});
</script>

<template>
  <div
    id="gev-map-controls"
    class="gev-map-controls gev-surface"
    role="group"
    :aria-label="t('Map controls')"
    :hidden="!state?.active"
  ></div>
</template>
