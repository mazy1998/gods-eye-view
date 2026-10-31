// Map & Look: three tabs over three panels, the seven style tiles on the
// visual owner's `style`, wrappers moved into its slots that survive every
// re-render, and the providers link only where Provider Settings works.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../../testSupport/componentDom.mjs';

const { default: MapLookView } = await import('./MapLookView.vue');

const panels = (view) =>
  Object.fromEntries(
    [...view.element.querySelectorAll('[role="tabpanel"]')].map((panel) => [
      panel.id,
      panel.hidden,
    ]),
  );

test('it opens on Look, and a tab shows its own panel only', (t) => {
  const tabs = [];
  const view = mount(MapLookView, {
    props: { mapActions: { setTab: (tab) => tabs.push(tab) } },
  });
  t.after(() => view.dispose());
  const list = view.element.querySelector('[role="tablist"]');
  assert.equal(list.getAttribute('aria-label'), 'Map & Look');
  assert.deepEqual(
    [...list.querySelectorAll('[role="tab"]')].map((tab) => [
      tab.textContent.trim(),
      tab.getAttribute('aria-selected'),
      tab.getAttribute('aria-controls'),
    ]),
    [
      ['Map', 'false', 'map-look-map'],
      ['Look', 'true', 'map-look-look'],
      ['Display', 'false', 'map-look-display'],
    ],
  );
  assert.deepEqual(panels(view), {
    'map-look-map': true,
    'map-look-look': false,
    'map-look-display': true,
  });
  list.querySelector('#map-look-map-tab').click();
  assert.deepEqual(tabs, ['map']);
  view.update({ tab: 'map' });
  assert.deepEqual(panels(view), {
    'map-look-map': false,
    'map-look-look': true,
    'map-look-display': true,
  });
});

test('the style tiles follow the published style and set it on click', (t) => {
  const calls = [];
  const view = mount(MapLookView, {
    props: {
      state: { style: 'thermal' },
      actions: { setStyle: (style) => calls.push(style) },
    },
  });
  t.after(() => view.dispose());
  const tiles = () => [...view.element.querySelectorAll('.style-btn')];
  assert.deepEqual(
    tiles().map((tile) => [
      tile.dataset.style,
      tile.querySelector('.btn-label').textContent,
      tile.querySelector('.btn-key').textContent,
    ]),
    [
      ['normal', 'Normal', '1'],
      ['retro', 'CRT', '2'],
      ['surveillance', 'NVG', '3'],
      ['thermal', 'FLIR', '4'],
      ['anime', 'Anime', '5'],
      ['noir', 'Noir', '6'],
    ],
  );
  const pressed = () =>
    tiles()
      .filter((tile) => tile.getAttribute('aria-pressed') === 'true')
      .map((tile) => tile.dataset.style);
  assert.deepEqual(pressed(), ['thermal']);
  assert.ok(tiles()[3].classList.contains('active'));
  assert.equal(tiles()[0].title, 'Show the globe without a visual filter.');
  // Each picture is drawn, never fetched, and hidden from assistive tech.
  for (const tile of tiles()) {
    const picture = tile.querySelector('.map-look-thumb');
    assert.equal(picture.getAttribute('aria-hidden'), 'true');
    assert.equal(picture.querySelector('image, img'), null);
  }
  tiles()[5].click();
  assert.deepEqual(calls, ['noir']);
  // The tile does not light optimistically; the owner's publication does.
  assert.deepEqual(pressed(), ['thermal']);
  view.update({ state: { style: 'noir' } });
  assert.deepEqual(pressed(), ['noir']);
});

test('wrappers moved into its slots survive every re-render', (t) => {
  const view = mount(MapLookView, { props: {} });
  t.after(() => view.dispose());
  const moved = {};
  for (const name of ['parameters', 'adjustments', 'display']) {
    moved[name] = document.createElement('div');
    view.element
      .querySelector(`[data-map-look-slot="${name}"]`)
      .append(moved[name]);
  }
  view.update({ tab: 'display', state: { style: 'noir' } });
  view.update({ tab: 'map', mapStack: { stacks: [], activeId: null } });
  view.update({ tab: 'look', providers: true, pickerKey: 3 });
  for (const [name, node] of Object.entries(moved))
    assert.equal(
      node.parentNode?.dataset.mapLookSlot,
      name,
      `${name} keeps its wrapper`,
    );
});

test('the providers link opens Provider Settings, and is absent where it cannot work', (t) => {
  const opened = [];
  const view = mount(MapLookView, {
    props: { mapActions: { openProviders: () => opened.push(true) } },
  });
  t.after(() => view.dispose());
  assert.equal(view.element.querySelector('.map-look-providers'), null);
  view.update({ providers: true });
  const link = view.element.querySelector('.map-look-providers');
  assert.equal(
    link.querySelector('span').textContent,
    'Configure map providers',
  );
  link.click();
  assert.deepEqual(opened, [true]);
});
