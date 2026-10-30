import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';

const { mountView } = await import('../mountView.js');
const { mountCockpitBriefingPages } =
  await import('../cockpitBriefingPages.js');
const { createStateChannel } = await import('../../app/stateChannel.js');
const { emptyBriefView } = await import('../cockpitBriefing.js');

function mountPages() {
  const news = container.appendChild(document.createElement('section'));
  const local = container.appendChild(document.createElement('section'));
  let current = emptyBriefView();
  const channel = createStateChannel(() => current);
  const cockpit = {
    show(next) {
      current = next;
      channel.publish();
    },
    getBriefView: () => channel.getSnapshot(),
    subscribeBriefView: (listener, options) =>
      channel.subscribe(listener, options),
  };
  const mounted = mountCockpitBriefingPages(mountView, {
    news,
    local,
    cockpit,
  });
  return { news, local, cockpit, mounted };
}

test('News and Local rest on their placeholders and source credit', () => {
  const { news, local, mounted } = mountPages();
  const status = news.querySelector('#cockpit-news-status');
  assert.equal(status.textContent.trim(), 'ACQUIRING REGIONAL NEWS');
  assert.equal(status.hidden, false);
  assert.equal(
    news.querySelector('#cockpit-news-list').getAttribute('aria-live'),
    'polite',
  );
  assert.equal(
    local.querySelector('#cockpit-local-place').textContent,
    'RESOLVING REGION',
  );
  assert.equal(
    local.querySelector('#cockpit-local-coordinates').textContent,
    '--',
  );
  const credit = local.querySelector('.cockpit-weather-credit');
  assert.equal(credit.getAttribute('href'), 'https://open-meteo.com/');
  assert.equal(credit.getAttribute('rel'), 'noopener');
  mounted.dispose();
  assert.equal(news.childNodes.length, 0);
  assert.equal(local.childNodes.length, 0);
});

test('articles render as text links that open apart from the page', () => {
  const { news, local, cockpit, mounted } = mountPages();
  const view = emptyBriefView();
  cockpit.show({
    news: {
      statusText: 'REGIONAL NEWS UNAVAILABLE',
      statusState: 'ok',
      statusHidden: true,
      articles: [
        {
          key: '0:a',
          url: 'https://news.example/a',
          title: '<img src=x>Story',
          meta: 'news.example · 2H',
        },
      ],
    },
    local: { ...view.local, place: 'AUSTIN', temperature: '22°C' },
  });
  const status = news.querySelector('#cockpit-news-status');
  assert.equal(status.hidden, true);
  assert.equal(status.dataset.state, 'ok');
  const link = news.querySelector('#cockpit-news-list li a');
  assert.equal(link.getAttribute('href'), 'https://news.example/a');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.querySelector('strong').textContent, '<img src=x>Story');
  assert.equal(link.querySelector('img'), null);
  assert.equal(link.querySelector('span').textContent, 'news.example · 2H');
  assert.equal(
    local.querySelector('#cockpit-local-place').textContent,
    'AUSTIN',
  );
  assert.equal(
    local.querySelector('#cockpit-local-temperature').textContent,
    '22°C',
  );
  mounted.dispose();
});
