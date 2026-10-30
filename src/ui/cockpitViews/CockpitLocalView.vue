<script setup>
import { t } from '../../i18n/index.js';
defineProps({
  local: { type: Object, required: true },
});
</script>
<template>
  <div class="cockpit-local-place">
    <strong id="cockpit-local-place">{{ local.place }}</strong>
    <small id="cockpit-local-coordinates">{{ local.coordinates }}</small>
  </div>
  <div class="cockpit-local-grid">
    <div>
      <span>{{ t('TEMP') }}</span
      ><strong id="cockpit-local-temperature">{{ local.temperature }}</strong
      ><small translate="no">OPEN-METEO</small>
    </div>
    <div>
      <span>{{ t('WIND') }}</span
      ><strong id="cockpit-local-wind">{{ local.wind }}</strong
      ><small id="cockpit-local-wind-direction">{{
        local.windDirection
      }}</small>
    </div>
    <div>
      <span>{{ t('SKY') }}</span
      ><strong id="cockpit-local-condition">{{ local.condition }}</strong
      ><small id="cockpit-local-cloud">{{ local.cloud }}</small>
    </div>
    <div>
      <span>{{ t('PRECIP') }}</span
      ><strong id="cockpit-local-precipitation">{{
        local.precipitation
      }}</strong
      ><small>{{ t('MM') }}</small>
    </div>
  </div>
  <a
    class="cockpit-weather-credit"
    href="https://open-meteo.com/"
    target="_blank"
    rel="noopener"
    >{{ t('Weather data by Open-Meteo.com') }}</a
  >
</template>
