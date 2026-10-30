import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
import { attachCompatibleDock } from './dockCompat.js';

test("a host's own provider options survive unrelated dock publications", (t) => {
  container.innerHTML = `<div id="gev-voice-control">
    <select id="gev-voice-provider">
      <option value="openai">OpenAI</option>
      <option value="gemini">Gemini</option>
    </select>
  </div>`;
  const select = container.querySelector('select');
  select.value = 'gemini';
  const ui = attachCompatibleDock({
    root: container.firstElementChild,
    providerSelect: select,
  });
  t.after(() => {
    ui.dispose();
    container.innerHTML = '';
  });
  const options = () => [...select.options].map((option) => option.value);

  ui.dock.set({ status: 'listening' });
  ui.dock.set({ detail: 'Listening' });
  assert.deepEqual(options(), ['openai', 'gemini']);
  assert.equal(select.value, 'gemini');

  // A supplied list still replaces them, and the same list again is a no-op.
  const providers = [{ value: 'openai', label: 'OpenAI' }];
  ui.dock.set({ providers, providerValue: 'openai' });
  assert.deepEqual(options(), ['openai']);
  const option = select.options[0];
  ui.dock.set({ providers: providers.map((item) => ({ ...item })) });
  assert.equal(select.options[0], option, 'an equal list is not repainted');
});
