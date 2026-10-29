// Saving the first Google key strips the keyless OSM basemap from the share
// hash. That decision must follow the latest saved status, not the status the
// surface opened with: once Google is set, a later Google save (after a
// restart that never reloaded the page) keeps the user's map=osm choice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from './testSupport/componentDom.mjs';

const { initKeySetup } = await import('./keySetup.js');

const template = readFileSync(
  new URL('./ui/templates/provider-settings.html', import.meta.url),
  'utf8',
);
const status = (set) => ({
  keys: [
    {
      id: 'google-maps',
      title: 'Google Maps',
      unlocks: 'Photorealistic 3D',
      getUrl: 'https://console.cloud.google.com/',
      envVars: ['GOOGLE_MAPS_API_KEY'],
      tier: 'metered',
      clientExposed: true,
      set,
    },
  ],
  setCount: set ? 1 : 0,
  total: 1,
});

test('a second Google save keeps map=osm once the first save set Google', async (t) => {
  container.innerHTML = template;
  let hash = 'lat=30.2&lon=-97.7&map=osm';
  const location = {
    get hash() {
      return `#${hash}`;
    },
    get href() {
      return `http://127.0.0.1/#${hash}`;
    },
  };
  const history = {
    replaceState: (_state, _title, url) => {
      hash = new URL(url).hash.slice(1);
    },
  };
  for (const [name, value] of Object.entries({ location, history })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, name, previous)
        : delete globalThis[name],
    );
  }
  const controller = new AbortController();
  t.after(() => controller.abort());
  await initKeySetup({
    documentRef: document,
    signal: controller.signal,
    fetchImpl: async (url) => {
      if (url === '/api/setup/status')
        return { ok: true, json: async () => status(false) };
      // The key is saved; the dev-server restart fails, so no reload follows.
      return {
        ok: true,
        json: async () => ({
          ok: true,
          saved: ['GOOGLE_MAPS_API_KEY'],
          status: status(true),
        }),
      };
    },
  });
  const saveGoogle = async () => {
    const input = document.querySelector(
      'input[data-env-var="GOOGLE_MAPS_API_KEY"]',
    );
    input.value = 'AIza-example';
    document.querySelector('[data-key-setup-apply]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  await saveGoogle();
  assert.ok(!hash.includes('map=osm'), `first save strips OSM: ${hash}`);

  hash = 'lat=30.2&lon=-97.7&map=osm';
  await saveGoogle();
  assert.equal(hash, 'lat=30.2&lon=-97.7&map=osm');
});
