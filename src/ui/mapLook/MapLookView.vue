<script setup>
/**
 * Map & Look: the Map, Look and Display tabs inside #pp-toggles, which the
 * Map destination hosts. The style tiles and the map-stack picker are views
 * of their owners' channels. The Display groups, the parameter panel and the
 * image adjustments keep their own wrappers (Cockpit's portal moves some of
 * them): the shell moves each wrapper once into an empty slot here, and this
 * view never renders children into a slot. The tab is view-local state the
 * shell holds; it is not persisted or shared.
 */
import { watch } from 'vue';
import TabList from '../primitives/TabList.vue';
import StyleTiles from './StyleTiles.vue';
import MapStackPicker from './MapStackPicker.vue';
import { t } from '../../i18n/index.js';

const props = defineProps({
  /** VisualSettings' view state (the Display views' channel). */
  state: { type: Object, default: null },
  /** The map-stack channel's state. */
  mapStack: { type: Object, default: null },
  tab: { type: String, default: 'look' },
  /** Bumped by the map-source controls' refresh: the picker re-renders. */
  pickerKey: { type: Number, default: 0 },
  /** The shared Display operations (setStyle). */
  actions: { type: Object, default: null },
  /** setTab, selectStack, openProviders. */
  mapActions: { type: Object, default: null },
  /** Whether Provider Settings works here (not in a prod build). */
  providers: { type: Boolean, default: false },
});
const tabs = () => [
  {
    value: 'map',
    label: t('Map'),
    id: 'map-look-map-tab',
    controls: 'map-look-map',
  },
  {
    value: 'look',
    label: t('Look'),
    id: 'map-look-look-tab',
    controls: 'map-look-look',
  },
  {
    value: 'display',
    label: t('HUD & overlays'),
    id: 'map-look-display-tab',
    controls: 'map-look-display',
  },
];
// A tab change that hides the panel holding focus (a style key or voice
// selecting Look from Display) hands focus to the newly selected tab, so the
// keyboard keeps its place. Checked before the panel hides; otherwise focus
// stays where it is.
watch(
  () => props.tab,
  (next, previous) => {
    const outgoing = document.getElementById(`map-look-${previous}`);
    if (!outgoing?.contains(document.activeElement)) return;
    document.getElementById(`map-look-${next}-tab`)?.focus();
  },
);
</script>

<template>
  <div class="map-look">
    <TabList
      :tabs="tabs()"
      :model-value="tab"
      :label="t('Map & Look')"
      @update:model-value="mapActions?.setTab?.($event)"
    />
    <section
      id="map-look-map"
      class="map-look-panel"
      role="tabpanel"
      aria-labelledby="map-look-map-tab"
      :hidden="tab !== 'map'"
    >
      <MapStackPicker
        :refresh-key="pickerKey"
        :map-stack="mapStack"
        :actions="mapActions"
      />
    </section>
    <section
      id="map-look-look"
      class="map-look-panel"
      role="tabpanel"
      aria-labelledby="map-look-look-tab"
      :hidden="tab !== 'look'"
    >
      <StyleTiles :style="state?.style ?? 'normal'" :actions="actions" />
      <div class="map-look-slot" data-map-look-slot="parameters"></div>
      <section
        class="map-look-adjustments"
        aria-labelledby="map-look-adjustments-title"
      >
        <h3 id="map-look-adjustments-title" class="map-look-heading">
          {{ t('Image adjustments') }}
        </h3>
        <div class="map-look-slot" data-map-look-slot="adjustments"></div>
      </section>
      <p class="map-look-hint">
        <svg
          class="map-look-hint-icon"
          viewBox="0 0 20 14"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="0.75" y="0.75" width="18.5" height="12.5" rx="2" />
          <path
            d="M4 4.5h1.5M7.5 4.5H9M11 4.5h1.5M14.5 4.5H16M4 7h1.5M7.5 7H9M11 7h1.5M14.5 7H16M6 9.75h8"
          />
        </svg>
        {{ t('Style shortcuts 1–6') }}
      </p>
    </section>
    <section
      id="map-look-display"
      class="map-look-panel"
      role="tabpanel"
      aria-labelledby="map-look-display-tab"
      :hidden="tab !== 'display'"
    >
      <div class="map-look-slot" data-map-look-slot="display"></div>
    </section>
    <button
      v-if="providers"
      type="button"
      class="map-look-providers"
      @click="mapActions?.openProviders?.()"
    >
      <span>{{ t('Configure map providers') }}</span>
      <svg
        class="map-look-providers-chevron"
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 3.5 10.5 8 6 12.5" />
      </svg>
    </button>
  </div>
</template>
