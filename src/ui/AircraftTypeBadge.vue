<script setup>
defineProps({ presentation: { type: Object, required: true } });
</script>
<template>
  <span class="gev-aircraft-kind">{{ presentation.kind }}</span>
</template>
