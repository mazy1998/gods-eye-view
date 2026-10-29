/** Own loading notices, traffic status, toast timing and visibility cleanup. */
import {
  aggregateLayerLoading,
  createGlobalStatusNotice,
  createLoadingFeedbackState,
  createTrafficSyncFeedbackState,
  presentGlobalLoadingStatus,
  reduceLoadingFeedback,
  reduceTrafficSyncFeedback,
} from '../loadingFeedback.js';
import { mountView } from './mountView.js';
import FeedbackContent from './feedback/FeedbackContent.vue';
import LiteralText from './feedback/LiteralText.vue';
import { getLocale, t, msg } from '../i18n/index.js';
import { localizeLayerName } from './layerNames.js';
import { translateFeedError } from './statusText.js';

// The server also loads loadingFeedback.js (through the HUD summary), so its
// labels stay English. Translate the known ones; pass anything else (a live
// provider error) through.
const STATUS_LABEL_KEYS = Object.freeze({
  'LOADING LIVE DATA': msg('LOADING LIVE DATA'),
  'LOAD COMPLETE': msg('LOAD COMPLETE'),
  'LOAD CANCELLED': msg('LOAD CANCELLED'),
  'LOAD FAILED': msg('LOAD FAILED'),
  'LIVE DATA OFF': msg('LIVE DATA OFF'),
  'MAPPED SITES LOADED': msg('MAPPED SITES LOADED'),
  'RETRYING MAPPED SITES': msg('RETRYING MAPPED SITES'),
  'FETCHING MAPPED SITES': msg('FETCHING MAPPED SITES'),
  'RETRYING ALPR CAMERAS': msg('RETRYING ALPR CAMERAS'),
  'FETCHING ALPR CAMERAS': msg('FETCHING ALPR CAMERAS'),
  'OVERPASS TEMPORARILY UNAVAILABLE': msg('OVERPASS TEMPORARILY UNAVAILABLE'),
  // The other mapped-site failure reasons (src/data/installationFeedback.js),
  // upper-cased by presentGlobalLoadingStatus.
  'OVERPASS RATE-LIMITED': msg('OVERPASS RATE-LIMITED'),
  'OVERPASS TIMED OUT': msg('OVERPASS TIMED OUT'),
  'OVERPASS COULD NOT COMPLETE THE QUERY': msg(
    'OVERPASS COULD NOT COMPLETE THE QUERY',
  ),
  'MAP TILES TEMPORARILY UNAVAILABLE': msg('MAP TILES TEMPORARILY UNAVAILABLE'),
  'MAPPED NAMES TEMPORARILY UNAVAILABLE': msg(
    'MAPPED NAMES TEMPORARILY UNAVAILABLE',
  ),
  'TURNING OFF LIVE DATA': msg('TURNING OFF LIVE DATA'),
  'REFRESHING LIVE DATA': msg('REFRESHING LIVE DATA'),
  'syncing road network': msg('syncing road network'),
});

// The ALPR retry chip shows the layer's English error upper-cased
// (loadingFeedback.js). These are the camera and vector tile failures it can
// carry, by their upper-cased text; each is translated through its own
// sentence-case key, the one the layer row shows, and upper-cased again.
const CHIP_ERROR_KEYS = new Map(
  [
    msg('Vector tile metadata unavailable'),
    msg('Vector tiles unavailable'),
    msg('Vector tile request timed out'),
    msg('Camera coverage unavailable'),
    msg('Camera source temporarily unavailable'),
    msg('Overpass returned an incomplete camera response'),
  ].map((key) => [key.toUpperCase(), key]),
);
const CHIP_TILE_HTTP_RE = /^VECTOR TILES UNAVAILABLE \(HTTP (\d+)\)$/;

function localizeStatusLabel(label) {
  if (typeof label !== 'string' || !label) return label;
  const text = label.trim();
  const key = STATUS_LABEL_KEYS[text];
  if (key) return t(key);
  const errorKey = CHIP_ERROR_KEYS.get(text);
  const http = errorKey ? null : CHIP_TILE_HTTP_RE.exec(text);
  if (!errorKey && !http) return label;
  return translateFeedError(
    errorKey || `Vector tiles unavailable (HTTP ${http[1]})`,
  ).toLocaleUpperCase(getLocale());
}

// A retry detail is "retrying in Ns" or "retry pending", optionally prefixed
// by the ALPR layer name (loadingFeedback.js). The prefix is kept in every
// language: it is what tells the chip apart from a mapped-sites retry.
const RETRY_DETAIL_RE =
  /^(?:(ALPR cameras) · )?(?:retrying in (\d+)s|(retry pending))$/;

