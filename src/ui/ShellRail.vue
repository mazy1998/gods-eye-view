<script setup>
// The rail: one labelled button per drawer destination, a single tab stop
// that arrows move, and the open destination marked current.
import { ref } from 'vue';
import { t } from '../i18n/index.js';
import { DRAWER_DESTINATIONS } from './drawerNavigation.js';
import { nextSegmentValue, rovingStop } from './segmentedControl.js';

const props = defineProps({
  drawer: { type: Object, required: true },
  // The drawer's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
});
const list = ref(null);
// The brand mark at the top of the rail: a public file and the product's
// short name, which is never translated.
const LOGO = '/logo.svg';
const MARK = 'GEV';
const items = DRAWER_DESTINATIONS.map((destination) => ({
  ...destination,
  value: destination.id,
  // A destination with nothing to host yet waits for its port.
  disabled: !destination.panels.length && !destination.elements?.length,
}));

const tabStop = (item) =>
  item === rovingStop(items, props.state?.destination) ? 0 : -1;

function navigate(event, from) {
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const next = nextSegmentValue(
    items.filter((item) => !item.disabled).map((item) => item.value),
    from,
    event.key,
  );
  if (next === undefined) return;
  event.preventDefault();
  list.value?.querySelector(`[data-destination="${next}"]`)?.focus();
}
</script>

<template>
  <nav
    class="gev-rail gev-surface"
    :aria-label="t('Destinations')"
    :hidden="!state?.active"
  >
    <div class="gev-rail-mark" aria-hidden="true">
      <img class="gev-rail-mark-logo" :src="LOGO" alt="" />
      <span class="gev-rail-mark-name" translate="no">{{ MARK }}</span>
    </div>
    <!-- A toolbar announces that arrows move between its buttons. -->
    <div
      ref="list"
      class="gev-rail-items"
      role="toolbar"
      aria-orientation="vertical"
      :aria-label="t('Destinations')"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="gev-rail-item"
        :data-destination="item.id"
        :aria-current="state?.destination === item.id ? 'true' : undefined"
        :aria-expanded="String(state?.destination === item.id)"
        aria-controls="gev-drawer"
        :tabindex="tabStop(item)"
        :disabled="item.disabled"
        @click="
          props.drawer.toggle(item.id, { focusReturn: $event.currentTarget })
        "
        @keydown="navigate($event, item.id)"
      >
        <span
          class="gev-rail-icon material-symbols-outlined"
          aria-hidden="true"
          >{{ item.icon }}</span
        >
        <span class="gev-rail-label">{{ t(item.label) }}</span>
      </button>
    </div>
  </nav>
</template>
