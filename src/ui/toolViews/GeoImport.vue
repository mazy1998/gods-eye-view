<script setup>
import { formatNumber, t, tn } from '../../i18n/index.js';
import ActionButton from '../primitives/ActionButton.vue';
defineProps({ state: { type: Object, required: true } });
// Standard file-format names are product identifiers, not translated UI copy.
const FORMATS = ['GeoJSON', 'KML', 'KMZ', 'GPX'];
const countLabel = (file) =>
  tn(file.entityCount, '{count} map object', '{count} map objects', {
    count: formatNumber(file.entityCount),
  });
const description = (file) =>
  `${file.name} — ${file.format.toUpperCase()}, ${countLabel(file)}${file.ownStyles ? t(', drawn with its own styles') : ''}`;
</script>

<template>
  <header class="gev-tools-header">
    <svg
      class="gev-tools-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
    </svg>
    <h3 class="gev-tools-title">{{ t('Import') }}</h3>
    <span
      class="gev-tools-count"
      :title="`${t('Imported files')}: ${formatNumber(state.files.length)}`"
      >{{ formatNumber(state.files.length) }}</span
    >
  </header>
  <div class="gev-tools-drop-guide">
    <svg
      class="gev-tools-upload"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
    </svg>
    <p class="gev-tools-prompt">{{ t('Drop map files onto the globe') }}</p>
    <p class="gev-tools-meta">{{ FORMATS.join(' · ') }}</p>
    <ActionButton
      id="geo-import-button"
      size="compact"
      :label="t('Choose files')"
      :title="
        t(
          'Show your own GeoJSON, KML, KMZ or GPX files on the globe (or drop them onto it). File bytes stay on this device; overlays can appear in map screenshots shared with voice.',
        )
      "
    />
  </div>
  <input
    id="geo-import-input"
    type="file"
    accept=".geojson,.json,.kml,.kmz,.gpx"
    multiple
    hidden
    :aria-label="t('Choose GeoJSON, KML, KMZ or GPX files')"
  />
  <p class="gev-tools-meta">
    {{ t('Session only — files clear when you reload') }}
  </p>
  <ul
    id="geo-import-list"
    class="geo-import-list"
    :class="{ visible: state.files.length > 0 }"
    :aria-label="t('Imported files')"
  >
    <li
      v-for="file in state.files"
      :key="file.id"
      class="geo-import-row"
      :data-import-id="file.id"
    >
      <span
        class="geo-import-swatch"
        :class="{ 'own-styles': file.ownStyles }"
        :style="file.ownStyles ? undefined : { background: file.color }"
        aria-hidden="true"
      ></span>
      <span class="geo-import-name" :title="description(file)">{{
        file.name
      }}</span>
      <span class="gev-tools-meta"
        >{{ file.format.toUpperCase() }} · {{ countLabel(file)
        }}{{ file.ownStyles ? t(', drawn with its own styles') : '' }}</span
      >
      <button
        type="button"
        class="geo-import-action"
        data-action="toggle"
        :aria-pressed="String(file.visible)"
        :title="
          file.visible
            ? t('Hide {name}', { name: file.name })
            : t('Show {name}', { name: file.name })
        "
        :aria-label="
          file.visible
            ? t('Hide {name}', { name: file.name })
            : t('Show {name}', { name: file.name })
        "
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{
          file.visible ? 'visibility' : 'visibility_off'
        }}</span>
      </button>
      <button
        type="button"
        class="geo-import-action"
        data-action="fly"
        :title="t('Fly to {name}', { name: file.name })"
        :aria-label="t('Fly to {name}', { name: file.name })"
      >
        <span class="material-symbols-outlined" aria-hidden="true"
          >my_location</span
        >
      </button>
      <button
        type="button"
        class="geo-import-action"
        data-action="remove"
        :title="t('Remove {name}', { name: file.name })"
        :aria-label="t('Remove {name}', { name: file.name })"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </li>
  </ul>
  <span
    id="geo-import-hint"
    class="draw-hint geo-import-hint"
    aria-live="polite"
    >{{ state.hint }}</span
  >
  <ActionButton
    id="geo-import-scene"
    class="gev-tools-scene-link"
    size="compact"
    :label="t('Import scene')"
    >{{ t('Import scene') }}<span aria-hidden="true">→</span></ActionButton
  >
</template>
