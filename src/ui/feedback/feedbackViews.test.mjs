import { container } from '../../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { initFirstRunExperience, FIRST_RUN_SESSION_KEY } =
  await import('../../firstRunExperience.js');
const { ShellFeedback } = await import('../shellFeedback.js');
const { createStartupFeedback } = await import('../startupFeedback.js');
const { mountCreditText } = await import('../creditText.js');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function launcher({ storage, layerResult = false } = {}) {
  container.innerHTML = '<aside id="first-run-launcher" hidden></aside>';
  const values = new Map();
  const sessionStorageRef = {
    setItem: (k, v) => values.set(k, v),
    getItem: (k) => values.get(k),
  };
  const calls = [];
  const owner = initFirstRunExperience({
    documentRef: document,
    location: { search: '?welcome=1' },
    storage: storage || { setItem() {}, removeItem() {} },
    sessionStorageRef,
    styleManager: {
      resetToGlobeView() {},
      setContextMode: async () => ({ ok: true }),
      setPanelCollapsed: (...args) => calls.push(args),
    },
    dataManager: {
      setEnabled: async (...args) => {
        calls.push(args);
        return layerResult;
      },
    },
  });
  return { owner, values, calls };
}

test('mission failures stay sticky, remain literal, and retry through the same owner', async () => {
  const f = launcher();
  try {
    const button = container.querySelector(
      '[data-first-run-choice="environmental"]',
    );
    button.focus();
    button.click();
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.disabled, false);
    assert.equal(document.activeElement, button);
    await tick();
    assert.match(
      container.querySelector('[data-first-run-status]').textContent,
      /Could not open.*earthquakes, local-firms/,
    );
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    button.click();
    await tick();
    assert.equal(f.calls.length, 4);
    assert.deepEqual(f.calls[0], ['earthquakes', true, { origin: 'user' }]);
  } finally {
    f.owner.destroy();
  }
});

test('blocked suppression reverts the tick; teardown writes no dismissal', () => {
  const f = launcher({
    storage: {
      setItem() {
        throw new Error('blocked');
      },
    },
  });
  const box = container.querySelector('[data-first-run-suppress]');
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(box.checked, false);
  assert.match(
    container.querySelector('[data-first-run-status]').textContent,
    /blocking storage/,
  );
  f.owner.destroy();
  assert.equal(f.values.has(FIRST_RUN_SESSION_KEY), false);
  assert.equal(container.querySelector('#first-run-launcher'), null);
});

test('dismissal keeps the session policy and destroy cancels late mission painting', async () => {
  const f = launcher({ layerResult: true });
  container.querySelector('[data-first-run-choice="environmental"]').click();
  f.owner.destroy();
  await tick();
  assert.equal(container.textContent, '');
  assert.equal(f.values.has(FIRST_RUN_SESSION_KEY), false);
  const second = launcher();
  second.owner.dismiss();
  assert.equal(second.values.get(FIRST_RUN_SESSION_KEY), 'dismissed');
  second.owner.destroy();
});

function feedback() {
  container.innerHTML =
    '<div id="global-loading-status" role="status" aria-live="polite" aria-atomic="true" hidden></div><div id="traffic-sync-chip" aria-live="polite"></div><div id="toast" role="status" aria-live="polite"></div>';
  const layer = {
    id: 'traffic',
    enabled: true,
    stats: {
      loading: true,
      phaseProgressPct: 20,
      phaseLabel: '<img src=x onerror=alert(1)>',
    },
  };
  const owner = new ShellFeedback({ readLayers: () => [layer] });
  return { owner, layer };
}

test('loading, traffic and toast updates are synchronous literal text; teardown releases views', () => {
  const { owner, layer } = feedback();
  owner._updateTrafficSyncChip(false, 0);
  assert.equal(
    document.getElementById('traffic-sync-progress').textContent,
    '20%',
  );
  assert.equal(container.querySelector('img'), null);
  layer.stats = { phaseProgressPct: 100, phaseLabel: 'LIVE · 0% cov' };
  owner._updateTrafficSyncChip(false, 50);
  assert.equal(
    document.getElementById('traffic-sync-progress').textContent,
    '',
  );
  owner._showGlobalStatusNotice('<script>bad</script>', {
    detail: '<img src=x>',
    persistent: true,
  });
  assert.equal(
    document.getElementById('global-loading-label').textContent,
    '<script>bad</script>',
  );
  assert.equal(
    document.getElementById('global-loading-detail').textContent,
    '<img src=x>',
  );
  owner._showToast('<b>literal</b>');
  assert.equal(document.getElementById('toast').textContent, '<b>literal</b>');
  assert.equal(container.querySelector('script,img,b'), null);
  owner.destroy();
  owner._showToast('late');
  assert.equal(document.getElementById('toast').textContent, '');
  assert.equal(document.getElementById('global-loading-status').hidden, true);
});