function localizeStatusDetail(detail) {
  if (typeof detail !== 'string' || !detail) return detail;
  const match = detail.trim().match(RETRY_DETAIL_RE);
  if (match) {
    const [, prefix, seconds, pending] = match;
    const retry = pending
      ? t('retry pending')
      : t('retrying in {seconds}s', { seconds });
    return prefix ? `${t('ALPR cameras')} · ${retry}` : retry;
  }
  return localizeLayerRoster(detail);
}

// The loading detail is the active layers' English names joined by " · ",
// with " +N" when more are loading. Translate each known layer name; anything
// else (a provider such as "OpenStreetMap · Overpass") passes through.
function localizeLayerRoster(detail) {
  const [, names, suffix = ''] = detail.match(/^(.*?)( \+\d+)?$/s) || [];
  if (!names) return detail;
  return (
    names
      .split(' · ')
      .map((name) => localizeLayerName(name))
      .join(' · ') + suffix
  );
}

/** The chip's label and detail in the UI language (exported for tests). */
export function localizeLoadingPresentation(presentation) {
  if (!presentation) return presentation;
  return {
    ...presentation,
    label: localizeStatusLabel(presentation.label),
    detail: localizeStatusDetail(presentation.detail),
  };
}
export class ShellFeedback {
  constructor({ readLayers }) {
    this.readLayers = readLayers;
    this.destroyed = false;
    this._loadingFeedbackState = createLoadingFeedbackState();
    this._trafficSyncFeedbackState = createTrafficSyncFeedbackState();
    this._loadingFeedbackEvent = null;
    this._globalStatusNotice = null;
    this._loadingFeedbackTicker =
      this._trafficChipTicker =
      this._toastTimer =
        null;
    this._toastRevision = 0;
    this._loadingVisibilityHandler = null;
    this._lastLoadingFeedbackUpdateAt = 0;
    this._lastTrafficChipUpdateAt = 0;
    this._lastTrafficGlobalUpdateAt = 0;
    this._globalLoadingStatus = document.getElementById(
      'global-loading-status',
    );
    this._trafficSyncChip = document.getElementById('traffic-sync-chip');
    this._toast = document.getElementById('toast');
    const mount = (parent, component, props) => {
      if (!parent) return null;
      parent.replaceChildren();
      parent.classList.add('gev-surface');
      return mountView(component, { parent, props });
    };
    this._loadingView = mount(this._globalLoadingStatus, FeedbackContent, {
      labelId: 'global-loading-label',
      detailId: 'global-loading-detail',
      label: t('LOADING LIVE DATA'),
      detail: '',
    });
    this._trafficView = mount(this._trafficSyncChip, FeedbackContent, {
      labelId: 'traffic-sync-label',
      detailId: 'traffic-sync-progress',
      label: t('syncing road network'),
      detail: '0%',
    });
    this._toastView = mount(this._toast, LiteralText, { text: '' });
  }
  observeVisibility() {
    if (this.destroyed || this._loadingVisibilityHandler) return;
    this._loadingVisibilityHandler = () => {
      if (!document.hidden) this._updateGlobalLoadingFeedback();
      else this._stopLoadingFeedbackTicker();
    };
    document.addEventListener(
      'visibilitychange',
      this._loadingVisibilityHandler,
    );
  }
  _updateTrafficSyncChip(forceShow = false, now = performance.now()) {
    if (this.destroyed) return;
    if (!this._trafficView) return;
    const layers = this.readLayers();
    const traffic = Array.isArray(layers)
      ? layers.find((layer) => layer.id === 'traffic')
      : null;
    this._trafficSyncFeedbackState = reduceTrafficSyncFeedback(
      this._trafficSyncFeedbackState,
      {
        enabled: traffic?.enabled === true,
        stats: traffic?.stats || {},
        forceShow,
      },
      now,
    );
    const presentation = this._trafficSyncFeedbackState;
    this._trafficView.update({
      ...(presentation.label
        ? { label: localizeStatusLabel(presentation.label) }
        : {}),
      immediate: !presentation.busy,
      detail: presentation.progressText,
    });
    this._trafficSyncChip.classList.toggle('visible', presentation.visible);
  }

