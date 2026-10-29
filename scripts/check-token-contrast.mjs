#!/usr/bin/env node
/**
 * WCAG AA contrast report for the design-token appearances in
 * src/ui/styles/tokens.css. Text tokens need 4.5:1 and border/focus/indicator
 * tokens need 3:1 against every surface token. Text drawn on a control or tint
 * layer is checked with that layer composited over every surface. Translucent
 * paint is checked over both a black and a white backdrop, because the globe
 * beneath it can be either. Exits non-zero when any pair fails.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

export const THEMES = Object.freeze(['original', 'transparent-dark', 'light']);
const SURFACES = ['--gev-surface-base', '--gev-surface-raised', '--gev-surface-overlay'];
const TEXT = [
  '--gev-text',
  '--gev-text-muted',
  '--gev-accent-text',
  '--gev-warning-text',
  '--gev-danger-text',
];
const NON_TEXT = ['--gev-border', '--gev-focus-ring', '--gev-accent', '--gev-warning', '--gev-danger'];
/** Text drawn on a translucent layer that itself sits on each surface. */
const LAYERED = [
  ['--gev-text', '--gev-control-bg'],
  ['--gev-text-muted', '--gev-control-bg'],
  ['--gev-text', '--gev-accent-tint'],
  ['--gev-accent-text', '--gev-accent-tint'],
  ['--gev-danger-text', '--gev-danger-tint'],
];
const BACKDROPS = { black: [0, 0, 0], white: [255, 255, 255] };

/** Custom properties declared in every top-level block whose selector matches. */
function declarations(css, matches) {
  const props = {};
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!matches(selector.trim())) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      props[name] = value.trim();
    }
  }
  return props;
}

/** Resolved token map for one theme: legacy :root, token defaults, theme overrides. */
export function themeTokens(theme) {
  const legacy = declarations(read('src/ui/styles/foundation.css'), (s) => s === ':root');
  const tokens = read('src/ui/styles/tokens.css');
  const props = { ...legacy, ...declarations(tokens, (s) => s === ':root') };
  if (theme !== 'original') {
    const themed = declarations(tokens, (s) =>
      s.startsWith(`:root[data-gev-appearance='${theme}']`),
    );
    if (!Object.keys(themed).length) throw new Error(`No token block for appearance ${theme}`);
    Object.assign(props, themed);
  }
  const resolve = (value, depth = 0) => {
    if (depth > 10) throw new Error(`Cyclic token reference: ${value}`);
    return value.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
      const next = props[name] ?? fallback;
      if (next === undefined) throw new Error(`Undefined token ${name}`);
      return resolve(next, depth + 1);
    });
  };
  return Object.fromEntries(Object.entries(props).map(([name, value]) => [name, resolve(value)]));
}

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb() and rgba() into [r, g, b, a]. */
export function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const [r, g, b, a = 255] = full.match(/../g).map((pair) => parseInt(pair, 16));
    return [r, g, b, a / 255];
  }
  const fn = value.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (fn) {
    const [r, g, b, a = 1] = fn.split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  }
  throw new Error(`Unsupported color: ${value}`);
}

const over = ([r, g, b, a], base) => [r, g, b].map((c, i) => c * a + base[i] * (1 - a));

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every checked pair of one theme with its worst ratio across backdrops. */
export function themeContrast(theme) {
  const tokens = themeTokens(theme);
  const pairs = [];
  const check = (fg, bg, minimum, layer) => {
    const surface = parseColor(tokens[bg]);
    const tint = layer ? parseColor(tokens[layer]) : [0, 0, 0, 0];
    const ink = parseColor(tokens[fg]);
    const opaque = surface[3] === 1 && tint[3] === 0;
    const backdrops = opaque ? [['opaque', [0, 0, 0]]] : Object.entries(BACKDROPS);
    let worst = { ratio: Infinity, backdrop: '' };
    for (const [backdrop, base] of backdrops) {
      const paint = over(tint, over(surface, base));
      const ratio = contrastRatio(over(ink, paint), paint);
      if (ratio < worst.ratio) worst = { ratio, backdrop };
    }
    const where = layer ? `${layer} on ${bg}` : bg;
    pairs.push({ theme, fg, bg: where, minimum, ...worst, pass: worst.ratio >= minimum });
  };
  for (const bg of SURFACES) {
    for (const fg of TEXT) check(fg, bg, 4.5);
    for (const fg of NON_TEXT) check(fg, bg, 3);
    for (const [fg, layer] of LAYERED) check(fg, bg, 4.5, layer);
  }
  check('--gev-on-accent', '--gev-accent', 4.5);
  return pairs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = THEMES.flatMap(themeContrast);
  console.log('| Theme | Foreground | Surface | Worst ratio | Backdrop | Needs | Result |');
  console.log('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    console.log(
      `| ${row.theme} | \`${row.fg}\` | ${row.bg.replace(/--[\w-]+/g, '`$&`')} | ${row.ratio.toFixed(2)} | ${row.backdrop} | ${row.minimum} | ${row.pass ? 'pass' : 'FAIL'} |`,
    );
  }
  const failed = rows.filter((row) => !row.pass);
  console.log(`\n${rows.length - failed.length}/${rows.length} pairs meet WCAG AA.`);
  process.exitCode = failed.length ? 1 : 0;
}
