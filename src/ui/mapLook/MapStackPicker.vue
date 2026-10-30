<script setup>
/**
 * Map → one tile per presented map stack, from the map-stack channel (which
 * never changes share links): the active stack is pressed, an unavailable one
 * is disabled with its reason. A click selects through the map-source
 * controls, which own the switch and its share sync. Only the tiles of the
 * current render act: tiles a refresh replaced, or a disposed view's, stay
 * inert, as the rebuilt chips were.
 */
import { computed, useTemplateRef } from 'vue';
import { t } from '../../i18n/index.js';
import { mapStackChipModels } from '../../mapStackChips.js';

const props = defineProps({
  mapStack: { type: Object, default: null },
  actions: { type: Object, default: null },
  /** A refresh re-renders the tiles; their row stays the same element. */
  refreshKey: { type: Number, default: 0 },
});
const chips = computed(() =>
  mapStackChipModels(props.mapStack?.stacks, props.mapStack?.activeId ?? null),
);
const status = computed(() => {
  const state = props.mapStack;
  if (state?.status === 'switching') return '...';
  const active = state?.stacks?.find((stack) => stack.id === state.activeId);
  return active?.shortLabel || active?.label || t('MAP');
});
const liveTiles = useTemplateRef('stack-tile');
const select = (chip, event) => {
  if (!chip.available || !liveTiles.value?.includes(event.currentTarget))
    return;
  props.actions?.selectStack?.(chip.id);
};
</script>

<template>
  <section class="map-source-section" aria-labelledby="map-source-label">
    <div class="map-source-heading">
      <span id="map-source-label">{{ t('MAP SOURCE') }}</span>
      <span
        id="map-stack-status"
        class="pp-stack-status"
        :class="{ warn: !!mapStack?.lastError }"
        aria-live="polite"
        >{{ status }}</span
      >
    </div>
    <div
      id="map-stack-chips"
      class="map-stack-chip-row"
      role="group"
      :aria-label="t('Map source')"
    >
      <button
        v-for="chip in chips"
        :key="`${refreshKey}:${chip.id}`"
        ref="stack-tile"
        type="button"
        class="map-stack-chip"
        :class="{ active: chip.active, unavailable: !chip.available }"
        :data-stack-id="chip.id"
        :title="chip.title"
        :aria-pressed="String(chip.active)"
        :aria-disabled="String(!chip.available)"
        :aria-label="
          chip.available
            ? undefined
            : t('{label} unavailable: {hint}', {
                label: chip.label,
                hint: chip.unavailableHint,
              })
        "
        @click="select(chip, $event)"
      >
        <span class="map-stack-chip-label">{{ chip.label }}</span>
        <span v-if="chip.requirement" class="map-stack-chip-req">{{
          chip.requirement
        }}</span>
      </button>
    </div>
  </section>
</template>
