<script setup>
import { rowTextParts } from './layerText.js';
defineProps({ text: { type: String, default: '' } });
</script>
<template>
  <span
    ><span
      v-for="(part, index) in rowTextParts(text)"
      :key="index"
      :class="{ 'data-keep': part.keep }"
      >{{ part.text }}</span
    ></span
  >
</template>
