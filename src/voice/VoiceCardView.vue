<script setup>
/** The voice-card owner's presentation. Provider content is always text. */
import { computed } from 'vue';
import { t } from '../i18n/index.js';
import {
  initialVoiceCardState,
  voiceCardView,
} from './voiceCardPresentation.js';
const props = defineProps({ state: { type: Object, default: null } });
const view = computed(
  () =>
    props.state ?? {
      ...voiceCardView(initialVoiceCardState()),
      notesOpen: false,
    },
);
// i18n-ignore: product name
const ASSISTANT_NAME = 'GEV';
</script>

<template>
  <section
    id="gev-voice-card"
    class="gev-voice-card"
    :hidden="!view.visible"
    :data-busy="String(view.busy)"
    :aria-label="t('Voice assistant')"
  >
    <div class="gev-voice-card-header">
      <span class="gev-voice-card-kicker">{{ t('VOICE') }}</span>
      <span id="gev-voice-card-phase" class="gev-voice-card-phase">{{
        view.phase
      }}</span>
      <button
        id="gev-voice-card-dismiss"
        class="gev-voice-card-dismiss"
        type="button"
        :aria-label="t('Dismiss voice card')"
      >
        ×
      </button>
    </div>
    <p
      id="gev-voice-card-user"
      class="gev-voice-card-caption"
      data-role="user"
      :hidden="!view.user.visible"
    >
      <span id="gev-voice-card-user-who" class="gev-voice-card-who">{{
        view.user.label
      }}</span
      ><span id="gev-voice-card-user-text" class="gev-voice-card-text">{{
        view.user.text
      }}</span>
    </p>
    <p
      id="gev-voice-card-pointer"
      class="gev-voice-card-pointer"
      :hidden="!view.pointer.visible"
    >
      <span id="gev-voice-card-pointer-kind" class="gev-voice-card-who">{{
        view.pointer.kind
      }}</span
      ><span class="gev-voice-card-sr">: </span
      ><span
        id="gev-voice-card-pointer-text"
        class="gev-voice-card-pointer-label"
        >{{ view.pointer.text }}</span
      >
    </p>
    <p
      id="gev-voice-card-assistant"
      class="gev-voice-card-caption"
      data-role="assistant"
      :hidden="!view.assistant.visible"
    >
      <span class="gev-voice-card-who">{{ ASSISTANT_NAME }}</span
      ><span id="gev-voice-card-assistant-text" class="gev-voice-card-text">{{
        view.assistant.text
      }}</span>
    </p>
    <ol
      id="gev-voice-card-plan"
      class="gev-voice-card-plan"
      :aria-label="t('Plan')"
      :hidden="view.steps.length === 0"
    >
      <li
        v-for="step in view.steps"
        :key="step.key"
        class="gev-voice-card-step"
        :data-status="step.status"
      >
        <span class="gev-voice-card-step-label">{{ step.label }}</span
        ><span class="gev-voice-card-sr">{{
          step.statusText ? `, ${step.statusText}` : ''
        }}</span
        ><span v-if="step.detail" class="gev-voice-card-step-detail">{{
          step.detail
        }}</span>
      </li>
    </ol>
    <div
      id="gev-voice-card-result"
      class="gev-voice-card-result"
      :hidden="!view.result.visible"
    >
      <div id="gev-voice-card-result-title" class="gev-voice-card-result-title">
        {{ view.result.title }}
      </div>
      <div
        id="gev-voice-card-chips"
        class="gev-voice-card-chips"
        :hidden="view.result.chips.length === 0"
      >
        <span
          v-for="(chip, index) in view.result.chips"
          :key="index"
          class="gev-voice-card-chip"
          :data-tone="chip"
          >{{ chip }}</span
        >
      </div>
      <ul id="gev-voice-card-lines" class="gev-voice-card-lines">
        <li v-for="(line, index) in view.result.lines" :key="index">
          {{ line }}
        </li>
      </ul>
      <ol
        id="gev-voice-card-referents"
        class="gev-voice-card-referents"
        :aria-label="t('Referenced items')"
        :hidden="view.result.referents.length === 0"
      >
        <li v-for="ref in view.result.referents" :key="ref.n" :value="ref.n">
          {{ ref.label }}
        </li>
      </ol>
      <details
        id="gev-voice-card-notes"
        class="gev-voice-card-notes"
        :hidden="view.result.notes.length === 0"
        :open="view.notesOpen"
      >
        <summary>{{ t('NOTES & SOURCES') }}</summary>
        <ul id="gev-voice-card-note-list" class="gev-voice-card-lines">
          <li v-for="(note, index) in view.result.notes" :key="index">
            {{ note }}
          </li>
        </ul>
      </details>
    </div>
    <div
      id="gev-voice-card-live"
      class="gev-voice-card-sr"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ view.announce }}
    </div>
  </section>
</template>
