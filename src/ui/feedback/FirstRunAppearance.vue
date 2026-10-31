<script setup>
/**
 * The welcome card's Appearance choice: the appearance owner's three values,
 * applied live exactly as Settings → Appearance applies them. Cyber keeps its
 * own palette, so under Cyber the choice is kept and said to wait for it.
 */
import { t, msg } from '../../i18n/index.js';
import { APPEARANCES } from '../appearance.js';
import { useOwnerState } from '../ownerState.js';

const props = defineProps({
  appearance: { type: Object, required: true },
});
const owner = useOwnerState(props.appearance.channel);
const DETAILS = Object.freeze({
  original: msg('Opaque dark panels'),
  'transparent-dark': msg('Glass panels over the globe'),
  light: msg('Frosted white panels'),
});
</script>

<template>
  <section
    class="first-run-section"
    aria-labelledby="first-run-appearance-heading"
  >
    <h3 id="first-run-appearance-heading" class="first-run-section-heading">
      <span class="first-run-step">2</span>{{ t('Appearance') }}
    </h3>
    <div
      class="first-run-appearances"
      role="radiogroup"
      aria-labelledby="first-run-appearance-heading"
    >
      <label
        v-for="item in APPEARANCES"
        :key="item.value"
        class="first-run-appearance"
      >
        <input
          type="radio"
          name="first-run-appearance"
          :value="item.value"
          :checked="owner?.appearance === item.value"
          :data-first-run-appearance="item.value"
          @change="props.appearance.set(item.value)"
        />
        <span
          class="first-run-swatch"
          :data-appearance="item.value"
          aria-hidden="true"
        ></span>
        <span class="first-run-choice-text"
          ><strong>{{ t(item.label) }}</strong
          ><small>{{ t(DETAILS[item.value]) }}</small></span
        >
      </label>
    </div>
    <p v-if="owner?.cyber" class="first-run-appearance-note">
      {{ t('The Cyber HUD layout uses its own colors.') }}
    </p>
  </section>
</template>
