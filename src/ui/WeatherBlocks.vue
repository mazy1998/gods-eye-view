<script setup>
import { nextTick, watch } from 'vue';
import FilterChip from './primitives/FilterChip.vue';
import QuantitativeSlider from './primitives/QuantitativeSlider.vue';
import { formatScaleLabel, unitLabel } from './unitLabels.js';
import { t } from '../i18n/index.js';
const props = defineProps({
  blocks: { type: Array, default: () => [] },
  cardId: String,
  activate: Function,
  rangeInput: Function,
  rangeChange: Function,
});
const lists = new Map();
const listRef = (block, node) => {
  if (block.type !== 'list') return;
  if (node) lists.set(block.id, node);
  else lists.delete(block.id);
};
watch(
  () =>
    props.blocks
      .map((block) => block.list?.items?.find((item) => item.current)?.id)
      .join('|'),
  async () => {
    await nextTick();
    for (const node of lists.values())
      if (node.isConnected)
        node
          .querySelector('[aria-current="step"]')
          ?.scrollIntoView?.({ block: 'nearest' });
  },
  { immediate: true },
);
const colors = (legend) => {
  const values = legend?.colors || [];
  return values.length >= 2 &&
    values.every((color) => /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color))
    ? values
    : [];
};
const scale = (legend) => {
  if (!colors(legend).length) return '';
  const range = `${formatScaleLabel(legend.labels[0])} — ${formatScaleLabel(legend.labels.at(-1))}`;
  const units = unitLabel(legend.units);
  return units ? `${range}\u00a0${units}` : range;
};
const zero = (legend) =>
  colors(legend).length &&
  legend.units === '°C' &&
  Number.isInteger(legend.zeroIndex) &&
  legend.zeroIndex >= 0 &&
  legend.zeroIndex < legend.colors.length;
