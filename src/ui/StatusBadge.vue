<script setup>
/**
 * Read-only badge view with the statusBadge.js contract: literal translated
 * text, controlled visibility and the shared gev-status-badge CSS surface.
 * Owners keep status derivation, machine-state attributes and announcement
 * policy; they pass those as ordinary attributes, which land on the badge.
 * No listeners, timers, state inference or automatic live regions.
 */
defineProps({
  label: { type: String, default: '' },
  /** 'pill' | 'box' | 'plain' */
  appearance: { type: String, default: 'pill' },
  hidden: { type: Boolean, default: false },
});
</script>

<template>
  <span
    class="gev-status-badge"
    :class="{
      'gev-status-badge--box': appearance === 'box',
      'gev-status-badge--plain': appearance === 'plain',
    }"
    :hidden="hidden"
    >{{ label }}</span
  >
</template>
