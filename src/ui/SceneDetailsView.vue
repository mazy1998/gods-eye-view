<script setup>
import ActionButton from './primitives/ActionButton.vue';
import { t } from '../i18n/index.js';
defineProps({ draft: Object, call: Function, input: Function });
</script>
<template>
  <div class="stories-details">
    <label
      >{{ t('Anchors and data packs')
      }}<textarea
        data-scene-detail="sceneText"
        rows="9"
        class="gev-field"
        :aria-label="t('Anchors and data packs')"
        :value="draft.sceneText"
        @input="input('sceneText', $event.target.value)"
      />
    </label>
    <label
      >{{ t('Shot camera, timing, packs and actions')
      }}<textarea
        data-scene-detail="shotText"
        rows="9"
        class="gev-field"
        :aria-label="t('Shot camera, timing, packs and actions')"
        :value="draft.shotText"
        @input="input('shotText', $event.target.value)"
      />
    </label>
    <label
      >{{ t('New anchor ID')
      }}<input
        data-scene-detail="anchorName"
        class="gev-field"
        :aria-label="t('New anchor ID')"
        :value="draft.anchorName"
        @input="input('anchorName', $event.target.value)"
    /></label>
    <div class="stories-dialog-actions">
      <ActionButton
        :label="t('Capture camera as anchor')"
        @click="call('captureAnchor')"
      />
      <ActionButton
        :label="t('Set move start to current camera')"
        @click="call('moveStart')"
      />
      <ActionButton
        :label="t('Use ordinary flight')"
        @click="call('ordinaryFlight')"
      />
    </div>
  </div>
</template>
