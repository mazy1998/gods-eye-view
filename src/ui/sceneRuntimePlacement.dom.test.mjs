import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

test('scene playback Stop shows below the shell header whenever the header is up', (t) => {
  const style = document.createElement('style');
  style.textContent = ['scenes.css', 'stories.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = `<header class="gev-header gev-surface"></header>
    <div id="scene-runtime" class="stories-playback active">
      <div class="stories-runtime"><span>Nepal</span>
        <button id="scene-runtime-stop" class="stories-runtime-stop">STOP</button>
      </div>
    </div>`;
  const header = container.querySelector('.gev-header');
  t.after(() => {
    document.body.classList.remove('recording-mode', 'ui-clean-view');
    container.innerHTML = '';
    style.remove();
  });
  const top = () =>
    getComputedStyle(document.getElementById('scene-runtime')).top;

  assert.equal(top(), 'calc(var(--gev-header-height) + var(--gev-space-2))');
  // Without a header (phone, Cockpit, clean view, recording) it keeps its place.
  header.hidden = true;
  assert.equal(top(), '34px');
  header.hidden = false;
  for (const mode of ['recording-mode', 'ui-clean-view']) {
    document.body.classList.add(mode);
    assert.equal(top(), '34px', mode);
    document.body.classList.remove(mode);
  }
});
