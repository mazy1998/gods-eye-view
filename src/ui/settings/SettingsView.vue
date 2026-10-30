<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { t } from '../../i18n/index.js';
import { useOwnerState } from '../ownerState.js';
import TabList from '../primitives/TabList.vue';
import ActionButton from '../primitives/ActionButton.vue';
import AppearancePicker from './AppearancePicker.vue';

const props = defineProps({
  surface: { type: Object, required: true },
  appearance: Object,
});
const state = useOwnerState(props.surface.channel);
const providers = ref(null);
const language = ref(null);
const storageNote = ref(null);
let releaseProviders;
let restoreLanguage;
onMounted(() => {
  releaseProviders = props.surface.hostProviders(
    providers.value,
    storageNote.value,
  );
  const picker = language.value.ownerDocument.getElementById('locale-picker');
  if (!picker?.parentNode) return;
  const home = picker.ownerDocument.createComment('language picker home');
  picker.before(home);
  language.value.append(picker);
  restoreLanguage = () => {
    if (home.isConnected && picker.parentNode === language.value)
      home.after(picker);
    home.remove();
  };
});
onBeforeUnmount(() => {
  props.surface.closeLanguage();
  releaseProviders?.();
  restoreLanguage?.();
});
</script>

<template>
  <section class="gev-settings gev-surface" :aria-label="t('Settings')">
    <TabList
      :model-value="state.section"
      :label="t('Settings')"
      :tabs="[
        { value: 'providers', label: t('Providers') },
        { value: 'voice', label: t('Voice') },
        { value: 'language', label: t('Language & help') },
      ]"
      @update:model-value="surface.select($event)"
    />
    <section
      v-show="state.section === 'providers'"
      class="gev-settings-section"
      :aria-label="t('Providers')"
    >
      <p>{{ t('The globe works without keys.') }}</p>
      <p v-if="!state.providersReady" role="status">
        {{ t('Loading provider settings…') }}
      </p>
      <p v-else-if="!state.providersAvailable">
        {{
          t('Provider keys can be configured on the machine running the app.')
        }}
      </p>
      <ActionButton
        v-else-if="!state.providersEmbedded"
        :label="t('Open provider settings')"
        @click="surface.openProviders()"
      />
      <div ref="providers" class="gev-settings-providers"></div>
      <details v-show="state.providersEmbedded" class="gev-settings-storage">
        <summary>{{ t('How keys are stored') }}</summary>
        <div ref="storageNote"></div>
      </details>
    </section>
    <section
      v-show="state.section === 'voice'"
      class="gev-settings-section"
      :aria-label="t('Voice')"
    >
      <h3>{{ t('Voice') }}</h3>
      <p v-if="!state.voiceAvailable">
        {{ t('Voice settings are unavailable.') }}
      </p>
      <p>{{ t('Manage voice preview, inactivity timeout and model tier.') }}</p>
      <ActionButton
        :label="t('Voice Settings')"
        :disabled="!state.voiceAvailable"
        aria-controls="gev-voice-panel"
        @click="surface.openVoice()"
      />
    </section>
    <section
      v-show="state.section === 'language'"
      class="gev-settings-section"
      :aria-label="t('Language & help')"
    >
      <h3>{{ t('Language') }}</h3>
      <div ref="language" class="gev-settings-language"></div>
      <AppearancePicker v-if="appearance" :appearance="appearance" />
      <h3>{{ t('Help') }}</h3>
      <a
        href="https://github.com/bilawalsidhu/gods-eye-view#readme"
        target="_blank"
        rel="noopener noreferrer"
        >{{ t('Help & documentation') }}</a
      >
    </section>
  </section>
</template>
