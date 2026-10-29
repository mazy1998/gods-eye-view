import { container, mount } from '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { nextTick } = await import('vue');
const { default: DirectionsView } = await import('./DirectionsView.vue');
const descriptor = (current = 0) => ({
  chips: [
    { id: 'mode-car', label: 'DRIVE', active: true, params: { mode: 'car' } },
    { id: 'mode-foot', label: 'WALK', params: { mode: 'foot' } },
    { id: 'mode-bike', label: 'BIKE', params: { mode: 'bike' } },
    { id: 'set-a', label: 'SET A', params: { arm: 'a' } },
    { id: 'set-b', label: 'SET B', params: { arm: 'b' } },
    { id: 'swap', label: '⇄', title: 'Swap endpoints', params: { swap: true } },
    {
      id: 'fly',
      label: 'FLYING',
      busy: true,
      disabled: true,
      params: { fly: true },
    },
    { id: 'clear', label: 'CLEAR', params: { clear: true } },
  ],
  list: {
    ariaLabel: 'Route steps',
    items: [
      {
        id: 'step-0',
        lead: '1 · 100 m',
        text: '<b>Turn left</b>',
        active: current === 0,
        current: current === 0,
      },
      {
        id: 'step-1',
        lead: '2 · 200 m',
        text: 'Continue straight',
        active: current === 1,
        current: current === 1,
      },
      { id: 'step-truncated', text: 'Only first steps shown', disabled: true },
    ],
  },
});

test('Directions is independently mountable with native descriptor hooks, literal text and owner callbacks', () => {
  const calls = [];
  const view = mount(DirectionsView, {
    props: {
      summary: '<em>Route summary</em>',
      controls: descriptor(),
      chip: (id) => calls.push(['chip', id]),
      listItem: (id) => calls.push(['step', id]),
    },
  });
  assert.equal(view.element.id, 'directions-controls-body');
  assert.equal(
    container.querySelector('.data-toggle-meta').textContent,
    '<em>Route summary</em>',
  );
  assert.equal(container.querySelectorAll('.data-toggle-chip').length, 8);
  assert.equal(container.querySelector('b, em'), null);
  assert.equal(
    container.querySelector('[data-chip-id=swap]').getAttribute('aria-label'),
    'Swap endpoints',
  );
  assert.equal(
    container
      .querySelector('[data-chip-id=mode-car]')
      .getAttribute('aria-pressed'),
    'true',
  );
  const fly = container.querySelector('[data-chip-id=fly]');
  assert.equal(fly.getAttribute('aria-busy'), 'true');
  fly.click();
  container.querySelector('[data-chip-id=set-a]').click();
  container.querySelector('button[data-list-item-id=step-1]').click();
  container.querySelector('button[data-list-item-id=step-truncated]').click();
  assert.deepEqual(calls, [
    ['chip', 'set-a'],
    ['step', 'step-1'],
  ]);
  const stale = container.querySelector('[data-chip-id=clear]');
  view.update({ chip: (id) => calls.push(['current', id]) });
  stale.click();
  assert.deepEqual(calls.at(-1), ['current', 'clear']);
  view.dispose();
  stale.click();
  assert.equal(calls.length, 3);
});

test('Directions preserves explicit hidden hooks for disabled rows and collapsed details', () => {
  const view = mount(DirectionsView, { props: { summary: 'Directions off' } });
  const chips = container.querySelector('.data-toggle-controls'),
    list = container.querySelector('.data-row-list');
  assert.equal(chips.hidden, true);
  assert.equal(list.hidden, true);
  view.update({ controls: descriptor() });
  assert.equal(chips.hidden, false);
  assert.equal(list.hidden, false);
  view.update({ expanded: false });
  assert.equal(chips.hidden, true);
  assert.equal(list.hidden, true);
  assert.equal(container.querySelector('.data-toggle-meta').hidden, true);
  view.update({ expanded: true });
  assert.equal(chips.hidden, false);
  assert.equal(list.hidden, false);
});

test('Directions scrolls current steps after paint and cancels pending scroll after unmount', async (t) => {
  const previous = HTMLElement.prototype.scrollIntoView,
    scrolled = [];
  HTMLElement.prototype.scrollIntoView = function (options) {
    scrolled.push([this.dataset.listItemId, options]);
  };
  t.after(() => {
    if (previous) HTMLElement.prototype.scrollIntoView = previous;
    else delete HTMLElement.prototype.scrollIntoView;
  });
  const view = mount(DirectionsView, { props: { controls: descriptor() } });
  await nextTick();
  assert.deepEqual(scrolled, [['step-0', { block: 'nearest' }]]);
  const first = container.querySelector('button[data-list-item-id=step-0]');
  view.update({ controls: descriptor(1) });
  await nextTick();
  await nextTick();
  assert.equal(
    container.querySelector('button[data-list-item-id=step-0]'),
    first,
  );
  assert.equal(first.getAttribute('aria-current'), 'false');
  assert.deepEqual(scrolled.at(-1), ['step-1', { block: 'nearest' }]);
  view.update({ controls: descriptor(0) });
  view.dispose();
  const count = scrolled.length;
  await nextTick();
  await nextTick();
  assert.equal(scrolled.length, count);
});

test('Tools has a named card and a shared, busy-guarded layer switch', () => {
  let calls = 0;
  const view = mount(DirectionsView, {
    props: {
      hosted: true,
      enabled: false,
      summary: 'OSM routing · never',
      toggleState: {
        label: 'Directions: OFF',
        stateText: 'OFF',
        busy: false,
        blocked: false,
      },
      toggle: () => calls++,
    },
  });
  const root = view.element;
  assert.equal(root.querySelector('h3').textContent, 'Directions');
  root.focus();
  assert.equal(document.activeElement, root);
  const button = root.querySelector('[role=switch]');
  button.click();
  assert.equal(calls, 1);
  view.update({
    enabled: true,
    toggleState: {
      label: 'Directions: ON',
      stateText: 'ON',
      busy: true,
      blocked: true,
    },
  });
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(calls, 1);
  view.dispose();
  button.click();
  assert.equal(calls, 1);
});
