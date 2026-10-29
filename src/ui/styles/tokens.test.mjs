import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THEMES,
  contrastRatio,
  parseColor,
  themeContrast,
  themeTokens,
} from '../../../scripts/check-token-contrast.mjs';

test('contrast math matches the WCAG reference values', () => {
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrastRatio([128, 128, 128], [128, 128, 128]), 1);
  assert.deepEqual(parseColor('#0f8'), [0, 255, 136, 1]);
  assert.deepEqual(parseColor('rgba(255, 255, 255, 0.5)'), [255, 255, 255, 0.5]);
});

for (const theme of THEMES) {
  test(`${theme}: text, border and focus tokens meet WCAG AA on every surface`, () => {
    const failures = themeContrast(theme)
      .filter((pair) => !pair.pass)
      .map((pair) => `${pair.fg} on ${pair.bg}: ${pair.ratio.toFixed(2)} < ${pair.minimum}`);
    assert.deepEqual(failures, []);
  });
}

test('original resolves the colors it shares with the legacy palette', () => {
  const tokens = themeTokens('original');
  assert.equal(tokens['--gev-text'], tokens['--text-primary']);
  assert.equal(tokens['--gev-accent'], tokens['--accent']);
  assert.equal(tokens['--gev-focus-ring'], tokens['--text-primary']);
});

// A surface adopts the tokens for its foreground and background together when
// it is ported; add its stylesheet here in that step. Only the first-level
// @imports of style.css are followed; none import further.
const PORTED = new Set(['tokens', 'primitives'].map((name) => `./src/ui/styles/${name}.css`));
const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const stylesheets = [...read('style.css').matchAll(/@import '([^']+)'/g)].map((m) => m[1]);
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('alternate themes cannot reach unported legacy stylesheets', () => {
  const tokens = new Set(read('src/ui/styles/tokens.css').match(/--gev-[\w-]+(?=\s*:)/g));
  const offenders = stylesheets
    .filter((path) => !PORTED.has(path))
    .flatMap((path) =>
      [...read(path).matchAll(/var\(\s*(--gev-[\w-]+)/g)]
        .filter((m) => tokens.has(m[1]))
        .map((m) => `${path}: ${m[1]}`),
    );
  assert.deepEqual(offenders, []);
});

const COLOUR_PROPERTY =
  /^(?:color|fill|stroke|caret-color|accent-color|box-shadow|text-shadow|background(?:-color|-image)?|outline(?:-color)?|text-decoration(?:-color)?|column-rule(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|--[\w-]+)$/i;
const NOT_A_COLOUR =
  /^(?:-?\d*\.?\d+(?:px|em|rem|%|deg|s|ms)?|transparent|currentcolor|inherit|initial|unset|revert|none|solid|dashed|dotted|double|inset|auto)$/i;
const SEMANTIC_TOKENS = new Set(read('src/ui/styles/tokens.css').match(/--gev-[\w-]+(?=\s*:)/g));

/** Values of colour-bearing declarations that do not reduce to semantic
    tokens: an allowlist, so named colours, colour functions, gradients,
    other variables and literal var() fallbacks are all caught. Assigning a
    legacy property (`--text-primary: var(--gev-text)`) is allowed; reading
    one is not. */
function untokenizedColours(css, tokens = SEMANTIC_TOKENS) {
  const found = [];
  for (const [, property, value] of withoutComments(css).matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    if (!COLOUR_PROPERTY.test(property)) continue;
    let rest = value.replace(/!important\s*$/, '');
    // Innermost var() first: its name must be a token, and a fallback stays
    // in the value to be checked like any other part of it.
    const innermost = /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/;
    for (let m; (m = rest.match(innermost)); ) {
      if (!tokens.has(m[1])) found.push(`${property}: ${m[1]}`);
      rest = rest.replace(m[0], ` ${m[2] ?? ''} `);
    }
    for (const word of rest.split(/[\s,/]+/).filter(Boolean))
      if (!NOT_A_COLOUR.test(word)) found.push(`${property}: ${word}`);
  }
  return found;
}

test('the colour guard rejects literals, named colours, colour functions and other variables', () => {
  const offenders = (css) => untokenizedColours(css);
  assert.deepEqual(offenders('.a { color: var(--gev-text); border: 1px solid var(--gev-border); }'), []);
  assert.deepEqual(offenders('.a { background: transparent; box-shadow: var(--gev-elevation-1); }'), []);
  assert.deepEqual(offenders('.a { border-bottom: 2px solid transparent; white-space: nowrap; }'), []);
  assert.deepEqual(offenders('.a { --text-primary: var(--gev-text, var(--gev-text-muted)); }'), []);
  assert.deepEqual(offenders('.a { outline: 2px solid var(--gev-focus-ring) !important; }'), []);
  for (const bad of ['#fff', 'magenta', 'rebeccapurple', 'rgb(0 0 0)', 'color(srgb 1 0 0)', 'color-mix(in srgb, red, blue)', 'oklch(0.7 0.1 200)'])
    assert.notDeepEqual(offenders(`.a { color: ${bad}; }`), [], bad);
  assert.deepEqual(offenders('.a { outline: 2px solid var(--accent); }'), ['outline: --accent']);
  assert.deepEqual(offenders('.a { color: var(--gev-text, #fff); }'), ['color: #fff']);
  assert.deepEqual(offenders('.a { color: var(--cyber-red); }'), ['color: --cyber-red']);
  assert.notDeepEqual(offenders('.a { background-image: linear-gradient(red, blue); }'), []);
});

test('ported stylesheets take every colour from the semantic tokens', () => {
  // A literal, a legacy palette colour or any other variable would stay put
  // when the appearance changes, leaving that foreground or background unthemed.
  const offenders = [...PORTED]
    .filter((path) => path !== './src/ui/styles/tokens.css')
    .flatMap((path) => untokenizedColours(read(path)).map((o) => `${path}: ${o}`));
  assert.deepEqual(offenders, []);
  for (const path of PORTED) assert.ok(stylesheets.includes(path), `${path} is imported`);
});
