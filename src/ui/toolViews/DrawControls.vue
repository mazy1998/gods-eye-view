<script setup>
import { t } from '../../i18n/index.js';
import ActionButton from '../primitives/ActionButton.vue';
defineProps({ state: { type: Object, required: true } });
</script>

<template>
  <button
    id="draw-toggle"
    class="pp-toggle-btn"
    :class="{ active: state.active }"
    type="button"
    :aria-pressed="String(state.active)"
    :title="
      t(
        'Draw on the world — click vertices, double-click or Enter to finish, Esc to cancel',
      )
    "
  >
    <span class="pp-icon material-symbols-outlined" aria-hidden="true"
      >draw</span
    >
    <span class="pp-label">{{ t('Draw') }}</span>
  </button>
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
