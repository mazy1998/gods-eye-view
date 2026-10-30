// The Map tab's source tiles: the owner-approved allowlist from the
// controller's stack data, a click that dispatches the same selection the
// chip row made, and the lit tile from controller state rather than the click.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../../testSupport/componentDom.mjs';

const { default: MapStackPicker } = await import('./MapStackPicker.vue');
const { PRESENTED_MAP_STACK_IDS } = await import('../../mapStackChips.js');

// Shaped exactly like the map-stack channel's stacks.
const CONTROLLER_STACKS = [
  { id: 'photoreal', label: 'Google 3D', requiresIon: false, available: true },
  {
    id: 'bing-aerial',
    label: 'Bing Aerial',
    requiresIon: true,
    available: true,
  },
  {
    id: 'bing-labels',
    label: 'Bing Labels',
    requiresIon: true,
    available: true,
  },
  {
    id: 'esri-imagery',
    label: 'Esri Satellite',
    requiresIon: false,
    available: true,
  },
  { id: 'osm', label: 'OSM', requiresIon: false, available: true },
];

function picker(stacks, activeId, selected = []) {
  const view = mount(MapStackPicker, {
    props: {
      mapStack: { stacks, activeId, status: 'ready' },
      actions: { selectStack: (id) => selected.push(id) },
    },
  });
  const chips = () => [...view.element.querySelectorAll('.map-stack-chip')];
  const chipText = (chip) =>
    [...chip.children].map((child) => child.textContent).join(' ');
  return { view, chips, chipText, selected };
}

test('the row renders exactly the five owner-approved sources', (t) => {
  const { view, chips, chipText } = picker(CONTROLLER_STACKS, 'photoreal');
  t.after(() => view.dispose());
  assert.deepEqual(
    chips().map((chip) => chip.dataset.stackId),
    ['photoreal', 'bing-aerial', 'bing-labels', 'esri-imagery', 'osm'],
  );
  assert.deepEqual(chips().map(chipText), [
    'Google 3D',
    'Bing Aerial',
    'Bing Labels',
    'Esri Satellite',
    'OSM',
  ]);
  assert.deepEqual(PRESENTED_MAP_STACK_IDS, [
    'photoreal',
    'bing-aerial',
    'bing-labels',
    'esri-imagery',
    'osm',
  ]);
  assert.ok(
    chips().every(
      (chip) => chip.tagName === 'BUTTON' && chip.type === 'button',
    ),
  );
});

test('internal and future stacks stay outside the approved presentation set', (t) => {
  // A future Hybrid stack may land in the controller, but it must not appear
  // until the owner-approved presentation allowlist explicitly includes it.
  const withHybrid = [
    ...CONTROLLER_STACKS,
    { id: 'hybrid', label: 'Hybrid', available: true },
  ];
  const { view, chips, chipText } = picker(withHybrid, 'photoreal');
  t.after(() => view.dispose());
  assert.equal(chips().length, 5);
  assert.doesNotMatch(chips().map(chipText).join(' '), /Hybrid/);
});

test('re-rendering replaces the previous chips instead of stacking a second row', (t) => {
  const { view, chips } = picker(CONTROLLER_STACKS, 'photoreal');
  t.after(() => view.dispose());
  view.update({ mapStack: { stacks: CONTROLLER_STACKS, activeId: 'osm' } });
  assert.equal(chips().length, PRESENTED_MAP_STACK_IDS.length);
});

test('clicking a chip dispatches that stack id — the same selection the chip row made', (t) => {
  const { view, chips, selected } = picker(CONTROLLER_STACKS, 'photoreal');
  t.after(() => view.dispose());
  chips()[4].click();
  chips()[3].click();
  chips()[1].click();
  assert.deepEqual(selected, ['osm', 'esri-imagery', 'bing-aerial']);
});

test('the active chip is the pressed chip, and exactly one is pressed', (t) => {
  const { view, chips } = picker(CONTROLLER_STACKS, 'bing-labels');
  t.after(() => view.dispose());
  const pressed = chips().filter(
    (chip) => chip.getAttribute('aria-pressed') === 'true',
  );
  assert.deepEqual(
    pressed.map((chip) => chip.dataset.stackId),
    ['bing-labels'],
  );
  assert.ok(pressed[0].classList.contains('active'));
  assert.ok(
    chips()
      .filter((chip) => chip.dataset.stackId !== 'bing-labels')
      .every((chip) => !chip.classList.contains('active')),
  );
});

