import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createStatusBadge, updateStatusBadge } from './statusBadge.js';
import StatusBadge from './StatusBadge.vue';
import { createRailCards } from './railCards.js';
import { railFixture } from './railTestFixture.mjs';

test('badges paint literal translated text without installing announcement or interaction semantics', () => {
  const { document } = railFixture();
  for (const appearance of ['pill', 'box', 'plain']) {
    const badge = createStatusBadge({
      documentRef: document,
      appearance,
      className: 'feature-hook',
      label: '<img src=x onerror=alert(1)> · НЕИЗВЕСТНО',
    });
    assert.equal(badge.tagName, 'SPAN');
    assert.equal(
      badge.textContent,
      '<img src=x onerror=alert(1)> · НЕИЗВЕСТНО',
    );
    assert.equal(badge.children.length, 0);
    assert.equal(badge.classList.contains('gev-status-badge'), true);
    assert.equal(badge.classList.contains('feature-hook'), true);
    assert.equal(badge.getAttribute('role'), null);
    assert.equal(badge.getAttribute('aria-live'), null);
    assert.equal(badge.getAttribute('tabindex'), null);
    assert.equal(
      badge.classList.contains(`gev-status-badge--${appearance}`),
      appearance !== 'pill',
    );
  }
});

test('painting preserves feature state, live regions and focus with zero identical writes', () => {
  let writes = 0;
  const { document } = railFixture(() => writes++);
  const badge = createStatusBadge({ documentRef: document, hidden: true });
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.dataset.frameState = 'ready';
  const focusOwner = document.createElement('button');
  focusOwner.focus();
  updateStatusBadge(badge, { label: 'SNAPSHOT · DEGRADED' });
  assert.equal(badge.hidden, false);
  writes = 0;
  updateStatusBadge(badge, { label: 'SNAPSHOT · DEGRADED' });
  assert.equal(writes, 0);
  assert.equal(badge.getAttribute('role'), 'status');
  assert.equal(badge.getAttribute('aria-live'), 'polite');
  assert.equal(badge.dataset.frameState, 'ready');
  assert.equal(document.activeElement, focusOwner);
});

test('coverage badges keep keyed identity, hide empty coverage and never claim feed health', () => {
  const f = railFixture();
  const view = createRailCards({ ...f, badgeClassName: 'weather-coverage' });
  const card = { id: 'radar', title: 'Rain radar', badge: 'CONUS', blocks: [] };
  view.update([card]);
  const badge = f.find((node) => node.classList.contains('gev-status-badge'));
  const header = f.container.children[0].children[0];
  header.focus();
  assert.equal(badge.classList.contains('gev-status-badge--plain'), true);
  assert.equal(badge.classList.contains('weather-coverage'), true);
  view.update([{ ...card, badge: '' }]);
  assert.equal(badge.hidden, true);
  view.update([{ ...card, badge: 'Global · 1° grid' }]);
  assert.equal(badge.hidden, false);
  assert.equal(badge.textContent, 'Global · 1° grid');
  assert.equal(
    f.find((node) => node.classList.contains('gev-status-badge')),
    badge,
  );
  assert.deepEqual({ ...badge.dataset }, {});
  assert.equal(f.document.activeElement, header);
  view.destroy();
  view.update([card]);
  assert.equal(f.container.children.length, 0);
});

const renderBadge = (props) =>
  renderToString(createSSRApp({ render: () => h(StatusBadge, props) }));
const escapeText = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

test('the Vue badge renders the adapter markup: literal text, shared classes, no semantics of its own', async () => {
  const { document } = railFixture();
  const label = '<img src=x onerror=alert(1)> · НЕИЗВЕСТНО';
  for (const appearance of ['pill', 'box', 'plain']) {
    const legacy = createStatusBadge({
      documentRef: document,
      appearance,
      className: 'feature-hook',
      label,
    });
    assert.equal(
      await renderBadge({ appearance, class: 'feature-hook', label }),
      `<span class="${legacy.className}">${escapeText(label)}</span>`,
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
