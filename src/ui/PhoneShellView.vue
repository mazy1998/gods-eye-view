<script setup>
import { computed } from 'vue';
import { t } from '../i18n/index.js';
import { MOBILE_TABS, MOBILE_MORE_DESTINATIONS } from './phoneDestinations.js';
import IconButton from './primitives/IconButton.vue';
import FilterChip from './primitives/FilterChip.vue';
import AppearancePicker from './settings/AppearancePicker.vue';
import SettingsView from './settings/SettingsView.vue';
const props = defineProps({
  state: Object,
  actions: Object,
  appearance: Object,
  settingsSurface: Object,
});
const title = computed(() =>
  props.state.sheet === 'more'
    ? MOBILE_MORE_DESTINATIONS.find(
        (item) => item.id === props.state.destination,
      )?.label
    : MOBILE_TABS.find((item) => item.sheet === props.state.sheet)?.label,
);
</script>
<template>
  <div class="gev-phone-shell" :hidden="!state.active">
    <div
      id="mobile-sheet-backdrop"
      :hidden="!state.sheet"
      @click="actions.close"
    />
    <section
      id="mobile-sheet"
      class="phone-sheet gev-surface"
      :hidden="!state.sheet"
      :aria-label="title ? t(title) : undefined"
    >
      <header class="phone-sheet-header">
        <h2>{{ title ? t(title) : '' }}</h2>
        <IconButton :label="t('Close')" size="sm" @click="actions.close"
          ><span class="material-symbols-outlined">close</span></IconButton
        >
      </header>
      <nav
        v-if="state.sheet === 'more'"
        class="phone-more-destinations"
        :aria-label="t('More')"
      >
        <FilterChip
          v-for="item in MOBILE_MORE_DESTINATIONS"
          :key="item.id"
          :label="t(item.label)"
          :model-value="state.destination === item.id"
          :data-mobile-destination="item.id"
          :disabled="state.playback && item.id !== 'stories'"
          @update:model-value="actions.destination(item.id)"
        />
      </nav>
      <div class="phone-sheet-scroll">
        <SettingsView
          v-if="
            settingsSurface &&
            state.active &&
            state.sheet === 'more' &&
            state.destination === 'settings'
          "
          :surface="settingsSurface"
          :appearance="appearance"
        />
        <AppearancePicker
          v-if="
            !settingsSurface &&
            appearance &&
            state.active &&
            state.sheet === 'more' &&
            state.destination === 'settings'
          "
          :appearance="appearance"
        />
        <div id="mobile-sheet-panels" />
      </div>
    </section>
    <nav
      id="mobile-tab-bar"
      :aria-label="t('Panels')"
      :aria-hidden="String(!state.active)"
    >
      <button
        v-for="tab in MOBILE_TABS"
        :key="tab.sheet"
        type="button"
        class="mobile-tab"
        :data-mobile-sheet="tab.sheet"
        :disabled="state.playback && tab.sheet !== 'more'"
        :aria-expanded="String(state.sheet === tab.sheet)"
        aria-controls="mobile-sheet"
        @click="actions.tab(tab.sheet)"
      >
        <span
          class="material-symbols-outlined mobile-tab-icon"
          aria-hidden="true"
          >{{ tab.icon }}</span
        >
        <span class="mobile-tab-label">{{ t(tab.label) }}</span>
      </button>
    </nav>
  </div>
</template>
