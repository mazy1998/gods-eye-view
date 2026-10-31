import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const { CockpitViewController } = await import('gods-eye-view/ui/cockpit');

test('published Cockpit controller binds native vision/contact/weather and paints briefing pages', (t) => {
  container.innerHTML =
    '<div class="cockpit-vision-controls"><button id="cockpit-vision-previous"></button><button id="cockpit-vision-current"><strong id="cockpit-vision-current-label"></strong></button><button id="cockpit-vision-next"></button></div><section id="cockpit-context"><strong id="cockpit-context-subject"></strong><button id="cockpit-context-previous"></button><button id="cockpit-context-next"></button><button id="cockpit-context-toggle"></button><button id="cockpit-weather-toggle"><strong id="cockpit-weather-state"></strong></button></section><section><div id="cockpit-news-status"></div><ol id="cockpit-news-list"></ol></section><section><strong id="cockpit-local-place"></strong><span id="cockpit-local-temperature"></span></section>';
  const event = { addEventListener: () => () => {} };
  const viewer = { scene: { preUpdate: event }, trackedEntityChanged: event };
  const by = (id) => document.getElementById(id);
  const changed = [];
  const owner = new CockpitViewController(viewer, {
    services: { weatherCodeLabel: () => 'CLEAR' },
    onVisionChange: (mode) => changed.push(mode),
  });
  t.after(() => owner.dispose());
  by('cockpit-vision-next').click();
  assert.equal(by('cockpit-vision-current-label').textContent, 'CRT');
  assert.equal(owner.visionMode, 'crt');
  owner.setVisionMode('thermal');
  assert.equal(by('cockpit-vision-current-label').textContent, 'FLIR');
  const navigation = [];
  owner.navigateContext = (direction) => navigation.push(direction);
  by('cockpit-context-previous').click();
  by('cockpit-context-next').click();
  assert.deepEqual(navigation, [-1, 1]);
  by('cockpit-context-toggle').click();
  assert.equal(
    by('cockpit-context-toggle').getAttribute('aria-expanded'),
    'false',
  );
  by('cockpit-weather-toggle').click();
  assert.equal(owner.weatherEnabled, true);
  assert.equal(by('cockpit-weather-state').textContent, 'ON');
  owner.renderRegionalBrief({
    place: { label: '<Place>' },
    articles: [
      {
        title: '<News>',
        url: 'https://example.invalid/',
        domain: 'example.invalid',
      },
    ],
    weather: { temperatureC: 12 },
  });
  assert.equal(by('cockpit-local-place').textContent, '<PLACE>');
  assert.equal(by('cockpit-local-temperature').textContent, '12°C');
  assert.equal(
    by('cockpit-news-list').querySelector('strong').textContent,
    '<News>',
  );
  assert.equal(container.querySelector('news'), null);
  const link = by('cockpit-news-list').querySelector('a');
  assert.equal(link.rel, 'noopener noreferrer');
  owner.dispose();
  owner.dispose();
  by('cockpit-vision-next').click();
  owner.setVisionMode('noir');
  owner.renderRegionalBriefStatus('unavailable');
  assert.equal(by('cockpit-vision-current-label').textContent, 'FLIR');
  assert.equal(by('cockpit-news-list').querySelector('a'), link);
  assert.deepEqual(changed.slice(0, 2), ['crt', 'thermal']);
});

test('native and mounted Cockpit vision controls share text for every supported mode', async (t) => {
  const { COCKPIT_VISION_MODES } = await import('../cockpitVisionPolicy.js');
  const { mountView } = await import('./mountView.js');
  const { mountCockpitVision } = await import('./cockpitVision.js');
  const native = container.appendChild(document.createElement('div'));
  native.innerHTML =
    '<button id="cockpit-vision-current"><strong id="cockpit-vision-current-label"></strong></button>';
  const event = { addEventListener: () => () => {} };
  const owner = new CockpitViewController({
    scene: { preUpdate: event },
    trackedEntityChanged: event,
  });
  t.after(() => owner.dispose());
  // Keep the already bound native handles distinct from the view's document ids.
  const nativeButton = native.querySelector('button');
  nativeButton.id = 'embedded-vision-current';
  nativeButton.querySelector('strong').removeAttribute('id');
  const group = container.appendChild(document.createElement('div'));
  const mounted = mountCockpitVision(mountView, { group, cockpit: owner });
  t.after(() => mounted.dispose());
  for (const mode of COCKPIT_VISION_MODES) {
    owner.setVisionMode(mode);
    const viewButton = group.querySelector('#cockpit-vision-current');
    assert.equal(nativeButton.dataset.cockpitVision, mode);
    assert.equal(viewButton.dataset.cockpitVision, mode);
    assert.ok(nativeButton.textContent.trim(), mode);
    assert.equal(
      nativeButton.textContent,
      group.querySelector('#cockpit-vision-current-label').textContent,
      mode,
    );
    for (const attr of ['aria-label', 'title'])
      assert.equal(
        nativeButton.getAttribute(attr),
        viewButton.getAttribute(attr),
        `${mode}: ${attr}`,
      );
  }
});
