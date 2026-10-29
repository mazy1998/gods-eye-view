import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCatalog,
  extractMessages,
  findUnmarked,
  readCatalog,
  shippedLocales,
  unmarkedComponent,
  unmarkedMarkup,
  unmarkedScript,
} from '../../scripts/i18n.mjs';
import { LOCALES } from './locale.js';

const messages = extractMessages();

test('every catalog file is a shipped locale and every non-English locale has a catalog', () => {
  assert.deepEqual(
    shippedLocales().sort(),
    LOCALES.filter((locale) => locale !== 'en').sort(),
  );
});

for (const locale of shippedLocales()) {
  test(`${locale} catalog matches the code (npm run i18n)`, () => {
    const { missing, stale, errors } = checkCatalog(
      locale,
      readCatalog(locale),
      messages,
    );
    assert.deepEqual(
      { missing, stale, errors },
      { missing: [], stale: [], errors: [] },
    );
  });
}

test('every UI string is marked for translation or kept on purpose (npm run i18n)', () => {
  assert.deepEqual(
    findUnmarked().map(({ where, text }) => `${where}  ${text}`),
    [],
  );
});

test('checkCatalog reports missing, stale, placeholder and plural problems', () => {
  const fixture = new Map([
    ['Saved {name}', { plural: false }],
    ['{count} keys', { plural: true, one: '{count} key' }],
    ['Untranslated', { plural: false }],
  ]);
  const result = checkCatalog(
    'ru',
    {
      'Saved {name}': 'Сохранено {nmae}',
      '{count} keys': {
        one: '{count} ключ',
        few: '{count} ключа',
        many: '{count} ключей',
      },
      Removed: 'Удалено',
    },
    fixture,
  );
  assert.deepEqual(result.missing, ['Untranslated']);
  assert.deepEqual(result.stale, ['Removed']);
  assert.equal(result.errors.length, 2);
});

test('checkCatalog reports a translation left in English unless it is allowed', () => {
  const fixture = new Map([
    ['Bloom', { plural: false }],
    ['HDG', { plural: false }],
    ['voice|READY', { plural: false }],
    ['{state} · {source}', { plural: false }],
  ]);
  const catalog = {
    Bloom: 'Bloom',
    HDG: 'HDG',
    'voice|READY': 'READY',
    '{state} · {source}': '{state} · {source}',
  };
  const errors = (allowed) =>
    checkCatalog('es', catalog, fixture, new Set(allowed)).errors;
  assert.deepEqual(
    errors([]).map((error) => error.split(' is still English')[0]),
    ['"Bloom"', '"HDG"', '"voice|READY"'],
  );
  assert.deepEqual(errors(['Bloom', 'HDG', 'voice|READY']), []);
});

test('unmarkedMarkup finds text and attributes without data-i18n*', () => {
  const texts = (html) => unmarkedMarkup('f.html', html).map((f) => f.text);
  assert.deepEqual(texts('<span>Close</span>'), ['Close']);
  assert.deepEqual(texts('<span data-i18n>Close</span>'), []);
  assert.deepEqual(texts('<button title="Pin it">x</button>'), [
    'title="Pin it"',
  ]);
  assert.deepEqual(
    texts('<button title="Pin it" data-i18n-title>x</button>'),
    [],
  );
  assert.deepEqual(
    texts('<select translate="no"><option>0.9 dB</option></select>'),
    [],
  );
  assert.deepEqual(texts('<b data-i18n-runtime><i>OFF</i></b>'), []);
  assert.deepEqual(
    texts('<span class="material-symbols-outlined">public</span>'),
    [],
  );
  assert.deepEqual(texts('<!-- Note --><span>— 42 —</span>'), []);
});

test('unmarkedComponent checks template text, attributes and script literals, not interpolations', () => {
  const texts = (vue) => unmarkedComponent('f.vue', vue).map((f) => f.text);
  assert.deepEqual(
    texts(
      "<script setup>\nimport { t } from '../i18n/index.js';\nconst hint = { label: 'Plain words' };\n</script>\n<template>\n  <button :title=\"t('Pin it')\" title=\"Pin it\">{{ t('Save keys') }}</button>\n  <p>Not marked</p>\n  <span>{{ count }} · {{ hint.label }}</span>\n</template>\n",
    ),
    ['Plain words', 'title="Pin it"', 'Not marked'],
  );
});

