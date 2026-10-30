<script setup>
/**
 * Display → HUD: visibility, layout and (under the Cyber layout) the sonar
 * scanner. Renders inside its group wrapper, which Cockpit's portal moves as a
 * whole. VisualSettings owns every value; cyberSonarScene writes the status.
 */
import { t } from '../../i18n/index.js';
import { msg } from '../../i18n/marker.js';
import { displayDefaults } from './displayDefaults.js';
import { sliderFill } from './sliderFill.js';

const props = defineProps({
  state: { type: Object, default: null },
  actions: { type: Object, default: null },
});
const view = () => props.state ?? displayDefaults;
const act = (name, ...args) => props.actions?.[name]?.(...args);
const integer = (event) => parseInt(event.target.value, 10);
const SONAR = [
  [
    'rings',
    msg('Rings'),
    msg('Sonar ring count'),
    3,
    12,
    '',
    'setSonarRings',
    null,
  ],
  [
    'range',
    msg('Range'),
    msg('Sonar ring range'),
    60,
    120,
    '%',
    'setSonarRange',
    null,
  ],
  [
    'intensity',
    msg('Power'),
    msg('Sonar intensity'),
    0,
    100,
    '%',
    'setSonarIntensity',
    null,
  ],
  [
    'opacity',
    msg('Opacity'),
    msg('Cyber contact and label opacity'),
    35,
    100,
    '%',
    'setSonarOpacity',
    msg(
      'Minimum opacity for map dots, icons, models, brackets, and labels between sonar passes',
    ),
  ],
  [
    'sector',
    msg('Sector'),
    msg('Sonar sector width'),
    8,
    60,
    '°',
    'setSonarSector',
    null,
  ],
];
</script>

<template>
  <button
    class="pp-toggle-btn"
    :class="{ active: view().hud.visible }"
    id="hud-toggle"
    :title="t('Intelligence HUD (H)')"
    @click="act('toggleHud')"
  >
    <span class="pp-icon">◎</span>
    <span class="pp-label" translate="no">HUD</span>
  </button>
  <div
    class="pp-slider-row"
    :class="{ visible: view().hud.visible }"
    id="hud-layout-row"
  >
    <span class="pp-slider-mini-label">{{ t('Layout') }}</span>
    <select
      id="hud-layout-select"
      class="pp-select gev-field gev-field--compact"
      :aria-label="t('HUD layout')"
      @change="act('setHudLayout', $event.target.value)"
    >
      <option
        v-for="[value, label] in [
          ['tactical', msg('Tactical')],
          ['operator', msg('Operator')],
          ['minimal', msg('Minimal')],
          ['cyber', msg('Cyber')],
        ]"
        :key="value"
        :value="value"
        :selected="view().hud.variant === value"
      >
        {{ t(label) }}
      </option>
    </select>
  </div>
  <div
    class="pp-slider-row cyber-sonar-control cyber-sonar-toggle-row"
    id="cyber-sonar-row"
  >
    <span class="pp-slider-mini-label">{{ t('Sonar') }}</span>
    <button
      class="pp-mode-btn"
      :class="{ active: view().sonar.enabled }"
      id="cyber-sonar-toggle"
      :title="t('Cyber sonar contact scanner')"
      :aria-label="t('Cyber sonar contact scanner')"
      :aria-pressed="String(view().sonar.enabled)"
      @click="act('toggleSonar')"
    >
      {{ view().sonar.enabled ? t('ON') : t('OFF') }}
    </button>
  </div>
  <!-- cyberSonarScene owns this status text; the view never patches it. -->
  <output
    v-once
    id="cyber-sonar-status"
    class="cyber-sonar-control"
    role="status"
  ></output>
  <div
    v-for="[name, label, aria, min, max, unit, action, title] in SONAR"
    :key="name"
    class="pp-slider-row cyber-sonar-control cyber-sonar-setting"
    :id="`cyber-sonar-${name}-row`"
  >
    <label class="pp-slider-mini-label" :for="`cyber-sonar-${name}`">{{
      t(label)
    }}</label>
    <input
      type="range"
      class="gev-quantitative-slider pp-slider"
      :id="`cyber-sonar-${name}`"
      :min="min"
      :max="max"
      step="1"
      :value="view().sonar[name]"
      :style="sliderFill(view().sonar[name], min, max)"
      :aria-label="t(aria)"
      :title="title ? t(title) : undefined"
      @input="act(action, integer($event))"
    />
    <span class="pp-slider-value" :id="`cyber-sonar-${name}-value`">{{
      `${view().sonar[name]}${unit}`
    }}</span>
  </div>
</template>
