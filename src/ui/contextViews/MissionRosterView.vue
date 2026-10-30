<script setup>
import { ref } from 'vue';
import { t } from '../../i18n/index.js';
const props = defineProps({
  roster: { type: Object, required: true },
  onSelect: { type: Function, required: true },
  onPointerEnter: { type: Function, required: true },
  onPointerLeave: { type: Function, required: true },
  onFocus: { type: Function, required: true },
  onBlur: { type: Function, required: true },
});
const list = ref(null);

/** Report where focus went, when it moved to another mission in the list. */
function blurred(event) {
  const next = event.relatedTarget?.closest?.('[data-mission-roster-index]');
  props.onBlur(
    next && list.value?.contains(next)
      ? Number(next.dataset.missionRosterIndex)
      : null,
  );
}
</script>
<template>
  <div class="space-mission-roster-header">
    <div>
      <strong>{{ t('Available missions') }}</strong>
      <span>{{ t('Select a mission to inspect') }}</span>
    </div>
    <output data-mission-roster-count>{{
      roster.loaded ? t('{count} in 30 days', { count: roster.count }) : '—'
    }}</output>
  </div>
  <div ref="list" class="space-mission-roster-list" data-mission-roster-list>
    <div v-if="!roster.loaded" class="space-mission-roster-empty">
      {{ t('Loading missions from the last 30 days') }}
    </div>
    <div v-else-if="!roster.items.length" class="space-mission-roster-empty">
      {{ t('No missions in the last 30 days') }}
    </div>
    <template v-else>
      <!-- Each refresh brings new rows, so focus returns to the same mission
           and a resting pointer previews again once it moves. -->
      <button
        v-for="item in roster.items"
        :key="`${roster.revision}:${item.id}`"
        type="button"
        class="space-mission-roster-item"
        :data-mission-roster-index="item.index"
        :data-mission-roster-id="item.id"
        :aria-label="t('Select {mission}', { mission: item.label })"
        @click="onSelect(item.index)"
        @mouseenter="onPointerEnter(item.index)"
        @mouseleave="onPointerLeave()"
        @focus="onFocus(item.index)"
        @blur="blurred"
      >
        <span
          class="space-mission-roster-marker"
          :style="{ '--mission-roster-color': item.color }"
          aria-hidden="true"
        ></span
        ><span class="space-mission-roster-copy"
          ><strong>{{ item.label }}</strong
          ><small>{{ item.provider }} · {{ item.date }}</small></span
        ><span class="space-mission-roster-chevron" aria-hidden="true">›</span>
      </button>
    </template>
  </div>
  <p
    class="space-mission-roster-focus-continuation"
    tabindex="-1"
    data-mission-roster-focus-continuation
  >
    {{ t('Tab previews a mission; Enter or Space selects it') }}
  </p>
</template>
