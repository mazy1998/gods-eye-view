import {
  formatAwarenessLabel,
  AWARENESS_RADIUS_M,
} from '../../data/militaryAwarenessEngine.js';
import { formatNumber, t, translateKnown } from '../../i18n/index.js';
import { formatQuantity } from '../../ui/unitLabels.js';
import { AWARENESS_PAGE_SIZE, AWARENESS_PAGE_ROTATE_MS } from './policy.js';

/** Format a cohort total without presenting a retained cap as exact. */
export function formatAwarenessCount(summary = {}) {
  if (!Number.isFinite(summary.count)) return '?';
  const count = summary.count.toLocaleString('en-US');
  return summary.complete === false || summary.truncated === true
    ? `At least ${count}`
    : count;
}

/** The count as the panel shows it, in the UI language. */
function presentAwarenessCount(summary = {}) {
  if (!Number.isFinite(summary.count)) return '?';
  const count = formatNumber(summary.count);
  return summary.complete === false || summary.truncated === true
    ? t('At least {count}', { count })
    : count;
}

/** A distance as the panel shows it: 850 m, 4.6 km, 120 km, in the UI language. */
export function presentAwarenessDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  const wholeMeters = Math.round(meters);
  if (wholeMeters < 1000) return formatQuantity(wholeMeters, 'm');
  const digits = meters < 10000 ? 1 : 0;
  return formatQuantity(meters / 1000, 'km', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** The cohort's reason, kept English in data, shown in the UI language. */
function presentAwarenessReason(summary = {}) {
  return summary.reasonTemplate
    ? t(summary.reasonTemplate, summary.reasonValues)
    : translateKnown(summary.reason || '');
}

export function createPanel({ state: layerState, services, parts, source }) {
  function ensurePanel() {
    if (layerState.panel) return layerState.panel;
    const existing = document.getElementById('military-awareness-panel');
    const panel = existing || document.createElement('aside');
    layerState.panelOwned = !existing;
    if (!existing) {
      panel.id = 'military-awareness-panel';
      document.body.appendChild(panel);
    }
    layerState.panel = panel;
    return panel;
  }

  /**
   * Publish what the panel shows. An unchanged view publishes nothing, so a
   * live refresh that changes no text leaves the panel and its open Named
   * areas alone; a changed one takes a new revision. Views paint
   * synchronously, so focus is captured before and restored after.
   */
  function publishPanelView(view) {
    const signature = JSON.stringify(view);
    if (layerState.panelSignature === signature) return;
    layerState.panelSignature = signature;
    const focusSnapshot = captureAwarenessPanelFocus(layerState.panel);
    layerState.panelView = {
      ...view,
      revision: layerState.panelView.revision + 1,
    };
    layerState.panelChannel.publish();
    restoreAwarenessPanelFocus(layerState.panel, focusSnapshot);
  }

  function hidePanel() {
    if (layerState.panel) {
      layerState.panel.hidden = false;
      publishPanelView({ kind: 'standby', ready: layerState.enabled });
    }
    if (layerState.directionRoot) layerState.directionRoot.hidden = true;
  }

  /** Empty the panel when the layer is destroyed. */
  function clearPanel() {
    publishPanelView({ kind: 'empty' });
  }

  function cohortView(cohort) {
    const summary = cohort.summary;
    const page = layerState.cohortPages.get(cohort.id) || 0;
    const pageCount = Math.max(
      1,
      Math.ceil(summary.nearest.length / AWARENESS_PAGE_SIZE),
    );
    return {
      id: cohort.id,
      label: cohort.label,
      relationship: summary.relationship.toLowerCase(),
      count: presentAwarenessCount(summary),
      page:
        pageCount > 1
          ? `${Math.floor(page / AWARENESS_PAGE_SIZE) + 1}/${pageCount}`
          : '',
      source: cohort.source,
      coverage: cohort.coverage || '',
      reason: presentAwarenessReason(summary),
      targets: summary.nearest
        .slice(page, page + AWARENESS_PAGE_SIZE)
        .map((item, index) => {
          const label = formatAwarenessLabel(item);
          const id = item.icao24 || item.mmsi || item.id;
          const distance = presentAwarenessDistance(item.distanceM);
          if (!id) return { key: `unavailable:${index}`, label, distance };
          return {
            key: `${cohort.id}:${id}`,
            layer: cohort.id,
            id: String(id),
            label,
            distance,
            focusLabel: t('Focus {label}', {
              label: label === '—' ? t('Unavailable') : label,
            }),
            names: item.memberNames || [],
          };
        }),
    };
  }

  function renderResults() {
    if (!layerState.enabled || !layerState.results) return hidePanel();
    const panel = ensurePanel();
    const { subject, cohorts } = layerState.results;
    const subjectCohort = cohorts.find(
      (cohort) => cohort.id === subject.layerId,
    );
    panel.hidden = false;
    publishPanelView({
      kind: 'results',
      subject: subject.label,
      // Where the selected contact comes from: its cohort and that feed.
      subjectSource: subjectCohort
        ? `${subjectCohort.label} · ${subjectCohort.source}`
        : '',
      window: presentAwarenessDistance(AWARENESS_RADIUS_M),
      names: subject.memberNames || [],
      canPrevious: layerState.navigationIndex > 0,
      canNext: parts.navigation.canNavigateNext(),
      cohorts: cohorts.map(cohortView),
    });
  }

  /** Stable identity for a Contacts-panel button across live repaints. */

  function awarenessPanelControlKey(element) {
    const control = element?.closest?.(
      'button[data-awareness-action], button[data-awareness-layer][data-awareness-id]',
    );
    if (!control) return null;
    if (control.dataset.awarenessAction)
      return `action:${control.dataset.awarenessAction}`;
    return `target:${control.dataset.awarenessLayer}:${control.dataset.awarenessId}`;
  }

  /** Capture stable identity so a live repaint can restore only the same control. */

  function captureAwarenessPanelFocus(
    panel,
    activeElement = document.activeElement,
  ) {
    if (!panel?.contains?.(activeElement)) return null;
    if (activeElement?.matches?.('[data-awareness-focus-continuation]')) {
      return { key: 'continuation' };
    }
    const key = awarenessPanelControlKey(activeElement);
    if (!key) return null;
    return { key };
  }

  /** Restore the same control, or continue beyond the list when it is no longer rendered. */

  function restoreAwarenessPanelFocus(panel, snapshot) {
    if (!panel || !snapshot) return null;
    const continuation = panel.querySelector(
      '[data-awareness-focus-continuation]',
    );
    const controls = [
      ...panel.querySelectorAll(
        'button[data-awareness-action], button[data-awareness-layer][data-awareness-id]',
      ),
    ].filter((control) => !control.disabled);
    const retained =
      snapshot.key === 'continuation'
        ? continuation
        : controls.find(
            (control) => awarenessPanelControlKey(control) === snapshot.key,
          );
    const target = retained || continuation;
    target?.focus?.({ preventScroll: true });
    return target || null;
  }

  function rotateAwarenessPages() {
    if (!layerState.enabled || !layerState.results) return;
    let changed = false;
    for (const cohort of layerState.results.cohorts) {
      const pageCount = Math.max(
        1,
        Math.ceil(cohort.summary.nearest.length / AWARENESS_PAGE_SIZE),
      );
      if (pageCount <= 1) continue;
      const current = layerState.cohortPages.get(cohort.id) || 0;
      layerState.cohortPages.set(
        cohort.id,
        ((Math.floor(current / AWARENESS_PAGE_SIZE) + 1) % pageCount) *
          AWARENESS_PAGE_SIZE,
      );
      changed = true;
    }
    if (changed) {
      renderResults();
      parts.rendering.scheduleDirectionOverlayUpdate(true);
    }
  }

  function startAwarenessPageRotation() {
    if (!layerState.pageTimer)
      layerState.pageTimer = window.setInterval(
        rotateAwarenessPages,
        AWARENESS_PAGE_ROTATE_MS,
      );
  }

  function stopAwarenessPageRotation() {
    if (layerState.pageTimer) window.clearInterval(layerState.pageTimer);
    layerState.pageTimer = null;
  }

  /**
   * Whether an evaluation actually has a contact to point an arrow at.
   *
   * A cohort reports `count: null` when its feed is unavailable or stale, and `0`
   * when the feed is healthy but empty. Only a positive count puts a marker on
   * the compass rim, so anything else means there is nothing to animate.
   * @param {?{cohorts?: Array<{summary?: {count: ?number}}>}} results
   * @returns {boolean}
   */

  function awarenessResultsAreLive(results) {
    const cohorts = Array.isArray(results?.cohorts) ? results.cohorts : [];
    return cohorts.some((cohort) => Number(cohort?.summary?.count) > 0);
  }
  return {
    ensurePanel,
    hidePanel,
    clearPanel,
    awarenessPanelControlKey,
    captureAwarenessPanelFocus,
    restoreAwarenessPanelFocus,
    renderResults,
    rotateAwarenessPages,
    startAwarenessPageRotation,
    stopAwarenessPageRotation,
    awarenessResultsAreLive,
  };
}
