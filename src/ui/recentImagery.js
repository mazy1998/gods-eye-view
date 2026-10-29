/** Recent Imagery view adapter. The layer owns AOI, selection and compare;
 * this adapter owns disclosure, export progress, keyboard and DOM geometry. */
import { t } from '../i18n/index.js';
import { mountView } from './mountView.js';
import RecentImageryView from './RecentImageryView.vue';
import { createImagerySplit } from './imagerySplit.js';
import { createSegmentedControl } from './segmentedControl.js';
import { wvsSnapshotUrl } from '../layers/recentImagery/model.js';
import {
  sensorLine,
  countText,
  longerSideKm,
  exportTarget as targetFor,
} from './recentImageryPresentation.js';
export { localizeNotice } from './recentImageryPresentation.js';
const PANEL_ID = 'recent-imagery-panel';
const appearedDocuments = new WeakSet();
const KEY_STEPS = {
  ArrowLeft: (index) => index - 1,
  ArrowRight: (index) => index + 1,
  Home: () => 0,
  End: (index, total) => total - 1,
};
function revealCard(scroller, card) {
  const height = scroller?.clientHeight;
  if (!(height > 0) || typeof card?.getBoundingClientRect !== 'function')
    return;
  const view = scroller.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const top = box.top - view.top - (scroller.clientTop || 0);
  const delta =
    top < 0 || box.height > height
      ? top
      : Math.max(0, top + box.height - height);
  if (delta) scroller.scrollTop = (scroller.scrollTop || 0) + delta;
}

/**
 * Mount the readout into the panel body.
 * @param {{ container: HTMLElement, layer: object, viewer?: object, tool?: object, createSplit?: Function, fetchImpl?: typeof fetch, createObjectUrl?: Function, revokeObjectUrl?: Function, requestRender?: Function }} deps
 * @returns {{ root: HTMLElement, exportImage: (slot?: 'a' | 'b') => Promise<boolean>, destroy: () => void } | null}
 */
