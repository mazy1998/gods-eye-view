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
const PORTED = new Set(['tokens', 'primitives', 'location-views', 'tool-views', 'layer-browser', 'weather-controls', 'recent-imagery-view', 'radio-views', 'shell', 'camera-views', 'feedback-views', 'voice-dock-view', 'stories', 'voice-card-view', 'directions'].map((name) => `./src/ui/styles/${name}.css`));
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

// These are the new switch's own track/thumb, not overrides of Cyber's button
// states. Cyber has no legacy track selector. The semantic accent/on-accent
// pair keeps the on/off indication visible (including inside/outside surfaces).
// Keep exceptions exact and reasoned: never allow a whole file or component.
const CYBER_STATE_EXCEPTIONS = new Map([
  ['.gev-toggle:hover:not(:disabled, [aria-busy=\'true\']) .gev-toggle-track', 'Native switch track hover; Cyber has no track state rule.'],
  ['.gev-toggle[aria-checked=\'true\'] .gev-toggle-track', 'Native switch on track uses the semantic accent; removing it erases the on/off indication.'],
  ['.gev-toggle[aria-checked=\'true\'] .gev-toggle-thumb', 'Native switch on thumb uses the paired on-accent colour for contrast.'],
].map(([selector, reason]) => [`./src/ui/styles/primitives.css|${selector}`, reason]).concat([
  ['.gev-rail-item:hover:not(:disabled) .gev-rail-icon', 'New rail destination hover; there is no legacy rail control or Cyber rail rule.'],
  ['.gev-rail-item[aria-current=\'true\']', 'New rail current destination label; Cyber has no rail rule, and removing it erases which destination is open.'],
  ['.gev-rail-item[aria-current=\'true\'] .gev-rail-icon', 'New rail current destination icon; Cyber has no rail rule, and removing it erases which destination is open.'],
  ['.gev-rail-item[aria-current=\'true\']::before', 'New rail current destination marker; Cyber has no rail rule.'],
  ['.gev-rail-item:focus-visible .gev-rail-icon', 'New rail focus ring; removing it leaves keyboard focus unmarked.'],
].map(([selector, reason]) => [`./src/ui/styles/shell.css|${selector}`, reason])));

