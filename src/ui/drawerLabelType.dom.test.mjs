import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';

function mount(t, sheets, markup) {
  const style = document.createElement('style');
  style.textContent = sheets
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  container.innerHTML = markup;
  const root = document.documentElement;
  t.after(() => {
    delete root.dataset.uiTheme;
    container.innerHTML = '';
    style.remove();
  });
  return (selector) => getComputedStyle(container.querySelector(selector));
}

const SMALL_CAPS = '600 var(--gev-font-size-2xs) / 1 var(--gev-font-sans)';

test("Map & Look's one-of-many choices and requirement tags use the drawer's sans type", (t) => {
  const css = mount(
    t,
    ['segmented-control.css', 'controls.css', 'map-look.css'],
    `<div id="pp-toggles"><div class="map-look"><div class="map-look-slot">
      <div class="gev-segmented pp-mode-seg">
        <button class="gev-segment pp-mode-btn active">Elastic</button>
      </div>
      <button class="map-stack-chip"><span class="map-stack-chip-req">ION</span></button>
    </div></div></div>`,
  );
  const segment = css('.pp-mode-btn');
  assert.equal(
    segment.font,
    '500 var(--gev-font-size-sm) / 1.25 var(--gev-font-sans)',
  );
  assert.equal(segment.textTransform, 'none');
  assert.equal(segment.letterSpacing, 'normal');
  const tag = css('.map-stack-chip-req');
  assert.equal(tag.font, SMALL_CAPS);
  assert.equal(tag.letterSpacing, '1px');
  assert.equal(tag.textTransform, 'uppercase');

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('.pp-mode-btn').textTransform, 'uppercase');
  assert.equal(
    css('.map-stack-chip-req').font,
    'var(--gev-font-size-2xs) / 1 var(--gev-font-mono)',
  );
});

test("Draw's settings continue its row in the drawer's sans type, with no inset band", (t) => {
  const css = mount(
    t,
    [
      'segmented-control.css',
      'action-button.css',
      'controls.css',
      'tool-views.css',
    ],
    `<div class="gev-legacy-host"><div id="draw-group" class="gev-tools gev-surface pp-toggle-group">
      <div id="draw-mode-row" class="pp-slider-row visible">
        <span class="pp-slider-mini-label">Shape</span>
        <div class="gev-segmented pp-mode-seg">
          <button class="gev-segment pp-mode-btn" role="radio" aria-checked="true">Area</button>
        </div>
      </div>
      <div id="draw-label-row" class="pp-slider-row visible">
        <input id="draw-label-input" class="pp-text-input" />
        <button id="draw-clear" class="gev-action-button gev-action-button--danger draw-clear-btn">Clear board</button>
        <span id="draw-hint" class="draw-hint">Click 3 more points.</span>
      </div>
    </div></div>`,
  );
  const row = css('#draw-mode-row');
  assert.equal(row.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(row.borderTopStyle, 'none');
  assert.equal(css('.pp-slider-mini-label').textTransform, 'none');
  assert.equal(
    css('.pp-slider-mini-label').font,
    'var(--gev-font-size-md) / 1.3 var(--gev-font-sans)',
  );
  assert.equal(
    css('.gev-segment').font,
    '500 var(--gev-font-size-sm) / 1.25 var(--gev-font-sans)',
  );
  assert.equal(css('.gev-segment').textTransform, 'none');
  for (const id of ['#draw-label-input', '#draw-clear'])
    assert.match(
      css(id).font,
      /var\(--gev-font-size-sm\) \/ 1\.3 var\(--gev-font-sans\)/,
    );
  assert.equal(css('#draw-clear').letterSpacing, 'normal');
  assert.equal(
    css('#draw-hint').font,
    'var(--gev-font-size-sm) / 1.4 var(--gev-font-sans)',
  );

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('.gev-segment').textTransform, 'uppercase');
  assert.equal(css('#draw-clear').fontFamily, 'var(--font-mono)');
});

test('Create lists shots with dividers, sans actions and sans metadata', (t) => {
  const css = mount(
    t,
    ['action-button.css', 'scenes.css', 'stories.css'],
    `<div id="scene-controls-body"><div class="stories-controls">
      <div id="scene-shot-list" class="scene-shot-list">
        <div class="scene-shot-row active" data-id="a">
          <div class="scene-shot-top"><div class="scene-shot-label">A</div>
            <div class="scene-shot-actions">
              <button class="gev-action-button gev-action-button--compact scene-shot-btn">LOAD</button>
            </div>
          </div>
          <div class="scene-shot-meta">NORMAL · OFF · 4.0s + 0.9s</div>
        </div>
        <div class="scene-shot-row" data-id="b"></div>
      </div>
    </div></div>`,
  );
  const row = css('[data-id="b"]');
  assert.equal(row.borderTopWidth, '0px');
  assert.equal(row.borderBottomWidth, '1px');
  assert.equal(row.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(css('[data-id="a"]').background, 'var(--gev-accent-tint)');
  assert.equal(
    css('.scene-shot-btn').font,
    '500 var(--gev-font-size-sm) / 1.2 var(--gev-font-sans)',
  );
  assert.equal(
    css('.scene-shot-meta').font,
    'var(--gev-font-size-xs) / 1.4 var(--gev-font-sans)',
  );

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('.scene-shot-meta').fontFamily, 'var(--font-mono)');
  assert.equal(css('[data-id="b"]').borderTopWidth, '1px');
});

