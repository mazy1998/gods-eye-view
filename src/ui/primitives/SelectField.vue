<script setup>
/**
 * Native select on the shared gev-field surface, controlled by `modelValue`:
 * after every render it shows the matching option, or none when no option
 * matches, and a choice the owner does not apply returns to the owner's
 * value. Owners receive the chosen option's own value (not its string form);
 * the browser keeps the popup and its keyboard behaviour.
 */
import { nextTick, onMounted, onUpdated, ref } from 'vue';

const props = defineProps({
  modelValue: { type: null, default: undefined },
  /** [{ value, label, disabled? }] with labels already translated. */
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  /** 'default' | 'compact' */
  density: { type: String, default: 'default' },
  /** Accessible name, already translated. */
  label: { type: String, default: undefined },
});
const emit = defineEmits(['update:modelValue']);
const select = ref(null);

// Programmatic selection fires no change event, so this never emits.
const show = () => {
  if (select.value)
    select.value.selectedIndex = props.options.findIndex(
      (option) => option.value === props.modelValue,
    );
};
onMounted(show);
onUpdated(show);

async function choose(event) {
  emit('update:modelValue', props.options[event.target.selectedIndex]?.value);
  // An owner that applies the choice re-renders first; one that refuses it
  // leaves the model unchanged, and the select returns to it.
  await nextTick();
  show();
}
</script>

<template>
  <select
    ref="select"
    class="gev-field"
    :class="density !== 'default' && `gev-field--${density}`"
    :disabled="disabled"
    :aria-label="label"
    @change="choose"
  >
    <option
      v-for="option in options"
      :key="String(option.value)"
      :value="String(option.value)"
      :selected="option.value === modelValue"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
