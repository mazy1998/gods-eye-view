import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('./inspect.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
const DRAWER =
  /^:where\(:root:not\(\[data-ui-theme='cyber'\]\)\)\s+\.gev-legacy-host\s+>\s+#global-context-panel\s+#space-mission-panel\s+/;

/** Token values the drawer gives `property` on selectors ending in `target`. */
function drawerValues(target, property) {
  const values = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const reaches = selectors
      .split(/,(?![^()]*\))/)
      .map((selector) => selector.trim())
      .some(
        (selector) =>
          DRAWER.test(selector) &&
          selector.replace(/\s+/g, ' ').endsWith(target),
      );
    if (!reaches) continue;
    for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g))
      if (name === property) values.push(value.trim());
  }
  return values;
}

// The drawer removes the Context panel's dark material, so every replay
// control that kept a colour for that material needs one for the drawer's.
test('the Missions replay controls take their colours from the appearance in the drawer', () => {
  for (const [target, property] of [
    ['.mission-replay-transport button', 'color'],
    ['.mission-replay-transport button', 'background'],
    ['.mission-replay-transport button', 'border'],
    ['.mission-replay-speed-header output', 'color'],
    [
      '[data-mission-replay-speed]::-webkit-slider-runnable-track',
      'background',
    ],
    ['[data-mission-replay-speed]::-moz-range-track', 'background'],
    ['[data-mission-replay-speed]::-moz-range-progress', 'background'],
    ['[data-mission-replay-speed]::-webkit-slider-thumb', 'background'],
    ['[data-mission-replay-speed]::-moz-range-thumb', 'background'],
  ]) {
    const values = drawerValues(target, property);
    assert.ok(values.length, `${target} has a drawer ${property}`);
    for (const value of values)
      assert.match(
        value,
        /^(?:transparent|.*var\(--gev-[\w-]+\).*)$/,
        `${target} ${property}: ${value}`,
      );
  }
});
