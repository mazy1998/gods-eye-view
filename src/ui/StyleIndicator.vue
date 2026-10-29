<script setup>
// The ACTIVE STYLE value: a view of the visual-settings channel, written
// from the style name and nothing else.
import { computed } from 'vue';
import { t } from '../i18n/index.js';
import { useOwnerState } from './ownerState.js';
import { STYLE_STATUS_LABELS } from './visualPresets.js';

const props = defineProps({ channel: { type: Object, required: true } });
const visual = useOwnerState(props.channel);
const label = computed(() => {
  const style = visual.value?.style ?? 'normal';
  return STYLE_STATUS_LABELS[style]
    ? t(STYLE_STATUS_LABELS[style])
    : style.toUpperCase();
});
</script>

<template>
  <span class="indicator-value scene-text-holdout">{{ label }}</span>
</template>
