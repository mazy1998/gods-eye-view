<script setup>
import { t } from '../../i18n/index.js';
defineProps({
  detail: { type: Object, default: null },
  replay: { type: Object, required: true },
  onDeselect: { type: Function, required: true },
  onFocusSite: { type: Function, required: true },
  onReplay: { type: Function, required: true },
  onTogglePause: { type: Function, required: true },
  onCancelReplay: { type: Function, required: true },
  onReplaySpeed: { type: Function, required: true },
  onPrevious: { type: Function, required: true },
  onNext: { type: Function, required: true },
});
</script>
<template>
  <aside
    id="space-mission-panel"
    class="context-space-mission-detail"
    :aria-label="t('Selected Space Mission')"
    :hidden="!detail"
  >
    <template v-if="detail">
      <div class="space-mission-view-header">
        <span>{{ t('Selected mission') }}</span
        ><button
          type="button"
          data-mission-close
          :title="t('Show all missions')"
          :aria-label="t('Deselect mission')"
          @click="onDeselect"
        >
          ×
        </button>
      </div>
      <div class="space-mission-detail">
        <strong data-mission-title>{{ detail.title }}</strong>
        <span
          data-mission-field
          data-mission-provider
          :hidden="!detail.provider"
          >{{ detail.provider }}</span
        >
        <span data-mission-field :hidden="!detail.status"
          ><small>{{ t('Status') }}</small
          ><b data-mission-status>{{ detail.status }}</b></span
        >
        <span data-mission-field :hidden="!detail.site"
          ><small>{{ t('Launch site') }}</small
          ><b data-mission-site>{{ detail.site }}</b></span
        >
        <span data-mission-field :hidden="!detail.time"
          ><small>{{ t('Launch time') }}</small
          ><b data-mission-time>{{ detail.time }}</b></span
        >
        <span data-mission-field :hidden="!detail.orbit"
          ><small>{{ t('Orbit') }}</small
          ><b data-mission-orbit>{{ detail.orbit }}</b></span
        >
        <span
          ><small>{{ t('Ascent path') }}</small
          ><b data-mission-ascent-source>{{ detail.ascent }}</b></span
        >
        <span data-mission-field :hidden="!detail.distance"
          ><small>{{ t('Distance from Earth') }}</small
          ><b data-mission-distance>{{ detail.distance }}</b></span
        >
        <span data-mission-field :hidden="!detail.speed"
          ><small>{{ t('Satellite speed') }}</small
          ><b data-mission-speed :title="detail.speedTitle || undefined">{{
            detail.speed
          }}</b></span
        >
      </div>
      <section class="mission-data-section">
        <h4>{{ t('Payload') }}</h4>
        <div class="mission-table-scroll">
          <table class="mission-data-table">
            <thead>
              <tr>
                <th>{{ t('Name') }}</th>
                <th>{{ t('Type') }}</th>
                <th>{{ t('Destination') }}</th>
              </tr>
            </thead>
            <tbody data-mission-payloads>
              <tr v-for="row in detail.payloads" :key="row.key">
                <td>
                  {{ row.name
                  }}<small v-if="row.detail">{{ row.detail }}</small>
                </td>
                <td>{{ row.type }}</td>
                <td>{{ row.destination }}</td>
              </tr>
              <tr v-if="detail.morePayloads">
                <td colspan="3" class="mission-table-empty">
                  {{ detail.morePayloads }}
                </td>
              </tr>
              <tr v-if="!detail.payloads.length">
                <td colspan="3" class="mission-table-empty">
                  {{ t('No payload data') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section
        class="mission-data-section"
        data-mission-stages-section
        :hidden="!detail.stages.length"
      >
        <h4>{{ t('Stages and recovery') }}</h4>
        <div class="mission-table-scroll">
          <table class="mission-data-table">
            <thead>
              <tr>
                <th>{{ t('Stage') }}</th>
                <th>{{ t('Status') }}</th>
                <th>{{ t('Final position') }}</th>
              </tr>
            </thead>
            <tbody data-mission-stages>
              <tr v-for="row in detail.stages" :key="row.key">
                <td>
                  {{ row.name
                  }}<small v-if="row.detail">{{ row.detail }}</small>
                </td>
                <td>{{ row.status }}</td>
                <td>
                  {{ row.destination }}<small>{{ row.position }}</small>
                </td>
              </tr>
              <tr v-if="!detail.stages.length">
                <td colspan="3" class="mission-table-empty">
                  {{ t('No stage re-entry or recovery data') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div class="mission-replay-speed-control" :hidden="!replay.available">
        <div class="mission-replay-speed-header">
          <label for="space-mission-replay-speed">{{ t('Replay speed') }}</label
          ><output
            class="gev-slider-value"
            for="space-mission-replay-speed"
            data-mission-replay-speed-output
            >{{ replay.speedText }}</output
          >
        </div>
        <input
          id="space-mission-replay-speed"
          class="gev-quantitative-slider"
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          :value="replay.speed"
          :style="{ '--replay-speed-progress': replay.progress }"
          data-mission-replay-speed
          :aria-label="t('Replay speed multiplier')"
          @input="onReplaySpeed($event.currentTarget.value)"
        />
        <div class="mission-replay-speed-scale" aria-hidden="true">
          <span>0.25×</span><span>1×</span><span>4×</span>
        </div>
      </div>
      <div class="mission-action-row">
        <button
          type="button"
          class="mission-focus-button"
          data-mission-focus
          @click="onFocusSite"
        >
          {{ t('Focus') }}
        </button>
        <button
          type="button"
          class="mission-replay-button"
          data-mission-replay
          :aria-pressed="String(replay.active)"
          :hidden="replay.active || !replay.available"
          :disabled="!replay.available"
          :title="t('Replay the estimated ascent with a following camera')"
          @click="onReplay"
        >
          {{ t('Replay ascent') }}
        </button>
        <div
          class="mission-replay-transport"
          :class="{ 'is-paused': replay.active && replay.paused }"
          data-mission-replay-transport
          :aria-label="replay.phase || undefined"
          :hidden="!replay.active"
        >
          <button
            type="button"
            data-mission-replay-toggle
            :disabled="!replay.active"
            :title="replay.paused ? t('Resume replay') : t('Pause replay')"
            :aria-label="replay.paused ? t('Resume replay') : t('Pause replay')"
            @click="onTogglePause"
          >
            {{ replay.paused ? '▶' : 'Ⅱ' }}
          </button>
          <button
            type="button"
            class="cancel"
            data-mission-replay-cancel
            :title="t('Cancel replay')"
            :aria-label="t('Cancel replay')"
            @click="onCancelReplay"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      <div class="space-mission-nav">
        <button
          type="button"
          class="mission-nav-button"
          data-mission-prev
          :title="t('Previous mission')"
          :disabled="!detail.canPrevious"
          @click="onPrevious"
        >
          <span aria-hidden="true">‹</span> {{ t('Previous') }}
        </button>
        <span class="mission-nav-index" data-mission-index>{{
          detail.position
        }}</span>
        <button
          type="button"
          class="mission-nav-button"
          data-mission-next
          :title="t('Next mission')"
          :disabled="!detail.canNext"
          @click="onNext"
        >
          {{ t('Next') }} <span aria-hidden="true">›</span>
        </button>
      </div>
      <button
        type="button"
        class="panel-layer-toggle"
        data-mission-show-all
        @click="onDeselect"
      >
        {{ t('Show all missions') }}
      </button>
    </template>
  </aside>
</template>
