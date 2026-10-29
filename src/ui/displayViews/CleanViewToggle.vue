<script setup>
/** Display → Clean UI: hide the UI chrome (V). The exit button stays legacy. */
import { t } from '../../i18n/index.js';

defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{ active: !!state?.cleanView }"
    id="clean-view-toggle"
    :title="t('Hide UI chrome')"
    @click="actions?.toggleCleanView?.()"
  >
    <span class="pp-icon">□</span>
    <span class="pp-label">{{ t('Clean UI') }}</span>
  </button>
</template>
