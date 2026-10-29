<script setup>
/**
 * Display → 3D aircraft: on/off and coverage (Proximity / All). Renders inside
 * its group wrapper, which Cockpit's portal moves as a whole. 3D aircraft is
 * default-on in Proximity (2026-08-22), so the defaults ship lit.
 */
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { msg } from '../../i18n/marker.js';
import { displayDefaults } from './displayDefaults.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const models = computed(
  () => (props.state ?? displayDefaults).models3d ?? displayDefaults.models3d,
);
const act = (name, ...args) => props.actions?.[name]?.(...args);
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{ active: models.enabled }"
    id="models3d-toggle"
    :aria-pressed="String(models.enabled)"
    :title="t('3D aircraft — flat icons zoomed out, 3D models up close')"
    @click="act('toggleModels')"
  >
    <span class="pp-icon">✈</span>
    <span class="pp-label">3D</span>
  </button>
  <div
    class="pp-slider-row"
    :class="{ visible: models.enabled }"
    id="models3d-mode-row"
  >
    <span class="pp-slider-mini-label">{{ t('Models') }}</span>
    <div
      class="gev-segmented pp-mode-seg"
      role="radiogroup"
      :aria-label="t('3D model coverage')"
    >
      <button
        v-for="[value, text] in [
          ['proximity', msg('Proximity')],
          ['all', msg('All')],
        ]"
        :key="value"
        class="gev-segment pp-mode-btn"
        :class="{ active: models.mode === value }"
        :id="`models3d-mode-${value}`"
        :data-mode="value"
        role="radio"
        :aria-checked="String(models.mode === value)"
        @click="act('setModelsMode', value)"
      >
        {{ t(text) }}
      </button>
    </div>
  </div>
</template>
