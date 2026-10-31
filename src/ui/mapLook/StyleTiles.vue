<script setup>
/**
 * Look → the six visual styles as tiles, with their 1–6 shortcut badges.
 * The selection is VisualSettings' published `style`; a click sets the style
 * through the shared Display operation, as the dock's buttons did.
 */
import { t } from '../../i18n/index.js';
import { msg } from '../../i18n/marker.js';
import StyleThumbnail from './StyleThumbnail.vue';

defineProps({
  style: { type: String, default: 'normal' },
  actions: { type: Object, default: null },
});
const STYLES = [
  ['normal', msg('Normal'), msg('Show the globe without a visual filter.')],
  [
    'retro',
    msg('CRT'),
    msg('Emulate a green phosphor CRT with scanlines and screen curvature.'),
  ],
  [
    'surveillance',
    msg('NVG'),
    msg(
      'Simulate night-vision goggles with green intensification and a tube vignette.',
    ),
  ],
  [
    'thermal',
    msg('FLIR'),
    msg('Simulate FLIR-style thermal contrast. Turn up Ironbow for color.'),
  ],
  [
    'anime',
    msg('Anime'),
    msg('Apply bright cel-shaded color and illustrated outlines.'),
  ],
  [
    'noir',
    msg('Noir'),
    msg('Apply high-contrast monochrome film-noir grading.'),
  ],
];
</script>

<template>
  <div id="style-buttons" class="map-look-style-grid">
    <button
      v-for="([id, label, title], index) in STYLES"
      :key="id"
      type="button"
      class="style-btn"
      :class="{ active: id === style }"
      :data-style="id"
      :title="t(title)"
      :aria-pressed="String(id === style)"
      @click="actions?.setStyle?.(id)"
    >
      <StyleThumbnail :style-id="id" />
      <span class="btn-label">{{ t(label) }}</span>
      <span class="btn-key">{{ index + 1 }}</span>
    </button>
  </div>
</template>
