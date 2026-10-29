<script setup>
/**
 * The corner language picker, rendered from the locale picker model's state.
 * Pure presentation: mountLocalePicker owns the model, its keyboard and
 * pointer handling, focus and the language switch, and repaints this view
 * synchronously on every model change.
 */
import { computed, onUpdated, ref } from 'vue';
import { t } from '../../i18n/index.js';
import { CHINESE_LABELS, ICONS } from '../localePickerGlyphs.js';

const props = defineProps({
  /** The model's published state: open, query, visible codes, activeCode. */
  state: { type: Object, required: true },
  /** The model's options, in their order: { code, nativeName, selected }. */
  options: { type: Array, required: true },
  current: { type: String, required: true },
  currentName: { type: String, required: true },
  searchable: { type: Boolean, default: false },
  /** { popup, heading, listbox, option } where option prefixes a code. */
  ids: { type: Object, required: true },
});
const listbox = ref(null);
const byCode = computed(
  () => new Map(props.options.map((option) => [option.code, option])),
);
const visibleOptions = computed(() =>
  props.state.visible.map((code) => byCode.value.get(code)).filter(Boolean),
);
const optionId = (code) => `${props.ids.option}${code}`;
const activeId = computed(() =>
  props.state.open &&
  props.state.activeCode &&
  props.state.visible.includes(props.state.activeCode)
    ? optionId(props.state.activeCode)
    : undefined,
);
const strokeAttrs = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.4',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

// Keep the active option in view as the keyboard moves it.
onUpdated(() =>
  listbox.value
    ?.querySelector('.locale-picker-option.is-active')
    ?.scrollIntoView?.({ block: 'nearest' }),
);
</script>

<template>
  <button
    type="button"
    class="locale-picker-button"
    aria-haspopup="listbox"
    :aria-expanded="String(state.open)"
    :aria-controls="ids.popup"
    :aria-label="t('Language: {language}', { language: currentName })"
    :title="t('Change the interface language')"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      class="locale-picker-globe"
    >
      <path
        v-for="d in ICONS.globe.stroke"
        :key="d"
        :d="d"
        v-bind="strokeAttrs"
      /></svg
    ><span class="locale-picker-code" translate="no" aria-hidden="true">{{
      current.toUpperCase()
    }}</span
    ><svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      class="locale-picker-caret"
    >
      <path v-for="d in ICONS.caret.fill" :key="d" :d="d" fill="currentColor" />
    </svg>
  </button>
  <div :id="ids.popup" class="locale-picker-popup" :hidden="!state.open">
    <div :id="ids.heading" class="locale-picker-heading">
      {{ t('Interface language') }}
    </div>
    <input
      v-if="searchable"
      class="locale-picker-search"
      type="search"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="true"
      :aria-controls="ids.listbox"
      :aria-label="t('Search languages')"
      :placeholder="t('Search languages')"
      :value="state.query"
      :aria-activedescendant="activeId"
    />
    <ul
      :id="ids.listbox"
      ref="listbox"
      class="locale-picker-list"
      role="listbox"
      :aria-labelledby="ids.heading"
      tabindex="-1"
      :aria-activedescendant="searchable ? undefined : activeId"
    >
      <!-- Rows exist only while the list is open. Before, they were built on
           first open and stayed, hidden, after closing; neither is shown. -->
      <li
        v-for="option in state.open ? visibleOptions : []"
        :id="optionId(option.code)"
        :key="option.code"
        class="locale-picker-option"
        :class="{ 'is-active': option.code === state.activeCode }"
        role="option"
        :aria-selected="String(option.selected)"
        :lang="option.code"
        :data-locale="option.code"
      >
        <span class="locale-picker-text"
          ><span class="locale-picker-native">{{ option.nativeName }}</span
          ><span class="locale-picker-meta"
            ><span
              class="locale-picker-option-code"
              translate="no"
              :lang="CHINESE_LABELS[option.code] ? 'en' : undefined"
              >{{
                CHINESE_LABELS[option.code] || option.code.toUpperCase()
              }}</span
            ></span
          ></span
        ><svg
          v-if="option.selected"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          class="locale-picker-check"
        >
          <path
            v-for="d in ICONS.check.stroke"
            :key="d"
            :d="d"
            v-bind="strokeAttrs"
          />
        </svg>
      </li>
    </ul>
    <p
      class="locale-picker-empty"
      role="status"
      :hidden="state.visible.length > 0"
    >
      {{ t('No matching languages') }}
    </p>
  </div>
</template>
