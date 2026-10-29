<script setup>
/**
 * On/off switch: a native button with role=switch and aria-checked. Without a
 * visible `label`, give it a name with aria-label or aria-labelledby. While
 * `busy` (an owner transition in flight) it stays focusable, reports
 * aria-busy and aria-disabled, and ignores activation; `disabled` is for
 * switches that cannot be used at all.
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const activate = () => {
  if (!props.busy) emit('update:modelValue', !props.modelValue);
};
</script>

<template>
  <button
    type="button"
    role="switch"
    class="gev-toggle"
    :aria-checked="String(modelValue)"
    :aria-busy="busy ? 'true' : undefined"
    :aria-disabled="busy ? 'true' : undefined"
    :disabled="disabled"
    @click="activate"
  >
    <span class="gev-toggle-track" aria-hidden="true">
      <span class="gev-toggle-thumb"></span>
    </span>
    <span v-if="label" class="gev-toggle-label">{{ label }}</span>
  </button>
</template>
