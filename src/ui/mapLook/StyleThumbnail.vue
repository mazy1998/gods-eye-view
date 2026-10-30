<script setup>
/**
 * A style tile's picture: one drawn coast motif, with no imagery and no
 * fetch, so no map provider's tiles ship as assets. Each style's look is a
 * CSS filter on the motif plus at most one of its overlays (scanlines, a
 * night-vision tube, snow), shown by map-look.css.
 */
import { computed } from 'vue';

const props = defineProps({ styleId: { type: String, required: true } });
const ids = computed(() => ({
  lines: `map-look-thumb-${props.styleId}-lines`,
  tube: `map-look-thumb-${props.styleId}-tube`,
}));
</script>

<template>
  <span class="map-look-thumb" :data-thumb="styleId" aria-hidden="true">
    <svg viewBox="0 0 160 84" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern
          :id="ids.lines"
          width="4"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <rect width="4" height="1" fill="#000" fill-opacity="0.45" />
        </pattern>
        <radialGradient :id="ids.tube" cx="50%" cy="50%" r="62%">
          <stop offset="55%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.85" />
        </radialGradient>
      </defs>
      <g class="map-look-thumb-scene">
        <rect width="160" height="84" fill="#1d4f7c" />
        <path
          fill="#6f7f4b"
          d="M0 0h160v18c-14 4-22 2-30 10-6 6-4 14-12 18-6 3-12-2-16 4-5 7 4 14 0 22-3 6-10 7-12 12H76c3-8 12-10 14-18 2-7-6-12-2-19 4-8 14-6 18-13 5-8-2-15-10-17-9-2-14 6-22 4C66 17 62 8 52 10 40 12 34 24 22 24 12 24 6 18 0 20Z"
        />
        <path
          fill="#8b7c55"
          d="M28 50c6-4 14-2 16 4s-2 12-8 14-12-2-12-8 0-7 4-10Zm24 18c4-2 8 0 8 4s-4 6-7 5-4-7-1-9Z"
        />
        <path
          fill="none"
          stroke="#e9e4d4"
          stroke-opacity="0.7"
          stroke-width="0.8"
          d="M8 8c10 4 18 2 28 6M60 4c6 6 14 6 18 12M104 6c-2 6 2 10 10 12M124 12c4-2 10-2 14 2"
        />
        <g fill="#fff">
          <circle cx="70" cy="14" r="1.6" />
          <circle cx="96" cy="26" r="1.6" />
          <circle cx="108" cy="44" r="1.6" />
          <circle cx="40" cy="12" r="1.6" />
        </g>
      </g>
      <rect
        class="map-look-thumb-scanlines"
        width="160"
        height="84"
        :fill="`url(#${ids.lines})`"
      />
      <rect
        class="map-look-thumb-tube"
        width="160"
        height="84"
        :fill="`url(#${ids.tube})`"
      />
      <rect
        class="map-look-thumb-snow"
        width="160"
        height="84"
        fill="#fff"
        fill-opacity="0.35"
      />
    </svg>
  </span>
</template>
