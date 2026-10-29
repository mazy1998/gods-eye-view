<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
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
const search = ref(null);
let restoreCollapse;
onMounted(() => {
  const panel = search.value.closest('#data-panel');
  const header = panel?.querySelector(
    ':scope > .data-panel-inner > .panel-header',
  );
  const button = header?.querySelector('.panel-collapse-btn');
  if (!button || !panel.parentElement) return;
  const home = button.ownerDocument.createComment('collapse control home');
  button.before(home);
  const place = () => {
    const inSearch =
      !panel.classList.contains('collapsed') &&
      panel.closest('.gev-legacy-host') &&
      button.ownerDocument.documentElement.dataset.uiTheme !== 'cyber';
    const focused = button.ownerDocument.activeElement === button;
    if (inSearch && button.parentElement !== search.value) {
      search.value.append(button);
      if (focused) button.focus({ preventScroll: true });
    } else if (!inSearch && button.parentElement !== header) {
      home.after(button);
      if (focused) button.focus({ preventScroll: true });
    }
  };
  const observer = new MutationObserver(place);
  observer.observe(panel.parentElement, { childList: true });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  observer.observe(button.ownerDocument.documentElement, {
    attributes: true,
    attributeFilter: ['data-ui-theme'],
  });
  restoreCollapse = () => {
    observer.disconnect();
    home.after(button);
    home.remove();
  };
  place();
});
onBeforeUnmount(() => restoreCollapse?.());
const tab = ref('all');
const query = ref('');
const groups = computed(() => [...new Set(props.rows.map((row) => row.group))]);
const matches = (name) =>
  name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase());
const visible = (row) =>
  tab.value !== 'mine' &&
  (tab.value !== 'active' || row.enabled) &&
  (matches(row.name) || matches(row.englishName));
const visibleGroup = (group) =>
  props.rows.some((row) => row.group === group && visible(row));
watch(
  () => props.reveal,
  () => {
    tab.value = 'all';
    query.value = '';
  },
  { flush: 'sync' },
);
</script>
<template>
  <section class="gev-surface layer-browser" :aria-label="t('Layers')">
    <div ref="search" class="layer-search">
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
        <h3 class="data-layer-group-heading">{{ t(group) }}</h3>
        <LayerRow
          v-for="row in rows.filter((row) => row.group === group)"
          :key="row.id"
          v-show="visible(row)"
          :row="row"
          :toggle="toggle"
          :chip="chip"
          :list-item="listItem"
          :details="details"
        />
      </section>
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
