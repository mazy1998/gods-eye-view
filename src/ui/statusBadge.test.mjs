import test from 'node:test';
import assert from 'node:assert/strict';
import { container, mount } from '../testSupport/componentDom.mjs';
const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');
const { default: StatusBadge } = await import('./primitives/StatusBadge.vue');

const renderBadge = (props) =>
  renderToString(createSSRApp({ render: () => h(StatusBadge, props) }));
const escapeText = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

test('badges render literal text, shared classes and no announcement semantics of their own', async () => {
  const label = '<img src=x onerror=alert(1)> · НЕИЗВЕСТНО';
  for (const appearance of ['pill', 'box', 'plain']) {
    assert.equal(
      await renderBadge({ appearance, class: 'feature-hook', label }),
      `<span class="${['gev-status-badge', appearance !== 'pill' && `gev-status-badge--${appearance}`, 'feature-hook'].filter(Boolean).join(' ')}">${escapeText(label)}</span>`,
    );
  }
  assert.equal(
    await renderBadge({ label: '', hidden: true }),
    '<span class="gev-status-badge" hidden></span>',
  );
});

test('owner attributes reach the Vue badge unchanged, including live regions it never adds itself', async () => {
  assert.equal(
    await renderBadge({
      id: 'cctv-quality-chip',
      appearance: 'box',
      label: 'CAL · CURATED',
      'data-cal-badge': 'curated',
    }),
    '<span class="gev-status-badge gev-status-badge--box" id="cctv-quality-chip" data-cal-badge="curated">CAL · CURATED</span>',
  );
  assert.equal(
    await renderBadge({
      role: 'status',
      'aria-live': 'polite',
      label: 'SNAPSHOT · DEGRADED',
    }),
    '<span class="gev-status-badge" role="status" aria-live="polite">SNAPSHOT · DEGRADED</span>',
  );
});

test('badge updates preserve its native identity, owner attributes and nearby focus', () => {
  const focusOwner = document.createElement('button');
  container.append(focusOwner);
  const view = mount(StatusBadge, {
    props: {
      label: 'SNAPSHOT · DEGRADED',
      hidden: true,
      appearance: 'plain',
      role: 'status',
      'aria-live': 'polite',
      'data-frame-state': 'ready',
    },
  });
  const badge = view.element;
  focusOwner.focus();
  view.update({ hidden: false });
  assert.equal(view.element, badge);
  assert.equal(badge.hidden, false);
  const observer = new MutationObserver(() => {});
  observer.observe(badge, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  try {
    view.update({ label: 'SNAPSHOT · DEGRADED', hidden: false });
    assert.equal(observer.takeRecords().length, 0);
    assert.equal(badge.getAttribute('role'), 'status');
    assert.equal(badge.getAttribute('aria-live'), 'polite');
    assert.equal(badge.dataset.frameState, 'ready');
    assert.equal(document.activeElement, focusOwner);
    view.update({ label: '', hidden: true });
    assert.equal(view.element, badge);
    assert.equal(badge.hidden, true);
  } finally {
    observer.disconnect();
    view.dispose();
  }
});