test("Settings is one material, with drawer buttons and the language list's labels in sans", (t) => {
  const css = mount(
    t,
    ['action-button.css', 'locale-picker.css', 'settings-appearance.css'],
    `<section class="gev-settings gev-surface">
      <section class="gev-settings-section">
        <button class="gev-action-button" id="voice">Voice Settings</button>
        <div class="gev-settings-language"><div class="locale-picker-popup">
          <div class="locale-picker-heading">Interface language</div>
          <span class="locale-picker-meta"><span>EN</span></span>
        </div></div>
      </section>
    </section>`,
  );
  assert.equal(css('.gev-settings').backdropFilter, 'none');
  assert.equal(
    css('#voice').font,
    '500 var(--gev-font-size-md) / 1.3 var(--gev-font-sans)',
  );
  assert.equal(css('#voice').letterSpacing, 'normal');
  const heading = css('.locale-picker-heading');
  assert.equal(
    heading.font,
    '600 var(--gev-font-size-2xs) / 1.4 var(--gev-font-sans)',
  );
  assert.equal(heading.letterSpacing, '1px');
  assert.equal(heading.textTransform, 'uppercase');
  assert.equal(
    css('.locale-picker-meta').font,
    'var(--gev-font-size-xs) / 1.4 var(--gev-font-sans)',
  );

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('#voice').fontFamily, 'var(--font-mono)');
  assert.equal(css('.locale-picker-heading').fontFamily, 'var(--font-mono)');
});

test("the voice pill's provider chooser is a round field in sans", (t) => {
  const css = mount(
    t,
    ['voice-cost.css', 'voice-dock-view.css'],
    `<div id="command-dock"><div id="gev-voice-control" class="gev-surface">
      <label class="gev-voice-provider-field"><span>Voice provider</span>
        <select id="gev-voice-provider"><option>OpenAI</option></select>
      </label>
      <button class="gev-voice-settings-button"></button>
    </div></div>`,
  );
  assert.equal(
    css('#gev-voice-provider').font,
    'var(--gev-font-size-md) / 1.3 var(--gev-font-sans)',
  );
  assert.equal(
    css('.gev-voice-provider-field').borderRadius,
    'var(--gev-radius-pill)',
  );

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('.gev-voice-provider-field').fontFamily, 'var(--font-mono)');
});

test('Light fills the main import action with the accent; other looks keep the outline', (t) => {
  const css = mount(
    t,
    ['action-button.css', 'tool-views.css'],
    `<div class="gev-legacy-host"><div id="geo-import-group">
      <button id="geo-import-button" class="gev-action-button">Choose files</button>
    </div></div>`,
  );
  const root = document.documentElement;
  t.after(() => delete root.dataset.gevAppearance);
  assert.equal(css('#geo-import-button').color, 'var(--gev-accent-text)');
  root.dataset.gevAppearance = 'light';
  assert.equal(css('#geo-import-button').color, 'var(--gev-on-accent)');
  assert.equal(css('#geo-import-button').background, 'var(--gev-accent)');
  root.dataset.uiTheme = 'cyber';
  assert.notEqual(css('#geo-import-button').color, 'var(--gev-on-accent)');
});

test("the credit line and the compass's north letter use the sans face outside Cyber", (t) => {
  const css = mount(
    t,
    ['foundation.css', 'status.css', 'shell.css'],
    `<div id="cesium-credits" class="gev-credits"><a>Data attribution</a></div>
    <button id="north-up-view"><span class="camera-compass-n">N</span></button>`,
  );
  assert.equal(
    css('#cesium-credits').font,
    'var(--gev-font-size-xs) / 1.2 var(--gev-font-sans)',
  );
  assert.equal(css('.camera-compass-n').fontFamily, 'var(--gev-font-sans)');

  document.documentElement.dataset.uiTheme = 'cyber';
  assert.equal(css('#cesium-credits').fontFamily, 'var(--font-mono)');
  assert.equal(css('.camera-compass-n').fontFamily, 'var(--font-mono)');
});
