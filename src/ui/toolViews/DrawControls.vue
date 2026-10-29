<script setup>
import { t } from '../../i18n/index.js';
import ActionButton from '../primitives/ActionButton.vue';
defineProps({ state: { type: Object, required: true } });
</script>

<template>
  <h3 class="gev-tools-title gev-tools-draw-header">
    <button
      id="draw-toggle"
      class="pp-toggle-btn"
      :class="{ active: state.active }"
      type="button"
      :aria-label="t('Draw')"
      :aria-pressed="String(state.active)"
      :title="
        t(
          'Draw on the world — click vertices, double-click or Enter to finish, Esc to cancel',
        )
      "
    >
      <svg
        class="pp-icon gev-tools-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m3 21 1-6L16 3l5 5L9 20l-6 1Zm10-15 5 5M4 15l5 5" />
      </svg>
      <span class="pp-label">{{ t('Draw') }}</span>
      <span class="gev-tools-state" aria-hidden="true">{{
        t(state.active ? 'ON' : 'OFF')
      }}</span>
    </button>
  </h3>
  <div
    id="draw-mode-row"
    class="pp-slider-row"
    :class="{ visible: state.active }"
  >
    <span class="pp-slider-mini-label">{{ t('Shape') }}</span>
    <div
      class="gev-segmented pp-mode-seg"
      role="radiogroup"
      :aria-label="t('Shape to draw')"
    >
      <button
        v-for="option in [
          { value: 'area', label: t('Area') },
          { value: 'line', label: t('Line') },
          { value: 'pin', label: t('Pin') },
        ]"
        :key="option.value"
        type="button"
        class="gev-segment pp-mode-btn"
        :class="{ active: state.shape === option.value }"
        :data-shape="option.value"
        role="radio"
        :aria-checked="String(state.shape === option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
  <div
    id="draw-label-row"
    class="pp-slider-row"
    :class="{ visible: state.active }"
  >
    <input
      id="draw-label-input"
      class="pp-text-input"
      type="text"
      :value="state.label"
      maxlength="120"
      :placeholder="t('Label (optional)')"
      :aria-label="t('Label for the drawn shape')"
      autocomplete="off"
      spellcheck="false"
    />
    <select
      id="draw-color-select"
      class="pp-select draw-color-select gev-field gev-field--compact"
      :value="state.color"
      :aria-label="t('Colour of the drawn shape')"
    >
      <option value="primary">{{ t('Primary') }}</option>
      <option value="amber">{{ t('Amber') }}</option>
      <option value="cyan">{{ t('Cyan') }}</option>
      <option value="green">{{ t('Green') }}</option>
      <option value="red">{{ t('Red') }}</option>
    </select>
    <ActionButton
      id="draw-clear"
      class="draw-clear-btn"
      size="compact"
      variant="danger"
      :title="t('Remove every mark from the board')"
      :label="t('Clear board')"
    />
    <span id="draw-hint" class="draw-hint" aria-live="polite">{{
      state.hint
    }}</span>
  </div>
</template>
