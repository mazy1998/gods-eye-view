<script setup>
import { t } from '../../i18n/index.js';
defineProps({
  environmentalTitle: String,
  busy: Boolean,
  sticky: Boolean,
  status: String,
});
</script>
<template>
  <div class="first-run-scanline" aria-hidden="true"></div>
  <header class="first-run-header">
    <span class="first-run-kicker">{{
      t('MISSION CONTROL · FIRST LAUNCH')
    }}</span>
  </header>
  <h2 id="first-run-title">{{ t('Choose your first view') }}</h2>
  <!-- The card's one persuasive line, owner-authored and VERBATIM (2026-08-23)
         — including the unspaced em dash. The arc it has to carry: this looks
         like something you should not have access to → the sources are all
         public → the data is real. Tile subcopy stays purely functional. -->
  <p id="first-run-description">
    {{
      t(
        'It feels like a forbidden cockpit—then you realize the sources are public and the data is real.',
      )
    }}
  </p>
  <div class="first-run-choices">
    <button
      type="button"
      :aria-disabled="String(busy)"
      data-first-run-choice="contacts"
    >
      <span class="material-symbols-outlined" aria-hidden="true">radar</span>
      <span
        ><strong>{{ t('LIVE CONTACTS') }}</strong
        ><small>{{
          t('Aircraft, vessels and nearby intelligence')
        }}</small></span
      >
      <span class="material-symbols-outlined first-run-arrow" aria-hidden="true"
        >arrow_forward</span
      >
    </button>
    <button
      type="button"
      :aria-disabled="String(busy)"
      data-first-run-choice="space-missions"
    >
      <span class="material-symbols-outlined" aria-hidden="true"
        >rocket_launch</span
      >
      <span
        ><strong>{{ t('SPACE MISSIONS') }}</strong
        ><small>{{
          t('Launches, spacecraft and orbital context')
        }}</small></span
      >
      <span class="material-symbols-outlined first-run-arrow" aria-hidden="true"
        >arrow_forward</span
      >
    </button>
    <button
      type="button"
      :aria-disabled="String(busy)"
      data-first-run-choice="environmental"
    >
      <span class="material-symbols-outlined" aria-hidden="true"
        >local_fire_department</span
      >
      <!-- Title text is painted from ENVIRONMENTAL_LABEL_CHOICE at init. -->
      <!-- Subcopy names BOTH feeds this tile turns on, because the launcher
             optimizes for the fully configured experience (owner ruling,
             2026-08-23) — see the mission table in src/firstRunExperience.js. -->
      <span
        ><strong data-first-run-environmental-title>{{
          environmentalTitle
        }}</strong
        ><small>{{
          t('Live earthquakes and active fires, from USGS and NASA')
        }}</small></span
      >
      <span class="material-symbols-outlined first-run-arrow" aria-hidden="true"
        >arrow_forward</span
      >
    </button>
    <button
      type="button"
      class="first-run-explore"
      :aria-disabled="String(busy)"
      data-first-run-choice="explore"
    >
      <span class="material-symbols-outlined" aria-hidden="true">public</span>
      <span
        ><strong>{{ t('EXPLORE MANUALLY') }}</strong
        ><small>{{ t('Begin with a clean globe') }}</small></span
      >
      <span class="material-symbols-outlined first-run-arrow" aria-hidden="true"
        >arrow_forward</span
      >
    </button>
  </div>
  <div class="first-run-footer">
    <label class="first-run-suppress">
      <input type="checkbox" data-first-run-suppress />
      <span>{{ t("Don't show this again") }}</span>
    </label>
    <!-- A button, not just a hint: phones and tablets have no ESC key. It
           closes exactly as ESC does, for this session only. Touch screens
           see DISMISS; a keyboard keeps the ESC hint (first-run.css). -->
    <button type="button" class="first-run-dismiss" data-first-run-dismiss>
      <span class="first-run-dismiss-key">{{ t('ESC to dismiss') }}</span>
      <span class="first-run-dismiss-touch">{{ t('DISMISS') }}</span>
    </button>
  </div>
  <!-- Kept out of the footer row: it swaps to mission progress and errors, and
         a live region that also holds layout makes the row jump as it speaks. -->
  <p
    class="first-run-note"
    :data-sticky="sticky || undefined"
    data-first-run-status
    role="status"
    aria-live="polite"
  >
    {{ status }}
  </p>
</template>