test('unmarkedComponent finds literals in template expressions, not in styling, hooks or t()', () => {
  const found = (vue) => unmarkedComponent('f.vue', vue);
  const vue = [
    '<template>',
    "  <p>{{ open ? 'Yes please' : t('No thanks') }}</p>",
    '  <button :aria-label="\'Close panel\'" v-text="\'Plain words here\'"></button>',
    "  <Badge :label=\"state === 'ready now' ? t('Ready') : 'Waiting longer'\" />",
    '  <div :class="{ \'panel open\': open }" :data-state="\'ready now\'" v-if="mode === \'light mode\'"></div>',
    '</template>',
  ].join('\n');
  assert.deepEqual(
    found(vue).map(({ where, text }) => `${where} ${text}`),
    [
      'f.vue:2 Yes please',
      'f.vue:3 Close panel',
      'f.vue:3 Plain words here',
      'f.vue:4 Waiting longer',
    ],
  );
});

test('unmarkedComponent covers the review cases for templates', () => {
  const t =
    "<script setup>\nimport { t } from '../i18n/index.js';\n</script>\n";
  for (const [source, expected] of [
    ['<template><p>Loading data</p></template>', ['Loading data']],
    [
      '<template><button title="Close panel">x</button></template>',
      ['title="Close panel"'],
    ],
    [
      '<template><p v-if="a">Loading data</p><p v-else>Ready now</p></template>',
      ['Loading data', 'Ready now'],
    ],
    [
      `<template><button :title="'Close panel'">x</button></template>`,
      ['Close panel'],
    ],
    [
      `<template><button :aria-label="open ? 'Hide layers' : 'Show layers'">x</button></template>`,
      ['Hide layers', 'Show layers'],
    ],
    [
      `<template><span v-text="'Signal lost'"></span></template>`,
      ['Signal lost'],
    ],
    [`<template><span>{{ 'Signal lost' }}</span></template>`, ['Signal lost']],
    [
      `<template><span>{{ on ? 'Turn off' : 'Turn on' }}</span></template>`,
      ['Turn off', 'Turn on'],
    ],
    [
      `<template><input v-bind:placeholder="'Find a layer'"></template>`,
      ['Find a layer'],
    ],
    // A variable alone is exempt, as it is in other code.
    [
      "<script setup>\nconst label = 'Clear active';\n</script>\n<template><span>{{ label }}</span></template>",
      [],
    ],
    [
      `${t}<template><button :title="t('Close panel')">x</button></template>`,
      [],
    ],
    [`${t}<template><span>{{ t('Signal lost') }}</span></template>`, []],
    ['<template><p>Layers &amp; cameras</p></template>', ['Layers & cameras']],
    [
      '<template><slot>Nothing selected</slot></template>',
      ['Nothing selected'],
    ],
  ])
    assert.deepEqual(
      unmarkedComponent('X.vue', source).map((found) => found.text),
      expected,
      source,
    );
});

test('unmarkedScript finds literals that reach the page without t/tn/msg', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  assert.deepEqual(texts("el.textContent = 'Saved';"), ['Saved']);
  assert.deepEqual(texts("el.textContent = t('Saved');"), []);
  assert.deepEqual(texts("el.textContent = on ? 'On air' : 'Off air';"), [
    'On air',
    'Off air',
  ]);
  assert.deepEqual(texts("el.setAttribute('aria-label', `Open ${name}`);"), [
    'Open',
  ]);
  assert.deepEqual(
    texts("const row = { label: msg('Wind'), id: 'wind' };"),
    [],
  );
  assert.deepEqual(texts("const row = { label: 'Wind' };"), ['Wind']);
  assert.deepEqual(texts("el.textContent = labelFor('flights');"), []);
  assert.deepEqual(texts("el.className = 'is-active';"), []);
  assert.deepEqual(texts("el.title = mode === 'Auto mode' ? a : b;"), []);
  assert.deepEqual(texts("// el.textContent = 'Old copy';"), []);
  assert.deepEqual(
    texts("// i18n-ignore: product name\nel.textContent = 'OpenSky';"),
    [],
  );
});

test('unmarkedScript sees toasts behind optional calls and private helpers', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  assert.deepEqual(texts("showToast?.('North up');"), ['North up']);
  assert.deepEqual(texts("this._showToast('Search failed');"), [
    'Search failed',
  ]);
  assert.deepEqual(texts("this.showToast('Link copied');"), ['Link copied']);
  assert.deepEqual(texts("this.actions.showToast?.('Tilted view');"), [
    'Tilted view',
  ]);
  assert.deepEqual(texts("showToast?.(t('North up'));"), []);
  assert.deepEqual(texts("this._showToast(t('Search failed'));"), []);
});

