<script setup>
import { t } from '../../i18n/index.js';
import FirstRunAppearance from './FirstRunAppearance.vue';
defineProps({
  environmentalTitle: String,
  busy: Boolean,
  sticky: Boolean,
  status: String,
  // The mission Enter launches; the owner keeps one selected at all times.
  selected: { type: String, default: 'contacts' },
  // The appearance owner (src/ui/appearance.js), when the app has one.
  appearance: Object,
});
</script>
<template>
  <div class="first-run-scanline" aria-hidden="true"></div>
  <header class="first-run-header">
    <span class="first-run-kicker">{{
      t('MISSION CONTROL · FIRST LAUNCH')
    }}</span>
    <!-- A button, not just a hint: phones and tablets have no ESC key. It
           closes exactly as ESC does, for this session only. Touch screens
           see SKIP; a keyboard keeps the ESC hint (first-run.css). -->
    <button type="button" class="first-run-dismiss" data-first-run-dismiss>
      <span class="first-run-dismiss-key">{{ t('ESC · SKIP') }}</span>
      <span class="first-run-dismiss-touch">{{ t('SKIP') }}</span>
    </button>
  </header>
  <h2 id="first-run-title">{{ t("Welcome to God's Eye View") }}</h2>
  <!-- The second sentence is the card's one persuasive line, owner-authored and
         VERBATIM (2026-08-23) — including the unspaced em dash. The arc it has
         to carry: this looks like something you should not have access to →
         the sources are all public → the data is real. Tile subcopy stays
         purely functional. -->
  <p id="first-run-description">
    {{
      t(
        'A live 3D globe built from public data: aircraft, ships, satellites, cameras and more.',
      )
    }}
    <span class="first-run-line">{{
      t(
        'It feels like a forbidden cockpit—then you realize the sources are public and the data is real.',
      )
    }}</span>
  </p>
  <div class="first-run-body">
    <section class="first-run-section" aria-labelledby="first-run-view-heading">
      <h3 id="first-run-view-heading" class="first-run-section-heading">
        <span class="first-run-step">1</span>{{ t('Choose your first view') }}
      </h3>
      <!-- Native radios: arrow keys move the selection, and Enter (the button,
             the key on a focused card, or a double-click) launches it. -->
      <div
        class="first-run-choices"
        role="radiogroup"
        aria-labelledby="first-run-view-heading"
      >
        <label class="first-run-choice">
          <input
            type="radio"
            name="first-run-mission"
            value="contacts"
            :checked="selected === 'contacts'"
            :aria-disabled="String(busy)"
            data-first-run-choice="contacts"
          />
          <span class="first-run-preview" aria-hidden="true"
            ><span class="material-symbols-outlined">radar</span></span
          >
          <span class="first-run-choice-text"
            ><strong>{{ t('LIVE CONTACTS') }}</strong
            ><small>{{
              t('Aircraft, vessels and nearby intelligence')
            }}</small></span
          >
        </label>
        <label class="first-run-choice">
          <input
            type="radio"
            name="first-run-mission"
            value="space-missions"
            :checked="selected === 'space-missions'"
            :aria-disabled="String(busy)"
            data-first-run-choice="space-missions"
          />
          <span class="first-run-preview" aria-hidden="true"
            ><span class="material-symbols-outlined">rocket_launch</span></span
          >
          <span class="first-run-choice-text"
            ><strong>{{ t('SPACE MISSIONS') }}</strong
            ><small>{{
              t('Launches, spacecraft and orbital context')
            }}</small></span
          >
        </label>
        <label class="first-run-choice">
          <input
            type="radio"
            name="first-run-mission"
            value="environmental"
            :checked="selected === 'environmental'"
            :aria-disabled="String(busy)"
            data-first-run-choice="environmental"
          />
          <span class="first-run-preview" aria-hidden="true"
            ><span class="material-symbols-outlined"
              >local_fire_department</span
            ></span
          >
          <!-- Title text is painted from ENVIRONMENTAL_LABEL_CHOICE at init. -->
          <!-- Subcopy names BOTH feeds this tile turns on, because the launcher
                 optimizes for the fully configured experience (owner ruling,
                 2026-08-23) — see the mission table in src/firstRunExperience.js. -->
          <span class="first-run-choice-text"
            ><strong data-first-run-environmental-title>{{
              environmentalTitle
            }}</strong
            ><small>{{
              t('Live earthquakes and active fires, from USGS and NASA')
            }}</small></span
          >
        </label>
        <label class="first-run-choice">
          <input
            type="radio"
            name="first-run-mission"
            value="explore"
            :checked="selected === 'explore'"
            :aria-disabled="String(busy)"
            data-first-run-choice="explore"
          />
          <span class="first-run-preview" aria-hidden="true"
            ><span class="material-symbols-outlined">public</span></span
          >
          <span class="first-run-choice-text"
            ><strong>{{ t('EXPLORE MANUALLY') }}</strong
            ><small>{{ t('Begin with a clean globe') }}</small></span
          >
        </label>
      </div>
    </section>
    <FirstRunAppearance v-if="appearance" :appearance="appearance" />
    <section class="first-run-section" aria-labelledby="first-run-run-heading">
      <h3 id="first-run-run-heading" class="first-run-section-heading">
        {{ t('Run it your way') }}
      </h3>
      <div class="first-run-cards">
        <div class="first-run-card">
          <span class="first-run-card-icon" aria-hidden="true"
            ><span class="material-symbols-outlined">code</span></span
          >
          <span class="first-run-card-text"
            ><strong>{{ t('GEV Git source') }}</strong
            ><small>{{
              t('Open source. Self-host, fork, add a layer.')
            }}</small></span
          >
          <a
            class="first-run-card-link"
            href="https://github.com/bilawalsidhu/gods-eye-view"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('GITHUB')
            }}<span class="first-run-external" aria-hidden="true">↗</span></a
          >
        </div>
        <div class="first-run-card">
          <span class="first-run-card-icon" aria-hidden="true"
            ><span class="material-symbols-outlined">menu_book</span></span
          >
          <span class="first-run-card-text"
            ><strong>{{ t('Help & documentation') }}</strong
            ><small>{{
              t("Quick start, API keys and what's on the globe.")
            }}</small></span
          >
          <a
            class="first-run-card-link"
            href="https://github.com/bilawalsidhu/gods-eye-view#readme"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('README')
            }}<span class="first-run-external" aria-hidden="true">↗</span></a
          >
        </div>
      </div>
    </section>
    <section class="first-run-section" aria-labelledby="first-run-more-heading">
      <h3 id="first-run-more-heading" class="first-run-section-heading">
        {{ t('More from Halfpixel') }}
      </h3>
      <div class="first-run-cards">
        <a
          class="first-run-more"
          href="https://www.youtube.com/@bilawalsidhu"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="first-run-card-icon" aria-hidden="true"
            ><span class="material-symbols-outlined">play_arrow</span></span
          >
          <span class="first-run-card-text"
            ><strong>{{ t('Bilawal on YouTube') }}</strong
            ><small>{{ t('Build logs and demos') }}</small></span
          >
          <span class="first-run-external" aria-hidden="true">↗</span>
        </a>
        <a
          class="first-run-more"
          href="https://halfpixel.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="first-run-card-icon" aria-hidden="true"
            ><span class="material-symbols-outlined">language</span></span
          >
          <span class="first-run-card-text"
            ><strong>{{ t('halfpixel.ai') }}</strong
            ><small>{{ t('The studio behind GEV') }}</small></span
          >
          <span class="first-run-external" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
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
  <div class="first-run-footer">
    <label class="first-run-suppress">
      <input type="checkbox" data-first-run-suppress />
      <span>{{ t("Don't show this again") }}</span>
    </label>
    <p class="first-run-tip">
      {{ t('Tip: search for any place to fly straight to it.') }}
    </p>
    <button
      type="button"
      class="first-run-enter"
      :aria-disabled="String(busy)"
      data-first-run-enter
    >
      {{ t("ENTER GOD'S EYE VIEW")
      }}<span class="material-symbols-outlined" aria-hidden="true"
        >arrow_forward</span
      >
    </button>
  </div>
</template>
