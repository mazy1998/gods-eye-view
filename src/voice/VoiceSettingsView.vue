<script setup>
/**
 * The voice settings pane: Show Preview, the inactivity timeout, and the
 * model tier and session cost. Pure presentation of the voice dock owner;
 * the preference binding and RealtimeCost own every value and listener.
 */
import { onMounted, ref, watch } from 'vue';
import { t, tn } from '../i18n/index.js';

const props = defineProps({
  /** The voice dock owner's state. */
  state: { type: Object, required: true },
});
const PRESET_MINUTES = [3, 5, 10, 15];
// The minutes field is uncontrolled: it takes the owner's text when that text
// changes, never on other repaints (cost ticks, status), so a value the field
// holds is still there when its change commits.
const minutes = ref(null);
const showMinutes = () => {
  if (minutes.value) minutes.value.value = props.state.customText;
};
onMounted(showMinutes);
watch(() => props.state.customText, showMinutes, { flush: 'sync' });
</script>

<template>
  <label class="gev-voice-preference gev-voice-preference-toggle"
    ><input
      id="gev-voice-preview-enabled"
      type="checkbox"
      :checked="state.previewChecked"
      aria-describedby="gev-voice-preview-note"
    /><span>{{ t('Show Voice Preview') }}</span></label
  >
  <p id="gev-voice-preview-note" class="gev-voice-settings-note">
    {{ state.previewNote }}
  </p>
  <div class="gev-voice-timeout-group">
    <label
      class="gev-voice-preference gev-voice-setting-title"
      for="gev-voice-timeout-select"
      >{{ t('Voice inactivity timeout') }}</label
    >
    <div class="gev-voice-timeout-controls">
      <select
        id="gev-voice-timeout-select"
        aria-describedby="gev-voice-timeout-note gev-voice-timeout-status"
      >
        <option
          v-for="minutes in PRESET_MINUTES"
          :key="minutes"
          :value="String(minutes)"
          :selected="state.timeoutValue === String(minutes)"
        >
          {{ tn(minutes, '{count} minute', '{count} minutes') }}
        </option>
        <option value="custom" :selected="state.timeoutValue === 'custom'">
          {{ t('Custom') }}
        </option>
        <option value="0" :selected="state.timeoutValue === '0'">
          {{ t('None') }}
        </option>
      </select>
      <label class="gev-voice-timeout-unit" for="gev-voice-timeout-input">{{
        t('Minutes')
      }}</label>
      <input
        id="gev-voice-timeout-input"
        type="number"
        min="1"
        max="60"
        step="1"
        value="5"
        ref="minutes"
        :hidden="state.customHidden"
        aria-describedby="gev-voice-timeout-note"
      />
    </div>
    <p id="gev-voice-timeout-note" class="gev-voice-settings-note">
      {{ state.timeoutNote }}
    </p>
    <p
      id="gev-voice-timeout-status"
      class="gev-voice-settings-note"
      role="status"
      aria-live="polite"
    >
      {{ state.timeoutStatus }}
    </p>
  </div>
  <div class="gev-voice-cost-settings">
    <div class="gev-voice-cost-setting-row">
      <span>{{ t('Voice model tier — applies next session') }}</span>
      <button
        id="gev-voice-tier"
        class="gev-voice-tier-btn"
        type="button"
        :aria-pressed="String(state.tierPressed)"
        :title="state.tierTitle"
        :hidden="state.tierHidden"
      >
        {{ state.tierLabel }}
      </button>
    </div>
    <div class="gev-voice-cost-setting-row">
      <span>{{ t('Estimated session cost') }}</span>
      <span
        id="gev-voice-cost-value"
        class="gev-voice-cost-value"
        :data-level="state.costLevel"
        :title="state.costTitle"
        :hidden="state.costHidden"
        >{{ state.costText }}</span
      >
    </div>
  </div>
</template>
