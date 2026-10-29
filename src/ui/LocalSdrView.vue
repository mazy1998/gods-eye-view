<script setup>
import { t } from '../i18n/index.js';
import { R820T_GAIN_STEPS_DB } from '../sdr/gain.js';
import { localSdrGainOptionLabel } from './localSdrPresentation.js';
defineProps({
  view: { type: Object, required: true },
  drafts: { type: Object, required: true },
  feedLine: { type: String, default: null },
});
</script>
<template>
  <div class="sdr-radio-heading">
    <strong>{{ t('LOCAL RTL-SDR') }}</strong>
    <span
      id="sdr-connection-state"
      :class="{ active: view.connectionActive }"
      >{{ view.connectionLabel }}</span
    >
  </div>
  <p>
    {{
      t(
        'Chrome/Edge · WebUSB · one local tuner shared by FM and the Local ADS-B layer.',
      )
    }}
  </p>
  <div class="sdr-radio-actions">
    <button
      id="sdr-connect-btn"
      class="panel-layer-toggle"
      type="button"
      :class="{ active: view.connectPressed }"
      :disabled="view.connectDisabled"
      :aria-pressed="String(view.connectPressed)"
    >
      {{ view.connectLabel }}
    </button>
    <button
      id="sdr-locate-btn"
      type="button"
      :title="t('Use your location for faster ADS-B position decoding')"
      :class="{ active: view.locateActive }"
      :disabled="view.locateDisabled"
    >
      {{ view.locateLabel }}
    </button>
    <button
      id="sdr-change-device-btn"
      type="button"
      :title="t('Choose a different RTL-SDR or receiver channel')"
      :disabled="view.changeDeviceDisabled"
    >
      {{ t('CHANGE DEVICE') }}
    </button>
  </div>
  <div
    class="sdr-mode-row"
    role="group"
    :aria-label="t('RTL-SDR receiver mode')"
  >
    <button
      id="sdr-mode-fm-btn"
      type="button"
      translate="no"
      :class="{ active: view.fmActive }"
      :disabled="view.modeDisabled"
      :aria-pressed="String(view.fmActive)"
    >
      FM
    </button>
    <button
      id="sdr-mode-adsb-btn"
      type="button"
      translate="no"
      :class="{ active: view.adsbActive }"
      :disabled="view.modeDisabled"
      :aria-pressed="String(view.adsbActive)"
    >
      ADS-B · 1090
    </button>
  </div>
  <div class="sdr-gain-row">
    <label for="sdr-gain-select">{{ t('GAIN') }}</label>
    <select
      class="gev-field"
      id="sdr-gain-select"
      :aria-label="t('RTL-SDR tuner gain for the current mode')"
      :value="drafts.gain"
      :disabled="view.gainDisabled"
    >
      <option value="auto">{{ t('AUTO') }}</option>
      <option
        v-for="gain in R820T_GAIN_STEPS_DB"
        :key="gain"
        :value="gain.toFixed(1)"
      >
        {{ localSdrGainOptionLabel(gain) }}
      </option>
    </select>
  </div>
  <div
    id="sdr-adsb-stats"
    class="sdr-adsb-stats"
    role="status"
    aria-live="off"
    :hidden="view.statsHidden"
  >
    <span
      ><output id="sdr-stat-rate">{{ view.stats.rate }}</output>
      <span>{{ t('MSG/S') }}</span></span
    >
    <span
      ><output id="sdr-stat-heard">{{ view.stats.heard }}</output>
      <span>{{ t('HEARD') }}</span></span
    >
    <span
      ><output id="sdr-stat-positioned">{{ view.stats.positioned }}</output>
      <span>{{ t('POSITIONED') }}</span></span
    >
    <span translate="no"
      >IQ <output id="sdr-stat-iq">{{ view.stats.iq }}</output></span
    >
  </div>
  <div class="sdr-frequency-row">
    <label for="sdr-frequency-input">{{ t('FM MHZ') }}</label>
    <input
      class="gev-field"
      id="sdr-frequency-input"
      type="number"
      min="87.5"
      max="108"
      step="0.1"
      inputmode="decimal"
      :value="drafts.frequency"
      :disabled="view.frequencyDisabled"
    />
    <button id="sdr-tune-btn" type="button" :disabled="view.tuneDisabled">
      {{ t('TUNE') }}
    </button>
  </div>
  <div
    class="sdr-seek-row"
    role="group"
    :aria-label="t('Seek broadcast FM stations')"
  >
    <button id="sdr-seek-back-btn" type="button" :disabled="view.seekDisabled">
      {{ t('◀ SEEK') }}
    </button>
    <button
      id="sdr-seek-forward-btn"
      type="button"
      :disabled="view.seekDisabled"
    >
      {{ t('SEEK ▶') }}
    </button>
  </div>
  <label class="radio-volume-row" for="sdr-volume">
    <span>{{ t('SDR VOL') }}</span>
    <input
      id="sdr-volume"
      class="gev-quantitative-slider"
      type="range"
      min="0"
      max="100"
      :aria-label="t('Local SDR volume')"
      :value="drafts.volume"
      :disabled="view.volumeDisabled"
    />
    <output id="sdr-volume-value" class="gev-slider-value" for="sdr-volume">{{
      `${view.volumePercent}%`
    }}</output>
  </label>
  <div
    id="sdr-status"
    class="radio-playback-state"
    role="status"
    aria-live="polite"
    :class="{ error: view.statusError }"
  >
    {{ view.statusText }}
  </div>
  <div
    id="sdr-feed-status"
    class="sdr-feed-status"
    role="status"
    aria-live="off"
    :hidden="feedLine === null"
  >
    {{ feedLine || '' }}
  </div>
</template>
