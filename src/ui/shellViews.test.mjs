import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { StyleManager } = await import('./applicationShell.js');
const { h } = await import('vue');

test('shell views leave the registry when they are disposed', () => {
  const shell = { _views: new Set() };
  const view = StyleManager.prototype._mountView.call(
    shell,
    { setup: () => () => h('i', 'view') },
    { parent: container },
  );
  assert.equal(shell._views.size, 1);
  assert.equal(view.element, container.querySelector('i'));
  view.update({ title: 'updated' });
  assert.equal(view.element.title, 'updated');
  view.dispose();
  view.dispose();
  assert.equal(shell._views.size, 0);
  assert.equal(container.childNodes.length, 0);
});
