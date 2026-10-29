<script setup>
/**
 * Native numeric input. It emits the raw input
 * text on `change` (or on every `input` when `live`); owners keep parsing,
 * bounds policy, drafts and commit timing.
 */
const props = defineProps({
  modelValue: { type: [Number, String], default: undefined },
  min: { type: [Number, String], default: undefined },
  max: { type: [Number, String], default: undefined },
  step: { type: [Number, String], default: undefined },
  disabled: { type: Boolean, default: false },
  /** 'default' | 'compact' | 'inline' */
  density: { type: String, default: 'default' },
  live: { type: Boolean, default: false },
  /** Accessible name, already translated. */
  label: { type: String, default: undefined },
});
const emit = defineEmits(['update:modelValue']);
const commit = (event, live) => {
  if (live === props.live) emit('update:modelValue', event.target.value);
};
</script>

<template>
  <input
    type="number"
    class="gev-field"
    :class="density !== 'default' && `gev-field--${density}`"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :aria-label="label"
    @input="commit($event, true)"
    @change="commit($event, false)"
  />
</template>
