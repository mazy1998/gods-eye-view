<script setup>
/** Display → Celestial ring: reveal the full globe (Normal style only). */
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { displayDefaults } from './displayDefaults.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const celestial = computed(() => (props.state ?? displayDefaults).celestial);
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{ active: celestial.enabled }"
    id="celestial-toggle"
    :title="
      celestial.eligible
        ? t('Celestial ring — reveal the full globe')
        : t('Celestial ring — available in Normal style')
    "
    :aria-pressed="String(celestial.enabled)"
    :disabled="!celestial.eligible"
    :aria-disabled="String(!celestial.eligible)"
    @click="actions?.toggleCelestial?.()"
  >
    <span class="pp-icon material-symbols-outlined" aria-hidden="true"
      >flare</span
    >
    <span class="pp-label">{{ t('Celestial') }}</span>
  </button>
</template>
