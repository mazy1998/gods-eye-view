<script setup>
/**
 * The welcome card's Appearance choice: the appearance owner's three values,
 * applied live exactly as Settings → Appearance applies them. Cyber keeps its
 * own palette, so under Cyber the choice is kept and said to wait for it.
 */
import { computed } from 'vue';
import { t } from '../../i18n/index.js';
import { APPEARANCES } from '../appearance.js';
import { useOwnerState } from '../ownerState.js';
import SegmentedControl from '../primitives/SegmentedControl.vue';

const props = defineProps({
  appearance: { type: Object, required: true },
});
const owner = useOwnerState(props.appearance.channel);
const options = computed(() =>
  APPEARANCES.map((item) => ({ value: item.value, label: t(item.label) })),
);
</script>

<template>
  <section class="first-run-appearance">
    <h3 id="first-run-appearance-heading" class="first-run-section-heading">
      <span class="first-run-step">2</span>{{ t('Appearance') }}
    </h3>
    <SegmentedControl
      :model-value="owner?.appearance"
      :options="options"
      :label="t('Appearance')"
      @update:model-value="props.appearance.set($event)"
    />
    <p v-if="owner?.cyber" class="first-run-appearance-note">
      {{ t('The Cyber HUD layout uses its own colors.') }}
    </p>
  </section>
</template>
