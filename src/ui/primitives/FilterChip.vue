<script setup>
/**
 * Compact pressable chip for filters and quick choices: a native button with
 * aria-pressed. Read-only labels use StatusBadge instead.
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <button
    type="button"
    class="gev-chip"
    :aria-pressed="String(modelValue)"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span v-if="$slots.icon" class="gev-chip-icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    {{ label }}
  </button>
</template>
