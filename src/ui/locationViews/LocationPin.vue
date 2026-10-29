<script setup>
import { t } from '../../i18n/index.js';
</script>

<template>
  <button
    class="dock-pin-btn"
    data-pin-target="location-bar"
    type="button"
    :aria-label="t('Pin location tray')"
    aria-pressed="false"
    :title="t('Keep location tray open')"
  >
    <img :src="'/pin.svg'" alt="" />
  </button>
</template>
