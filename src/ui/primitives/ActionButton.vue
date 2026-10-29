<script setup>
/**
 * Ordinary action: a native button on the
 * shared gev-action-button surface. The label is literal translated text (or
 * slot content); owners keep callbacks and disabled state.
 */
defineProps({
  label: { type: String, default: '' },
  /** 'default' | 'danger' */
  variant: { type: String, default: 'default' },
  /** 'default' | 'compact' */
  size: { type: String, default: 'default' },
  disabled: { type: Boolean, default: false },
});
defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    class="gev-action-button"
    :class="{
      'gev-action-button--danger': variant === 'danger',
      'gev-action-button--compact': size === 'compact',
    }"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot>{{ label }}</slot>
  </button>
</template>
