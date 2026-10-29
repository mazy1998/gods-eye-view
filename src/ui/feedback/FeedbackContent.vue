<script setup>
import { setSplitFlapText, disposeSplitFlap } from '../../splitFlap.js';
defineProps({
  labelId: String,
  detailId: String,
  label: String,
  detail: String,
  immediate: Boolean,
});
const vFlap = {
  mounted: (el, { value }) =>
    setSplitFlapText(el, value.label, { immediate: value.immediate }),
  updated: (el, { value }) =>
    setSplitFlapText(el, value.label, { immediate: value.immediate }),
  beforeUnmount: disposeSplitFlap,
};
</script>
<template>
  <span :id="labelId" v-flap="{ label, immediate }"></span>
  <span :id="detailId">{{ detail }}</span>
</template>
