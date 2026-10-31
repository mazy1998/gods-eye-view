<script setup>
import { computed, shallowRef } from 'vue';
import StatusBadge from './primitives/StatusBadge.vue';
import NumberField from './primitives/NumberField.vue';
import SelectField from './primitives/SelectField.vue';
import DisclosureRow from './primitives/DisclosureRow.vue';
import { cctvSourceLabelText, cctvSourceStatusLabel } from './cctvFrames.js';
import { t } from '../i18n/index.js';
const props = defineProps({
  view: Object,
  source: Object,
  fields: Array,
  edit: Object,
  summary: String,
  filter: String,
  calibrationOpen: Boolean,
  inputEdit: Function,
  blurEdit: Function,
  keyEdit: Function,
  toggleCalibration: Function,
});
// The picker's own sentinel for its closing line about cameras out of view.
const OUTSIDE = 'cctv-outside-view';
const listed = computed(() => {
  const query = (props.filter || '').trim().toLocaleLowerCase();
  return props.view.cameras
    .filter(
      (camera) =>
        camera.id === props.view.activeId ||
        `${camera.city} ${camera.name} ${camera.sourceLabel || camera.provider || ''}`
          .toLocaleLowerCase()
          .includes(query),
    )
    .map((camera) => ({
      value: camera.id,
      label: [
        `${camera.city} · ${camera.name}`,
        cctvSourceLabelText(
          camera.sourceLabel || camera.provider || 'Configured Source',
        ),
        cctvSourceStatusLabel(camera.sourceStatus || 'unknown'),
      ].join(' · '),
    }));
});
// A focused picker is not rebuilt under the user as the view moves; it
// takes the new list on blur. A camera activated meanwhile is added so the
// picker does not go blank.
const held = shallowRef(null);
const options = computed(() => {
  const base = held.value ?? listed.value;
  const active = props.view.activeCamera;
  const list =
    held.value && active && !base.some((entry) => entry.value === active.id)
      ? [
          { value: active.id, label: `${active.city} · ${active.name}` },
          ...base,
        ]
      : base;
  return props.view.outsideNote
    ? [
        ...list,
        { value: OUTSIDE, label: props.view.outsideNote, disabled: true },
      ]
    : list;
});
// With nothing in view, the closed picker says where the cameras are.
const picked = computed(
  () =>
    props.view.activeId ||
    (!props.view.cameras.length && props.view.outsideNote ? OUTSIDE : ''),
);
// The picker lists the cameras in view; the step and focus controls work on
// the whole catalog.
const noCamera = computed(
  () => !props.view.enabled || !props.view.cameras.length,
);
const noCatalog = computed(
  () => !props.view.enabled || !props.view.catalogCount,
);
const canCalibrate = computed(
  () => props.view.enabled && !!props.view.activeCamera,
);
</script>
<template>
  <div class="camera-controls gev-surface">
    <div class="cctv-controls">
      <button
        id="cctv-enable-btn"
        type="button"
        class="scene-btn"
        :class="{ active: view.enabled }"
        :aria-pressed="String(view.enabled)"
      >
        {{ view.enabled ? t('CCTV on') : t('CCTV off') }}
      </button>
      <button
        id="cctv-nearest-btn"
        type="button"
        class="gev-action-button scene-btn"
        :disabled="noCatalog"
      >
        {{ t('NEAREST') }}
      </button>
    </div>
    <!-- The frame loader and shared video decoder own these stable media nodes. -->
    <div id="cctv-frame-wrap" class="cctv-frame-wrap">
      <span class="cctv-frame-caption" aria-hidden="true">{{
        t('ACQUIRING FRAME')
      }}</span>
      <img id="cctv-frame" :alt="t('CCTV camera')" />
      <canvas id="cctv-video" class="cctv-frame" hidden></canvas>
    </div>
    <StatusBadge
      id="cctv-source-badge"
      role="status"
      aria-live="polite"
      :label="source.label"
      :data-frame-state="source.frameState"
    />
    <div id="cctv-meta">{{ view.meta }}</div>
    <input
      id="cctv-camera-filter"
      class="gev-field"
      type="search"
      :value="filter"
      :aria-label="`${t('Search')} · ${t('Cameras')}`"
      :placeholder="t('Search')"
    />
    <div class="cctv-controls">
      <button
        id="cctv-prev-btn"
        type="button"
        class="gev-action-button scene-btn"
        :disabled="noCatalog"
      >
        {{ t('PREV') }}
      </button>
      <SelectField
        id="cctv-camera-select"
        :label="t('CCTV camera')"
        :model-value="picked"
        :options="options"
        :disabled="noCamera"
        @focusin="held = listed"
        @focusout="held = null"
      />
      <button
        id="cctv-next-btn"
        type="button"
        class="gev-action-button scene-btn"
        :disabled="noCatalog"
      >
        {{ t('NEXT') }}
      </button>
    </div>
    <div class="cctv-controls">
      <button
        id="cctv-focus-btn"
        type="button"
        class="gev-action-button scene-btn"
        :disabled="noCatalog || !view.activeId"
      >
        {{ t('FOCUS') }}
      </button>
      <button
        id="cctv-coverage-btn"
        type="button"
        class="scene-btn"
        :class="{ active: view.coverage !== 'off' }"
        :disabled="!view.enabled"
      >
        {{
          view.coverage === 'viewshed'
            ? t('VIEWSHED ON')
            : view.coverage === 'on'
              ? t('COVERAGE ON')
              : t('COVERAGE OFF')
        }}
      </button>
      <button
        id="cctv-auto-hop-btn"
        type="button"
        class="scene-btn"
        :class="{ active: view.autoHop }"
        :disabled="!view.enabled"
      >
        {{ view.autoHop ? t('AUTO HOP ON') : t('AUTO HOP OFF') }}
      </button>
    </div>
    <div class="cctv-controls">
      <button
        id="cctv-projection-btn"
        type="button"
        class="scene-btn"
        :class="{ active: view.projection }"
        :disabled="!view.enabled"
      >
        {{ view.projection ? t('PROJECTION ON') : t('PROJECTION OFF') }}
      </button>
      <StatusBadge
        id="cctv-quality-chip"
        appearance="box"
        :label="view.qualityLabel"
        :data-cal-badge="view.quality"
      />
    </div>
    <p id="cctv-coverage-note" class="camera-help">
      {{ t('Coverage is estimated from the camera pose.') }}
    </p>
    <div class="cctv-calibration-block">
      <DisclosureRow
        :model-value="calibrationOpen"
        :label="t('CALIBRATION')"
        controls="cctv-calibration-editor"
        @update:model-value="toggleCalibration"
      />
      <div class="cctv-calibration-header">
        <button
          id="cctv-adjust-btn"
          type="button"
          class="scene-btn"
          :class="{ active: view.calibrationMode && canCalibrate }"
          :disabled="!canCalibrate"
          :title="
            t(
              'Drag the camera in the world: rings rotate, arrows move, handles set range/FOV',
            )
          "
        >
          {{ view.calibrationMode ? t('ADJUST ON') : t('ADJUST') }}
        </button>
      </div>
      <div id="cctv-calibration-editor" :hidden="!calibrationOpen">
        <div
          id="cctv-cal-readout"
          class="cctv-cal-readout"
          :aria-label="t('Camera pose — click a value to type')"
        >
          <button
            v-for="field in fields"
            :key="field.id"
            type="button"
            class="cctv-cal-value"
            :data-cal-field="field.id"
            :disabled="!canCalibrate"
            :title="field.title"
          >
            <template v-if="edit?.fieldId === field.id"
              >{{ field.label }}
              <NumberField
                class="cctv-cal-input"
                density="inline"
                :label="field.label"
                :step="field.step"
                :model-value="edit.value"
                live
                @update:model-value="inputEdit"
                @keydown="keyEdit"
                @blur="blurEdit"
                @click.stop
            /></template>
            <template v-else>{{ field.text }}</template>
          </button>
        </div>
        <div class="cctv-controls cctv-calibration-actions">
          <button
            id="cctv-calib-save-btn"
            type="button"
            class="gev-action-button scene-btn"
            :disabled="!canCalibrate"
          >
            {{ t('SAVE CAL') }}
          </button>
          <button
            id="cctv-calib-reset-btn"
            type="button"
            class="gev-action-button scene-btn"
            :disabled="!canCalibrate"
          >
            {{ t('RESET CAL') }}
          </button>
        </div>
      </div>
    </div>
    <div class="cctv-summary-label">{{ t('SCENE SUMMARY') }}</div>
    <div id="cctv-summary">{{ summary }}</div>
  </div>
</template>
