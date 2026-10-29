<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import LayerText from './LayerText.vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
import { t } from '../i18n/index.js';

const props = defineProps({
  controls: Object,
  summary: { type: String, default: '' },
  expanded: { type: Boolean, default: true },
  chip: Function,
  listItem: Function,
  hosted: Boolean,
  enabled: Boolean,
  toggleState: Object,
  toggle: Function,
});
const list = ref(null);
const root = ref(null);
let live = true;
onBeforeUnmount(() => {
  live = false;
  // The drawer may have borrowed this root outside its Vue parent's DOM.
  root.value?.remove();
});
const chooseChip = (id) => {
  if (live) props.chip?.(id);
};
const chooseStep = (id) => {
  if (live) props.listItem?.(id);
};
const toggleLayer = () => {
  if (live && !props.toggleState?.blocked) props.toggle?.();
};
watch(
  () => props.controls?.list?.items?.find((item) => item.current)?.id,
  async () => {
    await nextTick();
    if (live)
      list.value
        ?.querySelector('[aria-current="step"]')
        ?.scrollIntoView?.({ block: 'nearest' });
  },
  { immediate: true },
);
</script>
<template>
  <section
    ref="root"
    id="directions-controls-body"
    class="directions-view gev-surface"
    :class="{ 'directions-view--hosted': hosted }"
    :tabindex="hosted ? -1 : undefined"
    :aria-label="t('Directions')"
  >
    <header v-if="hosted" class="directions-header gev-tools-header">
      <svg
        class="gev-tools-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="6" r="3" />
        <path d="M6 15V8a2 2 0 0 1 2-2h2m-1 12h7a2 2 0 0 0 2-2v-3" />
      </svg>
      <h3 class="gev-tools-title">{{ t('Directions') }}</h3>
      <ToggleSwitch
        class="gev-tools-route-toggle"
        :model-value="enabled"
        :label="toggleState?.stateText"
        :busy="toggleState?.busy"
        :aria-label="toggleState?.label || t('Directions')"
        :aria-busy="String(Boolean(toggleState?.busy))"
        :aria-disabled="String(Boolean(toggleState?.blocked))"
        :title="toggleState?.title"
        @update:model-value="toggleLayer()"
      />
    </header>
    <LayerText class="data-toggle-meta" :text="summary" :hidden="!expanded" />
    <div
      class="data-toggle-controls"
      :hidden="!expanded || !controls?.chips?.length"
    >
      <button
        v-for="item in controls?.chips || []"
        :key="item.id"
        type="button"
        class="data-toggle-chip"
        :class="[
          `chip-${item.state || (item.active ? 'active' : 'idle')}`,
          { active: item.active },
        ]"
        :data-chip-id="item.id"
        :disabled="Boolean(item.disabled)"
        :title="item.title || ''"
        :aria-label="item.id === 'swap' ? item.title : undefined"
        :aria-pressed="String(Boolean(item.active))"
        :aria-busy="String(Boolean(item.busy))"
        @click="chooseChip(item.id)"
      >
        {{ item.label }}
      </button>
    </div>
    <ol
      ref="list"
      class="data-row-list"
      :hidden="!expanded || !controls?.list?.items?.length"
      :aria-label="controls?.list?.ariaLabel || ''"
    >
      <li
        v-for="item in controls?.list?.items || []"
        :key="item.id"
        :data-list-item-id="item.id"
      >
        <button
          type="button"
          class="data-row-list-item"
          :class="{
            note: item.disabled,
            active: item.active,
            current: item.current,
          }"
          :data-list-item-id="item.id"
          :disabled="Boolean(item.disabled)"
          :aria-current="item.current ? 'step' : 'false'"
          :aria-pressed="String(Boolean(item.active))"
          :title="item.text"
          @click="chooseStep(item.id)"
        >
          <span class="data-row-list-lead">{{ item.lead }}</span
          ><span class="data-row-list-text">{{ item.text }}</span>
        </button>
      </li>
    </ol>
  </section>
</template>
