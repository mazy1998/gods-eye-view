<script setup>
/**
 * The voice reply card's stable markup. Rendered once and never patched:
 * VoiceCardControls (voiceCard.js) owns everything inside it. Its own port
 * is a later step (S20b).
 */
import { t } from '../i18n/index.js';

// The assistant's name on its card. i18n-ignore: product name
const ASSISTANT_NAME = 'GEV';
</script>

<template>
  <section
    v-once
    id="gev-voice-card"
    class="gev-voice-card"
    hidden
    :aria-label="t('Voice assistant')"
  >
    <div class="gev-voice-card-header">
      <span class="gev-voice-card-kicker">{{ t('VOICE') }}</span>
      <span id="gev-voice-card-phase" class="gev-voice-card-phase"></span>
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
      hidden
    >
      <span id="gev-voice-card-user-who" class="gev-voice-card-who">{{
        t('YOU')
      }}</span
      ><span id="gev-voice-card-user-text" class="gev-voice-card-text"></span>
    </p>
    <p id="gev-voice-card-pointer" class="gev-voice-card-pointer" hidden>
      <span id="gev-voice-card-pointer-kind" class="gev-voice-card-who">{{
        t('THIS')
      }}</span
      ><span class="gev-voice-card-sr">: </span
      ><span
        id="gev-voice-card-pointer-text"
        class="gev-voice-card-pointer-label"
      ></span>
    </p>
    <p
      id="gev-voice-card-assistant"
      class="gev-voice-card-caption"
      data-role="assistant"
      hidden
    >
      <span class="gev-voice-card-who">{{ ASSISTANT_NAME }}</span
      ><span
        id="gev-voice-card-assistant-text"
        class="gev-voice-card-text"
      ></span>
    </p>
    <ol
      id="gev-voice-card-plan"
      class="gev-voice-card-plan"
      :aria-label="t('Plan')"
      hidden
    ></ol>
    <div id="gev-voice-card-result" class="gev-voice-card-result" hidden>
      <div
        id="gev-voice-card-result-title"
        class="gev-voice-card-result-title"
      ></div>
      <div id="gev-voice-card-chips" class="gev-voice-card-chips" hidden></div>
      <ul id="gev-voice-card-lines" class="gev-voice-card-lines"></ul>
      <ol
        id="gev-voice-card-referents"
        class="gev-voice-card-referents"
        :aria-label="t('Referenced items')"
        hidden
      ></ol>
      <details id="gev-voice-card-notes" class="gev-voice-card-notes" hidden>
        <summary>{{ t('NOTES & SOURCES') }}</summary>
        <ul id="gev-voice-card-note-list" class="gev-voice-card-lines"></ul>
      </details>
    </div>
    <div
      id="gev-voice-card-live"
      class="gev-voice-card-sr"
      aria-live="polite"
      aria-atomic="true"
    ></div>
  </section>
</template>
