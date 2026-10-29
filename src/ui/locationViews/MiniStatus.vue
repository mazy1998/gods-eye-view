<script setup>
import { t } from '../../i18n/index.js';
defineProps({ city: String, poi: String });
</script>

<template>
  <div
    id="location-mini-status"
    class="location-mini-status"
    aria-live="polite"
  >
    <div id="location-mini-city" class="location-mini-city">
      {{ city || t('📍 Location: --') }}
    </div>
    <div id="location-mini-poi" class="location-mini-poi">
      {{ poi || t('Landmark: --') }}
    </div>
  </div>
</template>
