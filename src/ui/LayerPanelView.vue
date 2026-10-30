<script setup>
import { computed, ref, watch, nextTick } from 'vue';
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
const categoryButtons = new Map();
const setCategoryButton = (group, button) => {
  if (button) categoryButtons.set(group, button);
  else categoryButtons.delete(group);
};
const categoryIcons = {
  Space: 'satellite_alt',
  Environment: 'air',
  'Imagery & cameras': 'videocam',
  Infrastructure: 'cable',
  'Signals & events': 'sensors',
};
const browsing = computed(() => tab.value === 'all' && !query.value.trim());
const isCategory = (group) => Object.hasOwn(categoryIcons, group);
const groupId = (group) =>
  `layer-category-${Object.keys(categoryIcons).indexOf(group)}`;
watch(
  [tab, query],
  () => {
    category.value = null;
  },
  { flush: 'sync' },
);
const overviewOrder = [
  'Transport',
  'Space',
  'Environment',
  'Imagery & cameras',
  'Audio',
];
const groups = computed(() =>
  [
    ...new Set(
      props.rows
        .filter((row) => row.id !== 'directions')
        .map((row) => row.group),
    ),
  ].sort((a, b) => {
    const rank = (group) => {
      const index = overviewOrder.indexOf(group);
      return index < 0 ? overviewOrder.length : index;
    };
    return rank(a) - rank(b);
  }),
);
const matches = (name) =>
  name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase());
const visible = (row) =>
  tab.value !== 'mine' &&
  (tab.value !== 'active' || row.enabled) &&
  (matches(row.name) ||
    matches(row.englishName) ||
    (row.id === 'directions' && matches(t('Route planning'))));
const visibleRows = (group) =>
  !browsing.value || !isCategory(group) || category.value === group;
const closeCategory = async (group) => {
  const heading = categoryButtons.get(group);
  category.value = null;
  await nextTick();
  heading?.focus({ preventScroll: true });
};
const visibleGroup = (group) =>
  props.rows.some(
    (row) => row.id !== 'directions' && row.group === group && visible(row),
  );
watch(
  () => props.reveal,
  () => {
    tab.value = 'all';
    query.value = '';
    const group = props.rows.find((row) => row.id === props.reveal?.id)?.group;
    category.value = isCategory(group) ? group : null;
  },
  { flush: 'sync' },
);
</script>
<template>
  <section class="gev-surface layer-browser" :aria-label="t('Layers')">
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
        :key="group"
        v-show="visibleGroup(group)"
        :data-layer-group="group"
      >
        <button
          v-if="isCategory(group) && browsing"
          :ref="(button) => setCategoryButton(group, button)"
          type="button"
          class="gev-action-button layer-category"
          :aria-expanded="String(category === group)"
          :aria-controls="groupId(group)"
          @click="category = category === group ? null : group"
        >
          <span class="material-symbols-outlined" aria-hidden="true">{{
            categoryIcons[group]
          }}</span>
          <span>{{ t(group) }}</span>
          <span class="material-symbols-outlined" aria-hidden="true">{{
            category === group ? 'expand_more' : 'chevron_right'
          }}</span>
        </button>
        <h3 v-else class="data-layer-group-heading">{{ t(group) }}</h3>
        <div
          :id="isCategory(group) ? groupId(group) : undefined"
          v-show="visibleRows(group)"
        >
          <button
            v-if="isCategory(group) && browsing && category === group"
            type="button"
            class="gev-action-button layer-category-back"
            @click="closeCategory(group)"
          >
            {{ t('Back to layers') }}
          </button>
          <LayerRow
            v-for="row in rows.filter(
              (row) => row.group === group && row.id !== 'directions',
            )"
            :key="row.id"
            v-show="visible(row)"
            :row="row"
            :toggle="toggle"
            :chip="chip"
            :list-item="listItem"
            :details="details"
          />
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
