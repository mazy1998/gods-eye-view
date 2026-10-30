import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

const sheets = ['voice-card.css', 'voice-cost.css', 'voice-dock-view.css'];

test('the voice settings panel reads like a drawer card outside Cyber, and Cyber keeps its own', (t) => {
  const style = document.createElement('style');
  style.textContent = sheets
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = `<div id="command-dock">
    <div id="gev-voice-control" class="gev-surface">
      <section id="gev-voice-panel" class="gev-voice-panel" data-view="settings">
        <div class="gev-voice-panel-header">
          <span class="gev-voice-panel-title">VOICE</span>
          <div class="gev-voice-panel-tabs" role="tablist">
            <button class="gev-voice-panel-tab" role="tab" aria-selected="false">p</button>
            <button class="gev-voice-panel-tab" role="tab" aria-selected="true">s</button>
          </div>
          <button id="gev-voice-settings-close" type="button">×</button>
        </div>
        <div class="gev-voice-panel-body">
          <div class="gev-voice-timeout-group">
            <select id="gev-voice-timeout-select"><option>5</option></select>
          </div>
          <div class="gev-voice-cost-settings">
            <div class="gev-voice-cost-setting-row">
              <span>Voice model tier</span>
              <button id="gev-voice-tier" class="gev-voice-tier-btn">STD</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>`;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    container.innerHTML = '';
    style.remove();
  });
  const css = (selector) => getComputedStyle(container.querySelector(selector));

  // The title is a sentence-case heading in the drawer's sans face.
  assert.equal(css('.gev-voice-panel-title').textTransform, 'lowercase');
  assert.match(css('.gev-voice-panel-title').font, /--gev-font-sans/);
  // Preview and Settings sit in one segmented track; the chosen view is tinted.
  assert.equal(css('[role="tablist"]').paddingTop, '2px');
  assert.equal(
    css('[aria-selected="true"]').background,
    'var(--gev-accent-tint)',
  );
  assert.equal(css('[aria-selected="false"]').borderColor, 'rgba(0, 0, 0, 0)');
  // Fields and the tier button use the sans face, not the legacy mono.
  for (const selector of ['#gev-voice-timeout-select', '#gev-voice-tier'])
    assert.match(css(selector).font, /--gev-font-sans/, selector);
  // Coarse-pointer targets stay with the base rules.
  assert.equal(css('.gev-voice-panel-tab').minHeight, '2rem');

  root.dataset.uiTheme = 'cyber';
  assert.notEqual(css('.gev-voice-panel-title').textTransform, 'lowercase');
  assert.notEqual(css('[role="tablist"]').paddingTop, '2px');
  assert.doesNotMatch(css('#gev-voice-tier').font, /--gev-font-sans/);
});
