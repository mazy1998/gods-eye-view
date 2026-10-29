<script setup>
import { t } from '../../i18n/index.js';
defineProps({ status: String, error: Boolean });
</script>
<template>
  <span
    class="loader-logo brand-logo"
    data-logo-gaze
    data-logo-src="/logo.svg"
    aria-hidden="true"
    ><img src="/logo.svg" alt=""
  /></span>
  <h2 translate="no">GOD'S EYE <span class="title-accent">VIEW</span></h2>
  <p
    class="loader-status"
    :class="{ 'startup-error': error }"
    :style="error ? { color: 'var(--gev-error-text)' } : undefined"
  >
    {{ status || t('Initializing photorealistic world...') }}
  </p>
</template>
