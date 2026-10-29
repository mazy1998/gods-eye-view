import { h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import FirstRunContent from './ui/feedback/FirstRunContent.vue';
import { withDisplayViews } from './testSupport/displayMarkup.mjs';
import { expandApplicationHtml } from '../build/application-html.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = await withDisplayViews(expandApplicationHtml(readFileSync(new URL('../index.html', import.meta.url), 'utf8')));
const parameters = readFileSync(new URL('./ui/displayViews/StyleParametersView.vue', import.meta.url), 'utf8');

// Focused markup guards; actual computed names are checked in Chromium.
// Native labels and hidden inputs must not be treated as missing aria-labels.
test('HUD sliders have descriptive explicit names', () => {
  for (const [id, name] of [
    ['scope-feather-slider', 'Scope edge feather'],
    ['bloom-intensity-slider', 'Bloom intensity'],
    ['sharpen-intensity-slider', 'Sharpen intensity'],
  ]) {
    const input = html.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(input, `${id} exists`);
    assert.ok(input.includes(`aria-label="${name}"`), `${id} has its descriptive name`);
  }
});

test('the first-run checkbox keeps its native visible label', async () => {
  const markup = await renderToString(h(FirstRunContent));
  // The span may carry a data-i18n extraction attribute; the native wrapping
  // label contract is what this guards.
  assert.match(markup, /<label\b[^>]*class="first-run-suppress"[^>]*>\s*<input type="checkbox" data-first-run-suppress(?:="")?\s*\/?>\s*<span\b[^>]*>Don(?:'|&#39;)t show this again<\/span>\s*<\/label>/);
});

test('generated style sliders use the visible parameter label as their name', () => {
  // The row's visible label and its slider's name are the same translated label.
  assert.match(parameters, /<span class="param-label">\{\{ t\(row\.label\) \}\}<\/span>/);
  assert.match(parameters, /:aria-label="t\(row\.label\)"/);
});
