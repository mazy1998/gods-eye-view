<script setup>
import FilterChip from './primitives/FilterChip.vue';
import QuantitativeSlider from './primitives/QuantitativeSlider.vue';
import { t } from '../i18n/index.js';
defineProps({
  view: Object,
  sinceIndex: Number,
  sinceLabel: String,
  expanded: Boolean,
  expandAvailable: Boolean,
});
const panoOptions = () => [
  { id: 'all', label: t('ALL') },
  { id: 'pano', label: '360°' },
  { id: 'flat', label: t('FLAT') },
];
const renderOptions = () => [
  {
    id: 'letterbox',
    label: t('FIT'),
    title: t(
      'Fit: show the whole photo, with dark bars where its shape differs from the frame',
    ),
  },
  {
    id: 'fill',
    label: t('FILL'),
    title: t('Fill: fill the frame edge to edge, cropping the photo'),
  },
];
</script>
<template>
  <div class="street-level-controls gev-surface">
    <div id="sl-viewer-wrap" class="sl-viewer-wrap" :hidden="!view.viewer.open">
      <div class="sl-viewer-bar">
        <div class="sl-viewer-tools">
          <button
            id="sl-viewer-expand"
            class="scene-btn"
            type="button"
            :hidden="!expandAvailable"
            :aria-pressed="String(expanded)"
            :aria-label="expanded ? t('Shrink') : t('Expand')"
            :title="
              t('Show the street-level view full screen (Esc shrinks it)')
            "
          >
            <span class="sl-btn-icon" aria-hidden="true">{{
              expanded ? '⤡' : '⤢'
            }}</span
            ><span class="sl-btn-text">{{
              expanded ? t('SHRINK') : t('EXPAND')
            }}</span>
          </button>
          <div
            class="gev-segmented sl-seg"
            role="radiogroup"
            :aria-label="t('Image fit')"
            :hidden="!view.viewer.renderModes"
          >
            <button
              v-for="option in renderOptions()"
              :key="option.id"
              type="button"
              class="gev-segment sl-seg-btn"
              :class="{ 'is-active': option.id === view.viewer.renderMode }"
              :data-sl-render="option.id"
              role="radio"
              :aria-checked="String(option.id === view.viewer.renderMode)"
              :tabindex="option.id === view.viewer.renderMode ? 0 : -1"
              :title="option.title"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="sl-viewer-tools sl-viewer-tools-right">
          <button
            id="sl-viewer-close"
            class="sl-viewer-x"
            type="button"
            :title="t('Close the image and deselect it on the map')"
            :aria-label="t('Close the street-level image')"
          >
            {{ '×' }}
          </button>
        </div>
      </div>
      <div class="sl-viewer-stage">
        <div
          id="sl-viewer-placeholder"
          class="sl-viewer-placeholder"
          :hidden="!view.viewer.loading"
        ></div>
        <!-- The imagery owner mounts its renderer inside this stable host. -->
        <div
          id="sl-viewer"
          class="sl-viewer"
          :aria-label="t('Street-level viewer')"
        ></div>
      </div>
      <div id="sl-image-meta" class="sl-image-meta">
        <span id="sl-image-by" class="sl-image-by">{{
          view.viewer.captionLeft
        }}</span>
        <span class="sl-image-right"
          ><span id="sl-image-when" class="sl-image-when">{{
            view.viewer.captionRight
          }}</span
          ><a
            id="sl-image-link"
            class="sl-image-link"
            :href="view.viewer.link || '#'"
            target="_blank"
            rel="noopener noreferrer"
            :title="t('Open this image on the provider\'s site')"
            :hidden="!view.viewer.link"
            >{{ view.viewer.linkLabel }}</a
          ></span
        >
      </div>
    </div>
    <div class="sl-providers" role="group" :aria-label="t('Imagery providers')">
      <span class="cctv-summary-label">{{ t('PROVIDERS') }}</span>
      <div id="sl-provider-chips" class="sl-chips">
        <FilterChip
          v-for="chip in view.providers"
          :key="chip.id"
          class="data-toggle-chip"
          :class="[`chip-${chip.state}`, { active: chip.active }]"
          :label="chip.label"
          :title="chip.title"
          :model-value="chip.active"
          :disabled="chip.disabled"
          :data-chip-id="chip.id"
          :data-chip-color="chip.color || undefined"
          :style="chip.color ? `--chip-color: ${chip.color}` : undefined"
          :aria-busy="String(chip.busy)"
        />
      </div>
    </div>
    <div id="sl-error" class="sl-error" role="alert" :hidden="!view.error">
      <span aria-hidden="true">⚠</span>
      <span id="sl-error-text">{{ view.error || '' }}</span>
    </div>
    <fieldset
      id="sl-controls"
      class="sl-controls"
      :disabled="view.controlsDisabled"
      :hidden="!view.filterControls.pano && !view.filterControls.since"
    >
      <div
        id="sl-pano-row"
        class="sl-filters"
        role="group"
        :aria-label="t('Imagery filters')"
        :hidden="!view.filterControls.pano"
      >
        <span class="cctv-summary-label">{{ t('IMAGERY') }}</span>
        <div
          class="gev-segmented sl-seg"
          role="radiogroup"
          :aria-label="t('Panorama filter')"
        >
          <button
            v-for="option in panoOptions()"
            :key="option.id"
            type="button"
            class="gev-segment sl-seg-btn"
            :class="{ 'is-active': option.id === view.filter.pano }"
            :data-sl-pano="option.id"
            role="radio"
            :aria-checked="String(option.id === view.filter.pano)"
            :tabindex="option.id === view.filter.pano ? 0 : -1"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div
        id="sl-since-row"
        class="sl-since"
        :hidden="!view.filterControls.since"
      >
        <label class="cctv-summary-label" for="sl-since">{{
          t('SINCE')
        }}</label>
        <QuantitativeSlider
          id="sl-since"
          class="sl-range"
          :min="0"
          :max="8"
          :step="1"
          :model-value="sinceIndex"
          :label="t('SINCE')"
          :value-text="sinceLabel"
          aria-describedby="sl-since-label sl-since-note"
        />
        <span class="sl-since-value"
          ><output id="sl-since-label" class="sl-since-label" for="sl-since">{{
            sinceLabel
          }}</output
          ><small
            id="sl-since-note"
            class="sl-since-note"
            :hidden="!view.sinceNote"
            >{{ view.sinceNote || '' }}</small
          ></span
        >
      </div>
    </fieldset>
    <div class="sl-meta-row">
      <div id="sl-coverage-meta" class="sl-meta">{{ view.meta }}</div>
      <button
        id="sl-nearest-btn"
        class="scene-btn sl-nearest-btn"
        type="button"
        :hidden="!view.nearest.visible"
        :title="view.nearest.title"
        :disabled="view.nearest.disabled"
      >
        {{ view.nearest.label }}
      </button>
    </div>
  </div>
</template>
