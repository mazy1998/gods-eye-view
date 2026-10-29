<script setup>
import { t } from '../../i18n/index.js';
defineProps({
  query: { type: String, default: '' },
  expanded: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },
  onEdit: Function,
  onSubmit: Function,
  onToggle: Function,
  onBlur: Function,
});
</script>

<template>
  <div class="location-search-wrap gev-location-search gev-surface">
    <button
      id="search-toggle"
      class="search-toggle-btn"
      type="button"
      :title="t('Search any location')"
      :aria-label="t('Search any location')"
      aria-controls="location-search"
      :aria-expanded="expanded"
      @click="onToggle?.()"
    >
      <span class="material-symbols-outlined" aria-hidden="true">search</span>
    </button>
    <input
      id="location-search"
      type="text"
      :value="query"
      :class="{ expanded, searching: busy }"
      :aria-busy="busy"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? 'location-search-error' : undefined"
      :placeholder="t('Search places or coordinates')"
      :aria-label="t('Search location by name or coordinates')"
      autocomplete="off"
      spellcheck="false"
      @input="onEdit?.($event.target.value)"
      @keydown.enter="!$event.isComposing && onSubmit?.($event.target.value)"
      @blur="onBlur?.()"
    />
  </div>
</template>
