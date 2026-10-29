<script setup>
import { t } from '../../i18n/index.js';
defineProps({
  state: Object,
  error: { type: String, default: '' },
  dismissed: Boolean,
  onFly: Function,
});
</script>

<template>
  <div class="gev-location-results gev-surface">
    <p id="location-search-error" class="location-search-error" role="alert">
      {{ error }}
    </p>
    <div
      v-if="state?.status === 'found' && !dismissed"
      class="gev-location-result"
    >
      <span class="gev-location-result-label">{{
        state.destination?.label || state.query
      }}</span>
      <button
        type="button"
        class="gev-location-fly"
        :aria-label="
          t('Fly to {place}', {
            place: state.destination?.label || state.query,
          })
        "
        :disabled="state.searching"
        @click="onFly?.()"
      >
        {{ t('Fly to') }}
      </button>
    </div>
  </div>
</template>
