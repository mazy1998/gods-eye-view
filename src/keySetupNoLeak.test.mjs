// A pasted provider key lives only in its password input until Save. It must
// never reach the published state, a DOM attribute, the console or a status
// line, whether the save is refused, fails on the network, or succeeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from './testSupport/componentDom.mjs';

const { initKeySetup } = await import('./keySetup.js');

const SECRET = 'sk-NOLEAK-7f3a9c';
const template = readFileSync(
  new URL('./ui/templates/provider-settings.html', import.meta.url),
  'utf8',
);
const STATUS = {
  keys: [
    {
      id: 'openai',
      title: 'OpenAI',
      unlocks: 'Voice',
      getUrl: 'https://platform.openai.com/api-keys',
      envVars: ['OPENAI_API_KEY'],
      tier: 'metered',
      clientExposed: false,
      set: false,
    },
  ],
  setCount: 0,
  total: 1,
};

/** Mount the real template, capture console output, and answer requests. */
async function setup(t, saveResponse) {
  container.innerHTML = template;
  const logged = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'])
    t.mock.method(console, level, (...args) =>
      logged.push(args.map((arg) => String(arg?.stack ?? arg)).join(' ')),
    );
  const bodies = [];
  const controller = new AbortController();
  t.after(() => controller.abort());
  const surface = await initKeySetup({
    documentRef: document,
    signal: controller.signal,
    fetchImpl: async (url, init = {}) => {
      if (url === '/api/setup/status')
        return { ok: true, json: async () => structuredClone(STATUS) };
      bodies.push(init.body);
      return saveResponse();
    },
  });
  const published = [];
  surface.channel.subscribe(({ state }) => published.push(JSON.stringify(state)));
  const input = document.querySelector('input[data-env-var="OPENAI_API_KEY"]');
  input.value = SECRET;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return { surface, input, logged, bodies, published };
}

const save = () =>
  document.querySelector('[data-key-setup-apply]').click();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function assertNoLeak({ logged, published }) {
  const status = document.querySelector('[data-key-setup-status]').textContent;
  assert.ok(!status.includes(SECRET), `status line: ${status}`);
  assert.ok(!document.documentElement.outerHTML.includes(SECRET), 'a DOM attribute');
  for (const state of published) assert.ok(!state.includes(SECRET), 'a snapshot');
  for (const line of logged) assert.ok(!line.includes(SECRET), `console: ${line}`);
}

test('a refused save shows the refusal and leaks the key nowhere', async (t) => {
  const run = await setup(t, () => ({
    ok: false,
    status: 400,
    json: async () => ({
      ok: false,
      code: 'not-printable',
      params: { name: 'OPENAI_API_KEY' },
      error: 'OPENAI_API_KEY may only contain printable characters with no spaces',
    }),
  }));
  save();
  await settle();
  assert.ok(run.bodies[0].includes(SECRET), 'the key itself was sent');
  assert.match(
    document.querySelector('[data-key-setup-status]').textContent,
    /OPENAI_API_KEY may only contain printable characters/,
  );
  assert.equal(run.input.value, SECRET, 'a refused key stays for correction');
  assertNoLeak(run);
});

test('a network failure reports the error and leaks the key nowhere', async (t) => {
  const run = await setup(t, () => {
    throw new Error('connection reset');
  });
  save();
  await settle();
  assert.match(
    document.querySelector('[data-key-setup-status]').textContent,
    /connection reset/,
  );
  assertNoLeak(run);
});

test('a successful save clears the field and leaks the key nowhere', async (t) => {
  const run = await setup(t, () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      saved: ['OPENAI_API_KEY'],
      status: { ...STATUS, setCount: 1, keys: [{ ...STATUS.keys[0], set: true }] },
    }),
  }));
  save();
  await settle();
  const input = document.querySelector('input[data-env-var="OPENAI_API_KEY"]');
  assert.equal(input.value, '');
  assert.ok(run.published.some((state) => JSON.parse(state).status.setCount === 1));
  assertNoLeak(run);
});
