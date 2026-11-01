<script setup>
import { computed, ref, watch, onBeforeUpdate, onUpdated } from 'vue';
import TabList from './primitives/TabList.vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
import ActionButton from './primitives/ActionButton.vue';
import IconButton from './primitives/IconButton.vue';
import LayerRow from './LayerRow.vue';
import { t, tn } from '../i18n/index.js';
const props = defineProps({
  rows: { type: Array, default: () => [] },
  files: { type: Array, default: () => [] },
  reveal: Object,
  toggle: Function,
  chip: Function,
  listItem: Function,
  clear: Function,
  clearBusy: Boolean,
  details: Function,
  fileAction: Function,
});
const tab = ref('all');
const query = ref('');
const category = ref(null);
// Every group is a category: closed until opened, one open at a time, so the
// overview fits and no long group pushes the others out of view.
const browsing = computed(() => tab.value === 'all' && !query.value.trim());
const groupId = (group) => `layer-category-${group.key}`;
watch(
  [tab, query],
  () => {
    category.value = null;
  },
  { flush: 'sync' },
);
// Rows arrive in presentation order, so groups do too.
const groups = computed(() => [
  ...new Map(
    props.rows
      .filter((row) => row.id !== 'directions')
      .map((row) => [row.group.key, row.group]),
  ).values(),
]);
const matches = (name) =>
  name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase());
const visible = (row) =>
  tab.value !== 'mine' &&
  (tab.value !== 'active' || row.enabled) &&
  (matches(row.name) ||
    matches(row.englishName) ||
    (row.id === 'directions' && matches(t('Route planning'))));
const visibleRows = (group) => !browsing.value || category.value === group.key;
const visibleGroup = (group) =>
  props.rows.some(
    (row) =>
      row.id !== 'directions' && row.group.key === group.key && visible(row),
  );
watch(
  () => props.reveal,
  () => {
    tab.value = 'all';
    query.value = '';
    category.value =
      props.rows.find((row) => row.id === props.reveal?.id)?.group.key ?? null;
  },
  { flush: 'sync' },
);
// A row that leaves the list while it holds focus (a layer switched off under
// Active) hands focus to the next shown switch, the previous one, or the tab.
const panel = ref(null);
let focusedRow = null;
const shown = (element) => {
  for (
    let node = element;
    node && node !== panel.value;
    node = node.parentElement
  )
    if (node.style?.display === 'none') return false;
  return true;
};
onBeforeUpdate(() => {
  const active = panel.value?.ownerDocument.activeElement;
  const row = panel.value?.contains(active)
    ? active.closest('.layer-groups [data-layer-id]')
    : null;
  // Only a row this update hides: one already hidden is not ours to move.
  focusedRow = row && shown(row) ? row : null;
});
onUpdated(() => {
  const row = focusedRow;
  focusedRow = null;
  if (!row || shown(row)) return;
  const rows = [
    ...panel.value.querySelectorAll('.layer-groups [data-layer-id]'),
  ];
  const index = rows.indexOf(row);
  const next =
    rows.slice(index + 1).find(shown) ||
    rows.slice(0, Math.max(index, 0)).reverse().find(shown);
  const target =
    next?.querySelector('.data-toggle-btn') ||
    panel.value.querySelector('[role="tab"][aria-selected="true"]');
  target?.focus();
});
</script>
<template>
  <section
    ref="panel"
    class="gev-surface layer-browser"
    :aria-label="t('Layers')"
  >
    <div class="layer-search">
      <span class="material-symbols-outlined" aria-hidden="true">search</span>
      <input
        :value="query"
        @input="query = $event.target.value"
        class="layer-filter"
        type="search"
        :placeholder="t('Find a layer')"
        :aria-label="t('Find a layer')"
      />
    </div>
    <TabList
      v-model="tab"
      :label="t('Layers')"
      :tabs="[
        { value: 'all', label: t('All layers') },
        { value: 'active', label: t('Active') },
        { value: 'mine', label: t('My data') },
      ]"
    />
    <div v-show="tab !== 'mine'" class="layer-groups">
      <section
        v-for="group in groups"
        :key="group.key"
        v-show="visibleGroup(group)"
        :data-layer-group="group.key"
      >
        <button
          v-if="browsing"
          type="button"
          class="gev-action-button layer-category"
          :aria-expanded="String(category === group.key)"
          :aria-controls="groupId(group)"
          @click="category = category === group.key ? null : group.key"
        >
          <span class="material-symbols-outlined" aria-hidden="true">{{
            group.icon
          }}</span>
          <span>{{ t(group.label) }}</span>
          <span class="material-symbols-outlined" aria-hidden="true">{{
            category === group.key ? 'expand_more' : 'chevron_right'
          }}</span>
        </button>
        <h3 v-else class="data-layer-group-heading">{{ t(group.label) }}</h3>
        <div :id="groupId(group)" v-show="visibleRows(group)">
          <LayerRow
            v-for="row in rows.filter(
              (row) => row.group.key === group.key && row.id !== 'directions',
            )"
            :key="row.id"
            v-show="visible(row)"
            :row="row"
            :toggle="toggle"
            :chip="chip"
            :list-item="listItem"
            :details="details"
          />
          <!-- Where a panel that belongs to the group (Radio) is placed, so it
               shows and hides with the group's rows. Vue never patches it. -->
          <div class="layer-group-home"></div>
        </div>
      </section>
      <LayerRow
        v-for="row in rows.filter((row) => row.id === 'directions')"
        :key="row.id"
        v-show="visible(row)"
        :row="row"
        :toggle="toggle"
        :chip="chip"
        :list-item="listItem"
        :details="details"
        navigation-only
      />
      <p v-if="!rows.some(visible)" class="layer-empty">
        {{ t('No matching layers') }}
      </p>
    </div>
    <section v-show="tab === 'mine'" class="layer-imports">
      <p class="layer-empty">{{ t('Session only') }}</p>
      <div
        v-for="file in files.filter((file) => matches(file.name))"
        :key="file.id"
        class="layer-import"
        :data-import-id="file.id"
      >
        <span>{{ file.name }}</span
        ><span>{{ file.format }} · {{ file.entityCount }}</span>
        <ToggleSwitch
          :model-value="file.visible"
          :aria-label="file.name"
          @update:model-value="fileAction('setVisible', file.id, $event)"
        />
        <IconButton
          :label="t('Fly to {name}', { name: file.name })"
          size="sm"
          @click="fileAction('flyTo', file.id)"
          ><span class="material-symbols-outlined"
            >my_location</span
          ></IconButton
        ><ActionButton
          :label="t('Remove')"
          variant="danger"
          @click="fileAction('remove', file.id)"
        />
      </div>
      <p v-if="!files.length" class="layer-empty">
        {{ t('No imported files') }}
      </p>
    </section>
    <footer class="layer-footer">
      <span>{{
        tn(
          rows.filter((row) => row.enabled).length,
          '{count} layer active',
          '{count} layers active',
        )
      }}</span
      ><ActionButton
        :label="t('Clear active')"
        :aria-busy="String(clearBusy)"
        :aria-disabled="String(clearBusy)"
        @click="clear()"
      />
    </footer>
  </section>
</template>
