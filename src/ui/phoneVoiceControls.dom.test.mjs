import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

test('the phone dock folds voice settings into one pill outside Cyber, and Cyber keeps them in view', (t) => {
  const style = document.createElement('style');
  style.textContent = readFileSync(
    new URL('./styles/phone-shell-view.css', import.meta.url),
    'utf8',
  );
  document.head.append(style);
  document.body.classList.add('mobile-shell');
  container.innerHTML = `<div id="gev-voice-control">
    <label class="gev-voice-provider-field"><select></select></label>
    <button class="gev-voice-settings-button" type="button"></button>
    <section class="gev-voice-panel" data-view="settings" hidden></section>
  </div>`;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    document.body.classList.remove('mobile-shell');
    container.innerHTML = '';
    style.remove();
  });
  const shown = (selector) =>
    getComputedStyle(container.querySelector(selector)).display !== 'none';
  const controls = ['.gev-voice-provider-field', '.gev-voice-settings-button'];

  for (const selector of controls) assert.equal(shown(selector), false);
  container.querySelector('.gev-voice-panel').hidden = false;
  for (const selector of controls) assert.equal(shown(selector), true);

  container.querySelector('.gev-voice-panel').hidden = true;
  root.dataset.uiTheme = 'cyber';
  for (const selector of controls)
    assert.equal(shown(selector), true, `${selector} stays usable in Cyber`);
});
