<script setup>
// The header: the wordmark, search with the places tray beside it, the
// active-layer count, and the globe actions. The slots receive today's nodes
// (see shellChrome.js); the count reads the layer channel.
import { computed } from 'vue';
import { t, tn } from '../i18n/index.js';
import { useOwnerState } from './ownerState.js';

const props = defineProps({
  // LayerBindings.channel: the layers the Layers list shows, as plain data.
  layers: { type: Object, required: true },
  // The drawer's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
  // Keydown inside search, for the places tray's Escape (see the shell).
  onSearchKeydown: { type: Function, default: null },
});
const owner = useOwnerState(props.layers);
// The Layers footer's count: enabled layers the Layers list shows.
const count = computed(
  () =>
    (owner.value?.layers ?? []).filter(
      (layer) => layer.showInTogglePanel && layer.enabled,
    ).length,
);
</script>

<template>
  <header
    id="gev-header"
    class="gev-header gev-surface"
    :hidden="!state?.active"
  >
    <div id="gev-header-brand" class="gev-header-brand"></div>
    <div class="gev-header-center">
      <div
        id="gev-header-search"
        class="gev-header-search"
        role="search"
        :aria-label="t('Search places')"
        @keydown="onSearchKeydown?.($event)"
      ></div>
      <div id="gev-header-places" class="gev-header-places"></div>
    </div>
    <div class="gev-header-end">
      <span class="gev-header-count">{{
        tn(count, '{count} layer active', '{count} layers active')
      }}</span>
      <div id="gev-header-actions" class="gev-header-actions"></div>
    </div>
  </header>
</template>
