import { formatUtcDayMonth, t } from '../i18n/index.js';
import { utcClock } from './railTimeline.js';
import { createRailTimelineState } from './railTimelineState.js';
import { mountView } from './mountView.js';
import WeatherPanelView from './WeatherPanelView.vue';

// Remounting controls must not reopen a panel the user already collapsed.
const appearedDocuments = new WeakSet();
const openDocuments = new WeakMap();
const ORDER = [
  'weather-cyclones',
  'wind',
  'weather-radar',
  'weather-satellite',
  'weather-lightning',
  'air-quality',
];
const OBSERVED = new Set(ORDER.slice(2, 5));
let nextPanelId = 0;
const utc = (time) =>
  Number.isFinite(Date.parse(time))
    ? `${formatUtcDayMonth(time)} ${utcClock(time)}`
    : t('Unavailable');
const clockTime = (time) => utcClock(time) || t('Unavailable');
const age = (time) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 60_000),
  );
  return minutes >= 60
    ? t('{hours}h {minutes}m ago', {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      })
    : t('{minutes}m ago', { minutes });
};
const historyTime = (time) =>
  t('{time} · {minutes} min ago', {
    time: clockTime(time),
    minutes: Math.max(0, Math.floor((Date.now() - Date.parse(time)) / 60_000)),
  });
const dated = (time) => `${utc(time)} · ${age(time)}`;
const set = (node, key, value) => {
  if (node[key] !== value) node[key] = value;
};

/**
 * Bring a newly opened card into the scrolled body: nearest alignment, or its
 * header at the top when the card is taller than the body. One write to the
 * body's own scroll position, without animation; ancestors never move.
 */
function revealCard(scroller, card) {
  const height = scroller?.clientHeight;
  if (!(height > 0) || !scroller.getBoundingClientRect) return;
  if (typeof card?.getBoundingClientRect !== 'function') return;
  const view = scroller.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const top = box.top - view.top - (scroller.clientTop || 0);
  const delta =
    top < 0 || box.height > height
      ? top
      : Math.max(0, top + box.height - height);
  if (delta) scroller.scrollTop = (scroller.scrollTop || 0) + delta;
}

