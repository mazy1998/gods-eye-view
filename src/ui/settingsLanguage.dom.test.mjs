import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

test('the Settings language list pairs its text and surface from one appearance, and Cyber keeps its own', (t) => {
  const style = document.createElement('style');
  style.textContent = ['locale-picker.css', 'settings-appearance.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = `<section class="gev-surface gev-settings-language">
    <div id="locale-picker"><div class="locale-picker is-open">
      <div class="locale-picker-popup">
        <div class="locale-picker-heading">Language</div>
        <input class="locale-picker-search" />
        <ul class="locale-picker-list">
          <li class="locale-picker-option is-active" aria-selected="true">
            <span class="locale-picker-native">English</span>
            <span class="locale-picker-meta">en</span>
          </li>
          <li class="locale-picker-option" aria-selected="false">
            <span class="locale-picker-native">Español</span>
          </li>
        </ul>
      </div>
    </div></div>
  </section>`;
  const root = document.documentElement;
  root.dataset.gevAppearance = 'light';
  t.after(() => {
    delete root.dataset.uiTheme;
    delete root.dataset.gevAppearance;
    container.innerHTML = '';
    style.remove();
  });
  const css = (selector) => getComputedStyle(container.querySelector(selector));
  const natives = () => container.querySelectorAll('.locale-picker-native');

  assert.equal(
    css('.locale-picker-popup').background,
    'var(--gev-surface-raised)',
  );
  assert.equal(css('.locale-picker-popup').color, 'var(--gev-text)');
  assert.equal(getComputedStyle(natives()[1]).color, 'var(--gev-text)');
  assert.equal(getComputedStyle(natives()[0]).color, 'var(--gev-accent-text)');
  assert.equal(
    css('.locale-picker-search').background,
    'var(--gev-control-bg)',
  );
  assert.equal(css('.locale-picker-meta').color, 'var(--gev-text-muted)');

  root.dataset.uiTheme = 'cyber';
  assert.notEqual(
    css('.locale-picker-popup').background,
    'var(--gev-surface-raised)',
  );
  assert.notEqual(getComputedStyle(natives()[1]).color, 'var(--gev-text)');
});
