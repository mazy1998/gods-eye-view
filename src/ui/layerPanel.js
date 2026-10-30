import { mountView } from './mountView.js';
import LayerPanelView from './LayerPanelView.vue';
import { setRowText } from './layerText.js';
export { setRowText } from './layerText.js';
import { layerFeedState } from '../data/feedState.js';
export { layerFeedState } from '../data/feedState.js';
import { GUIDANCE_STATUSES } from '../loadingFeedback.js';
import { keyGuidanceText, keyRequirementText } from './keyGuidance.js';
import {
  LAYER_NAME_KEYS,
  PANEL_LABEL_KEYS as PANEL_LABELS,
  sourceLabel,
} from './layerNames.js';
export { localizeLayerName } from './layerNames.js';
import { createWeatherPanel } from './weatherPanel.js';
import { translateFeedError, translateStatusLine } from './statusText.js';
import {
  formatNumber,
  getLocale,
  msg,
  t,
  translateKnown,
} from '../i18n/index.js';

// Feed-state values are machine ids (QA hooks, CSS feed-* classes); only the
// label translates.
const FEED_STATE_LABEL_KEYS = Object.freeze({
  nominal: msg('ON'),
  loading: msg('LOADING'),
  degraded: msg('DEGRADED'),
  stale: msg('STALE'),
  partial: msg('PARTIAL'),
  fallback: msg('FALLBACK'),
  unavailable: msg('UNAVAILABLE'),
});

function lifecycleStateLabel(lifecycleState) {
  return t(lifecycleState === 'enabling' ? msg('ENABLING') : msg('DISABLING'));
}

// Presentation order is independent of catalog registration and startup order.
const PANEL_GROUPS = [
  {
    label: msg('Transport'),
    ids: [
      'flights',
      'military',
      'local-adsb',
      'ais-live-vessels',
      'traffic',
      'transit',
      'bikeshare',
      'directions',
    ],
  },
  { label: msg('Space'), ids: ['satellites', 'rocket-launches'] },
  {
    label: msg('Environment'),
    ids: [
      'air-quality',
      'wind',
      'weather-radar',
      'weather-satellite',
      'weather-lightning',
      'weather-cyclones',
    ],
  },
  {
    label: msg('Imagery & cameras'),
    ids: ['cctv', 'recent-imagery', 'street-level', 's2-ghostmaps'],
  },
  {
    label: msg('Infrastructure'),
    ids: [
      'alpr-cameras',
      'military-installations',
      'local-datacenters',
      'telegeography-submarine-cables',
      'local-dams',
    ],
  },
  {
    label: msg('Signals & events'),
    ids: ['earthquakes', 'local-firms', 'fire-perimeters', 'gnss-integrity'],
  },
  { label: msg('Audio'), ids: ['radio'] },
];
const PANEL_ORDER = PANEL_GROUPS.flatMap(({ label, ids }) =>
  ids.map((id) => ({ id, label })),
);
const PANEL_POSITIONS = new Map(
  PANEL_ORDER.map(({ id }, index) => [id, index]),
);
const DETAIL_PANELS = {
  wind: 'weather-panel',
  'air-quality': 'weather-panel',
  'weather-radar': 'weather-panel',
  'weather-satellite': 'weather-panel',
  'weather-lightning': 'weather-panel',
  'weather-cyclones': 'weather-panel',
  'recent-imagery': 'recent-imagery-panel',
  cctv: 'cctv-panel',
  'street-level': 'street-level-panel',
  radio: 'radio-panel',
};

function englishPanelLabel(layer) {
  return PANEL_LABELS[layer.id] || LAYER_NAME_KEYS[layer.id] || layer.name;
}

// PANEL_LABELS win over layer-name keys; otherwise the module's own name.
function panelLabel(layer) {
  if (PANEL_LABELS[layer.id]) return t(PANEL_LABELS[layer.id]);
  const key = LAYER_NAME_KEYS[layer.id];
  return key ? t(key) : layer.name;
}

/**
 * Guidance for a control a missing provider key is holding back.
 *
 * The key registry already owns what each key is called and which environment
 * variables enable it, so a layer only declares WHICH key it needs
 * (`requiresKeyId`) and reports `stats.keyRequired` while that key is absent.
 * Naming the variable turns an unexplained dead control into a next step.
 *
 * An unnamed or unknown key returns '' rather than guessing: guidance naming
 * the wrong variable sends the operator to the wrong provider.
 *
 * @param {object} [layer] Row from the layer manager's getAll().
 * @returns {string} Guidance text, or '' when no key guidance applies.
 */
