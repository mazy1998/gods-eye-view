<script setup>
/**
 * Provider Settings rows, rendered from the key-setup owner's state (the
 * server's status: registry text and `set` flags only). Key fields are
 * uncontrolled password inputs: a pasted key never enters this view's or
 * the owner's state; the owner reads the fields once at Save, and after a
 * save (`savedRevision`) the view empties them.
 */
import { ref, watch } from 'vue';
import { t } from '../../i18n/index.js';
import { useOwnerState } from '../ownerState.js';

const props = defineProps({
  channel: { type: Object, required: true },
  onRemove: { type: Function, default: () => {} },
  onToggleCloudVoiceAuth: { type: Function, default: () => {} },
});
const owner = useOwnerState(props.channel);
const inputs = ref([]);

const TIER_DOTS = { metered: '🔴', paid: '🔴', free: '🟡' };
const tierTitle = (tier) =>
  tier === 'metered'
    ? t('Metered — a billing-enabled account')
    : tier === 'paid'
      ? t('Optional paid token — public access works without one')
      : t('Free key — register, paste, done');

watch(
  () => owner.value?.savedRevision,
  () => {
    for (const input of inputs.value) input.value = '';
  },
);
</script>

<template>
  <section
    v-for="key in owner?.status?.keys ?? []"
    :key="key.id"
    class="key-setup-row"
    :data-key-id="key.id"
    :data-set="String(Boolean(key.set))"
    :data-managed="key.managed"
  >
    <div class="key-setup-row-head">
      <span class="key-setup-led" aria-hidden="true"></span>
      <!-- i18n-ignore: provider product name -->
      <strong>{{ key.title }}</strong>
      <span class="key-setup-tier" :title="tierTitle(key.tier)">{{
        TIER_DOTS[key.tier] || ''
      }}</span>
      <span
        v-if="key.clientExposed"
        class="key-setup-exposed"
        :title="
          t(
            'This key runs in the browser by design — restrict it at the provider (see SECURITY.md)',
          )
        "
        >{{ t('browser-side') }}</span
      >
      <!-- Externally supplied credentials are reported, never rewritten. -->
      <span
        v-if="key.managed === 'external'"
        class="key-setup-external"
        :title="
          t(
            'Supplied by your environment, Keychain, or launcher — change it where it was set',
          )
        "
        >{{ t('configured externally') }}</span
      >
      <a
        class="key-setup-get"
        :href="key.getUrl"
        target="_blank"
        rel="noopener noreferrer"
        >{{ key.set ? t('MANAGE ↗') : t('GET KEY ↗') }}</a
      >
    </div>
    <p class="key-setup-unlocks">{{ t(key.unlocks) }}</p>
    <div v-if="key.managed !== 'external'" class="key-setup-fields">
      <!-- Password-style so a pasted key never shows on a recorded screen. -->
      <input
        v-for="envVar in key.envVars"
        :key="envVar"
        ref="inputs"
        type="password"
        autocomplete="off"
        spellcheck="false"
        :data-env-var="envVar"
        :aria-label="envVar"
        :placeholder="
          key.set
            ? t('{envVar} saved — paste to replace', { envVar })
            : t('paste {envVar}', { envVar })
        "
      />
      <button
        v-if="key.managed === 'file'"
        type="button"
        class="key-setup-remove"
        :data-key-setup-remove="JSON.stringify(key.envVars)"
        :title="
          t(`Remove {title} from this app's saved keys`, { title: key.title })
        "
        @click="onRemove(key.envVars)"
      >
        {{ t('REMOVE') }}
      </button>
    </div>
    <div v-if="key.id === 'openai'" class="key-setup-cloud-auth">
      <span class="key-setup-cloud-auth-state">{{
        owner.cloudVoiceAuth === 'oauth'
          ? t('VOICE AUTH · CHATGPT OAUTH')
          : t('VOICE AUTH · API KEY')
      }}</span>
      <!-- Stays focusable while busy; the owner ignores repeats. -->
      <button
        type="button"
        class="key-setup-cloud-auth-toggle"
        data-cloud-voice-auth-toggle="true"
        :title="
          owner.cloudVoiceAuth === 'oauth'
            ? t('Use OPENAI_API_KEY for the next cloud voice session')
            : t(
                'Use the signed-in local ChatGPT/Codex OAuth session for the next cloud voice session',
              )
        "
        :aria-disabled="String(owner.oauthBusy)"
        @click="onToggleCloudVoiceAuth()"
      >
        {{
          owner.cloudVoiceAuth === 'oauth'
            ? t('USE API KEY')
            : t('USE CHATGPT OAUTH')
        }}
      </button>
    </div>
  </section>
</template>
