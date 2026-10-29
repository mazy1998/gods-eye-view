// Markup contracts of the primitive components, rendered without a DOM.
// Mounted behavior is covered by primitives.dom.test.mjs and browser fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ActionButton from './ActionButton.vue';
import DisclosureRow from './DisclosureRow.vue';
import FilterChip from './FilterChip.vue';
import IconButton from './IconButton.vue';
import NumberField from './NumberField.vue';
import PanelHeader from './PanelHeader.vue';
import QuantitativeSlider from './QuantitativeSlider.vue';
import SegmentedControl from './SegmentedControl.vue';
import SelectField from './SelectField.vue';
import StatusBadge from './StatusBadge.vue';
import SurfaceCard from './SurfaceCard.vue';
import TabList from './TabList.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const render = (component, props = {}, slots) =>
  renderToString(createSSRApp({ render: () => h(component, props, slots) }));
const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

/** Attributes of every element with the given tag, in document order. */
function elements(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map(([, attrs]) =>
    Object.fromEntries(
      [...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, name, value = '']) => [name, value]),
    ),
  );
}

test('ActionButton renders native action variants and sizes', async () => {
  for (const variant of ['default', 'danger'])
    for (const size of ['default', 'compact'])
      for (const disabled of [false, true]) {
        const label = '<b>Save</b> · СОХРАНИТЬ';
        const html = await render(ActionButton, { label, variant, size, disabled });
        const [button] = elements(html, 'button');
        assert.equal(button.type, 'button');
        assert.equal(button.class, ['gev-action-button', variant === 'danger' && 'gev-action-button--danger', size === 'compact' && 'gev-action-button--compact'].filter(Boolean).join(' '));
        assert.equal('disabled' in button, disabled);
        assert.ok(html.includes('&lt;b&gt;Save&lt;/b&gt; · СОХРАНИТЬ'), 'label stays literal text');
      }
});

test('NumberField renders native numeric bounds, values and densities', async () => {
  for (const density of ['default', 'compact', 'inline']) {
    const className = density === 'default' ? '' : `gev-field--${density}`;
    const html = await render(NumberField, {
      density,
      min: 0,
      max: 10,
      step: 0.5,
      modelValue: 3,
      label: 'Zoom',
    });
    const [input] = elements(html, 'input');
    assert.equal(input.type, 'number');
    assert.equal(input.class, `gev-field${className ? ` ${className}` : ''}`);
    assert.deepEqual([input.min, input.max, input.step, input.value], ['0', '10', '0.5', '3']);
    assert.equal(input['aria-label'], 'Zoom');
  }
});

test('SegmentedControl is a radiogroup with one roving stop per keyboard policy', async () => {
  const radio = elements(
    await render(SegmentedControl, { options: OPTIONS, modelValue: 'c', label: 'Shape' }),
    'button',
  );
  assert.deepEqual(
    radio.map((b) => [b.role, b['aria-checked'], b.tabindex, 'disabled' in b]),
    [
      ['radio', 'false', '-1', false],
      ['radio', 'false', '-1', true],
      ['radio', 'true', '0', false],
    ],
  );
  const group = elements(
    await render(SegmentedControl, { options: OPTIONS, label: 'Shape' }),
    'div',
  )[0];
  assert.deepEqual([group.role, group['aria-label'], group.class], ['radiogroup', 'Shape', 'gev-segmented']);
  // No selection yet: the first enabled choice holds the tab stop.
  const unselected = elements(await render(SegmentedControl, { options: OPTIONS }), 'button');
  assert.deepEqual(unselected.map((b) => b.tabindex), ['0', '-1', '-1']);
  // Click-only groups keep native tab order.
  const none = elements(
    await render(SegmentedControl, { options: OPTIONS, modelValue: 'a', keyboard: 'none' }),
    'button',
  );
  assert.ok(none.every((b) => !('tabindex' in b)));
});

test('TabList selects one tab, links panels and keeps a roving tab stop', async () => {
  const tabs = OPTIONS.map((tab) => ({ ...tab, id: `t-${tab.value}`, controls: `p-${tab.value}` }));
  const html = await render(TabList, { tabs, modelValue: 'a', label: 'Mode' });
  assert.deepEqual(elements(html, 'div')[0], { class: 'gev-tabs', role: 'tablist', 'aria-label': 'Mode' });
  assert.deepEqual(
    elements(html, 'button').map((b) => [b.id, b.role, b['aria-selected'], b['aria-controls'], b.tabindex]),
    [
      ['t-a', 'tab', 'true', 'p-a', '0'],
      ['t-b', 'tab', 'false', 'p-b', '-1'],
      ['t-c', 'tab', 'false', 'p-c', '-1'],
    ],
  );
});

