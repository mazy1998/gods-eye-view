import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const maps = await import('gods-eye-view/ui/maps');

test('published chip helpers render literal labels and synchronize host-owned state', () => {
  assert.equal(maps.MAP_STACK_CHIP_CLASS, 'map-stack-chip');
  const selected = [];
  maps.renderMapStackChips(
    container,
    [
      { id: 'osm', label: '<OSM>' },
      { id: 'photoreal', label: 'Google', available: false },
    ],
    { activeId: 'osm', onSelect: (id) => selected.push(id) },
  );
  assert.equal(
    container.querySelector('[data-stack-id="osm"]').textContent,
    '<OSM>',
  );
  assert.equal(container.querySelector('osm'), null);
  container.querySelector('[data-stack-id="photoreal"]').click();
  container.querySelector('[data-stack-id="osm"]').click();
  assert.deepEqual(selected, ['osm']);
  maps.syncMapStackChips(container, 'photoreal');
  assert.equal(
    container
      .querySelector('[data-stack-id="photoreal"]')
      .getAttribute('aria-pressed'),
    'true',
  );
});

test('published native map controller renders, follows updates and revokes replaced and disposed controls', async () => {
  container.innerHTML = '<div id="chips"></div><output></output>';
  const row = container.querySelector('div');
  const statusElement = container.querySelector('output');
  const stacks = [
    { id: 'osm', label: 'OpenStreetMap', shortLabel: 'OSM' },
    { id: 'photoreal', label: 'Google' },
  ];
  let activeId = 'osm';
  let notify;
  let unsubscribed = 0;
  let selections = 0;
  const controller = {
    getStacks: () => stacks,
    getActiveId: () => activeId,
    getState: (status = 'ready') => ({
      activeId,
      activeStack: stacks.find((s) => s.id === activeId),
      status,
    }),
    async setStack(id) {
      selections++;
      activeId = id;
      return this.getState();
    },
  };
  const control = maps.createMapSourceControls({
    container: row,
    statusElement,
    controller,
    subscribe: (fn) => {
      notify = fn;
      return () => unsubscribed++;
    },
  });
  assert.equal(row.querySelectorAll('button').length, 2);
  assert.equal(statusElement.textContent, 'OSM');
  const retired = row.querySelector('[data-stack-id="photoreal"]');
  await control.select('photoreal');
  assert.equal(statusElement.textContent, 'Google');
  activeId = 'osm';
  notify();
  assert.equal(statusElement.textContent, 'OSM');
  control.render({ ...controller.getState(), lastError: 'Unavailable' });
  assert.equal(statusElement.classList.contains('warn'), true);
  control.refresh();
  retired.click();
  assert.equal(selections, 1);
  const retained = row.querySelector('[data-stack-id="photoreal"]');
  control.destroy();
  control.destroy();
  retained.click();
  activeId = 'photoreal';
  notify();
  control.render(controller.getState());
  assert.equal(statusElement.textContent, 'OSM');
  assert.equal(selections, 1);
  assert.equal(unsubscribed, 1);
});
