import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

test('a selected Street Level provider that needs a key keeps its warning', (t) => {
  const style = document.createElement('style');
  style.textContent = ['radio.css', 'street-level.css', 'camera-views.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = `<div id="sl-body"><div class="street-level-controls">
    <div id="sl-provider-chips" class="sl-chips">
      <button class="gev-chip data-toggle-chip chip-active active" data-chip-id="panoramax">Panoramax</button>
      <button class="gev-chip data-toggle-chip chip-error active" data-chip-id="mapillary">Mapillary</button>
    </div>
  </div></div>`;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    container.innerHTML = '';
    style.remove();
  });
  const css = (id) =>
    getComputedStyle(container.querySelector(`[data-chip-id="${id}"]`));

  assert.equal(css('panoramax').color, 'var(--gev-accent-text)');
  assert.equal(css('mapillary').color, 'var(--gev-warning-text)');
  assert.equal(css('mapillary').background, 'var(--gev-control-bg)');

  // Cyber keeps the amber it always had.
  root.dataset.uiTheme = 'cyber';
  assert.equal(css('mapillary').color, 'rgb(255, 179, 0)');
});
