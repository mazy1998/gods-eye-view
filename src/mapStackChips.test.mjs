import { readShellSource } from './testSupport/readShellSource.mjs';
import { expandApplicationHtml } from '../build/application-html.js';
import { readStylesheet } from './testSupport/readStylesheet.mjs';
// MAP STACK source models and chip styles. The Map tab's picker
// (mapLook/mapStackPicker.dom.test.mjs) renders these models: the owner-approved
// allowlist from the controller's stack data, each stack's own reason, and the
// lit chip from controller state rather than the click. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRESENTED_MAP_STACK_IDS,
  mapStackChipModel,
  mapStackChipModels,
} from './mapStackChips.js';

test("models carry the stack's own reason and never invent an active chip", () => {
  assert.deepEqual(mapStackChipModels([{ id: 'osm', label: 'OSM' }], null), [
    {
      id: 'osm',
      label: 'OSM',
      available: true,
      active: false,
      requiresIon: false,
      requirement: '',
      unavailableHint: '',
      title: 'OSM',
    },
  ]);

  // A stack list without a controller-supplied reason still explains itself.
  assert.deepEqual(
    [
      mapStackChipModel(
        {
          id: 'bing-aerial',
          label: 'Bing Aerial',
          requiresIon: true,
          available: false,
        },
        null,
      ),
      mapStackChipModel(
        { id: 'hybrid', label: 'Hybrid', available: false },
        null,
      ),
    ].map(({ requirement, unavailableHint, title }) => ({
      requirement,
      unavailableHint,
      title,
    })),
    [
      {
        requirement: 'ION',
        unavailableHint: 'Needs CESIUM_ION_TOKEN — add it in Provider Settings',
        title: 'Needs CESIUM_ION_TOKEN — add it in Provider Settings',
      },
      {
        requirement: '',
        unavailableHint: 'Hybrid is unavailable',
        title: 'Hybrid is unavailable',
      },
    ],
  );

  assert.deepEqual(mapStackChipModels(undefined, 'osm'), []);
});

test('the active cyan survives hover', () => {
  const css = readStylesheet(new URL('../style.css', import.meta.url));
  const hover = css.indexOf('.map-stack-chip:hover');
  const active = css.indexOf('.map-stack-chip.active {');
  const unavailable = css.indexOf('.map-stack-chip.unavailable');

  assert.ok(
    hover > 0 && active > hover,
    'active must follow hover so it wins at equal specificity',
  );
  assert.ok(
    unavailable > active,
    'unavailable must follow both so a keyless chip never lights up',
  );
  assert.doesNotMatch(
    css.slice(hover, css.indexOf('{', hover)),
    /:not\(/,
    'a :not() in the hover selector outranks .active and washes the cyan out on hover',
  );
});

test('the keyboard focus ring survives on the ACTIVE chip', () => {
  // The bug this pins: `.active` legitimately wins the color/border/background/
  // box-shadow it shares with the focus rule, and the base rule sets
  // `outline: none` — so a focus state built only from those properties is
  // INVISIBLE on the active chip. The ring must live on a property no other
  // chip-state rule sets.
  const css = readStylesheet(new URL('../style.css', import.meta.url));
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
  const chipRules = [
    ...css.matchAll(/([^{}]*\.map-stack-chip[^{}]*)\{([^{}]*)\}/g),
  ].map(([, selector, body], order) => ({
    selector: stripComments(selector).trim(),
    body: stripComments(body),
    order,
  }));
  assert.ok(chipRules.length >= 5, 'expected the chip state rules to be found');

  const ringIndex = chipRules.findIndex(
    ({ selector, body }) =>
      selector.includes(':focus-visible') &&
      /outline:\s*(?!none)\S/.test(body) &&
      /outline-offset:/.test(body),
  );
  assert.ok(
    ringIndex >= 0,
    'a :focus-visible rule must draw a real outline ring',
  );

  // Nothing after it may touch outline again, so the ring cannot be erased by
  // .active, :disabled, or anything added later.
  for (const rule of chipRules.slice(ringIndex + 1)) {
    assert.doesNotMatch(
      rule.body,
      /outline/,
      `"${rule.selector}" must not touch outline — it would erase the focus ring`,
    );
  }
  for (const selector of [
    '.map-stack-chip.active',
    '.map-stack-chip.unavailable',
  ]) {
    assert.ok(
      chipRules.some((rule) => rule.selector.includes(selector)),
      `expected a ${selector} rule to exist for this check to mean anything`,
    );
  }

  // `transition: all` animates outline-width off the `outline: none` base, and
  // Chrome parks that transition at 0px for chips on a wrapped line — the ring
  // never appeared on rows 2 and 3. The base rule must list its properties.
  const base = chipRules.find((rule) =>
    rule.selector.endsWith('.map-stack-chip'),
  );
  assert.ok(base, 'expected the base .map-stack-chip rule');
  assert.doesNotMatch(
    base.body,
    /transition:\s*all\b/,
    'transition: all animates outline-width and kills the focus ring on wrapped rows',
  );
  assert.doesNotMatch(
    base.body,
    /transition:[^;]*outline/,
    'the focus ring must not be animated',
  );
  assert.match(
    base.body,
    /transition:\s*\n?\s*color/,
    'the hover/active treatment still animates',
  );
});

test('Map & Look owns Map Source and the retired trays and left panel are absent', () => {
  const html = expandApplicationHtml(
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  );
  const ui = readShellSource();
  const picker = readFileSync(
    new URL('./ui/mapLook/MapStackPicker.vue', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(
    html,
    /map-stack-select/,
    'the SOURCE dropdown is replaced by the chip row',
  );
  assert.doesNotMatch(
    html,
    /id="stack-panel"/,
    'the duplicate left MAP STACK panel is retired',
  );
  assert.doesNotMatch(
    html,
    /id="control-panel"|id="map-stack-chips"/,
    'the dock tray no longer holds a second picker',
  );
  assert.match(
    picker,
    /<section class="map-source-section"[\s\S]*?id="map-stack-chips"\s+class="map-stack-chip-row"\s+role="group"\s+:aria-label="t\('Map source'\)"/,
  );
  assert.match(
    picker,
    /id="map-source-label">\{\{ t\('MAP SOURCE'\) \}\}<[\s\S]*?id="map-stack-status"/,
  );

  const controls = readFileSync(
    new URL('./ui/mapSourceControls.js', import.meta.url),
    'utf8',
  );
  assert.match(
    ui,
    /return this\._mapSourceControls\.select\(stackId, \{ syncShare \}\)/,
    'the application action uses the component selection path',
  );
  assert.match(
    ui,
    /selectStack: \(id\) => \{\s*void this\._mapSourceControls\?\.select\(id\)/,
    'tile clicks use the same component selection path',
  );
  assert.match(
    controls,
    /await controller\.setStack\(stackId\)/,
    'selection still delegates source loading to the map controller',
  );
  assert.match(
    picker,
    /mapStackChipModels\(props\.mapStack\?\.stacks, props\.mapStack\?\.activeId/,
    'the active tile follows the published controller state',
  );
  assert.match(
    ui,
    /window\.addEventListener\('gev:map-stack-changed', onChange\)/,
    'provider-driven fallback reaches the component without a user click',
  );
  assert.match(
    ui,
    /window\.removeEventListener\('gev:map-stack-changed', onChange\)/,
    'the provider-driven subscription has an explicit remover',
  );
  assert.match(
    controls,
    /unsubscribe\?\.\(\)/,
    'component destruction releases its subscription',
  );
});
