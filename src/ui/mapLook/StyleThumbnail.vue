<script setup>
/**
 * A style tile's picture: one drawn coastline, a peninsula between two seas
 * with its islands, textured land, snow on the northern mountains, borders
 * and city lights. It is all procedural, with no imagery and no fetch, so no
 * map provider's tiles ship as assets. Each style's look is a CSS filter on
 * the drawing plus at most one of its overlays (scanlines or a night-vision
 * tube), shown by map-look.css.
 */
import { computed } from 'vue';

const props = defineProps({ styleId: { type: String, required: true } });
const ids = computed(() => {
  const id = (part) => `map-look-thumb-${props.styleId}-${part}`;
  return {
    lines: id('lines'),
    tube: id('tube'),
    terrain: id('terrain'),
    snow: id('snow'),
    alps: id('alps'),
  };
});
const url = (id) => `url(#${id})`;
</script>

<template>
  <span class="map-look-thumb" :data-thumb="styleId" aria-hidden="true">
    <svg viewBox="0 0 160 70" preserveAspectRatio="xMidYMid slice">
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
        <filter
          :id="ids.terrain"
          x="0"
          y="0"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.09"
            numOctaves="4"
            seed="7"
          />
          <feColorMatrix
            values="0.55 0 0 0 0.03  0.6 0 0 0 0.12  0.32 0 0 0 0.03  0 0 0 0 1"
          />
        </filter>
        <filter
          :id="ids.snow"
          x="0"
          y="0"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.35 0.5"
            numOctaves="2"
            seed="3"
          />
          <feColorMatrix
            values="0 0 0 0 0.93  0 0 0 0 0.94  0 0 0 0 0.93  3 0 0 0 -1.75"
          />
        </filter>
        <clipPath :id="ids.alps">
          <path
            d="M0 0h160v9c-10 3-18-1-26 2-8 3-14 1-20 4-6-4-14-2-20-5-8 3-16 2-24 5-8-2-16 1-24-1C34 16 24 12 16 15 10 13 4 15 0 13Z"
          />
        </clipPath>
      </defs>
      <g class="map-look-thumb-scene">
        <rect width="160" height="70" :filter="url(ids.terrain)" />
        <rect
          width="160"
          height="70"
          :filter="url(ids.snow)"
          :clip-path="url(ids.alps)"
        />
        <g fill="#10304f" fill-rule="evenodd">
          <path
            d="M0 34c12-4 26-8 40-7 12 1 22 1 30 3 8 3 12 8 16 14 6 8 12 14 18 20 4 3 8 5 12 6H0ZM63 40c2-2 5-1 5 2s-1 6-3 7-4-2-4-5 1-3 2-4ZM60 51c3-1 7 0 7 4s-1 10-4 11-6-2-6-7 1-7 3-8ZM98 66c4-2 10-2 13 0s-3 5-7 4-8-2-6-4Z"
          />
          <path
            d="M93 16c3-5 9-6 14-3 6 5 12 9 18 13 9 6 20 12 35 18v26h-8c-2-4-6-6-10-8-8-4-14-8-18-14-6-8-10-14-16-20-6-4-12-6-15-12Z"
          />
        </g>
        <path
          fill="none"
          stroke="#f1eee4"
          stroke-opacity="0.45"
          stroke-width="0.45"
          d="M22 4c6 6 10 12 18 16M52 14c4 4 10 6 18 6M72 20c4 6 10 10 14 16M86 30c6 2 10 6 12 12M100 40c4 4 8 10 14 12M110 8c6 2 10 6 14 4M126 18c6-2 12 0 18 4M138 6c4 6 10 8 16 6"
        />
        <g fill="#fff">
          <circle cx="66" cy="18" r="1.2" />
          <circle cx="96" cy="12" r="1.2" />
          <circle cx="88" cy="24" r="1" />
          <circle cx="86" cy="32" r="1" />
          <circle cx="98" cy="46" r="1.2" />
          <circle cx="116" cy="58" r="1" />
        </g>
      </g>
      <rect
        class="map-look-thumb-scanlines"
        width="160"
        height="70"
        :fill="url(ids.lines)"
      />
      <rect
        class="map-look-thumb-tube"
        width="160"
        height="70"
        :fill="url(ids.tube)"
      />
    </svg>
  </span>
</template>
