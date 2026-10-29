<script setup>
/**
 * One-of-many selector with the segmentedControl.js contract. Controlled: it
 * renders `modelValue` and emits `update:modelValue` only on user action, so a
 * restored value never emits. `keyboard` keeps each group's policy: 'none'
 * (click only, native tab order), 'arrows', or 'radio' (arrows plus Home/End);
 * the latter two move focus with the selection and use a roving tab stop.
 */
import { ref } from 'vue';
import { nextSegmentValue, rovingStop } from '../segmentedControl.js';

const props = defineProps({
  modelValue: { type: null, default: undefined },
  /** [{ value, label, disabled?, title? }] with labels already translated. */
  options: { type: Array, required: true },
  /** 'none' | 'arrows' | 'radio' */
  keyboard: { type: String, default: 'radio' },
  /** Accessible name of the group. */
  label: { type: String, default: undefined },
});
const emit = defineEmits(['update:modelValue']);
const group = ref(null);

const tabStop = (option) => {
  if (props.keyboard === 'none') return undefined;
  return option === rovingStop(props.options, props.modelValue) ? 0 : -1;
};

function navigate(event, from) {
  if (props.keyboard === 'none') return;
  const enabled = props.options.filter((option) => !option.disabled);
  const next = nextSegmentValue(
    enabled.map((option) => option.value),
    from,
    event.key,
    { homeEnd: props.keyboard === 'radio' },
  );
  if (next === undefined) return;
  event.preventDefault();
  const index = props.options.findIndex((option) => option.value === next);
  group.value?.children[index]?.focus();
  if (next !== props.modelValue) emit('update:modelValue', next);
}
</script>

<template>
  <div ref="group" class="gev-segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="gev-segment"
      role="radio"
      :aria-checked="String(option.value === modelValue)"
      :tabindex="tabStop(option)"
      :disabled="option.disabled"
      :title="option.title"
      @click="emit('update:modelValue', option.value)"
      @keydown="navigate($event, option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