/** Split only selector-list commas, not commas in :is(), :where() or attributes. */
function selectorList(value) {
  const selectors = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) { selectors.push(value.slice(start, i)); start = i + 1; }
  }
  selectors.push(value.slice(start));
  return selectors.map((selector) => selector.trim().replace(/\s+/g, ' '));
}
const STATE_SELECTOR = /:(?:hover|active|focus(?:-visible|-within)?|checked)(?![\w-])|\.(?:active|is-active|selected|current|focused|pinned)(?![\w-])|\[\s*aria-(?:pressed|checked|selected|current|expanded)(?=[\s~|^$*=\]])/i;
// Only recognize a leading exclusion, never one buried in a partial alternative.
const CYBER_EXCLUSION = /^:root:not\(\s*\[data-ui-theme\s*=\s*(['"])cyber\1\]\s*\)(?=\s|\)|$)/;
function excludesCyber(selector) {
  if (CYBER_EXCLUSION.test(selector)) return true;
  const prefix = /^:(?:where|is)\(/.exec(selector);
  if (!prefix) return false;
  let depth = 1, quote = '';
  for (let i = prefix[0].length; i < selector.length; i++) {
    const char = selector[i];
    if (char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')' && --depth === 0)
      return selectorList(selector.slice(prefix[0].length, i)).every(excludesCyber);
  }
  return false;
}

/** Walk blocks without losing declarations before/after nested rules. Qualified
 * palette nesting is rejected below; flat rules in @media/@supports are fine. */
function cssBlocks(css) {
  const blocks = [], stack = [];
  let start = 0, quote = '', depth = 0;
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (!depth && char === '{') {
      const selector = css.slice(start, i).trim();
      stack.push({ selector, body: '', nested: stack.some((b) => !b.selector.startsWith('@')) });
      start = i + 1;
    } else if (!depth && (char === ';' || char === '}')) {
      if (stack.length) stack.at(-1).body += css.slice(start, i) + ';';
      start = i + 1;
      if (char === '}' && stack.length) blocks.push(stack.pop());
    }
  }
  return blocks;
}
const STATE_COLOUR_PROPERTY = /^(?:color|background(?:-[\w-]+)?|border(?:-[\w-]+)?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color|text-shadow|box-shadow)$/i;
const COLOUR_SHORTHAND = /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|outline|text-decoration|column-rule)$/i;
const LAYOUT_WORD = /^(?:0|-?\d*\.?\d+(?:px|em|rem)|thin|medium|thick|none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i;

function stateColours(css, path = '', exceptions = CYBER_STATE_EXCEPTIONS) {
  const offenders = [];
  for (const { selector: selectorText, body, nested } of cssBlocks(withoutComments(css))) {
    const properties = [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)]
      .filter(([, property, rawValue]) => {
        const value = rawValue.replace(/!important\s*$/, '').trim();
        if (/^(?:box-shadow|text-shadow)$/i.test(property) && value === 'none') return false;
        // A custom property may feed a colour elsewhere; require the same guard.
        if (property.startsWith('--') || STATE_COLOUR_PROPERTY.test(property)) return true;
        return COLOUR_SHORTHAND.test(property) && value.split(/\s+/).some((word) => !LAYOUT_WORD.test(word));
      }).map(([, property]) => property);
    if (!properties.length) continue;
    if (nested) {
      offenders.push(`${selectorText}: nested palette rule; flatten it (${properties.join(', ')})`);
      continue;
    }
    for (const selector of selectorList(selectorText)) {
      if (!STATE_SELECTOR.test(selector) || excludesCyber(selector)) continue;
      const reason = exceptions.get(`${path}|${selector}`);
      if (typeof reason === 'string' && reason.trim()) continue;
      offenders.push(`${selector}: ${properties.join(', ')}`);
    }
  }
  return offenders;
}

test('the Cyber state guard catches unscoped states, selector alternatives and colour shorthands', () => {
  const excluded = ":where(:root:not([data-ui-theme='cyber']))";
  for (const selector of ['.gev-chip:hover:not(:disabled)', '.chip.active', '.x:active', '.x:focus-visible', '.x:focus-within', '.x:focus', '.x:checked', '.x[aria-pressed="true"]', '.x[aria-checked="false"]', '.x[aria-selected]']) {
    assert.notDeepEqual(stateColours(`${selector} { color: var(--gev-text); }`), [], selector);
    assert.deepEqual(stateColours(`${excluded} ${selector} { color: var(--gev-text); }`), [], selector);
  }
  for (const property of ['background', 'background-color', 'background-image', 'border-color', 'border-inline-start-color', 'outline-color', 'fill', 'stroke', 'box-shadow'])
    assert.notDeepEqual(stateColours(`.x:hover { ${property}: var(--gev-accent); }`), [], property);
  assert.notDeepEqual(stateColours('.x:hover { border: 1px solid var(--gev-border); outline: 2px solid currentColor; }'), []);
  assert.deepEqual(stateColours('.x:hover { transform: scale(1.1); border: 0; outline-offset: 2px; box-shadow: none; }'), []);
  assert.deepEqual(stateColours('.inactive, .active-label { color: var(--gev-text); }'), []);
  assert.deepEqual(stateColours(`${excluded} :is(.a, .b):hover { color: var(--gev-text); }`), []);
  assert.equal(stateColours(`${excluded} .a:hover, .b:hover { color: var(--gev-text); }`).length, 1);
  assert.notDeepEqual(stateColours(`:is(${excluded}, .other) .x:hover { color: var(--gev-text); }`), []);
  assert.notDeepEqual(stateColours('@media (width > 0px) { .x:hover { color: var(--gev-text); } }'), []);
  assert.notDeepEqual(stateColours('@supports (display: grid) { .x[aria-pressed] { background: var(--gev-accent); } }'), []);
  assert.deepEqual(stateColours(":where(:root:not([data-ui-theme='cyber']) .gev-surface) .x:hover { color: var(--gev-text); }"), []);
  assert.deepEqual(stateColours(':root:not([data-ui-theme="cyber"]) .x:hover { color: var(--gev-text); }'), []);
  const css = '.x:hover { color: var(--gev-text); }';
  assert.notDeepEqual(stateColours(css, 'fixture', new Map([['fixture|.x:hover', '']])), []);
  assert.deepEqual(stateColours(css, 'fixture', new Map([['fixture|.x:hover', 'Test-only deliberate exception.']])), []);
  assert.notDeepEqual(stateColours(css, 'another-file', new Map([['fixture|.x:hover', 'Test-only deliberate exception.']])), []);
});

test('Cyber guard rejects partial functional exclusions, custom property states and nested palettes', () => {
  const excluded = ':root:not([data-ui-theme="cyber"])';
  for (const css of [
    `:where(${excluded} .surface, :root) .chip:hover { color: var(--gev-accent); }`,
    `:where(:is(${excluded}, :root)) .chip:hover { color: var(--gev-accent); }`,
    '.chip:hover { --gev-text: var(--gev-danger-text); }',
    '.chip:hover { --chip-bg: var(--gev-accent); }',
    '.chip:hover { & .label { color: var(--gev-accent); } }',
    '.chip { @media (width > 0px) { &:hover { color: var(--gev-text); } } }',
    '.chip:hover { @supports (display: grid) { color: var(--gev-text); } }',
    '.chip:hover { color: var(--gev-text); & .label { display: block; } }',
    '.chip:hover { & .label { display: block; } color: var(--gev-text); }',
  ]) assert.notDeepEqual(stateColours(css), [], css);
  assert.deepEqual(stateColours(`:where(${excluded} .surface, ${excluded} .other) .chip:hover { color: var(--gev-text); }`), []);
  assert.deepEqual(stateColours(`@media (width > 0px) { @supports (display: grid) { ${excluded} .x:hover { --chip-bg: var(--gev-accent); } } }`), []);
  assert.deepEqual(stateColours('.chip:hover { & .label { display: block; } }'), []);
  for (const selector of ['.is-active', '.selected', '.current', '.focused', '.pinned', '[aria-current]', '[aria-expanded="true"]']) {
    assert.notDeepEqual(stateColours(`${selector} { color: var(--gev-text); }`), [], selector);
    assert.deepEqual(stateColours(`${excluded} ${selector} { color: var(--gev-text); }`), [], selector);
  }
});

test('ported state colours preserve Cyber precedence or have an exact reasoned exception', () => {
  const offenders = [...PORTED].flatMap((path) => stateColours(read(path), path).map((rule) => `${path}: ${rule}`));
  assert.deepEqual(offenders, []);
  for (const [key, reason] of CYBER_STATE_EXCEPTIONS) {
    const [path, selector] = key.split('|');
    assert.ok(PORTED.has(path), `exception belongs to a ported sheet: ${path}`);
    assert.ok(reason.trim(), `${selector} has a reason`);
    assert.ok([...withoutComments(read(path)).matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(([, selectors]) => selectorList(selectors).includes(selector)), `${selector} exception is still used`);
  }
});
