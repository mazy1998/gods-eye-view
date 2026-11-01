<script setup>
// The right-hand selection slot: the current item's icon, title and close
// button, and the slot's body, where the item mounts its own content
// (selectionSlot.js). Hidden while empty or resting.
import { onMounted, ref } from 'vue';
import { t } from '../i18n/index.js';
import IconButton from './primitives/IconButton.vue';

const props = defineProps({
  selection: { type: Object, required: true },
  // The slot's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
});
const body = ref(null);
const actions = ref(null);

onMounted(() => {
  body.value.append(props.selection.body);
  actions.value.append(props.selection.actions);
});

function onKeydown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  event.preventDefault();
  props.selection.close({ focus: true });
}
</script>

<template>
  <section
    id="gev-selection-slot"
    class="gev-slot"
    :aria-label="state?.item?.title || undefined"
    :data-slot-item="state?.item?.id || undefined"
    :hidden="!state?.active || !state?.item"
    @keydown="onKeydown"
  >
    <div class="gev-slot-header gev-surface">
      <span
        v-if="state?.item?.icon"
        class="material-symbols-outlined gev-slot-icon"
        aria-hidden="true"
        >{{ state.item.icon }}</span
      >
      <h2 class="gev-slot-title">{{ state?.item?.title }}</h2>
      <!-- Holds the item's header controls (selectionSlot.js). -->
      <span ref="actions" class="gev-slot-actions-home"></span>
      <IconButton
        class="gev-slot-close"
        :label="t('Close')"
        size="sm"
        @click="props.selection.close({ focus: true })"
      >
        <span class="material-symbols-outlined">close</span>
      </IconButton>
    </div>
    <div ref="body" class="gev-slot-scroll"></div>
  </section>
</template>
