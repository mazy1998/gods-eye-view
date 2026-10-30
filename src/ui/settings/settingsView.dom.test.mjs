import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container, mount } from '../../testSupport/componentDom.mjs';

const { nextTick } = await import('vue');
const { initKeySetup } = await import('../../keySetup.js');
const { createSettingsSurface } = await import('./settingsSurface.js');
const { default: SettingsView } = await import('./SettingsView.vue');
const template = readFileSync(
  new URL('../templates/provider-settings.html', import.meta.url),
  'utf8',
);
const status = {
  keys: ['google-maps', 'openai', 'cesium-ion', 'extra'].map((id) => ({
    id,
    title: id,
    unlocks: 'Voice',
    getUrl: '#',
    envVars: [id.toUpperCase()],
    tier: 'free',
    clientExposed: false,
    set: false,
  })),
  setCount: 0,
  total: 4,
};

async function fixture(t, saveResponse) {
  container.innerHTML = template;
  const picker = document.getElementById('locale-picker');
  picker.innerHTML = '<button>Language</button>';
  const originalHome = picker.parentNode;
  const actions = [];
  const surface = createSettingsSurface({
    open: () => actions.push('open'),
    close: () => actions.push('close'),
    openVoice: () => actions.push('voice'),
    closeLanguage: () => actions.push('language-close'),
  });
  const view = mount(SettingsView, { props: { surface } });
  const provider = await initKeySetup({
    documentRef: document,
    fetchImpl: async (url, init) =>
      url === '/api/setup/status'
        ? { ok: true, json: async () => status }
        : saveResponse(init),
  });
  const initialMessage = provider.channel.getSnapshot().message;
  surface.connect(provider);
  await nextTick();
  t.after(() => {
    view.dispose();
    surface.destroy();
    provider.destroy();
  });
  return {
    surface,
    view,
    provider,
    actions,
    picker,
    originalHome,
    initialMessage,
  };
}

test('sections lease one native provider form, preserving masked inputs and language controls', async (t) => {
  const f = await fixture(t);
  const root = document.getElementById('key-setup');
  const field = root.querySelector('input[data-env-var=OPENAI]');
  field.value = 'fake-only-in-this-field';
  assert.equal(field.type, 'password');
  assert.equal(root.getAttribute('role'), 'region');
  assert.equal(root.hidden, false);
  assert.ok(root.closest('.gev-settings-providers'));
  assert.ok(
    document.getElementById('key-setup-description').closest('details'),
  );
  assert.equal(document.getElementById('key-setup-chip').hidden, true);
  assert.equal(root.querySelector('[data-key-id=extra]').style.display, 'none');
  const extra = root.querySelector('[data-key-id=extra] input');
  extra.value = 'another-fake-field-value';
  root.querySelector('.key-setup-more').click();
  await nextTick();
  assert.notEqual(
    root.querySelector('[data-key-id=extra]').style.display,
    'none',
  );
  assert.equal(root.querySelector('[data-key-id=extra] input'), extra);
  for (const section of ['voice', 'language', 'providers']) {
    f.surface.select(section);
    await nextTick();
    assert.equal(root.querySelector('input[data-env-var=OPENAI]'), field);
    assert.equal(field.value, 'fake-only-in-this-field');
    assert.equal(extra.value, 'another-fake-field-value');
    assert.equal(document.querySelectorAll('#key-setup').length, 1);
  }
  assert.ok(f.picker.closest('.gev-settings-language'));
  assert.equal(
    JSON.stringify(f.provider.channel.getSnapshot()).includes(field.value),
    false,
  );
  assert.equal(
    JSON.stringify(f.surface.channel.getSnapshot()).includes(field.value),
    false,
  );
  f.surface.openVoice();
  assert.deepEqual(f.actions, ['voice']);
  f.surface.select('voice');
  f.provider.open();
  assert.equal(f.surface.channel.getSnapshot().section, 'providers');
  f.provider.close();
  assert.deepEqual(f.actions, ['voice', 'open', 'close']);
  f.view.dispose();
  assert.equal(root.getAttribute('role'), 'dialog');
  assert.equal(root.hidden, true);
  assert.equal(root.querySelector('input[data-env-var=OPENAI]'), field);
  assert.equal(field.value, 'fake-only-in-this-field');
  assert.equal(
    document.getElementById('key-setup-description').parentElement,
    root,
  );
  assert.equal(f.picker.parentNode, f.originalHome);
  assert.deepEqual(f.actions, ['voice', 'open', 'close', 'language-close']);
  assert.equal(document.getElementById('key-setup-chip').hidden, false);
});

test('provider destruction and a late connection do not leave a borrowed or duplicate form', async (t) => {
  const f = await fixture(t);
  f.provider.destroy();
  assert.equal(document.getElementById('key-setup'), null);
  f.surface.connect(null);
  await nextTick();
  assert.equal(f.surface.channel.getSnapshot().providersAvailable, false);
  f.view.dispose();
  let hosted = 0;
  f.surface.connect({
    host: () => {
      hosted++;
      return () => {};
    },
  });
  assert.equal(hosted, 0, 'a disposed destination leaves no host');
  f.surface.destroy();
  f.surface.connect({
    host: () => {
      hosted++;
    },
  });
  assert.equal(hosted, 0, 'late async work is inert after teardown');
});

test('saving the embedded form includes hidden native fields, guards repeats and clears values only after success', async (t) => {
  const requests = [];
  let finish;
  const f = await fixture(t, (init) => {
    requests.push(init.body);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const root = document.getElementById('key-setup');
  const input = root.querySelector('[data-key-id=extra] input');
  input.value = 'qa-hidden-field-only';
  assert.equal(input.closest('.key-setup-row').style.display, 'none');
  const publications = [];
  const unsubscribe = f.provider.channel.subscribe(({ state }) =>
    publications.push(JSON.stringify(state)),
  );
  t.after(unsubscribe);
  const save = root.querySelector('[data-key-setup-apply]');
  save.click();
  save.click();
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0]), { EXTRA: 'qa-hidden-field-only' });
  assert.equal(save.getAttribute('aria-disabled'), 'true');
  assert.equal(input.value, 'qa-hidden-field-only');
  finish({
    ok: true,
    json: async () => ({
      ok: true,
      saved: ['EXTRA'],
      status: {
        ...status,
        keys: status.keys.map((key) => ({ ...key, set: key.id === 'extra' })),
        setCount: 1,
      },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  assert.equal(root.querySelector('[data-key-id=extra] input'), input);
  assert.equal(input.value, '');
  assert.equal(save.getAttribute('aria-disabled'), 'false');
  assert.equal(
    publications.some((state) => state.includes('qa-hidden-field-only')),
    false,
  );
  assert.equal(root.outerHTML.includes('qa-hidden-field-only'), false);
  assert.match(f.provider.channel.getSnapshot().message, /Saved/);
  f.view.dispose();
  assert.equal(f.provider.channel.getSnapshot().message, f.initialMessage);
  assert.equal(f.provider.channel.getSnapshot().open, false);
});

test('a host without the voice settings control presents an unavailable action without activating voice', async () => {
  let calls = 0;
  const surface = createSettingsSurface({
    canOpenVoice: () => false,
    openVoice: () => calls++,
  });
  const view = mount(SettingsView, { props: { surface } });
  try {
    surface.select('voice');
    await nextTick();
    const button = [...view.element.querySelectorAll('button')].find(
      (el) => el.textContent === 'Voice Settings',
    );
    assert.equal(button.disabled, true);
    button.click();
    surface.openVoice();
    assert.equal(calls, 0);
  } finally {
    view.dispose();
    surface.destroy();
  }
});
