<script setup>
import { t } from '../i18n/index.js';
import ActionButton from './primitives/ActionButton.vue';
defineProps({
  presentation: { type: Object, required: true },
  availability: { type: Object, default: () => ({}) },
  actions: { type: Object, default: null },
});
</script>
<template>
  <article class="gev-aircraft-card" tabindex="-1">
    <p v-if="presentation.operator" class="gev-aircraft-operator">
      {{ presentation.operator }}
    </p>
    <div class="gev-aircraft-actions">
      <ActionButton
        :disabled="!availability.cockpit"
        :title="availability.cockpitReason || undefined"
        :aria-describedby="
          availability.cockpitReason ? 'gev-aircraft-cockpit-reason' : undefined
        "
        @click="actions?.cockpit?.()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">flight</span
        >{{ t('Cockpit') }}
      </ActionButton>
      <ActionButton
        :disabled="!availability.contacts"
        :title="availability.contactsReason || undefined"
        @click="actions?.contacts?.()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">group</span
        >{{ t('Contacts') }}
      </ActionButton>
    </div>
    <p
      v-if="availability.cockpitReason"
      id="gev-aircraft-cockpit-reason"
      class="gev-aircraft-action-reason"
    >
      {{ availability.cockpitReason }}
    </p>
    <p v-if="presentation.emergency" class="gev-aircraft-warning">
      {{ presentation.emergency }}
    </p>
    <section
      v-if="presentation.route"
      class="gev-aircraft-route"
      :aria-label="t('Route')"
    >
      <div role="group" :aria-label="t('Origin')">
        <strong>{{ presentation.route.origin.code }}</strong
        ><span v-if="presentation.route.origin.name">{{
          presentation.route.origin.name
        }}</span>
      </div>
      <span class="gev-aircraft-route-arrow" aria-hidden="true">→</span>
      <div role="group" :aria-label="t('Destination')">
        <strong>{{ presentation.route.destination.code }}</strong
        ><span v-if="presentation.route.destination.name">{{
          presentation.route.destination.name
        }}</span>
      </div>
    </section>
    <dl v-if="presentation.telemetry.length" class="gev-aircraft-metrics">
      <div v-for="row in presentation.telemetry" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>
          <strong>{{ row.number }}</strong
          ><span>{{ row.separator }}{{ row.unit }}</span>
        </dd>
      </div>
    </dl>
    <dl v-if="presentation.details.length" class="gev-aircraft-details">
      <div v-for="row in presentation.details" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <section
      v-if="presentation.nearby.length"
      class="gev-aircraft-nearby"
      :aria-label="t('Nearby aircraft')"
    >
      <h3>{{ t('Nearby aircraft') }}</h3>
      <ActionButton
        v-for="contact in presentation.nearby"
        :key="contact.key"
        class="gev-aircraft-nearby-button"
        :data-aircraft-key="contact.key"
        @click="actions?.nearby?.(contact.key)"
      >
        <span class="gev-aircraft-nearby-name">{{ contact.label }}</span>
        <span
          >{{ contact.distance
          }}<span v-if="contact.altitude"> · {{ contact.altitude }}</span></span
        >
        <span aria-hidden="true">›</span>
      </ActionButton>
    </section>
    <footer class="gev-aircraft-source">
      <span v-if="presentation.source"
        >{{ presentation.sourceLabel }}: {{ presentation.source }}</span
      >
      <span>{{ presentation.received }}</span>
      <strong v-if="presentation.stale">{{ presentation.stale }}</strong>
    </footer>
  </article>
</template>
