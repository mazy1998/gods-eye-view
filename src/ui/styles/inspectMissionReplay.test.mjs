import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('./inspect.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
const HOSTED =
  /^:where\(:root:not\(\[data-ui-theme='cyber'\]\)\)\s+:is\(\.gev-legacy-host,\s*\.phone-sheet-panels\)\s+>\s+#global-context-panel\s+#space-mission-panel\s+/;

/** Token values both hosts give `property` on selectors ending in `target`. */
function hostedValues(target, property) {
  const values = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const reaches = selectors
      .split(/,(?![^()]*\))/)
      .map((selector) => selector.trim())
      .some(
        (selector) =>
          HOSTED.test(selector) &&
          selector.replace(/\s+/g, ' ').endsWith(target),
      );
    if (!reaches) continue;
    for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g))
      if (name === property) values.push(value.trim());
  }
  return values;
}

// Both hosts remove the Context panel's dark material, so every replay
// control needs an appearance token for the shared surface.
test('the Missions replay controls take their colours from the appearance in the drawer and phone sheet', () => {
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
    const values = hostedValues(target, property);
    assert.ok(values.length, `${target} has a hosted ${property}`);
    for (const value of values)
      assert.match(
        value,
        /^(?:transparent|.*var\(--gev-[\w-]+\).*)$/,
        `${target} ${property}: ${value}`,
      );
  }
});
