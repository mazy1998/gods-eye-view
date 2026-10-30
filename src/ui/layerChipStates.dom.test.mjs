import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

test('a selected layer chip that is loading or has failed shows that state, not success', (t) => {
  const style = document.createElement('style');
  style.textContent = ['radio.css', 'layer-browser.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = `<div class="layer-browser">
    <button class="data-toggle-chip chip-active active" data-chip-id="ok">A</button>
    <button class="data-toggle-chip chip-error active" data-chip-id="failed">B</button>
    <button class="data-toggle-chip chip-loading active" data-chip-id="loading">C</button>
  </div>`;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    container.innerHTML = '';
    style.remove();
  });
  const css = (id) =>
    getComputedStyle(container.querySelector(`[data-chip-id="${id}"]`));

  assert.equal(css('ok').color, 'var(--gev-accent-text)');
  assert.equal(css('failed').color, 'var(--gev-danger-text)');
  assert.equal(css('failed').background, 'var(--gev-danger-tint)');
  assert.equal(css('loading').color, 'var(--gev-text-muted)');

  // Cyber keeps the shared failure palette it always had.
  root.dataset.uiTheme = 'cyber';
  assert.equal(css('failed').color, 'rgb(255, 133, 133)');
});
