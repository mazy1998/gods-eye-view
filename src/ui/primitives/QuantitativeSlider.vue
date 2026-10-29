<script setup>
/**
 * Native range input on the shared gev-quantitative-slider surface. The browser
 * keeps keyboard, pointer, bounds and step behaviour; every input emits the
 * numeric value, and owners decide when to apply it.
 */
defineProps({
  modelValue: { type: Number, default: undefined },
  min: { type: [Number, String], default: undefined },
  max: { type: [Number, String], default: undefined },
  step: { type: [Number, String], default: undefined },
  disabled: { type: Boolean, default: false },
  /** Accessible name and spoken value, already translated. */
  label: { type: String, default: undefined },
  valueText: { type: String, default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <input
    type="range"
    class="gev-quantitative-slider"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :aria-label="label"
    :aria-valuetext="valueText"
    @input="$emit('update:modelValue', $event.target.valueAsNumber)"
  />
</template>
