<script setup>
import ActionButton from './primitives/ActionButton.vue';
import { t } from '../i18n/index.js';
defineProps({ runtime: String, running: Boolean, stop: Function });
</script>
<template>
  <div class="stories-runtime">
    <span>{{ runtime }}</span>
    <ActionButton
      v-if="running"
      id="scene-runtime-stop"
      class="stories-runtime-stop"
      size="compact"
      variant="danger"
      :label="t('STOP')"
      @click="stop"
    />
  </div>
</template>
