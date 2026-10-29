<script setup>
/**
 * Icon-only native button. `label` is its accessible name and tooltip; the
 * icon comes from the slot and is hidden from assistive technology. A boolean `pressed`
 * makes it a toggle button (aria-pressed); leave it unset for plain actions.
 */
defineProps({
  label: { type: String, required: true },
  pressed: { type: Boolean, default: undefined },
  /** 'md' (40px) | 'sm' (32px) */
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
});
defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    class="gev-icon-button"
    :class="{ 'gev-icon-button--sm': size === 'sm' }"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed === undefined ? undefined : String(pressed)"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span aria-hidden="true"><slot /></span>
  </button>
</template>
