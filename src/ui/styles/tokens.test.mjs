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

test('alternate themes cannot reach unported legacy stylesheets', () => {
  // A surface adopts the tokens for its foreground and background together
  // when it is ported; add its stylesheet here in that step. Only the
  // first-level @imports of style.css are followed; none import further.
  const ported = new Set(['./src/ui/styles/tokens.css']);
  const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const tokens = new Set(read('src/ui/styles/tokens.css').match(/--gev-[\w-]+(?=\s*:)/g));
  const entry = read('style.css');
  const offenders = [...entry.matchAll(/@import '([^']+)'/g)]
    .map((m) => m[1])
    .filter((path) => !ported.has(path))
    .flatMap((path) =>
      [...read(path).matchAll(/var\(\s*(--gev-[\w-]+)/g)]
        .filter((m) => tokens.has(m[1]))
        .map((m) => `${path}: ${m[1]}`),
    );
  assert.deepEqual(offenders, []);
});