export function createRecentImageryPanel({
  container,
  layer,
  viewer = null,
  tool = null,
  createSplit = createImagerySplit,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  createObjectUrl = (blob) => URL.createObjectURL(blob),
  revokeObjectUrl = (url) => URL.revokeObjectURL(url),
  requestRender = () => viewer?.scene?.requestRender?.(),
} = {}) {
  const document = container?.ownerDocument;
  if (!document?.createElement || !layer) return null;
  const panel = document.getElementById?.(PANEL_ID) || null;
  const count = document.getElementById?.(`${PANEL_ID}-count`) || null;

  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };
  const set = (node, key, value) => {
    if (node[key] !== value) node[key] = value;
  };
  let snapshot = layer.getSnapshot();
  let detailsOpen = false;
  let split = null;
  let splitSignature = '';
  let exportError = null;
  const exporting = new Set();
  let destroyed = false;
  const view = mountView(RecentImageryView, {
    parent: container,
    props: {
      snapshot,
      detailsOpen,
      exportError,
      exporting: [],
    },
  });
  const root = view.element;
  const strip = root.querySelector('#ri-strip');
  const opacity = root.querySelector('#ri-opacity');
  const swap = root.querySelector('#ri-swap');
  const zoomIn = root.querySelector('#ri-zoom-in');
  const detailsHost = root.querySelector('#ri-details');
  const modeGroup = root.querySelector('#ri-mode');
  const modeControl = createSegmentedControl({
    buttons: modeGroup.querySelectorAll('[data-mode]'),
    valueOf: (button) => button.dataset.mode,
    onChange: (mode) => layer.setMode(mode),
    keyboard: 'arrows',
    keyTarget: modeGroup,
    readValue: () => snapshot.mode,
    listen,
  });
  let stripKeys = snapshot.candidates
    .map((candidate) => candidate.key)
    .join('|');
  function paint() {
    view.update({
      snapshot,
      detailsOpen,
      exportError,
      exporting: [...exporting],
    });
    stripKeys = snapshot.candidates.map((candidate) => candidate.key).join('|');
  }
  function exportTarget(slotId) {
    return targetFor(snapshot, slotId);
  }
  /**
   * The body is the scroll container and no render may move it: a
   * re-render, a thumbnail arriving or a notification never sends the
   * operator back to the top.
   */
  function preserveScroll(fn) {
    const top = Number(container.scrollTop) || 0;
    try {
      return fn();
    } finally {
      if ((Number(container.scrollTop) || 0) !== top) container.scrollTop = top;
    }
  }

  /**
   * Keyboard only: slide the strip until the focused card is in view. Only
   * `strip.scrollLeft` moves — `scrollIntoView` would also scroll the body.
   */
  function scrollFocusedIntoView() {
    const focus = snapshot.candidates[snapshot.focusIndex];
    const card = focus
      ? strip.querySelector(`#ri-card-${snapshot.focusIndex}`)
      : null;
    const left = Number(card?.offsetLeft) || 0;
    const width = Number(card?.offsetWidth) || 0;
    const viewLeft = Number(strip.scrollLeft) || 0;
    const viewWidth = Number(strip.clientWidth) || 0;
    if (!width || !viewWidth) return;
    if (left < viewLeft) strip.scrollLeft = left;
    else if (left + width > viewLeft + viewWidth)
      strip.scrollLeft = left + width - viewWidth;
  }

  function reportVisibleRange() {
    const width = Number(strip.clientWidth) || 0;
    if (!width || !snapshot.candidates.length) return;
    const left = Number(strip.scrollLeft) || 0;
    let first = null;
    let last = null;
    strip.querySelectorAll('.ri-card').forEach((card, index) => {
      const start = Number(card?.offsetLeft) || 0;
      const end = start + (Number(card?.offsetWidth) || 0);
      if (!card || end < left || start > left + width) return;
      first ??= index;
      last = index;
    });
    if (first !== null) layer.setVisibleRange(first, last);
  }

  // ---- divider ----------------------------------------------------------
  function renderSplit() {
    const live = snapshot.comparison.active;
    const basemap = snapshot.shown.swipe === 'basemap';
    const swapped = Boolean(snapshot.swapped);
    const a = snapshot.candidates.find((c) => c.key === snapshot.shown.a);
    const b = snapshot.candidates.find((c) => c.key === snapshot.shown.b);
    const describe = (c) => (c ? `${sensorLine(c.product)} · ${c.day}` : '');
    // The two sides as [label, title, spoken name]; SWAP trades them.
    const sides = [
      basemap ? [t('IMAGE'), describe(a), t('image')] : ['A', describe(a), 'A'],
      basemap
        ? [t('BASEMAP'), t('The basemap'), t('basemap')]
        : ['B', describe(b), 'B'],
    ];
    const [before, after] = swapped ? [sides[1], sides[0]] : sides;
    const signature = live
      ? `${snapshot.shown.swipe}|${swapped}|${describe(a)}|${describe(b)}`
      : '';
    if (signature !== splitSignature) {
      split?.destroy();
      split = null;
      splitSignature = signature;
    }
    if (!live || split || destroyed) return;
    split = createSplit({
      scene: viewer?.scene,
      parent: document.body,
      initialValue: snapshot.split,
      id: 'recent-imagery-split-line',
      handleClass: 'recent-imagery-split-handle',
      cssTarget: document.documentElement,
      cssProperty: '--recent-imagery-split',
      beforeLabel: before[0],
      afterLabel: after[0],
      beforeTitle: before[1],
      afterTitle: after[1],
      ariaLabel: basemap
        ? t('Recent imagery against the basemap divider')
        : t('Recent imagery A and B divider'),
      formatValueText: (leftPercent, rightPercent) =>
        t('{before} {left} percent, {after} {right} percent', {
          before: `${before[2][0].toUpperCase()}${before[2].slice(1)}`,
          left: leftPercent,
          after: after[2],
          right: rightPercent,
        }),
      getViewportWidth: () =>
        Number(viewer?.scene?.canvas?.clientWidth) ||
        Number(document.documentElement?.clientWidth) ||
        0,
      onChange: (value) => layer.setSplit(value),
      requestRender,
    });
    split?.setValue(snapshot.split);
  }

  // ---- panel ------------------------------------------------------------
  function renderPanel() {
    const hidden = !snapshot.enabled;
    if (panel) set(panel, 'hidden', hidden);
    if (count) set(count, 'textContent', hidden ? '' : countText(snapshot));
    if (hidden || !panel || appearedDocuments.has(document)) return;
    appearedDocuments.add(document);
    // First appearance opens the panel unless a stored or shared collapse
    // choice exists (marked by the panel chrome when it restored the state).
    const preference = panel.dataset?.collapsedPreference;
    if (
      panel.classList.contains('collapsed') &&
      (preference === undefined || preference === 'default')
    )
      panel.querySelector?.(`[data-collapse-target="${PANEL_ID}"]`)?.click();
  }

  function render() {
    if (destroyed) return;
    preserveScroll(() => {
      paint();
      renderPanel();
      renderSplit();
      reportVisibleRange();
    });
  }
  // ---- export -----------------------------------------------------------
  async function exportImage(slotId = 'a') {
    const candidate = exportTarget(slotId);
    if (!candidate || !snapshot.box || exporting.has(slotId)) return false;
    exporting.add(slotId);
    exportError = null;
    preserveScroll(paint);
    // The snapshot is plate carrée: keep the box's degree aspect, with the
    // longer side at the size limit.
    const size = longerSideKm(snapshot.boxSizeKm) > 25 ? 2048 : 1024;
    const spanLon = Math.abs(snapshot.box.east - snapshot.box.west) || 1;
    const spanLat = Math.abs(snapshot.box.north - snapshot.box.south) || 1;
    const width = Math.max(
      1,
      Math.round(size * Math.min(1, spanLon / spanLat)),
    );
    const height = Math.max(
      1,
      Math.round(size * Math.min(1, spanLat / spanLon)),
    );
    try {
      const response = await fetchImpl(
        wvsSnapshotUrl({
          product: candidate.product,
          day: candidate.day,
          box: snapshot.box,
          width,
          height,
        }),
      );
      if (!response?.ok) throw new Error(`HTTP ${response?.status ?? 'error'}`);
      const blob = await response.blob();
      if (destroyed) return false;
      const href = createObjectUrl(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `recent-imagery-${candidate.product}-${candidate.day}.png`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        revokeObjectUrl(href);
      }
      return true;
    } catch (error) {
      if (!destroyed)
        exportError = t('Export failed · {error}', {
          error: error?.message || error,
        });
      return false;
    } finally {
      exporting.delete(slotId);
      if (!destroyed)
        preserveScroll(() => {
          paint();
        });
    }
  }

  // ---- input ------------------------------------------------------------
  /** Escape clears the preview, then cancels the box tool, then blurs. */
  function escape() {
    if (layer.clearPreview()) return true;
    if (tool?.isActive()) {
      tool.cancel('escape');
      return true;
    }
    strip.blur();
    return false;
  }

  function pin(slotId, key) {
    if (!key) return;
    if (slotId === 'b' && snapshot.mode !== 'ab') return;
    exportError = null;
    layer.toggleAssignment(slotId, key);
  }

  listen(root, 'click', (event) => {
    const target = event.target;
    const action = target?.closest?.('[data-action-id]');
    if (action && !action.disabled) {
      const id = action.dataset.actionId;
      if (id === 'select-box') {
        exportError = null;
        if (tool?.isActive()) tool.cancel('toggle');
        else tool?.start();
      } else if (id === 'use-view') {
        exportError = null;
        layer.useCurrentView(viewer);
      } else if (id === 'clear') {
        exportError = null;
        layer.clear();
      } else if (id === 'toggle-empty')
        layer.setShowUnavailable(!snapshot.showUnavailable);
      else if (id === 'export-a' || id === 'export-b')
        void exportImage(id.slice(-1));
      return;
    }
    if (target?.closest?.('.rail-card-header')) {
      detailsOpen = !detailsOpen;
      render();
      if (detailsOpen) revealCard(container, detailsHost.children[0]);
      return;
    }

    const chip = target?.closest?.('.ri-chip');
    const card = target?.closest?.('.ri-card');
    if (chip && card) {
      if (!chip.disabled) pin(chip.dataset.slot, card.dataset.key);
      strip.focus({ preventScroll: true });
      return;
    }
    if (card) {
      exportError = null;
      layer.preview(card.dataset.key);
      strip.focus({ preventScroll: true });
      return;
    }
    if (target?.closest?.('.ri-swap') && !swap.disabled) {
      layer.swapSides?.();
      return;
    }
    const unpin = target?.closest?.('.ri-unpin');
    if (unpin && !unpin.disabled)
      layer.setAssignment(unpin.dataset.unpin, null);
    // The layer owns the camera flight; the panel only asks.
    if (target?.closest?.('.ri-zoom-in') && !zoomIn.disabled)
      layer.zoomToFit?.();
  });

  listen(root, 'input', (event) => {
    if (event.target === opacity) layer.setAlpha(Number(opacity.value) / 100);
  });

  listen(strip, 'keydown', (event) => {
    const total = snapshot.candidates.length;
    const index = snapshot.focusIndex || 0;
    const focus = snapshot.candidates[index];
    if (event.key === 'Escape') {
      event.preventDefault();
      escape();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter is a click on the focused card; key repeat must not re-fire.
      if (focus && !event.repeat) layer.preview(focus.key);
      return;
    }
    const letter = String(event.key || '').toLowerCase();
    const slotId =
      letter === 'a' || (letter === 's' && snapshot.mode !== 'ab')
        ? 'a'
        : letter === 'b'
          ? 'b'
          : null;
    if (slotId) {
      event.preventDefault();
      if (!event.repeat && focus && focus.thumbnail?.status !== 'empty')
        pin(slotId, focus.key);
      return;
    }
    const step = KEY_STEPS[event.key];
    if (!step || !total) return;
    event.preventDefault();
    layer.focus(Math.max(0, Math.min(total - 1, step(index, total))));
    preserveScroll(scrollFocusedIntoView);
  });

  listen(root, 'keydown', (event) => {
    if (event.key === 'Escape' && event.target !== strip) {
      if (
        snapshot.preview.key ||
        snapshot.preview.pending ||
        tool?.isActive()
      ) {
        event.preventDefault();
        escape();
      }
    }
  });

  listen(strip, 'scroll', reportVisibleRange, { passive: true });

  layer.setToolHandler?.(() => {
    if (tool?.isActive()) tool.cancel('layer');
  });
  const unsubscribe = layer.subscribe((next, reason) => {
    if (destroyed) return;
    snapshot = next || layer.getSnapshot();
    if (reason === 'split') split?.setValue(snapshot.split);
    else if (
      reason === 'alpha' ||
      (reason === 'thumbnail' &&
        snapshot.candidates.map((candidate) => candidate.key).join('|') ===
          stripKeys)
    )
      preserveScroll(paint);
    else render();
  });
  render();
  return {
    root,
    exportImage,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      layer.setToolHandler?.(null);
      split?.destroy();
      split = null;
      modeControl.destroy();
      for (const [target, type, handler, options] of listeners.splice(0))
        target.removeEventListener(type, handler, options);
      for (const image of root.querySelectorAll('.ri-thumb-img'))
        image.src = '';
      view.dispose();
      if (count) count.textContent = '';
      if (panel) panel.hidden = true;
    },
  };
}
