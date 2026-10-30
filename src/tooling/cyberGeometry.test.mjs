import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs,
  compare,
  matchingException,
  validateExceptions,
} from '../../scripts/qa-cyber-geometry.mjs';

test('geometry CLI requires an artifact and caps pixel tolerances', () => {
  assert.throws(() => parseArgs([]), /--out/);
  for (const value of ['-1', '3', 'NaN'])
    assert.throws(() =>
      parseArgs(['--out', 'report.json', '--tolerance', value]),
    );
  assert.equal(parseArgs(['--out', 'report.json']).baseline, 'f2c6ff08');
  assert.throws(() => parseArgs(['--unknown', 'x']));
});
test('pixel rounding has tolerance but visibility and frame modes remain exact', () => {
  assert.ok(compare(28, 28.047, 1));
  assert.ok(!compare(28, 0, 1));
  assert.ok(!compare(true, false, 1));
  assert.ok(!compare('block', 'none', 1));
  assert.ok(!compare('blur(24px)', 'none', 1));
});
test('geometry exceptions cannot exempt other nodes, properties or values', () => {
  const e = {
    fixture: 'layers',
    node: 'search',
    property: 'width',
    reference: 169,
    actual: 340,
    reason: 'New full-width finder.',
  };
  validateExceptions([e]);
  assert.ok(matchingException([e], 'layers', e, 1));
  for (const patch of [
    { node: 'frame' },
    { property: 'height' },
    { actual: 0 },
    { reference: 0 },
  ])
    assert.equal(
      matchingException([e], 'layers', { ...e, ...patch }, 1),
      undefined,
    );
  assert.equal(matchingException([e], 'voice', e, 1), undefined);
  assert.throws(() => validateExceptions([{ ...e, reason: '' }]));
  assert.throws(() => validateExceptions([{ ...e, fixture: '*' }]));
  for (const patch of [
    { property: 'display', reference: 'none', actual: 'grid' },
    { property: 'display', reference: 'block', actual: 'none' },
    { property: 'visible', reference: true, actual: false },
    { property: 'visibility', reference: 'visible', actual: 'hidden' },
    { property: 'opacity', reference: 1, actual: 0 },
  ]) {
    const hidden = { ...e, ...patch };
    assert.throws(() => validateExceptions([hidden]));
    assert.equal(matchingException([hidden], 'layers', hidden, 1), undefined);
  }
  validateExceptions([
    { ...e, property: 'display', reference: 'block', actual: 'grid' },
  ]);
});

test('host fixtures retain real panel roots, bodies and measured ancestor chains', async () => {
  const { createFixtures } =
    await import('../../scripts/qa-cyber-geometry-fixtures.mjs');
  const { readFileSync } = await import('node:fs');
  const { JSDOM } = await import('jsdom');
  const read = (file) =>
    readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  const fixtures = createFixtures(read);
  const cases = {
    layers: [
      '#data-panel.panel-collapsible > .data-panel-inner > .panel-header > .panel-title',
      '#data-panel > .data-panel-inner > #data-toggles > section.layer-browser.gev-surface > .layer-search > .layer-filter',
    ],
    stories: [
      '#scene-panel.panel-collapsible > .scene-panel-inner > .panel-header',
      '#scene-controls-body > .stories-controls > .scene-controls > #scene-start-btn',
    ],
    tools: [
      '#gev-legacy-host > #draw-group.pp-toggle-group > #draw-toggle',
      '#gev-legacy-host > #geo-import-group.pp-toggle-group > #geo-import-button',
    ],
  };
  for (const fixture of fixtures) {
    const dom = new JSDOM(fixture.html);
    for (const selector of cases[fixture.id] ?? [])
      assert.ok(dom.window.document.querySelector(selector), selector);
    if (fixture.id === 'tools') {
      assert.equal(dom.window.document.querySelector('#pp-toggles'), null);
      assert.deepEqual(
        [...dom.window.document.querySelector('#gev-legacy-host').children].map(
          (el) => el.id,
        ),
        ['geo-import-group', 'draw-group'],
      );
    }
    dom.window.close();
  }
  const amended = createFixtures((file) =>
    read(file).replace(
      'class="panel-collapsible',
      'class="retained-from-template panel-collapsible',
    ),
  );
  assert.match(amended[0].html, /retained-from-template/);
});

test('finder expectations cannot mix plain and icon-wrapper geometry', () => {
  const e = {
    fixture: 'layers',
    profile: 'default',
    node: 'search',
    property: 'paddingLeft',
    reference: 0,
    actual: 8,
    reason: 'Plain finder inset.',
  };
  assert.ok(matchingException([e], 'layers', e, 1, 'default'));
  assert.equal(
    matchingException([e], 'layers', e, 1, 'icon-finder'),
    undefined,
  );
});

test('shell visibility audits the map readout and language chip with the HUD off', async () => {
  const { createFixtures } =
    await import('../../scripts/qa-cyber-geometry-fixtures.mjs');
  const { readFileSync } = await import('node:fs');
  const { JSDOM } = await import('jsdom');
  const fixture = createFixtures((file) =>
    readFileSync(new URL('../../' + file, import.meta.url), 'utf8'),
  ).find((entry) => entry.id === 'shell-visibility');
  assert.deepEqual(fixture.properties, ['visible', 'display']);
  const dom = new JSDOM(fixture.html);
  const doc = dom.window.document;
  assert.ok(doc.querySelector('.gev-rail:not([hidden])'));
  assert.ok(doc.querySelector('#intel-hud:not(.active)'));
  assert.ok(
    doc.querySelector('#style-indicator[data-geometry="style-readout"]'),
  );
  assert.ok(
    doc.querySelector('body > #corner-actions[data-geometry="corner-row"]'),
  );
  assert.equal(
    doc.querySelector('#corner-actions .locale-picker-button').dataset.geometry,
    'language-chip',
  );
  dom.window.close();
});

test('Stories geometry uses the shared content order and enough cards to exercise its cap', async () => {
  const { createFixtures } =
    await import('../../scripts/qa-cyber-geometry-fixtures.mjs');
  const { readFileSync } = await import('node:fs');
  const { JSDOM } = await import('jsdom');
  const fixtures = createFixtures((file) =>
    readFileSync(new URL('../../' + file, import.meta.url), 'utf8'),
  );
  const stories = fixtures.find((f) => f.id === 'stories');
  assert.equal(stories.profile, 'playlist-cards');
  assert.equal(stories.structuralExceptions.length, 6);
  const dom = new JSDOM(stories.html);
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.stories-recipe').length, 6);
  assert.ok(
    doc
      .querySelector('#scene-start-btn')
      .compareDocumentPosition(doc.querySelector('.stories-authoring')) &
      dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  assert.equal(
    doc.querySelector('#scene-start-btn').textContent.trim(),
    'Play',
  );
  dom.window.close();
});
