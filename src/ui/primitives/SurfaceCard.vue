<script setup>
/** Raised grouping surface inside a panel, with an optional heading. */
defineProps({
  title: { type: String, default: undefined },
  /** Heading level, 3–5. */
  level: { type: Number, default: 3 },
});
</script>

<template>
  <div class="gev-card">
    <component :is="`h${level}`" v-if="title" class="gev-card-title">{{
      title
    }}</component>
    <slot />
  </div>
</template>
