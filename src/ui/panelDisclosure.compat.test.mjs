import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const panels = await import('gods-eye-view/ui/panels');

test('published hover disclosure follows host state, keyboard and pointer timing, then disposes', (t) => {
  assert.equal(typeof panels.createHoverDisclosure, 'function');
  container.innerHTML =
    '<section class="collapsed"><button class="dock-tray-toggle">Open</button><input></section>';
  const panel = container.querySelector('section');
  const disclosure = panel.querySelector('button');
  const input = panel.querySelector('input');
  let next = 0;
  const timers = new Map();
  const changes = [];
  t.mock.method(window, 'setTimeout', (fn) => {
    timers.set(++next, fn);
    return next;
  });
  t.mock.method(window, 'clearTimeout', (id) => timers.delete(id));
  t.mock.method(window.performance, 'now', () => 1000);
  let hovered = false;
  t.mock.method(
    panel,
    'matches',
    (selector) => selector === ':hover' && hovered,
  );
  const flush = () => {
    const work = [...timers.values()];
    timers.clear();
    for (const fn of work) fn();
  };
  const control = panels.createHoverDisclosure({
    panel,
    disclosure,
    focusTarget: () => input,
    onChange: (collapsed) => {
      changes.push(collapsed);
      panel.classList.toggle('collapsed', collapsed);
      disclosure.setAttribute('aria-expanded', String(!collapsed));
    },
    onEscape: (event) => {
      event.preventDefault();
      panel.classList.add('collapsed');
    },
  });
  disclosure.focus();
  disclosure.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  flush();
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, input);
  disclosure.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      repeat: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.deepEqual(changes, [false]);
  panel.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(panel.classList.contains('collapsed'), true);
  hovered = true;
  panel.dispatchEvent(new Event('pointerenter'));
  flush();
  assert.equal(panel.classList.contains('collapsed'), false);
  hovered = false;
  disclosure.blur();
  panel.dispatchEvent(new Event('pointerleave'));
  control.destroy();
  control.destroy();
  flush();
  assert.equal(panel.classList.contains('collapsed'), false);
  assert.equal(timers.size, 0);
  disclosure.click();
  panel.dispatchEvent(new Event('pointerenter'));
  flush();
  assert.deepEqual(changes, [false, false]);
});
