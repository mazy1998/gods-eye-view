<script setup>
import { computed } from 'vue';
import { t } from '../i18n/index.js';
import { recentImageryView } from './recentImageryPresentation.js';
const props = defineProps({
  snapshot: { type: Object, required: true },
  detailsOpen: Boolean,
  exportError: { type: String, default: null },
  exporting: { type: Array, default: () => [] },
});
const view = computed(() =>
  recentImageryView(props.snapshot, props.exportError, props.exporting),
);
</script>
<template>
  <section
    class="recent-imagery-readout"
    :aria-label="t('Recent imagery')"
    :data-mode="snapshot.mode"
    :hidden="!snapshot.enabled"
  >
    <div id="ri-actions" class="ri-block ri-actions-row">
      <div class="rail-card-block rail-card-actions" data-block-id="box">
        <button
          type="button"
          class="data-toggle-chip"
          data-action-id="select-box"
          :title="t('Drag a box on the map (Esc cancels)')"
          :aria-pressed="String(Boolean(snapshot.toolActive))"
          :class="{ active: snapshot.toolActive }"
        >
          {{ t('SELECT BOX') }}
        </button>
        <button
          type="button"
          class="data-toggle-chip"
          data-action-id="use-view"
          :title="t('Use the current view as the box')"
        >
          {{ t('USE VIEW') }}
        </button>
        <button
          type="button"
          class="data-toggle-chip"
          data-action-id="clear"
          :title="t('Forget the box and its images')"
          :disabled="!snapshot.box && !snapshot.boxError"
        >
          {{ t('CLEAR', { context: 'action' }) }}
        </button>
      </div>
    </div>
    <div
      id="ri-notice"
      class="ri-block ri-line ri-notice"
      :class="{
        warn: view.warning,
        info: !view.warning && Boolean(view.notice),
        'has-action': Boolean(snapshot.zoomToFit),
      }"
    >
      <span
        id="ri-notice-text"
        class="ri-notice-text"
        role="status"
        aria-live="polite"
        :title="view.notice"
        >{{ view.notice }}</span
      >
      <button
        id="ri-zoom-in"
        type="button"
        class="data-toggle-chip ri-zoom-in"
        :class="{ 'is-reserved': !snapshot.zoomToFit }"
        :disabled="!snapshot.zoomToFit"
        :aria-hidden="String(!snapshot.zoomToFit)"
        :title="t('Fly in until the view fits the 1,000 km limit')"
      >
        {{ t('ZOOM IN') }}
      </button>
    </div>
    <div
      id="ri-strip"
      class="ri-block ri-strip"
      :class="{ searching: snapshot.searching }"
      tabindex="0"
      role="listbox"
      aria-orientation="horizontal"
      :aria-label="
        t('Imagery days, newest first · arrows move, S or A and B pin')
      "
      aria-keyshortcuts="A B S"
      :aria-activedescendant="
        snapshot.candidates[snapshot.focusIndex]
          ? `ri-card-${snapshot.focusIndex}`
          : undefined
      "
    >
      <div
        v-for="card in view.cards"
        :key="card.key"
        :id="card.id"
        class="ri-card"
        :data-key="card.key"
        role="option"
        :class="{
          focused: card.focused,
          pinned: card.pinned,
          preview: card.preview,
        }"
        :aria-selected="String(card.focused)"
        :aria-label="card.aria"
      >
        <div class="ri-thumb" :data-status="card.status">
          <img
            v-if="card.imageUrl"
            class="ri-thumb-img"
            :src="card.imageUrl"
            alt=""
            decoding="async"
          />
          <span class="ri-thumb-text" :hidden="Boolean(card.imageUrl)">{{
            card.placeholder
          }}</span>
          <span class="ri-card-flag" :hidden="!card.flag">{{ card.flag }}</span>
          <span
            class="ri-card-start"
            :hidden="!card.recommended"
            :title="card.startTitle"
            >{{ t('START HERE') }}</span
          >
        </div>
        <div class="ri-card-date">{{ card.day }}</div>
        <div class="ri-card-sensor">{{ card.sensor }}</div>
        <div class="ri-card-cloud">{{ card.cloud }}</div>
        <div class="ri-card-chips">
          <button
            v-for="chip in card.chips"
            :key="chip.slotId"
            type="button"
            tabindex="-1"
            class="data-toggle-chip ri-chip"
            :data-slot="chip.slotId"
            :disabled="chip.disabled"
            :class="{ active: chip.active, 'is-reserved': chip.reserved }"
            :aria-pressed="String(chip.active)"
            :aria-hidden="String(chip.reserved)"
            :aria-label="chip.aria"
          >
            {{ chip.label }}
          </button>
        </div>
      </div>
      <div class="ri-strip-empty" :hidden="view.cards.length > 0">
        {{ view.empty }}
      </div>
    </div>
    <div id="ri-hint" class="ri-block ri-line ri-hint" :title="view.hint">
      {{ view.hint }}
    </div>
    <section
      id="ri-selection"
      class="ri-block ri-selection"
      :aria-label="t('On the map')"
      :data-mode="snapshot.mode"
    >
      <div
        id="ri-mode"
        class="gev-segmented ri-mode"
        role="radiogroup"
        :aria-label="t('Mode')"
      >
        <button
          v-for="mode in view.modes"
          :key="mode.id"
          type="button"
          class="gev-segment ri-mode-btn"
          :data-mode="mode.id"
          role="radio"
          :aria-checked="String(snapshot.mode === mode.id)"
          :tabindex="snapshot.mode === mode.id ? 0 : -1"
          :class="{ active: snapshot.mode === mode.id }"
        >
          {{ mode.label }}
        </button>
      </div>
      <div
        v-for="slot in view.slots"
        :key="slot.slotId"
        :id="`ri-slot-${slot.slotId}`"
        class="ri-slot"
        :class="{ lit: slot.lit }"
        :data-state="slot.state"
      >
        <span class="ri-slot-tag">{{ slot.tag }}</span>
        <span class="ri-slot-value" :title="slot.text">{{ slot.text }}</span>
        <button
          :id="`ri-unpin-${slot.slotId}`"
          class="data-toggle-chip ri-unpin"
          type="button"
          :data-unpin="slot.slotId"
          :class="{ 'is-reserved': !slot.pinned }"
          :disabled="!slot.pinned"
          :aria-hidden="String(!slot.pinned)"
          :aria-label="slot.unpin"
          :title="slot.unpin"
        >
          {{ '×' }}
        </button>
      </div>
    </section>
    <div id="ri-controls" class="ri-block ri-controls">
      <label for="ri-opacity" class="ri-opacity-label"
        ><span>{{ t('OPACITY') }}</span
        ><span class="ri-opacity-value">{{ view.alpha }}%</span></label
      >
      <input
        id="ri-opacity"
        class="gev-quantitative-slider ri-opacity"
        type="range"
        min="0"
        max="100"
        step="1"
        :value="view.alpha"
        :aria-label="t('Imagery opacity')"
        :disabled="!snapshot.shown.a && !snapshot.shown.b"
      />
      <button
        id="ri-swap"
        type="button"
        class="data-toggle-chip ri-swap"
        :class="{
          'is-reserved': !snapshot.comparison.active,
          active: snapshot.comparison.active && snapshot.swapped,
        }"
        :disabled="!snapshot.comparison.active"
        :aria-hidden="String(!snapshot.comparison.active)"
        :aria-pressed="
          String(Boolean(snapshot.comparison.active && snapshot.swapped))
        "
        :title="t('Trade the two sides of the divider')"
      >
        {{ t('SWAP') }}
      </button>
      <div class="ri-exports">
        <div class="rail-card-block rail-card-actions" data-block-id="export">
          <button
            type="button"
            v-for="item in view.exports"
            :key="item.slotId"
            class="data-toggle-chip"
            :data-action-id="`export-${item.slotId}`"
            :title="item.title"
            :disabled="item.disabled"
            :class="{ 'is-reserved': item.reserved }"
            :aria-hidden="
              item.slotId === 'b' ? String(item.reserved) : undefined
            "
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>
    <div id="ri-details" class="ri-details">
      <article
        class="rail-card ri-details-card"
        data-card-id="details"
        :class="{ 'is-open': detailsOpen }"
        :data-open="String(detailsOpen)"
      >
        <button
          type="button"
          class="rail-card-header"
          :aria-expanded="String(detailsOpen)"
          aria-controls="ri-details-body"
        >
          <span class="rail-card-labels"
            ><span class="rail-card-heading"
              ><span class="data-icon" aria-hidden="true" hidden></span
              ><span
                class="rail-card-title rail-card-nowrap"
                :title="t('Details')"
                >{{ t('Details') }}</span
              ></span
            ></span
          >
          <span class="rail-card-disclosure" aria-hidden="true">{{
            detailsOpen ? '▾' : '▸'
          }}</span>
          <span class="rail-card-compact" :hidden="detailsOpen">{{
            view.compact
          }}</span>
        </button>
        <div id="ri-details-body" class="rail-card-body" :hidden="!detailsOpen">
          <div class="rail-card-block rail-card-lines" data-block-id="lines">
            <div
              v-for="line in view.detailLines"
              :key="line.id"
              class="rail-card-line"
              :class="{ muted: line.muted }"
              :data-line-id="line.id"
            >
              {{ line.text }}
            </div>
          </div>
          <div
            class="rail-card-block rail-card-actions"
            data-block-id="empty-days"
          >
            <button
              type="button"
              class="data-toggle-chip"
              data-action-id="toggle-empty"
              :title="t('Days the probe found empty in this box')"
              :disabled="!snapshot.showUnavailable && !snapshot.hiddenCount"
            >
              {{ view.emptyDaysLabel }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