export function layerKeyRequirementTooltip(layer = {}) {
  if (layer?.stats?.keyRequired !== true) return '';
  const requiresKeyId = String(layer.requiresKeyId || '').trim();
  // A layer with several sources also names the ones it could use instead.
  return keyGuidanceText(
    requiresKeyId ? keyRequirementText(requiresKeyId) : '',
    layer.stats.keyAlternatives || [],
  );
}

/** Layer row presentation over supplied state and actions; no layer imports. */
export class LayerPanel {
  constructor({
    getLayers,
    isEnabled,
    setEnabled,
    setLayerParams,
    getRowControls,
    hasRowControls,
    subscribeRowControls,
    onHiddenRefresh = () => {},
    weatherClock,
    channel,
    clearChannel,
    clearSelectedLayers = () => {},
    drawerChannel,
    phoneChannel,
    openDetails = () => {},
  }) {
    this.weatherClock = weatherClock;
    this.channel = channel;
    this.clearChannel = clearChannel;
    this.clearSelectedLayers = clearSelectedLayers;
    this.drawerChannel = drawerChannel;
    this.phoneChannel = phoneChannel;
    this.openDetails = openDetails;
    this._pending = new Set();
    this._imports = null;
    this._files = [];
    this.getAll = getLayers;
    this.isEnabled = isEnabled;
    this.setEnabled = setEnabled;
    this.setLayerParams = setLayerParams;
    this._rowControlsFor = getRowControls;
    this.hasRowControls = hasRowControls;
    this.subscribeRowControls = subscribeRowControls;
    this.onHiddenRefresh = onHiddenRefresh;
    this._generation = 0;
    this._removers = [];
    this._destroyed = false;
    this._cancelRowControlsRefresh = null;
    this._recentImageryFactory = null;
    this._recentImageryPanel = null;
  }
  mount(container) {
    if (this._destroyed) return;
    this._releaseBindings();
    this._toggleContainer = container;
    this._drawerState = null;
    this._phoneState = null;
    for (const [key, channel] of [
      ['_drawerState', this.drawerChannel],
      ['_phoneState', this.phoneChannel],
    ])
      if (channel)
        this._removers.push(
          channel.subscribe(({ state }) => {
            const changed = this[key]?.active !== state?.active;
            this[key] = state;
            if (changed) this._pushView();
          }),
        );
    this._weatherPanel?.destroy();
    this._weatherPanel = createWeatherPanel({
      clock: this.weatherClock,
      container:
        container?.ownerDocument?.getElementById?.('weather-panel-body'),
      setLayerParams: this.setLayerParams,
    });
    this._mountRecentImagery();
    this._renderToggles();
    if (this.channel)
      this._removers.push(
        this.channel.subscribe(() => this._refreshTogglePanel()),
      );
    this._subscribeImports();
    if (this.clearChannel)
      this._removers.push(
        this.clearChannel.subscribe(({ state }) => {
          this._clearState = state;
          this._pushView();
        }),
      );
    const reveal = (event) => {
      this._reveal = {
        id: event.detail,
        serial: (this._reveal?.serial || 0) + 1,
      };
      this._pushView();
    };
    container?.addEventListener('gev:focus-layer-row', reveal);
    this._removers.push(() =>
      container?.removeEventListener('gev:focus-layer-row', reveal),
    );
  }
  attachImports(handle) {
    if (this._destroyed) return;
    this._importsUnsubscribe?.();
    this._importsUnsubscribe = null;
    this._imports = handle;
    this._files = handle?.list() || [];
    if (this._view) this._subscribeImports();
    this._pushView();
  }
  _subscribeImports() {
    this._importsUnsubscribe = this._imports?.channel?.subscribe(
      ({ state }) => {
        this._files = state.files;
        this._pushView();
      },
    );
  }
  /**
   * Host the Recent Imagery readout in its rail body, like the weather
   * readout. The application supplies the factory once the layer, viewer and
   * box tool exist; a remount rebuilds the readout in place.
   * @param {((container: HTMLElement) => { destroy: () => void } | null) | null} factory
   */
  attachRecentImagery(factory) {
    if (this._destroyed) return;
    this._recentImageryFactory = typeof factory === 'function' ? factory : null;
    this._mountRecentImagery();
  }
  _mountRecentImagery() {
    this._recentImageryPanel?.destroy();
    this._recentImageryPanel = null;
    const container = this._toggleContainer?.ownerDocument?.getElementById?.(
      'recent-imagery-panel-body',
    );
    if (container && this._recentImageryFactory)
      this._recentImageryPanel = this._recentImageryFactory(container) || null;
  }
  _releaseBindings() {
    this._generation++;
    this._importsUnsubscribe?.();
    this._importsUnsubscribe = null;
    this._view?.dispose();
    this._view = null;
    this._cancelRowControlsRefresh?.();
    this._cancelRowControlsRefresh = null;
    for (const remove of this._removers.splice(0)) remove();
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._releaseBindings();
    this._weatherPanel?.destroy();
    this._weatherPanel = null;
    this._recentImageryPanel?.destroy();
    this._recentImageryPanel = null;
    this._recentImageryFactory = null;
    this._toggleContainer = null;
  }
  _renderToggles() {
    if (this._destroyed || !this._toggleContainer) return;
    const generation = this._generation;
    this._listening = new Set();
    const live = () => !this._destroyed && this._generation === generation;
    this._view = mountView(LayerPanelView, {
      parent: this._toggleContainer,
      props: {
        ...this._viewProps(),
        toggle: (id) => live() && this._toggle(id),
        chip: (id, chipId) => {
          if (!live() || !this.isEnabled(id)) return;
          const chip = this._rowControlsFor(id)?.chips?.find(
            (item) => item.id === chipId,
          );
          if (!chip || chip.disabled) return;
          if (typeof chip.onClick === 'function') chip.onClick();
          else if (chip.params)
            this.setLayerParams(id, chip.params, { origin: 'user' });
        },
        listItem: (id, itemId) => {
          if (!live() || !this.isEnabled(id)) return;
          const item = this._rowControlsFor(id)?.list?.items?.find(
            (entry) => entry.id === itemId,
          );
          if (item?.params && !item.disabled)
            this.setLayerParams(id, item.params, { origin: 'user' });
        },
        clear: () =>
          live() && !this._clearState?.busy && this.clearSelectedLayers(),
        details: (panelId) => live() && this.openDetails(panelId),
        fileAction: (action, id, value) =>
          live() && this._imports?.[action]?.(id, value),
      },
    });
    this._refreshWeatherPanel();
  }
  _viewProps() {
    const rows = this.getAll()
      .filter((layer) => layer.showInTogglePanel)
      .map((layer) => {
        if (this.hasRowControls(layer.id) && !this._listening.has(layer.id)) {
          this._listening.add(layer.id);
          const remove = this.subscribeRowControls(layer.id, () =>
            this._scheduleRowControlsRefresh(),
          );
          if (remove) this._removers.push(remove);
        }
        const descriptor = this._rowControlsFor(layer.id);
        return {
          id: layer.id,
          icon: layer.icon,
          enabled: layer.enabled,
          name: panelLabel(layer),
          englishName: englishPanelLabel(layer),
          group:
            PANEL_ORDER[PANEL_POSITIONS.get(layer.id)]?.label ||
            msg('Other layers'),
          order: PANEL_POSITIONS.get(layer.id) ?? PANEL_ORDER.length,
          count: this._layerCountText(layer.stats || {}),
          countLine:
            getLocale() !== 'en' &&
            typeof layer.stats?.countLabel === 'string' &&
            /\d/.test(layer.stats.countLabel),
          meta: this._buildMetaText(layer),
          toggle: this._toggleState(layer),
          readout: Boolean(descriptor?.readout),
          detailsPanel:
            layer.id === 'directions' &&
            (this._drawerState?.active || this._phoneState?.active)
              ? 'directions-controls-body'
              : DETAIL_PANELS[layer.id],
          controls:
            layer.enabled && !descriptor?.readout && descriptor
              ? {
                  ...descriptor,
                  legend: descriptor.legend?.map((item) => ({
                    ...item,
                    countText:
                      item.count == null ? null : this._formatCount(item.count),
                  })),
                }
              : null,
        };
      })
      .sort((a, b) => a.order - b.order);
    return {
      rows,
      files: this._files,
      reveal: this._reveal,
      clearBusy: Boolean(this._clearState?.busy),
    };
  }
  _pushView() {
    if (this._view && !this._destroyed) this._view.update(this._viewProps());
  }
  async _toggle(id) {
    const layer = this.getAll().find((layer) => layer.id === id);
    if (!layer || this._toggleState(layer).blocked) return;
    this._pending.add(id);
    this._pushView();
    try {
      await this.setEnabled(id, !this.isEnabled(id), { origin: 'user' });
    } catch (error) {
      console.warn(`[Data] ${id} toggle error:`, error);
    } finally {
      this._pending.delete(id);
      if (!this._destroyed) this._pushView();
    }
  }
  _scheduleRowControlsRefresh() {
    if (this._destroyed || this._cancelRowControlsRefresh) return;
    const refresh = () => {
      this._cancelRowControlsRefresh = null;
      if (!this._destroyed) this._refreshTogglePanel();
    };
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(refresh);
      this._cancelRowControlsRefresh = () => cancelAnimationFrame(frame);
    } else {
      const timer = setTimeout(refresh, 0);
      this._cancelRowControlsRefresh = () => clearTimeout(timer);
    }
  }

  /** Synchronously flush a pending row-controls refresh, including in tests. */
  _flushRowControlsRefresh() {
    if (this._destroyed || !this._cancelRowControlsRefresh) return;
    this._cancelRowControlsRefresh();
    this._cancelRowControlsRefresh = null;
    this._refreshTogglePanel();
  }

  _refreshWeatherPanel() {
    this._weatherPanel?.update(
      this.getAll()
        .filter(
          (layer) =>
            layer.enabled &&
            [
              'wind',
              'weather-radar',
              'weather-satellite',
              'weather-lightning',
              'weather-cyclones',
              'air-quality',
            ].includes(layer.id),
        )
        .map((layer) => ({
          id: layer.id,
          icon: layer.icon,
          ...this._rowControlsFor(layer.id),
        })),
    );
  }

  _syncCount(row, count, stats) {
    const text = this._layerCountText(stats);
    setRowText(count, text);
    row.classList.toggle(
      'data-toggle-row--count-line',
      getLocale() !== 'en' &&
        typeof stats.countLabel === 'string' &&
        /\d/.test(stats.countLabel),
    );
    count.classList.toggle('data-count-empty', text === '—');
  }
  /** Preserve owner count labels rather than implying every count is visible. */
  _layerCountText(stats) {
    if (typeof stats.countLabel === 'string' && stats.countLabel.trim())
      return stats.countLabel;
    return stats.count ? this._formatCount(stats.count) : '—';
  }

  _refreshTogglePanel() {
    if (this._destroyed || !this._toggleContainer) return;
    // Skip DOM churn while hidden; visibilitychange (main.js) triggers one
    // refresh on return. (perf wave 2)
    if (typeof document !== 'undefined' && document.hidden) {
      this.onHiddenRefresh();
      return;
    }
    this._pushView();
    this._refreshWeatherPanel();
  }

  _buildMetaText(layer) {
    const stats = layer.stats || {};
    const feedState = layerFeedState(stats);
    const stateLabel = t(FEED_STATE_LABEL_KEYS[feedState]);
    const source = sourceLabel(stats.source || layer.source);
    const lifecycleState =
      layer.lifecycleState || (layer.enabled ? 'enabled' : 'disabled');
    if (lifecycleState === 'enabling' || lifecycleState === 'disabling') {
      return t('{state} · {source}', {
        state: lifecycleStateLabel(lifecycleState),
        source,
      });
    }
    if (layer.lifecycleUncertain) {
      return t(
        'UNCERTAIN · {source} · lifecycle state requires reconciliation',
        { source },
      );
    }
    const presentedError = translateFeedError(
      stats.error || stats.lastError || stats.managerRefreshError,
    );
    if (presentedError) {
      if (typeof stats.retryInSec === 'number' && stats.retryInSec > 0) {
        return t('{state} · {source} · {detail} · retry {seconds}s', {
          state: stateLabel,
          source,
          detail: presentedError,
          seconds: stats.retryInSec,
        });
      }
      return t('{state} · {source} · {detail}', {
        state: stateLabel,
        source,
        detail: presentedError,
      });
    }
    // A guidance status carries its prompt in `statusMessage`, not `error`, so
    // the row still tells the operator what to do without reporting a fault.
    if (
      GUIDANCE_STATUSES.includes(String(stats.status || '').toLowerCase()) &&
      typeof stats.statusMessage === 'string' &&
      stats.statusMessage.trim()
    ) {
      return `${source} · ${translateKnown(stats.statusMessage.trim())}`;
    }
    const ago = stats.lastUpdate ? this._timeAgo(stats.lastUpdate) : t('never');
    if (stats.loading) {
      const loadingLabel =
        typeof stats.loadingLabel === 'string' && stats.loadingLabel.trim()
          ? translateStatusLine(stats.loadingLabel.trim())
          : t('loading...');
      return t('{source} · {loadingLabel}', { source, loadingLabel });
    }
    if (feedState === 'fallback') {
      const detail =
        typeof stats.loadingLabel === 'string' && stats.loadingLabel.trim()
          ? translateStatusLine(stats.loadingLabel.trim())
          : stats.coverage || ago;
      return t('{state} · {source} · {detail}', {
        state: stateLabel,
        source,
        detail,
      });
    }
    if (feedState === 'partial') {
      const { acceptedRowCount, rawRowCount } = stats;
      const detail =
        Number.isInteger(acceptedRowCount) &&
        Number.isInteger(rawRowCount) &&
        acceptedRowCount >= 0 &&
        rawRowCount > acceptedRowCount
          ? t('{accepted} of {raw} records accepted', {
              accepted: acceptedRowCount,
              raw: rawRowCount,
            })
          : t('incomplete snapshot');
      return t('{state} · {source} · {detail} · {ago}', {
        state: stateLabel,
        source,
        detail,
        ago,
      });
    }
    if (feedState === 'stale') {
      // A layer drawing cached upstream data (Traffic's proxy tiles) dates the
      // row by the oldest of it, not by the load that re-served it.
      const dataAgo =
        Number(stats.oldestTileAt) > 0
          ? this._timeAgo(stats.oldestTileAt)
          : ago;
      if (typeof stats.retryInSec === 'number' && stats.retryInSec > 0) {
        return t('{state} · {source} · {ago} · retrying in {seconds}s', {
          state: stateLabel,
          source,
          ago: dataAgo,
          seconds: stats.retryInSec,
        });
      }
      return t('{state} · {source} · {ago}', {
        state: stateLabel,
        source,
        ago: dataAgo,
      });
    }
    if (typeof stats.loadingLabel === 'string' && stats.loadingLabel.trim()) {
      return t('{source} · {loadingLabel}', {
        source,
        loadingLabel: translateStatusLine(stats.loadingLabel.trim()),
      });
    }
    return t('{source} · {ago}', { source, ago });
  }

  _toggleState(layer) {
    const unavailable = layer.stats?.sourceUnavailable === true;
    const transitioning =
      layer.lifecycleState === 'enabling' ||
      layer.lifecycleState === 'disabling';
    const busy = transitioning || Boolean(this._pending?.has(layer.id));
    const uncertain = Boolean(layer.lifecycleUncertain);
    const feed = unavailable
      ? 'unavailable'
      : layer.enabled
        ? layerFeedState(layer.stats)
        : 'off';
    const showsFeed =
      !transitioning && !uncertain && (layer.enabled || unavailable);
    const stateText = transitioning
      ? lifecycleStateLabel(layer.lifecycleState)
      : uncertain
        ? t('UNCERTAIN')
        : showsFeed
          ? t(FEED_STATE_LABEL_KEYS[feed])
          : t('OFF');
    const title = unavailable
      ? String(
          translateFeedError(layer.stats.error) || t('Data source unavailable'),
        )
      : layerKeyRequirementTooltip(layer);
    const label = t('{name}: {state}', {
      name: panelLabel(layer),
      state: stateText,
    });
    return {
      busy,
      blocked: busy || (unavailable && !layer.enabled),
      feed: transitioning
        ? layer.lifecycleState
        : uncertain
          ? 'uncertain'
          : feed,
      stateText,
      title,
      label: title ? `${label}. ${title}` : label,
      classes: {
        active: Boolean(layer.enabled),
        transitioning,
        enabling: layer.lifecycleState === 'enabling',
        disabling: layer.lifecycleState === 'disabling',
        'lifecycle-uncertain': uncertain,
        ...Object.fromEntries(
          Object.keys(FEED_STATE_LABEL_KEYS).map((state) => [
            `feed-${state}`,
            Boolean(
              (layer.enabled || unavailable) && !uncertain && feed === state,
            ),
          ]),
        ),
      },
    };
  }
  _formatCount(n) {
    if (n >= 1000)
      return `${formatNumber(n / 1000, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        useGrouping: false,
      })}K`;
    return String(n);
  }

  _timeAgo(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 5) return t('just now');
    if (diff < 60) return t('{count}s ago', { count: diff });
    if (diff < 3600) return t('{count}m ago', { count: Math.floor(diff / 60) });
    return t('{count}h ago', { count: Math.floor(diff / 3600) });
  }
}
