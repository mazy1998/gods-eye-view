<script setup>
/**
 * Drawer or panel heading: a real heading element, an optional subtitle, and an
 * actions slot (for example a close IconButton) that the owner wires up.
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: undefined },
  /** Heading level, 2–4. */
  level: { type: Number, default: 2 },
});
</script>

<template>
  <div class="gev-panel-header">
    <div class="gev-panel-header-text">
      <component :is="`h${level}`" class="gev-panel-header-title">{{
        title
      }}</component>
      <p v-if="subtitle" class="gev-panel-header-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="gev-panel-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
