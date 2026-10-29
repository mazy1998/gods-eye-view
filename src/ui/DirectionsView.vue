<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import LayerText from './LayerText.vue';
import { t } from '../i18n/index.js';

const props = defineProps({
  controls: Object,
  summary: { type: String, default: '' },
  expanded: { type: Boolean, default: true },
  chip: Function,
  listItem: Function,
});
const list = ref(null);
let live = true;
onBeforeUnmount(() => {
  live = false;
});
const chooseChip = (id) => {
  if (live) props.chip?.(id);
};
const chooseStep = (id) => {
  if (live) props.listItem?.(id);
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
    id="directions-controls-body"
    class="directions-view gev-surface"
    :aria-label="t('Directions')"
  >
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