test('startup messages have an owner and errors never become HTML', () => {
  container.innerHTML =
    '<div id="loading-screen"><div class="loader-content"></div></div>';
  const owner = createStartupFeedback(container.firstElementChild);
  owner.textContent = 'Loading';
  assert.equal(
    container.querySelector('.loader-status').textContent,
    'Loading',
  );
  owner.fail('<img src=x onerror=bad>');
  assert.equal(
    container.querySelector('.startup-error').textContent,
    '<img src=x onerror=bad>',
  );
  assert.equal(
    container.querySelectorAll('img').length,
    1,
    'only the fixed brand logo',
  );
  owner.destroy();
});

test('credit labels leave Cesium provider nodes, links and handlers intact', () => {
  container.innerHTML =
    '<div id="cesium-credits"><a class="cesium-credit-expand-link">Data attribution</a></div><div class="cesium-credit-lightbox"><div class="cesium-credit-lightbox-title">Data provided by:</div><ul><li><a href="https://example.com/" rel="noopener noreferrer">Provider</a></li></ul></div>';
  const list = container.querySelector('ul');
  const link = list.querySelector('a');
  let clicked = 0;
  const expand = container.querySelector('.cesium-credit-expand-link');
  expand.addEventListener('click', () => clicked++);
  const dispose = mountCreditText(document);
  const lightbox = container.querySelector('.cesium-credit-lightbox');
  lightbox.className = 'cesium-credit-lightbox cesium-credit-lightbox-mobile';
  assert.equal(lightbox.hasAttribute('data-gev-credit-surface'), true);
  expand.click();
  assert.equal(clicked, 1);
  assert.equal(container.querySelector('ul'), list);
  assert.equal(list.querySelector('a'), link);
  assert.equal(link.rel, 'noopener noreferrer');
  dispose();
  assert.equal(lightbox.hasAttribute('data-gev-credit-surface'), false);
  assert.equal(container.querySelector('ul'), list);
});

test('each identical toast mutates the existing live region', (t) => {
  const { owner } = feedback();
  t.after(() => owner.destroy());
  const toast = document.getElementById('toast');
  const observer = new MutationObserver(() => {});
  observer.observe(toast, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  t.after(() => observer.disconnect());
  for (let occurrence = 0; occurrence < 2; occurrence++) {
    owner._showToast('Link copied!');
    const records = observer.takeRecords();
    assert.equal(document.getElementById('toast'), toast);
    assert.equal(toast.textContent, 'Link copied!');
    assert.equal(toast.getAttribute('aria-live'), 'polite');
    assert.ok(
      records.some(
        (record) => record.type === 'characterData' || record.addedNodes.length,
      ),
      `toast ${occurrence + 1} changes live-region text`,
    );
  }
});

// Localized labels are the text view's responsibility, not the keyboard adapter.
const { setLocale } = await import('../../i18n/index.js');
const { configureCreditKeyboardAccess } =
  await import('../../creditKeyboard.js');
function textFixture() {
  container.innerHTML =
    '<div id="cesium-credits"><a class="cesium-credit-expand-link">Data attribution</a></div><div><div class="cesium-credit-lightbox"><button class="cesium-credit-lightbox-close">×</button><div class="cesium-credit-lightbox-title">Data provided by:</div></div></div>';
  return {
    root: document,
    expand: container.querySelector('.cesium-credit-expand-link'),
    title: container.querySelector('.cesium-credit-lightbox-title'),
  };
}
for (const [locale, link, title] of [
  ['ru', 'Источники данных', 'Данные предоставлены:'],
  ['es', 'Atribución de datos', 'Datos proporcionados por:'],
])
  test(`${locale}: Cesium attribution link and lightbox title are translated`, (test) => {
    setLocale(locale);
    try {
      const f = textFixture();
      configureCreditKeyboardAccess(f.root);
      test.after(mountCreditText(f.root));
      assert.equal(f.expand.textContent, link);
      assert.equal(f.title.textContent, title);
    } finally {
      setLocale('en');
    }
  });