test('unmarkedScript sees status text assigned to layer errors and labels', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  assert.deepEqual(texts("layerState._error = 'live feed unavailable';"), [
    'live feed unavailable',
  ]);
  assert.deepEqual(
    texts("this._error = err?.message || 'TeleGeography load failed';"),
    ['TeleGeography load failed'],
  );
  assert.deepEqual(texts("_error = 'Route request failed';"), [
    'Route request failed',
  ]);
  assert.deepEqual(texts("error ??= 'Feed closed';"), ['Feed closed']);
  assert.deepEqual(texts('stats.error = `${name} fetch error`;'), [
    'fetch error',
  ]);
  assert.deepEqual(texts("loadingLabel = 'loading coverage...';"), [
    'loading coverage...',
  ]);
  assert.deepEqual(texts("state._loadingLabel = 'Loading cables';"), [
    'Loading cables',
  ]);
  assert.deepEqual(texts("stats.statusMessage = 'Add a key in Settings';"), [
    'Add a key in Settings',
  ]);
  assert.deepEqual(texts("this.status = 'Scene not saved';"), [
    'Scene not saved',
  ]);
  assert.deepEqual(
    texts("layerState._error = msg('live feed unavailable');"),
    [],
  );
  assert.deepEqual(texts("stats.error = t('GBFS fetch error');"), []);
  // Machine values, comparisons and local scratch variables are not UI text.
  assert.deepEqual(texts("status = 'missing-key';"), []);
  assert.deepEqual(texts("if (error === 'Feed closed') stop();"), []);
  assert.deepEqual(texts("const error = log() || 'Unknown shader error';"), []);
  assert.deepEqual(texts('stats.error = new Error(`HTTP ${code}`);'), []);
});

test('unmarkedScript sees human-readable status, loadingLabel and statusMessage fields', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  assert.deepEqual(
    texts("return { status: 'Scene not saved — storage unavailable' };"),
    ['Scene not saved — storage unavailable'],
  );
  assert.deepEqual(
    texts("return { status: ok ? 'Ready' : 'Source unavailable' };"),
    ['Ready', 'Source unavailable'],
  );
  assert.deepEqual(texts("return { loadingLabel: 'Loading feeds' };"), [
    'Loading feeds',
  ]);
  assert.deepEqual(texts("return { statusMessage: 'connect a receiver' };"), [
    'connect a receiver',
  ]);
  assert.deepEqual(texts("return { status: 'streaming', code: 'ok' };"), []);
  assert.deepEqual(texts("return { status: 'auth-failed' };"), []);
  assert.deepEqual(texts("return { status: msg('Source unavailable') };"), []);
});

// The Layers panel shows `stats.error || stats.lastError`, so a
// lastError is status text like error.
test('unmarkedScript sees status text assigned to lastError', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  assert.deepEqual(
    texts(
      "state.coverage.lastError = error?.message || 'Coverage tile failed';",
    ),
    ['Coverage tile failed'],
  );
  assert.deepEqual(texts("layerState._lastError = 'CelesTrak unreachable';"), [
    'CelesTrak unreachable',
  ]);
  assert.deepEqual(
    texts(
      "state.coverage.lastError = error?.message || msg('Coverage tile failed');",
    ),
    [],
  );
  assert.deepEqual(texts('this._lastError = message;'), []);
});

test('unmarkedScript skips default values and ternary branches, not later assignments', () => {
  const texts = (js) => unmarkedScript('f.js', js).map((f) => f.text);
  // A default value in a parameter list or destructuring is a local's.
  assert.deepEqual(texts("function f(error = 'Feed went away') {}"), []);
  assert.deepEqual(texts("const f = (status = 'Not ready', x) => x;"), []);
  assert.deepEqual(
    texts("function f(\n  status = 'Not ready',\n  x,\n) {}"),
    [],
  );
  assert.deepEqual(texts("const { status = 'Ready now' } = options;"), []);
  assert.deepEqual(
    texts("const {\n  error = 'No data yet',\n} = options;"),
    [],
  );
  assert.deepEqual(
    texts("for (const [id, status = 'Waiting'] of rows) {}"),
    [],
  );
  // A name right after `?` is a ternary branch, not a `status:` property.
  assert.deepEqual(texts("const s = ok ? status : 'Source unavailable';"), []);
  assert.deepEqual(texts("const s = ok\n  ? title\n  : 'Untitled view';"), []);
  // …while the property itself still is.
  assert.deepEqual(texts("return { title: x ? title : 'Untitled view' };"), [
    'Untitled view',
  ]);
  // A later assignment is checked even when the name is a declared local:
  // a layer keeps its status in `let error` (wind, AIS watchdog) and builds
  // `loadingLabel` in a `let` before returning it (FIRMS).
  assert.deepEqual(
    texts(
      "function f() {\n  let error = null;\n  if (x) error = 'Feed closed';\n}",
    ),
    ['Feed closed'],
  );
  assert.deepEqual(
    texts(
      "let loadingLabel = '';\nif (x) {\n  loadingLabel = 'KEY REQUIRED';\n}",
    ),
    ['KEY REQUIRED'],
  );
  assert.deepEqual(texts("let a = 1,\n  error = 'Feed closed';"), [
    'Feed closed',
  ]);
});
