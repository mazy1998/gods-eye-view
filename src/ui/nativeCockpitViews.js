import { t } from '../i18n/index.js';
import { cockpitVisionLabels } from './cockpitVisionLabels.js';

/** Bind supplied Cockpit markup to the controller's existing view channels. */
export function bindNativeCockpitViews(owner) {
  const byId = (id) => document.getElementById(id);
  const text = (node, value) => {
    if (node) node.textContent = value ?? '';
  };
  const listen = (id, fn) => owner._listen(byId(id), 'click', fn);
  listen('cockpit-vision-previous', () => owner.cycleVisionMode(-1));
  listen('cockpit-vision-current', () => owner.cycleVisionMode(1));
  listen('cockpit-vision-next', () => owner.cycleVisionMode(1));
  listen('cockpit-context-previous', () =>
    owner.navigateContext(-1, { origin: 'user' }),
  );
  listen('cockpit-context-next', () =>
    owner.navigateContext(1, { origin: 'user' }),
  );
  listen('cockpit-context-toggle', () => owner.toggleContactPanel());
  listen('cockpit-weather-toggle', () => owner.toggleWeather());
  const vision = byId('cockpit-vision-current');
  const visionLabel = byId('cockpit-vision-current-label');
  owner._listenerRemovers.push(
    owner.subscribeVisionView(({ state }) => {
      const { label, name } = cockpitVisionLabels(state.mode);
      text(visionLabel, label);
      if (vision) {
        vision.dataset.cockpitVision = state.mode;
        vision.setAttribute(
          'aria-label',
          t('Current cockpit vision style: {style}. Activate for next style.', {
            style: name,
          }),
        );
        vision.title = t('Current style: {style} — click for next', {
          style: name,
        });
      }
    }),
  );
  const contactFields = Object.fromEntries(
    Object.entries({
      subject: 'scope',
      'nearest-label': 'nearest',
      bearing: 'bearing',
      distance: 'distance',
      uncertainty: 'uncertainty',
      updated: 'updated',
    }).map(([suffix, field]) => [field, byId(`cockpit-context-${suffix}`)]),
  );
  const previous = byId('cockpit-context-previous'),
    next = byId('cockpit-context-next');
  const toggle = byId('cockpit-context-toggle'),
    direction = byId('cockpit-context-direction');
  const weather = byId('cockpit-weather-toggle'),
    weatherState = byId('cockpit-weather-state');
  const cohorts = [...document.querySelectorAll('[data-context-cohort]')];
  owner._listenerRemovers.push(
    owner.subscribeContactView(({ state }) => {
      for (const [field, node] of Object.entries(contactFields))
        text(node, state[field]);
      if (previous) previous.disabled = !state.canPrevious;
      if (next) next.disabled = !state.canNext;
      if (toggle) {
        toggle.textContent = state.collapsed ? '+' : '−';
        toggle.setAttribute('aria-expanded', String(!state.collapsed));
        toggle.setAttribute(
          'aria-label',
          state.collapsed
            ? t('Expand Contact panel')
            : t('Collapse Contact panel'),
        );
      }
      if (direction) {
        direction.style.transform = `rotate(${state.relative ?? 0}deg)`;
        direction.classList.toggle('unknown', state.relative === null);
      }
      for (const node of cohorts) {
        const cohort = state.cohorts.find(
          (item) => item.id === node.dataset.contextCohort,
        );
        text(node.querySelector('strong'), cohort?.count ?? '—');
        node.classList.toggle('unknown', Boolean(cohort?.unknown));
      }
      if (weather) {
        const label = state.weatherEnabled
          ? t('Disable cockpit weather effects')
          : t('Enable cockpit weather effects');
        weather.classList.toggle('active', state.weatherEnabled);
        weather.setAttribute('aria-pressed', String(state.weatherEnabled));
        weather.setAttribute('aria-label', label);
        weather.title = label;
      }
      text(weatherState, state.weatherEnabled ? t('ON') : t('OFF'));
    }),
  );
  const newsStatus = byId('cockpit-news-status'),
    newsList = byId('cockpit-news-list');
  const local = Object.fromEntries(
    [
      'place',
      'coordinates',
      'temperature',
      'wind',
      'wind-direction',
      'condition',
      'cloud',
      'precipitation',
    ].map((key) => [key, byId(`cockpit-local-${key}`)]),
  );
  let newsSignature = null;
  owner._listenerRemovers.push(
    owner.subscribeBriefView(({ state }) => {
      text(newsStatus, state.news.statusText);
      if (newsStatus) {
        newsStatus.hidden = state.news.statusHidden;
        if (state.news.statusState)
          newsStatus.dataset.state = state.news.statusState;
        else delete newsStatus.dataset.state;
      }
      const signature = JSON.stringify(state.news.articles);
      if (newsList && signature !== newsSignature) {
        newsSignature = signature;
        newsList.replaceChildren(
          ...state.news.articles.map((article) => {
            const item = newsList.ownerDocument.createElement('li');
            const link = newsList.ownerDocument.createElement('a');
            link.href = article.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            const title = newsList.ownerDocument.createElement('strong');
            title.textContent = article.title;
            const meta = newsList.ownerDocument.createElement('span');
            meta.textContent = article.meta;
            link.append(title, meta);
            item.append(link);
            return item;
          }),
        );
      }
      for (const [field, node] of Object.entries(local))
        text(
          node,
          state.local[field === 'wind-direction' ? 'windDirection' : field],
        );
    }),
  );
}