test('the lit chip tracks controller state, not the click', (t) => {
  const { view, chips } = picker(CONTROLLER_STACKS, 'photoreal');
  t.after(() => view.dispose());
  // A click requests a switch; nothing lights until the owner publishes.
  chips()[4].click();
  assert.ok(chips()[0].classList.contains('active'));
  assert.equal(chips()[4].getAttribute('aria-pressed'), 'false');

  // A landed switch moves both the class and the pressed state.
  view.update({ mapStack: { stacks: CONTROLLER_STACKS, activeId: 'osm' } });
  assert.ok(chips()[4].classList.contains('active'));
  assert.equal(chips()[4].getAttribute('aria-pressed'), 'true');
  assert.ok(!chips()[0].classList.contains('active'));
  assert.equal(chips()[0].getAttribute('aria-pressed'), 'false');
});

test('keyless ion stacks stay focusable, aria-disabled, and say why', (t) => {
  const keyless = CONTROLLER_STACKS.map((stack) =>
    stack.requiresIon
      ? {
          ...stack,
          available: false,
          unavailableReason:
            'Needs CESIUM_ION_TOKEN — add it in Provider Settings',
        }
      : stack,
  );
  const { view, chips, chipText, selected } = picker(keyless, 'photoreal');
  t.after(() => view.dispose());
  const bingAerial = chips()[1];
  assert.equal(
    bingAerial.disabled,
    false,
    'unavailable sources remain keyboard-reachable',
  );
  assert.equal(bingAerial.getAttribute('aria-disabled'), 'true');
  assert.equal(
    bingAerial.getAttribute('aria-label'),
    'Bing Aerial unavailable: Needs CESIUM_ION_TOKEN — add it in Provider Settings',
  );
  assert.ok(bingAerial.classList.contains('unavailable'));
  assert.equal(
    bingAerial.title,
    'Needs CESIUM_ION_TOKEN — add it in Provider Settings',
  );
  assert.equal(chipText(bingAerial), 'Bing Aerial ION');

  bingAerial.click();
  assert.deepEqual(
    selected,
    [],
    'an unavailable stack must not reach the switch path',
  );
  assert.equal(
    chips()[3].getAttribute('aria-disabled'),
    'false',
    'OSM stays selectable',
  );
});

test('a non-ion stack that fails never claims an ion token is required', (t) => {
  // The startup fallback-to-OSM case: Google 3D tiles failed to load, so
  // photoreal is unavailable for a reason that has nothing to do with ion.
  const tilesFailed = CONTROLLER_STACKS.map((stack) =>
    stack.id === 'photoreal'
      ? {
          ...stack,
          available: false,
          unavailableReason:
            'Needs GOOGLE_MAPS_API_KEY — add it in Provider Settings',
        }
      : stack,
  );
  const { view, chips, chipText } = picker(tilesFailed, 'osm');
  t.after(() => view.dispose());
  const google = chips()[0];
  assert.equal(google.getAttribute('aria-disabled'), 'true');
  assert.equal(
    google.getAttribute('aria-label'),
    'Google 3D unavailable: Needs GOOGLE_MAPS_API_KEY — add it in Provider Settings',
  );
  assert.equal(
    chipText(google),
    'Google 3D',
    'no ION badge on a stack that does not need ion',
  );
  assert.equal(
    google.title,
    'Needs GOOGLE_MAPS_API_KEY — add it in Provider Settings',
  );
  assert.equal(
    chipText(chips()[1]),
    'Bing Aerial',
    'available ion stacks stay unbadged',
  );
});

test('the status names the active source, and "..." while a switch is in flight', (t) => {
  const { view } = picker(
    [
      { ...CONTROLLER_STACKS[0], shortLabel: '3D' },
      ...CONTROLLER_STACKS.slice(1),
    ],
    'photoreal',
  );
  t.after(() => view.dispose());
  const status = () => view.element.querySelector('#map-stack-status');
  assert.equal(status().textContent, '3D');
  view.update({
    mapStack: {
      stacks: CONTROLLER_STACKS,
      activeId: 'photoreal',
      status: 'switching',
    },
  });
  assert.equal(status().textContent, '...');
  view.update({
    mapStack: {
      stacks: CONTROLLER_STACKS,
      activeId: 'osm',
      status: 'ready',
      lastError: 'Source unavailable; using OSM',
    },
  });
  assert.equal(status().textContent, 'OSM');
  assert.ok(status().classList.contains('warn'));
});

test("a disposed picker's retained tiles are inert", () => {
  const { view, chips, selected } = picker(CONTROLLER_STACKS, 'photoreal');
  const osm = chips()[4];
  view.dispose();
  osm.click();
  assert.deepEqual(selected, []);
});
