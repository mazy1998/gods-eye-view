<script setup>
import { formatNumber, t } from '../../i18n/index.js';
defineProps({
  view: { type: Object, required: true },
  onPrevious: { type: Function, required: true },
  onFocus: { type: Function, required: true },
  onNext: { type: Function, required: true },
  onTarget: { type: Function, required: true },
});
</script>
<template>
  <div v-if="view.kind === 'initial'" class="military-awareness-standby">
    <strong>{{ t('Contacts are off') }}</strong>
    <span>{{
      t('Select Contacts to load observed and mapped contacts nearby')
    }}</span>
  </div>
  <div v-else-if="view.kind === 'standby'" class="military-awareness-standby">
    <strong>{{ view.ready ? t('Ready') : t('Contacts are off') }}</strong>
    <span>{{
      view.ready
        ? t('Select a flight, vessel or mapped installation')
        : t('Turn on to load observed and mapped contacts nearby')
    }}</span>
  </div>
  <template v-else-if="view.kind === 'results'">
    <div class="military-awareness-subject">
      {{
        t('Near {subject} · {distance}', {
          subject: view.subject,
          distance: view.window,
        })
      }}
    </div>
    <details
      v-if="view.names.length"
      :key="`subject:${view.revision}`"
      class="military-awareness-names"
    >
      <summary>
        {{ t('Named areas ({n})', { n: formatNumber(view.names.length) }) }}
      </summary>
      <div>
        <template v-for="(name, index) in view.names" :key="index"
          ><br v-if="index" />{{ name }}</template
        >
      </div>
    </details>
    <div
      class="military-awareness-controls"
      role="group"
      :aria-label="t('Global Context navigation')"
    >
      <button
        type="button"
        data-awareness-action="previous"
        :title="t('Previous — prior visited contact in the 250 km window')"
        :disabled="!view.canPrevious"
        @click="onPrevious"
      >
        {{ t('Previous') }}
      </button>
      <button type="button" data-awareness-action="focus" @click="onFocus">
        {{ t('Focus') }}
      </button>
      <button
        type="button"
        data-awareness-action="next"
        :title="t('Next — nearest unvisited contact in the 250 km window')"
        :disabled="!view.canNext"
        @click="onNext"
      >
        {{ t('Next') }}
      </button>
    </div>
    <section
      v-for="cohort in view.cohorts"
      :key="cohort.id"
      class="military-awareness-row"
      :class="cohort.relationship"
    >
      <div>
        <strong>{{ cohort.label }}</strong
        ><b aria-live="polite"
          >{{ cohort.count }}{{ cohort.page ? ` · ${cohort.page}` : '' }}</b
        >
      </div>
      <small
        >{{ cohort.source
        }}{{ cohort.coverage ? ` · ${cohort.coverage}` : '' }} ·
        {{ cohort.reason }}</small
      >
      <ul v-if="cohort.targets.length">
        <li v-for="target in cohort.targets" :key="target.key">
          <span
            v-if="!target.id"
            class="military-awareness-target unavailable"
            :aria-label="t('Unavailable')"
            >{{ target.label }} <span>{{ target.distance }}</span></span
          >
          <template v-else>
            <!-- The glyph sits beside the button so the name stays its
                 first text. -->
            <span
              v-if="target.layer === 'ais-live-vessels'"
              class="material-symbols-outlined military-awareness-glyph"
              aria-hidden="true"
              >directions_boat</span
            >
            <span
              v-else-if="target.layer === 'military-installations'"
              class="material-symbols-outlined military-awareness-glyph"
              aria-hidden="true"
              >account_balance</span
            >
            <span
              v-else
              class="material-symbols-outlined military-awareness-glyph"
              aria-hidden="true"
              >flight</span
            >
            <button
              type="button"
              class="military-awareness-target"
              :data-awareness-layer="target.layer"
              :data-awareness-id="target.id"
              :aria-label="target.focusLabel"
              @click="onTarget(target.layer, target.id)"
            >
              {{ target.label }} <span>{{ target.distance }}</span>
            </button>
            <details
              v-if="target.names.length"
              :key="`${target.key}:${view.revision}`"
              class="military-awareness-names"
            >
              <summary>
                {{
                  t('Named areas ({n})', {
                    n: formatNumber(target.names.length),
                  })
                }}
              </summary>
              <div>
                <template v-for="(name, index) in target.names" :key="index"
                  ><br v-if="index" />{{ name }}</template
                >
              </div>
            </details>
          </template>
        </li>
      </ul>
    </section>
    <p
      class="military-awareness-note"
      tabindex="-1"
      data-awareness-focus-continuation
    >
      {{
        t(
          'Open-source mapped/observed context. Missing broadcasts, unloaded map areas, or unmapped sites are not evidence of absence.',
        )
      }}
    </p>
    <section
      class="military-awareness-selected"
      :aria-label="t('Selected contact')"
    >
      <h3>{{ view.subject }}</h3>
      <p v-if="view.subjectSource">{{ view.subjectSource }}</p>
    </section>
  </template>
</template>