  _updateGlobalLoadingFeedback(now = performance.now()) {
    if (this.destroyed) return;
    if (!this._globalLoadingStatus) return;
    const summary = aggregateLayerLoading(this.readLayers() || []);
    this._loadingFeedbackState = reduceLoadingFeedback(
      this._loadingFeedbackState,
      summary,
      now,
      this._loadingFeedbackEvent,
    );
    this._loadingFeedbackEvent = null;
    const presentation = presentGlobalLoadingStatus(
      this._globalStatusNotice,
      this._loadingFeedbackState,
      summary,
      now,
    );
    if (
      this._globalStatusNotice?.persistent !== true &&
      Number.isFinite(this._globalStatusNotice?.hideAt) &&
      now >= this._globalStatusNotice.hideAt
    ) {
      this._globalStatusNotice = null;
    }
    // Loading phases and universal notices both have time-driven transitions.
    // Compute this after arbitration: a queued finite notice starts its dwell
    // only on its first visible frame, then keeps the ticker alive to expiry.
    const noticeNeedsTicker = Number.isFinite(this._globalStatusNotice?.hideAt);
    if (this._loadingFeedbackState?.phase !== 'idle' || noticeNeedsTicker) {
      this._armLoadingFeedbackTicker();
    }
    const localized = localizeLoadingPresentation(presentation);
    this._globalLoadingStatus.hidden = !presentation;
    if (!presentation) {
      delete this._globalLoadingStatus.dataset.state;
      return;
    }
    this._globalLoadingStatus.dataset.state = presentation.state;
    this._loadingView?.update({
      label: localized.label,
      detail: localized.detail,
    });
  }

  _showGlobalStatusNotice(message, options = {}) {
    if (this.destroyed) return;
    const now = performance.now();
    this._globalStatusNotice = createGlobalStatusNotice(message, now, options);
    this._updateGlobalLoadingFeedback(now);
  }

  _startTrafficChipTicker() {
    if (this.destroyed) return;
    if (this._trafficChipTicker) return;
    this._trafficChipTicker = setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      // Poll busy traffic promptly; retain the idle/global 500 ms read budget.
      if (
        this._trafficSyncFeedbackState.busy ||
        now - this._lastTrafficChipUpdateAt >= 500
      ) {
        this._lastTrafficChipUpdateAt = now;
        this._updateTrafficSyncChip(false, now);
      }
      if (now - this._lastTrafficGlobalUpdateAt >= 500) {
        this._lastTrafficGlobalUpdateAt = now;
        this._updateGlobalLoadingFeedback(now);
      }
    }, 100);
  }

  _armLoadingFeedbackTicker() {
    if (this.destroyed) return;
    // Never arm behind a hidden tab: the reducer cannot usefully advance a
    // chip nobody can see, and the old `return` INSIDE the interval left the
    // 60ms timer scheduled for the entire hidden period (a batch completing
    // while hidden could never clear it — the idle check sat behind the
    // hidden guard). visibilitychange resamples and re-arms on return.
    if (this._loadingFeedbackTicker || document.hidden) return;
    this._loadingFeedbackTicker = setInterval(() => {
      if (document.hidden) {
        this._stopLoadingFeedbackTicker();
        return;
      }
      const now = performance.now();
      this._lastLoadingFeedbackUpdateAt = now;
      this._updateGlobalLoadingFeedback(now);
      const noticeNeedsTicker = Number.isFinite(
        this._globalStatusNotice?.hideAt,
      );
      if (this._loadingFeedbackState?.phase === 'idle' && !noticeNeedsTicker) {
        this._stopLoadingFeedbackTicker();
      }
    }, 60);
  }

  _stopLoadingFeedbackTicker() {
    if (!this._loadingFeedbackTicker) return;
    clearInterval(this._loadingFeedbackTicker);
    this._loadingFeedbackTicker = null;
  }

  _showToast(message) {
    if (this.destroyed) return;
    // Each toast is a new announcement, even when its text repeats. Keep
    // the live-region host and replace its text node on every occurrence.
    this._toastView?.update({
      key: ++this._toastRevision,
      text: String(message ?? ''),
    });
    this._toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible');
    }, 2000);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._stopLoadingFeedbackTicker();
    clearInterval(this._trafficChipTicker);
    clearTimeout(this._toastTimer);
    this._trafficChipTicker = this._toastTimer = null;
    if (this._loadingVisibilityHandler)
      document.removeEventListener(
        'visibilitychange',
        this._loadingVisibilityHandler,
      );
    this._loadingVisibilityHandler = null;
    this._loadingView?.dispose();
    this._trafficView?.dispose();
    this._toastView?.dispose();
    this._toast?.classList.remove('visible');
    if (this._globalLoadingStatus) this._globalLoadingStatus.hidden = true;
  }
}
