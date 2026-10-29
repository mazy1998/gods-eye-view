<script setup>
/** Display → Scope: the circular viewport mask and its edge feather. */
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { displayDefaults } from './displayDefaults.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const scope = computed(() => (props.state ?? displayDefaults).scope);
const act = (name, ...args) => props.actions?.[name]?.(...args);
</script>

<template>
  <label
    class="pp-toggle-btn pp-scope-toggle"
    :title="t('Scope — the circular viewport mask')"
  >
    <span class="pp-icon material-symbols-outlined" aria-hidden="true"
      >adjust</span
    >
    <span class="pp-label">{{ t('Scope') }}</span>
    <input
      type="checkbox"
      id="scope-toggle"
      :checked="scope.enabled"
      @change="act('setScopeEnabled', $event.target.checked)"
    />
  </label>
  <div class="pp-slider-row visible" id="scope-slider-row">
    <span class="pp-slider-mini-label">{{ t('Feather') }}</span>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      id="scope-feather-slider"
      min="0"
      max="200"
      :value="scope.featherPct"
      :disabled="!scope.enabled"
      :aria-label="t('Scope edge feather')"
      :title="t('Scope edge feather as a percentage of the keyhole radius')"
      @input="act('setScopeFeather', parseInt($event.target.value, 10))"
    />
    <span class="pp-slider-value" id="scope-feather-value">{{
      `${scope.featherPct}%`
    }}</span>
  </div>
</template>
