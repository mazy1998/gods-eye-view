<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { formatNumber, t, tn } from '../../i18n/index.js';
import ActionButton from '../primitives/ActionButton.vue';
defineProps({ state: { type: Object, required: true } });
const footer = ref(null);
onBeforeUnmount(() => footer.value?.remove());
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
      :class="{ 'gev-tools-count--empty': !state.files.length }"
      :title="`${t('Imported files')}: ${formatNumber(state.files.length)}`"
      >{{
        tn(state.files.length, '{count} file', '{count} files', {
          count: formatNumber(state.files.length),
        })
      }}</span
    >
    <svg
      class="gev-tools-chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
  <p class="gev-tools-meta gev-tools-session-note">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </svg>
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
  <footer
    ref="footer"
    id="tools-scene-import"
    class="gev-tools gev-tools-footer"
  >
    <ActionButton
      id="geo-import-scene"
      class="gev-tools-scene-link"
      size="compact"
      :label="`${t('Import a scene')} — ${t('Stories')} / ${t('Create')}`"
      ><span>{{ t('Import a scene') }}</span
      ><span aria-hidden="true">→</span
      ><span>{{ t('Stories') }} / {{ t('Create') }}</span
      ><svg
        class="gev-tools-chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" /></svg
    ></ActionButton>
  </footer>
</template>
