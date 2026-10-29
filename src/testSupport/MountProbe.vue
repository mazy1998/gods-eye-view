<script setup>
// qa-mount-view.mjs fixture: reports what a view sees in its mounted hook.
import { onMounted, ref } from 'vue';

const props = defineProps({
  label: { type: String, default: '' },
  onReport: { type: Function, default: () => {} },
});
const input = ref(null);

onMounted(() => {
  input.value.focus();
  props.onReport({
    label: props.label,
    connected: input.value.isConnected,
    focused: input.value.ownerDocument.activeElement === input.value,
    width: input.value.getBoundingClientRect().width,
    parentId: input.value.parentNode?.id ?? null,
  });
});
</script>

<template>
  <input ref="input" class="mount-probe" :aria-label="label" />
</template>
