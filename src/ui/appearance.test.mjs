import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../testSupport/componentDom.mjs';

const { APPEARANCES, APPEARANCE_STORAGE_KEY, createAppearance } =
  await import('./appearance.js');
const { mountView } = await import('./mountView.js');
const { flushViews } = await import('./ownerState.js');
const { default: AppearancePicker } =
  await import('./settings/AppearancePicker.vue');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function freshRoot() {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}

test('the stored appearance applies at construction; original sets no attribute', () => {
  for (const { value } of APPEARANCES) {
    const root = freshRoot();
    const storage = memoryStorage({ [APPEARANCE_STORAGE_KEY]: value });
    const appearance = createAppearance({ storage, root });
    assert.equal(appearance.get(), value);
    assert.equal(
      root.dataset.gevAppearance,
      value === 'original' ? undefined : value,
    );
    appearance.destroy();
    root.remove();
  }
});

test('an unknown, absent or unreadable value is original', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
  };
  for (const storage of [
    memoryStorage({ [APPEARANCE_STORAGE_KEY]: 'neon' }),
    memoryStorage(),
    blocked,
    null,
  ]) {
    const root = freshRoot();
    const appearance = createAppearance({ storage, root });
    assert.equal(appearance.get(), 'original');
    assert.equal(root.dataset.gevAppearance, undefined);
    appearance.destroy();
    root.remove();
  }
});

test('set applies, stores and publishes known values only', () => {
  const root = freshRoot();
  const storage = memoryStorage();
  const appearance = createAppearance({ storage, root });
  const seen = [];
  appearance.channel.subscribe(({ state }) => seen.push(state.appearance));
  assert.equal(appearance.set('light'), true);
  assert.equal(root.dataset.gevAppearance, 'light');
  assert.equal(storage.values.get(APPEARANCE_STORAGE_KEY), 'light');
  assert.equal(appearance.set('neon'), false);
  assert.equal(appearance.set('light'), true);
  assert.equal(appearance.set('original'), true);
  assert.equal(root.dataset.gevAppearance, undefined);
  assert.equal(storage.values.get(APPEARANCE_STORAGE_KEY), 'original');
  assert.deepEqual(seen, ['original', 'light', 'original']);
  appearance.destroy();
  root.remove();
});

test('a storage write that fails keeps the applied appearance', () => {
  const root = freshRoot();
  const storage = {
    getItem: () => null,
    setItem() {
      throw new Error('quota');
    },
  };
  const appearance = createAppearance({ storage, root });
  assert.equal(appearance.set('transparent-dark'), true);
  assert.equal(appearance.get(), 'transparent-dark');
  assert.equal(root.dataset.gevAppearance, 'transparent-dark');
  appearance.destroy();
  root.remove();
});

test('the snapshot follows Cyber, which keeps its own palette', async () => {
  const root = freshRoot();
  const appearance = createAppearance({ storage: memoryStorage(), root });
  appearance.set('light');
  assert.equal(appearance.channel.getSnapshot().cyber, false);
  root.dataset.uiTheme = 'cyber';
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(appearance.channel.getSnapshot(), {
    appearance: 'light',
    cyber: true,
  });
  // The choice stays applied; tokens.css keeps Cyber's palette over it.
  assert.equal(root.dataset.gevAppearance, 'light');
  const css = readFileSync(
    new URL('./styles/tokens.css', import.meta.url),
    'utf8',
  );
  for (const value of ['transparent-dark', 'light'])
    assert.match(
      css,
      new RegExp(
        String.raw`:root\[data-gev-appearance='${value}'\]:not\(\[data-ui-theme='cyber'\]\)`,
      ),
    );
  appearance.destroy();
  root.remove();
});

test('the Settings picker shows the owner and changes it through set', async () => {
  const root = freshRoot();
  const appearance = createAppearance({ storage: memoryStorage(), root });
  const host = document.createElement('div');
  document.body.append(host);
  const view = mountView(AppearancePicker, {
    parent: host,
    props: { appearance },
  });
  const radios = () => [...host.querySelectorAll('[role="radio"]')];
  assert.deepEqual(
    radios().map((radio) => radio.textContent.trim()),
    ['Original', 'Transparent dark', 'Light'],
  );
  assert.equal(radios()[0].getAttribute('aria-checked'), 'true');
  radios()[2].click();
  assert.equal(appearance.get(), 'light');
  await flushViews();
  assert.equal(radios()[2].getAttribute('aria-checked'), 'true');
  assert.equal(host.querySelector('.gev-appearance-note'), null);
  root.dataset.uiTheme = 'cyber';
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushViews();
  assert.ok(host.querySelector('.gev-appearance-note'));
  view.dispose();
  appearance.destroy();
  host.remove();
  root.remove();
});

test('the drawer renders Settings → Appearance above its hosted controls, only while Settings is open', async () => {
  const { createDrawerNavigation } = await import('./drawerNavigation.js');
  const { createStateChannel } = await import('../app/stateChannel.js');
  const { default: ShellDrawer } = await import('./ShellDrawer.vue');
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="corner-actions"></div><div id="scene-panel" data-panel-id="scene-panel" class="panel-collapsible collapsed"></div>',
  );
  const panelChannel = createStateChannel(() => ({ panels: {} }));
  const drawer = createDrawerNavigation({
    document,
    panelChannel,
    setPanelCollapsed: (id, collapsed) =>
      document.getElementById(id).classList.toggle('collapsed', collapsed),
    restoreOrder: ['scene-panel'],
  });
  const appearance = createAppearance({
    storage: memoryStorage(),
    root: freshRoot(),
  });
  const views = {
    settings: { component: AppearancePicker, props: { appearance } },
  };
  const view = mountView(ShellDrawer, {
    parent: document.body,
    props: { drawer, views },
  });
  const remove = drawer.channel.subscribe(({ state }) =>
    view.update({ state }),
  );
  const body = () => view.element.querySelector('.gev-drawer-body');
  drawer.open('settings');
  assert.deepEqual(
    [...body().children].map((node) => node.id),
    ['gev-appearance-settings', 'gev-legacy-host'],
  );
  assert.ok(drawer.host.contains(document.getElementById('corner-actions')));
  drawer.open('stories');
  assert.equal(document.getElementById('gev-appearance-settings'), null);
  drawer.close();
  assert.equal(document.getElementById('gev-appearance-settings'), null);
  remove();
  view.dispose();
  drawer.destroy();
  appearance.destroy();
  panelChannel.destroy();
  document.getElementById('corner-actions').remove();
  document.getElementById('scene-panel').remove();
});
