<script setup>
/**
 * Tab list with a roving tab stop: arrows along its orientation move and
 * select (wrapping, skipping disabled tabs), Home/End jump. Owners render the
 * panels and link them with each tab's `controls` id. Controlled, like the
 * segmented control.
 */
import { ref } from 'vue';
import { nextSegmentValue, rovingStop } from '../segmentedControl.js';

const props = defineProps({
  modelValue: { type: null, default: undefined },
  /** [{ value, label, id?, controls?, disabled? }] with labels translated. */
  tabs: { type: Array, required: true },
  /** Accessible name of the list. */
  label: { type: String, default: undefined },
  /** 'horizontal' (Left/Right) | 'vertical' (Up/Down) */
  orientation: { type: String, default: 'horizontal' },
});
const CROSS_AXIS = {
  horizontal: ['ArrowUp', 'ArrowDown'],
  vertical: ['ArrowLeft', 'ArrowRight'],
};
const emit = defineEmits(['update:modelValue']);
const list = ref(null);

const tabStop = (tab) =>
  tab === rovingStop(props.tabs, props.modelValue) ? 0 : -1;

function navigate(event, from) {
  if (CROSS_AXIS[props.orientation]?.includes(event.key)) return;
  const next = nextSegmentValue(
    props.tabs.filter((tab) => !tab.disabled).map((tab) => tab.value),
    from,
    event.key,
  );
  if (next === undefined) return;
  event.preventDefault();
  list.value?.children[
    props.tabs.findIndex((tab) => tab.value === next)
  ]?.focus();
  if (next !== props.modelValue) emit('update:modelValue', next);
}
</script>

<template>
  <div
    ref="list"
    class="gev-tabs"
    role="tablist"
    :aria-label="label"
    :aria-orientation="orientation === 'vertical' ? 'vertical' : undefined"
  >
    <button
      v-for="tab in tabs"
      :id="tab.id"
      :key="String(tab.value)"
      type="button"
      class="gev-tab"
      role="tab"
      :aria-selected="String(tab.value === modelValue)"
      :aria-controls="tab.controls"
      :tabindex="tabStop(tab)"
      :disabled="tab.disabled"
      @click="emit('update:modelValue', tab.value)"
      @keydown="navigate($event, tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
