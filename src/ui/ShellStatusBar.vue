<script setup>
// The status bar at the bottom left: the camera's position and the UTC
// clock (statusReadout.js), then the provider attribution Cesium renders,
// moved in whole (see shellChrome.js). Like the credit line, it is text over
// the globe, with no surface of its own.
import { t } from '../i18n/index.js';
import { useOwnerState } from './ownerState.js';

const props = defineProps({
  readout: { type: Object, required: true },
  // The drawer's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
});
const owner = useOwnerState(props.readout);
</script>

<template>
  <footer
    id="gev-status-bar"
    class="gev-status-bar"
    :aria-label="t('Map status')"
    :hidden="!state?.active"
  >
    <span v-if="owner?.coordinates" class="gev-status-item">{{
      owner.coordinates
    }}</span>
    <span v-if="owner?.utc" class="gev-status-item">{{ owner.utc }}</span>
    <div id="gev-status-credits" class="gev-status-credits"></div>
  </footer>
</template>
