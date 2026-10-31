import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

function mount(t, markup) {
  const style = document.createElement('style');
  style.textContent = ['scenes.css', 'stories.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = markup;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    container.innerHTML = '';
    style.remove();
  });
  return (selector) => getComputedStyle(container.querySelector(selector));
}

const CREATE = `<div id="scene-panel"><div id="scene-controls-body">
  <div class="stories-controls"><div class="stories-authoring">
    <section class="stories-step">
      <h3 class="scene-step-heading">SCENE</h3>
    </section>
    <section class="stories-step">
      <h3 class="scene-step-heading" id="shots">SHOTS</h3>
      <div class="scene-controls">
        <button class="scene-btn scene-btn-primary">+ CAPTURE SHOT</button>
      </div>
      <p class="scene-shot-hint">Click a shot to select it, double-click to rename.</p>
    </section>
    <section class="stories-step">
      <div class="scene-controls scene-file-controls">
        <button class="scene-btn" id="export">EXPORT</button>
      </div>
    </section>
  </div></div>
</div></div>`;

test("Create's step headings use the drawer's label type, Cyber upstream's", (t) => {
  const css = mount(t, CREATE);
  const heading = css('#shots');
  assert.equal(
    heading.font,
    '600 var(--gev-font-size-xs) / 1.4 var(--gev-font-sans)',
  );
  assert.equal(heading.letterSpacing, '1px');
  assert.equal(heading.textTransform, 'uppercase');
  assert.equal(heading.color, 'var(--gev-text-muted)');

  document.documentElement.dataset.uiTheme = 'cyber';
  const cyber = css('#shots');
  assert.equal(cyber.fontFamily, 'var(--font-mono)');
  assert.equal(cyber.fontWeight, 'normal');
  assert.equal(cyber.color, 'var(--scene-quiet)');
});

test("Create's shot hint shows without the legacy panel's has-shots marker", (t) => {
  const css = mount(t, CREATE);
  assert.equal(css('.scene-shot-hint').display, 'block');
  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('.scene-shot-hint').display, 'block');
});

test("Create's primary actions take the accent tint", (t) => {
  const css = mount(t, CREATE);
  const primary = css('.scene-btn-primary');
  assert.equal(primary.color, 'var(--gev-accent-text)');
  assert.equal(primary.background, 'var(--gev-accent-tint)');
});
