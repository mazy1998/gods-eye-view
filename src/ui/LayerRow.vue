<script setup>
import { ref, watch, nextTick } from 'vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
import LayerText from './LayerText.vue';
import DirectionsView from './DirectionsView.vue';
import { t } from '../i18n/index.js';
const props = defineProps({
  row: { type: Object, required: true },
  toggle: Function,
  chip: Function,
  listItem: Function,
  details: Function,
});
const expanded = ref(true);
const list = ref(null);
watch(
  () =>
    props.row.id === 'directions'
      ? null
      : props.row.controls?.list?.items?.find((item) => item.current)?.id,
  async () => {
    await nextTick();
    list.value
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  },
  { immediate: true },
);
</script>
<template>
  <div
    class="data-toggle-row"
    :class="{ 'data-toggle-row--count-line': row.countLine }"
    :data-layer-id="row.id"
    :data-layer-name="row.englishName"
  >
    <div class="data-toggle-top">
      <div class="data-toggle-left">
        <span class="data-icon" aria-hidden="true">{{ row.icon }}</span
        ><LayerText class="data-name" :text="row.name" />
      </div>
      <div class="data-toggle-right">
        <ToggleSwitch
          class="data-toggle-btn"
          :class="row.toggle.classes"
          :model-value="row.enabled"
          :label="row.toggle.stateText"
          :busy="row.toggle.busy"
          :aria-busy="String(row.toggle.busy)"
          :aria-disabled="String(row.toggle.blocked)"
          :aria-label="row.toggle.label"
          :title="row.toggle.title"
          :data-feed-state="row.toggle.feed"
          @update:model-value="toggle(row.id)"
        />
        <span
          v-if="!row.readout"
          class="data-count"
          :class="{ 'data-count-empty': row.count === '—' }"
          >{{ row.count }}</span
        >
        <button
          type="button"
          class="layer-details"
          :disabled="row.readout && !row.enabled"
          :aria-label="t('Details for {name}', { name: row.name })"
          :aria-controls="row.detailsPanel"
          :aria-expanded="row.detailsPanel ? undefined : String(expanded)"
          @click="
            row.detailsPanel
              ? details(row.detailsPanel)
              : (expanded = !expanded)
          "
        >
          <span aria-hidden="true">{{
            row.detailsPanel || !expanded ? '›' : '⌄'
          }}</span>
        </button>
      </div>
    </div>
    <DirectionsView
      v-if="row.id === 'directions'"
      :hosted="Boolean(row.detailsPanel)"
      :enabled="row.enabled"
      :toggle-state="row.toggle"
      :toggle="() => toggle(row.id)"
      :controls="row.controls"
      :summary="row.meta"
      :expanded="row.detailsPanel ? true : expanded"
      :chip="(id) => chip(row.id, id)"
      :list-item="(id) => listItem(row.id, id)"
    />
    <LayerText
      v-else
      class="data-toggle-meta"
      :text="row.meta"
      :hidden="!expanded"
    />
    <div
      v-if="row.id !== 'directions' && !row.readout"
      class="data-toggle-controls"
      :hidden="
        !expanded ||
        !row.controls ||
        !(
          row.controls.chips?.length ||
          row.controls.legend?.length ||
          row.controls.info
        )
      "
    >
      <button
        v-for="item in row.controls?.chips || []"
        :key="item.id"
        type="button"
        class="data-toggle-chip"
        :class="[
          `chip-${item.state || (item.active ? 'active' : 'idle')}`,
          { active: item.active },
        ]"
        :data-chip-id="item.id"
        :data-chip-color="item.color || undefined"
        :style="{ '--chip-color': item.color || undefined }"
        :disabled="Boolean(item.disabled)"
        :title="item.title || ''"
        :aria-pressed="String(Boolean(item.active))"
        :aria-busy="String(Boolean(item.busy))"
        @click="chip(row.id, item.id)"
      >
        {{ item.label }}
      </button>
      <span
        v-for="(item, index) in row.controls?.legend || []"
        :key="
          JSON.stringify([
            index,
            item.label,
            item.color,
            item.count,
            item.blurb,
          ])
        "
        class="data-toggle-legend-item"
        :title="item.blurb"
        ><span
          class="data-toggle-legend-swatch"
          :style="{ background: item.color }"
        ></span
        ><span
          >{{ item.label
          }}{{ item.count == null ? '' : ` ${item.countText}` }}</span
        ></span
      >
      <div
        class="data-toggle-controls-info"
        :hidden="!row.controls?.info"
        :title="row.controls?.infoTitle || ''"
      >
        {{ row.controls?.info }}
      </div>
    </div>
    <ol
      v-if="row.id !== 'directions' && !row.readout"
      ref="list"
      class="data-row-list"
      :hidden="!expanded || !row.controls?.list?.items?.length"
      :aria-label="row.controls?.list?.ariaLabel || ''"
    >
      <li
        v-for="item in row.controls?.list?.items || []"
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
          @click="listItem(row.id, item.id)"
        >
          <span class="data-row-list-lead">{{ item.lead }}</span
          ><span class="data-row-list-text">{{ item.text }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>
