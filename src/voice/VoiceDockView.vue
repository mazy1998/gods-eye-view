<script setup>
/**
 * The voice dock: status heading, mic button, visualizer, readout, help and
 * error trays, and (with a panel) the Preview / Settings popover. Pure
 * presentation of the voice dock owner; session, cost, provider, panel and
 * preference code own every value, listener and focus move. Two hosted
 * parts are deliberately static: the visualizer bars, which realtimeInput
 * drives every frame, and the reply card, which voiceCard.js owns.
 */
import { onMounted, ref } from 'vue';
import { t } from '../i18n/index.js';
import VoiceCardHost from './VoiceCardHost.vue';
import VoiceSettingsView from './VoiceSettingsView.vue';

defineProps({
  /** The voice dock owner's state. */
  state: { type: Object, required: true },
  /** Whether the dock has its Preview / Settings popover. */
  panel: { type: Boolean, default: false },
  dismissError: { type: Function, required: true },
});
const visualizer = ref(null);
// The visualizer's bars are never re-rendered; the analyser owns their style.
onMounted(() =>
  visualizer.value?.append(
    ...Array.from({ length: 15 }, (_, index) => {
      const bar = visualizer.value.ownerDocument.createElement('span');
      bar.setAttribute('style', `--bar:${index}`);
      return bar;
    }),
  ),
);
// A public file served as-is, not a module the SFC compiler should import.
const MIC_ICON = '/mic.svg';
// Before the panel first syncs, the tabs keep their initial markup.
const tabIndex = (state, view) =>
  state.panelView === null
    ? view === 'preview'
      ? undefined
      : '-1'
    : state.view === view
      ? '0'
      : '-1';
</script>

<template>
  <div
    id="gev-voice-control"
    class="gev-surface"
    :class="{ 'error-dismissed': state.errorDismissed }"
    :data-status="state.status"
    :data-speaker="state.speaker"
    :data-push-to-talk="state.pushToTalk ?? undefined"
    :data-microphone="state.microphone ?? undefined"
    :data-provider="state.provider ?? undefined"
    :data-provider-choice="state.providerChoice ?? undefined"
    :data-row-grace="state.rowGrace ? 'true' : undefined"
  >
    <label
      id="gev-voice-provider-field"
      class="gev-voice-provider-field"
      :hidden="!state.providerVisible"
    >
      <span>{{ t('Voice provider') }}</span>
      <select
        id="gev-voice-provider"
        :aria-label="t('Voice provider')"
        :title="state.providerTitle"
      >
        <option
          v-for="option in state.providers"
          :key="option.value"
          :value="option.value"
          :selected="option.value === state.providerValue"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <button
      v-if="panel"
      id="gev-voice-settings-button"
      class="gev-voice-settings-button"
      type="button"
      :aria-label="t('Voice Settings')"
      aria-controls="gev-voice-panel"
      :aria-expanded="String(state.open && state.view === 'settings')"
    >
      <span
        class="material-symbols-outlined gev-voice-settings-icon"
        aria-hidden="true"
        >settings</span
      >
    </button>
    <div class="gev-voice-heading">
      <div class="gev-voice-kicker">{{ t('AI AGENT') }}</div>
      <div id="gev-voice-status">{{ state.statusLabel }}</div>
      <span
        v-if="panel"
        id="gev-voice-cost-warning"
        class="gev-voice-cost-value gev-voice-cost-warning"
        :hidden="state.warningHidden"
        role="status"
        aria-live="polite"
        :title="state.warningTitle ?? undefined"
        :data-level="state.warningLevel ?? undefined"
        >{{ state.warningText }}</span
      >
      <div v-else class="gev-voice-cost">
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
    <button
      id="gev-voice-button"
      type="button"
      :aria-label="state.buttonLabel"
      :aria-pressed="state.buttonPressed ?? undefined"
      aria-describedby="gev-voice-help"
    >
      <span class="gev-mic-orbit"><img :src="MIC_ICON" alt="" /></span>
      <span class="gev-mic-label">{{ state.micLabel }}</span>
    </button>
    <!-- Bars are plain DOM added once: realtimeInput sets them every frame. -->
    <div ref="visualizer" class="gev-voice-visualizer" aria-hidden="true"></div>
    <div class="gev-voice-readout">
      <div id="gev-voice-detail" :title="state.detailTitle ?? undefined">
        {{ state.detail }}
      </div>
    </div>
    <div id="gev-voice-help" class="gev-voice-help-tray" role="tooltip">
      <span class="gev-voice-help-kicker">{{ t('VOICE CONTROL') }}</span>
      <span class="gev-voice-help-detail">{{ state.hint }}</span>
    </div>
    <section
      v-if="panel"
      id="gev-voice-panel"
      class="gev-voice-panel"
      :hidden="state.panelHidden"
      :data-view="state.panelView ?? undefined"
      :aria-label="t('Voice Settings')"
    >
      <div class="gev-voice-panel-header">
        <span class="gev-voice-panel-title">{{ t('VOICE') }}</span>
        <div
          class="gev-voice-panel-tabs"
          role="tablist"
          :aria-label="t('Voice Settings')"
        >
          <button
            id="gev-voice-preview-tab"
            class="gev-voice-panel-tab"
            type="button"
            role="tab"
            :aria-label="t('Preview')"
            :title="t('Preview')"
            :aria-selected="String(state.view === 'preview')"
            :tabindex="tabIndex(state, 'preview')"
            aria-controls="gev-voice-preview-panel"
          >
            <span
              class="material-symbols-outlined gev-voice-panel-tab-icon"
              aria-hidden="true"
              >visibility</span
            >
          </button>
          <button
            id="gev-voice-settings-tab"
            class="gev-voice-panel-tab"
            type="button"
            role="tab"
            :aria-label="t('Settings')"
            :title="t('Settings')"
            :aria-selected="String(state.view === 'settings')"
            :tabindex="tabIndex(state, 'settings')"
            aria-controls="gev-voice-settings-panel"
          >
            <span
              class="material-symbols-outlined gev-voice-panel-tab-icon"
              aria-hidden="true"
              >settings</span
            >
          </button>
        </div>
        <button
          id="gev-voice-settings-close"
          type="button"
          :aria-label="t('Close voice panel')"
        >
          ×
        </button>
      </div>
      <div class="gev-voice-panel-body">
        <section
          id="gev-voice-preview-panel"
          role="tabpanel"
          aria-labelledby="gev-voice-preview-tab"
          :hidden="state.previewHidden"
        >
          <p id="gev-voice-preview-empty" :hidden="state.previewEmptyHidden">
            {{ state.previewEmptyText }}
          </p>
          <VoiceCardHost />
        </section>
        <section
          id="gev-voice-settings-panel"
          role="tabpanel"
          aria-labelledby="gev-voice-settings-tab"
          :hidden="state.settingsHidden"
        >
          <VoiceSettingsView :state="state" />
        </section>
      </div>
    </section>
    <VoiceCardHost v-else />
    <div class="gev-voice-error-tray" role="alert" aria-live="assertive">
      <div class="gev-voice-error-header">
        <span>{{ t('VOICE SYSTEM ERROR') }}</span>
        <button
          class="gev-voice-error-dismiss"
          type="button"
          @click="dismissError()"
        >
          {{ t('DISMISS') }}
        </button>
      </div>
      <div id="gev-voice-error-detail">{{ state.errorDetail }}</div>
      <div class="gev-voice-error-hint">
        {{
          t('Check microphone permission and network access, then try again.')
        }}
      </div>
    </div>
  </div>
</template>
