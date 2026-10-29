<script>
// Page-unique ids: separate mountView roots do not share Vue's useId() counter.
let rows = 0;
</script>

<script setup>
/**
 * Full-width row that shows or hides the content its owner renders after it
 * (linked by `controls`). The chevron points right when collapsed and down
 * when expanded; an optional icon slot leads the label. The label alone names
 * the row; a description that changes (freshness, counts) describes it.
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  description: { type: String, default: undefined },
  controls: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
const id = `gev-disclosure-${++rows}`;
</script>

<template>
  <button
    type="button"
    class="gev-disclosure-row"
    :aria-expanded="String(modelValue)"
    :aria-controls="controls"
    :aria-labelledby="`${id}-label`"
    :aria-describedby="description ? `${id}-description` : undefined"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span v-if="$slots.icon" class="gev-disclosure-row-icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="gev-disclosure-row-text">
      <span :id="`${id}-label`" class="gev-disclosure-row-label">{{
        label
      }}</span>
      <span
        v-if="description"
        :id="`${id}-description`"
        class="gev-disclosure-row-description"
        >{{ description }}</span
      >
    </span>
    <span class="gev-disclosure-row-chevron" aria-hidden="true"></span>
  </button>
</template>