const lines = (block) => block.lines || [{ id: block.id, text: block.text }];
</script>
<template>
  <component
    v-for="block in blocks"
    :key="`${block.id}:${block.type}`"
    :is="
      block.type === 'list' ? 'ol' : block.type === 'actions' ? 'footer' : 'div'
    "
    :ref="(node) => listRef(block, node)"
    :class="block.type === 'list' ? 'data-row-list' : `rail-card-${block.type}`"
    :data-block-id="block.id"
    :hidden="
      block.type === 'list'
        ? !block.list?.items?.length
        : block.type === 'legend'
          ? !colors(block.legend).length
          : false
    "
    :aria-label="
      block.type === 'list' ? block.list?.ariaLabel || '' : undefined
    "
    :data-current-id="
      block.type === 'list'
        ? block.list?.items?.find((item) => item.current)?.id
        : undefined
    "
  >
    <template v-if="block.type === 'list'">
      <li
        v-for="item in block.list?.items || []"
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
          :disabled="item.disabled"
          :aria-current="item.current ? 'step' : 'false'"
          :aria-pressed="String(Boolean(item.active))"
          :title="String(item.text ?? '')"
          @click="activate(cardId, item)"
        >
          <span class="data-row-list-lead">{{ String(item.lead ?? '') }}</span
          ><span class="data-row-list-text">{{ String(item.text ?? '') }}</span>
        </button>
      </li>
    </template>
    <WeatherBlocks
      v-else-if="block.type === 'settings'"
      :blocks="
        (block.settings || []).map((setting) => ({
          ...setting,
          type: 'setting',
        }))
      "
      :card-id="cardId"
      :activate="activate"
      :range-input="rangeInput"
      :range-change="rangeChange"
    />
    <template v-else-if="block.type === 'setting'">
      <span class="rail-card-setting-label panel-title">{{ block.label }}</span>
      <div class="rail-card-chips" role="group" :aria-label="block.label">
        <FilterChip
          v-for="chip in block.chips || []"
          :key="chip.id"
          class="data-toggle-chip"
          :class="[
            `chip-${chip.state || (chip.active ? 'active' : 'idle')}`,
            { active: chip.active },
          ]"
          :label="chip.label"
          :model-value="Boolean(chip.active)"
          :disabled="chip.disabled"
          :title="chip.title || ''"
          :data-chip-id="chip.id"
          :data-chip-color="chip.color || undefined"
          :style="chip.color ? { '--chip-color': chip.color } : undefined"
          :aria-busy="String(Boolean(chip.busy))"
          @update:model-value="activate(cardId, chip)"
        />
      </div>
      <div class="rail-card-setting-range-row" :hidden="!block.range">
        <template v-if="block.range"
          ><span
            class="rail-card-setting-range-label"
            :hidden="!block.range.label"
            >{{ block.range.label || '' }}</span
          ><QuantitativeSlider
            class="rail-card-setting-range"
            :data-range-id="block.range.id || block.id"
            :min="Number(block.range.min)"
            :max="Number(block.range.max)"
            :step="Number(block.range.step)"
            :model-value="Number(block.range.value)"
            :disabled="block.range.disabled"
            :label="block.range.ariaLabel || block.label"
            :value-text="`${block.range.value}${block.range.unit || ''}`"
            @update:model-value="rangeInput(cardId, block.id, $event)"
            @change="rangeChange(cardId, block.id, $event.target.valueAsNumber)"
          /><span class="rail-card-setting-range-value">{{
            `${block.range.value}${block.range.unit || ''}`
          }}</span></template
        >
      </div>
    </template>
    <template v-else-if="block.type === 'legend'">
      <div
        class="rail-card-ramp"
        :hidden="!colors(block.legend).length || block.legend.categorical"
        :style="
          colors(block.legend).length
            ? `background: linear-gradient(to right, ${colors(block.legend).join(',')})`
            : ''
        "
      >
        <span
          class="rail-card-zero"
          aria-hidden="true"
          :hidden="!zero(block.legend)"
          :style="
            zero(block.legend)
              ? `left: ${(block.legend.zeroIndex / (block.legend.colors.length - 1)) * 100}%`
              : ''
          "
        ></span>
      </div>
      <div class="rail-card-scale" :hidden="block.legend.categorical">
        {{ scale(block.legend) }}
      </div>
      <div class="rail-card-legend-entries" :hidden="!block.legend.categorical">
        <div
          v-for="(color, index) in colors(block.legend)"
          :key="index"
          class="rail-card-legend-entry"
          :data-color="color"
        >
          <span
            class="rail-card-legend-swatch"
            :style="`background: ${color}`"
          ></span
          ><span>{{ block.legend.labels[index] || '' }}</span>
        </div>
      </div>
    </template>
    <template v-else-if="block.type === 'actions'">
      <template
        v-for="action in block.actions || []"
        :key="`${action.id}:${action.href ? 'link' : 'button'}`"
        ><component
          :is="action.href ? 'a' : 'button'"
          class="data-toggle-chip"
          :type="action.href ? undefined : 'button'"
          :data-action-id="action.id"
          :title="action.title || ''"
          :disabled="action.disabled"
          :href="action.href"
          :target="action.href ? '_blank' : undefined"
          :rel="action.href ? 'noopener' : undefined"
          @click="activate(cardId, action)"
          >{{ action.label }}</component
        ><span class="rail-card-action-hint" :hidden="!action.hint">{{
          action.hint || ''
        }}</span></template
      >
    </template>
    <template v-else-if="block.type === 'result'">
      <div class="rail-card-result-header">
        <span class="panel-title">{{ block.label }}</span
        ><button
          type="button"
          class="data-toggle-chip"
          data-action-id="clear"
          :hidden="!block.clear"
          :aria-label="t('Clear reading')"
          :title="t('Clear reading')"
          @click="activate(cardId, block.clear)"
        >
          {{ '×' }}
        </button>
      </div>
      <div class="rail-card-result-lines">
        <WeatherBlocks
          :blocks="[{ id: 'result-lines', type: 'lines', lines: block.lines }]"
          :card-id="cardId"
          :activate="activate"
          :range-input="rangeInput"
          :range-change="rangeChange"
        />
      </div>
    </template>
    <template v-else
      ><div
        v-for="line in lines(block)"
        :key="line.id"
        class="rail-card-line"
        :class="{ muted: line.muted }"
        :data-line-id="line.id"
      >
        {{ String(line.text ?? '') }}
      </div></template
    >
  </component>
</template>
