// Cockpit's own collapse rules decide which card controls show: the
// appearance restyle must not bring Previous and Next back on a collapsed
// Contact or Briefing card, where keyboard focus would reach them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../../testSupport/componentDom.mjs';

const css = ['../styles/cockpit.css', '../styles/cockpit-views.css']
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');

function cards(t) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  t.after(() => style.remove());
  container.innerHTML = `<section id="cockpit-hud">
    <aside class="cockpit-context-window" data-collapsed="true">
      <nav class="cockpit-context-actions">
        <button id="cockpit-context-previous"></button>
        <button id="cockpit-context-next"></button>
        <button id="cockpit-context-toggle"></button>
      </nav>
    </aside>
    <aside class="cockpit-signal-window" data-collapsed="true">
      <nav class="cockpit-brief-actions">
        <button id="cockpit-brief-previous"></button>
        <button id="cockpit-brief-next"></button>
        <button id="cockpit-brief-auto"></button>
        <button id="cockpit-signal-toggle"></button>
      </nav>
    </aside>
  </section>`;
  const shown = (id) =>
    getComputedStyle(document.getElementById(id)).display !== 'none';
  const collapse = (value) => {
    for (const card of container.querySelectorAll('[data-collapsed]'))
      card.dataset.collapsed = String(value);
  };
  return { shown, collapse };
}

for (const look of ['original', 'transparent-dark', 'light']) {
  test(`${look}: collapsed Contact and Briefing hide Previous and Next and keep their expand button`, (t) => {
    document.documentElement.dataset.gevAppearance = look;
    t.after(() => delete document.documentElement.dataset.gevAppearance);
    const { shown, collapse } = cards(t);
    for (const id of [
      'cockpit-context-previous',
      'cockpit-context-next',
      'cockpit-brief-previous',
      'cockpit-brief-next',
      'cockpit-brief-auto',
    ])
      assert.equal(shown(id), false, `${id} hidden while collapsed`);
    assert.equal(shown('cockpit-context-toggle'), true);
    assert.equal(shown('cockpit-signal-toggle'), true);
    collapse(false);
    for (const id of [
      'cockpit-context-previous',
      'cockpit-context-next',
      'cockpit-brief-previous',
      'cockpit-brief-next',
      'cockpit-brief-auto',
    ])
      assert.equal(shown(id), true, `${id} back once expanded`);
  });
}