test('ToggleSwitch, FilterChip and DisclosureRow expose their state', async () => {
  const [off] = elements(await render(ToggleSwitch, { 'aria-label': 'Live flights' }), 'button');
  assert.deepEqual([off.role, off['aria-checked'], off['aria-label']], ['switch', 'false', 'Live flights']);
  const on = await render(ToggleSwitch, { modelValue: true, label: 'Radio' });
  assert.equal(elements(on, 'button')[0]['aria-checked'], 'true');
  assert.match(on, /<span class="gev-toggle-label">Radio<\/span>/);

  const [chip] = elements(await render(FilterChip, { label: 'Military', modelValue: true }), 'button');
  assert.equal(chip['aria-pressed'], 'true');

  const row = await render(DisclosureRow, {
    label: 'Space',
    description: 'Satellites · launches',
    controls: 'space-feeds',
  });
  const [button] = elements(row, 'button');
  assert.deepEqual([button['aria-expanded'], button['aria-controls']], ['false', 'space-feeds']);
  assert.match(row, /gev-disclosure-row-description">Satellites · launches</);
  assert.match(row, /class="gev-disclosure-row-chevron" aria-hidden="true"/);
});

test('IconButton is named by its label and is a toggle only when pressed is set', async () => {
  const [plain] = elements(await render(IconButton, { label: 'Close' }), 'button');
  assert.deepEqual([plain['aria-label'], plain.title, 'aria-pressed' in plain], ['Close', 'Close', false]);
  const [toggle] = elements(await render(IconButton, { label: 'Pin', pressed: false }), 'button');
  assert.equal(toggle['aria-pressed'], 'false');
});

test('SelectField marks the option equal to the value, numbers included', async () => {
  const html = await render(SelectField, {
    options: [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two', disabled: true },
      { value: 10, label: 'Ten' },
    ],
    modelValue: 10,
    density: 'compact',
    label: 'Count',
  });
  assert.deepEqual(elements(html, 'select')[0], {
    class: 'gev-field gev-field--compact',
    'aria-label': 'Count',
  });
  assert.deepEqual(
    elements(html, 'option').map((o) => [o.value, 'selected' in o, 'disabled' in o]),
    [
      ['1', false, false],
      ['2', false, true],
      ['10', true, false],
    ],
  );
});

test('QuantitativeSlider is a native range with its spoken value', async () => {
  const [input] = elements(
    await render(QuantitativeSlider, {
      modelValue: 0.4,
      min: 0,
      max: 1,
      step: 0.1,
      label: 'Bloom',
      valueText: '40%',
    }),
    'input',
  );
  assert.deepEqual(
    [input.type, input.class, input.value, input['aria-label'], input['aria-valuetext']],
    ['range', 'gev-quantitative-slider', '0.4', 'Bloom', '40%'],
  );
});

test('PanelHeader and SurfaceCard use real headings at the requested level', async () => {
  const header = await render(
    PanelHeader,
    { title: 'Layers', subtitle: 'Choose what appears on the globe', level: 3 },
    { actions: () => h('button', { type: 'button' }, 'x') },
  );
  assert.match(header, /<h3 class="gev-panel-header-title">Layers<\/h3>/);
  assert.match(header, /<p class="gev-panel-header-subtitle">Choose what appears on the globe<\/p>/);
  assert.match(header, /<div class="gev-panel-header-actions">(<!--\[-->)?<button type="button">x<\/button>/);
  assert.doesNotMatch(await render(PanelHeader, { title: 'Layers' }), /actions|subtitle/);
  assert.match(await render(SurfaceCard, { title: 'Feed' }), /<h3 class="gev-card-title">Feed<\/h3>/);
  assert.doesNotMatch(await render(SurfaceCard), /<h\d/);
});

test('every class a primitive renders is styled by an imported stylesheet', async () => {
  const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const css = [...read('style.css').matchAll(/@import '([^']+)'/g)].map((m) => read(m[1])).join('\n');
  const slot = { icon: () => h('i'), actions: () => h('i'), default: () => 'x' };
  const markup = await Promise.all([
    render(ActionButton, { label: 'a', variant: 'danger', size: 'compact' }),
    render(DisclosureRow, { label: 'a', description: 'b' }, slot),
    render(FilterChip, { label: 'a' }, slot),
    render(IconButton, { label: 'a', size: 'sm' }, slot),
    render(NumberField, { density: 'inline' }),
    render(PanelHeader, { title: 'a', subtitle: 'b' }, slot),
    render(QuantitativeSlider),
    render(SegmentedControl, { options: OPTIONS }),
    render(SelectField, { options: OPTIONS, density: 'compact' }),
    render(StatusBadge, { label: 'a', appearance: 'box' }),
    render(SurfaceCard, { title: 'a' }, slot),
    render(TabList, { tabs: OPTIONS }),
    render(ToggleSwitch, { label: 'a' }),
  ]);
  const classes = new Set(
    markup.flatMap((html) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))),
  );
  const unstyled = [...classes].filter(
    (name) => name && !new RegExp(`\\.${name}(?![\\w-])`).test(css),
  );
  assert.deepEqual(unstyled, []);
});