/** Map weather descriptors and the observed clock into reusable rail readouts. */
export function createWeatherPanel({
  container,
  clock,
  setLayerParams = () => {},
  onAction = () => {},
} = {}) {
  const document = container?.ownerDocument;
  if (!document?.createElement) return null;
  const panel = container.closest?.('#weather-panel');
  const count = panel?.querySelector('#weather-panel-count');
  const panelId = ++nextPanelId;
  let entries = [];
  let models = [];
  let scopeText = '';
  let showTimeline = false;
  let hidden = true;
  let view = null;
  let rendering = false;
  const drafts = new Map();
  const rangeKey = (id, settingId) => JSON.stringify([id, settingId]);
  const rangeFor = (id, settingId) =>
    models
      .find((card) => card.id === id)
      ?.blocks.find((block) => block.type === 'settings')
      ?.settings.find((setting) => setting.id === settingId)?.range;
  const validRange = (range, value) =>
    range?.param &&
    !range.disabled &&
    Number.isFinite(value) &&
    value >= Number(range.min) &&
    value <= Number(range.max);
  const projectRanges = (cards) =>
    cards.map((card) => ({
      ...card,
      blocks: card.blocks.map((block) =>
        block.type === 'settings'
          ? {
              ...block,
              settings: block.settings.map((setting) => {
                const range = setting.range;
                const draft = drafts.get(rangeKey(card.id, setting.id));
                if (!range) return setting;
                const candidate = Number(draft?.value ?? range.value);
                const value = Math.min(
                  Number(range.max),
                  Math.max(
                    Number(range.min),
                    Number.isFinite(candidate) ? candidate : Number(range.min),
                  ),
                );
                return { ...setting, range: { ...range, value } };
              }),
            }
          : block,
      ),
    }));
  let destroyed = false;
  let previousIds = null;
  let hasAppeared = false;
  let openId = openDocuments.get(document) || null;
  // Open card as last shown; null until cards are on screen.
  let shownOpenId = null;
  const timeline = createRailTimelineState({
    onCommit: (tick) => clock?.setTarget(tick),
    onPreview: historyTime,
    onStep: (direction) => clock?.step(direction),
    onLatest: () => clock?.latest(),
    onPlay: () => clock?.togglePlay(),
  });
  let timelineState = timeline.channel.getSnapshot();
  const pushView = () => {
    if (destroyed || rendering) return;
    const cards = projectRanges(models);
    view?.update({
      cards: cards.filter(({ id }) => !OBSERVED.has(id)),
      observed: cards.filter(({ id }) => OBSERVED.has(id)),
      scope: scopeText,
      timeline: timelineState,
      showTimeline,
      hidden,
    });
  };
  const unsubscribeTimeline = timeline.channel.subscribe(({ state }) => {
    timelineState = state;
    pushView();
  });
  const activate = (id, action) => {
    if (destroyed || !action || action.disabled) return;
    if (action.params) setLayerParams(id, action.params, { origin: 'user' });
    else action.onClick?.();
  };
  view = mountView(WeatherPanelView, {
    parent: container,
    props: {
      cards: [],
      observed: [],
      scope: '',
      timeline: timelineState,
      hidden: true,
      showTimeline: false,
      timelineActions: timeline,
      open: (id) => {
        if (destroyed) return;
        openId = id;
        openDocuments.set(document, id);
        render();
      },
      activate,
      rangeInput: (id, settingId, rawValue) => {
        if (destroyed) return;
        const range = rangeFor(id, settingId);
        const value = Number(rawValue);
        if (!validRange(range, value)) return;
        drafts.set(rangeKey(id, settingId), { range, value });
        pushView();
        if (!range.commitOnChange)
          setLayerParams(id, { [range.param]: value }, { origin: 'user' });
      },
      rangeChange: (id, settingId, rawValue) => {
        if (destroyed) return;
        const range = rangeFor(id, settingId);
        if (!range?.commitOnChange) return;
        drafts.delete(rangeKey(id, settingId));
        const value = Number(rawValue);
        if (validRange(range, value))
          setLayerParams(id, { [range.param]: value }, { origin: 'user' });
      },
    },
  });
  const render = () => {
    if (destroyed) return;
    rendering = true;
    const state = clock?.getState() || {
      mode: 'latest',
      timeline: [],
      products: [],
    };
    const active = entries
      .filter(({ summary }) => summary)
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    const observed = active.filter(({ id }) => OBSERVED.has(id));
    showTimeline = observed.length > 0;
    const names = {
      'weather-radar': t('Rain radar'),
      'weather-satellite': t('Satellite clouds'),
      'weather-lightning': t('Lightning density'),
    };
    scopeText = observed.map(({ id }) => names[id]).join(' · ');
    const index =
      state.mode === 'latest'
        ? state.timeline.length - 1
        : Math.max(
            0,
            state.timeline.findLastIndex(
              (tick) => Date.parse(tick) <= Date.parse(state.target),
            ),
          );
    timeline.update({
      ticks: state.timeline,
      index,
      mode: state.mode,
      playing: Boolean(state.playing),
      disabled: !showTimeline || state.timeline.length < 2,
      readout:
        state.mode === 'latest'
          ? t('LATEST · newest per product')
          : historyTime(state.target),
    });
    models = active.map((entry) => {
      const { id, icon, summary, legend = [], list } = entry;
      // Discrete classes (storm geometry, AQHI bands) list swatches, not a ramp.
      const categorical = entry.legendCategorical === true;
      let detail = summary.detail;
      const product = state.products.find((item) => item.id === id);
      if (OBSERVED.has(id)) {
        const shown = product?.shown ?? summary.shownTime;
        if (state.mode === 'history' && product?.selected === null) {
          const gap = summary.maxGapMinutes || 30;
          const time = clockTime(state.target);
          detail =
            gap < 60
              ? t('No frame within {gap} min of {time}', { gap, time })
              : t('No frame within {gap} h of {time}', { gap: gap / 60, time });
        } else if (shown) {
          detail = dated(shown);
          if (state.mode === 'history')
            detail =
              Date.parse(shown) === Date.parse(state.target)
                ? t('{detail} · synced', { detail })
                : t('{detail} · nearest', { detail });
        }
      } else if (id === 'wind') {
        detail = t('Forecast · valid {valid} · issued {issued}', {
          valid: utc(summary.validTime),
          issued: utc(summary.issuedTime),
        });
        if (state.mode === 'history')
          detail = t('{detail} · Does not follow history', { detail });
      }
      const lines = [
        { id: 'time', text: detail, muted: true },
        { id: 'status', text: summary.status },
      ];
      for (const line of summary.lines || []) lines.push(line);
      const actions = (summary.actions || []).map((action) => ({
        ...action,
        onClick: action.onClick || (() => onAction(id, action.id)),
      }));
      const legendBlock = {
        id: 'legend',
        type: 'legend',
        legend: {
          categorical,
          colors: legend.map(({ color }) => color),
          labels: legend.map(({ label }) => label),
          units: categorical ? '' : summary.units,
          zeroIndex: legend.findIndex(({ label }) => label === '0'),
        },
      };
      const blocks = [
        ...(list?.items?.length ? [{ id: 'list', type: 'list', list }] : []),
        { id: 'details', type: 'lines', lines },
        ...(legend.length ? [legendBlock] : []),
        ...(summary.settings?.length
          ? [{ id: 'settings', type: 'settings', settings: summary.settings }]
          : []),
        ...(actions.length
          ? [{ id: 'actions', type: 'actions', actions }]
          : []),
        ...(summary.result ? [{ ...summary.result, type: 'result' }] : []),
      ];
      return {
        id,
        bodyId: `weather-card-body-${panelId}-${id}`,
        icon,
        title: summary.label,
        badge: summary.coverage,
        open: id === openId,
        compact:
          summary.status ||
          summary.compact ||
          (id === 'wind'
            ? t('Forecast · valid {valid}', { valid: utc(summary.validTime) })
            : detail),
        compactStatus: Boolean(summary.status),
        blocks,
      };
    });
    for (const [key, draft] of drafts) {
      const [id, settingId] = JSON.parse(key);
      const range = rangeFor(id, settingId);
      if (
        !range ||
        range.disabled ||
        !range.commitOnChange ||
        ['id', 'param', 'min', 'max', 'step', 'value'].some(
          (field) => range[field] !== draft.range[field],
        )
      )
        drafts.delete(key);
    }
    hidden = active.length === 0;
    rendering = false;
    pushView();
    // Only a change of open card moves the scroll position; refreshes leave it.
    if (shownOpenId !== null && openId !== shownOpenId) {
      const open = [
        ...(view.element?.querySelectorAll('[data-card-id]') || []),
      ].find((node) => node.dataset.cardId === openId);
      revealCard(container, open);
    }
    shownOpenId = active.length ? openId : null;
    if (count) set(count, 'textContent', String(active.length));
    if (panel) set(panel, 'hidden', hidden);
    if (!hidden && panel && !appearedDocuments.has(document)) {
      appearedDocuments.add(document);
      // First appearance opens the panel unless a stored or shared collapse
      // choice exists (marked by the panel chrome when it restored the state).
      const preference = panel.dataset?.collapsedPreference;
      if (
        panel.classList.contains('collapsed') &&
        (preference === undefined || preference === 'default')
      )
        panel.querySelector('[data-collapse-target="weather-panel"]')?.click();
    }
  };
  const unsubscribe = clock?.subscribe(render);
  return {
    update(nextEntries) {
      if (destroyed) return;
      entries = nextEntries.filter(({ summary }) => summary);
      const ids = new Set(entries.map(({ id }) => id));
      const ordered = [...entries].sort(
        (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
      );
      const added =
        previousIds && entries.filter(({ id }) => !previousIds.has(id));
      if (hasAppeared && added?.length) {
        openId = added.at(-1).id;
        openDocuments.set(document, openId);
      } else if (ids.size && !ids.has(openId)) {
        openId =
          (!hasAppeared &&
            !openId &&
            ordered.find(
              ({ id, list }) =>
                id === 'weather-cyclones' && list?.items?.length,
            )?.id) ||
          ordered[0]?.id ||
          null;
      }
      if (ids.size) hasAppeared = true;
      previousIds = ids;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      timeline.destroy();
      unsubscribeTimeline();
      drafts.clear();
      view.dispose();
      if (panel) set(panel, 'hidden', true);
      if (count) set(count, 'textContent', '0');
    },
  };
}
