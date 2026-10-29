// Behaviour of the primitive components in a DOM: controlled updates, emits,
// keyboard policies and focus. Markup contracts live in primitives.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { container, mount } from '../../testSupport/componentDom.mjs';

const { default: SegmentedControl } = await import('./SegmentedControl.vue');
const { default: TabList } = await import('./TabList.vue');
const { default: ToggleSwitch } = await import('./ToggleSwitch.vue');
const { default: DisclosureRow } = await import('./DisclosureRow.vue');
const { default: FilterChip } = await import('./FilterChip.vue');
const { default: IconButton } = await import('./IconButton.vue');
const { default: ActionButton } = await import('./ActionButton.vue');
const { default: SelectField } = await import('./SelectField.vue');
const { default: NumberField } = await import('./NumberField.vue');
const { default: QuantitativeSlider } = await import('./QuantitativeSlider.vue');

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

/** Mount a controlled view whose owner applies every emitted value. */
function controlled(component, props) {
  const emitted = [];
  const view = mount(component, {
    props: {
      ...props,
      'onUpdate:modelValue': (value) => {
        emitted.push(value);
        view.update({ modelValue: value });
      },
    },
  });
  return { view, emitted };
}
const key = (target, name) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};
const buttons = () => [...container.querySelectorAll('button')];
const checked = (attribute) => buttons().map((b) => b.getAttribute(attribute));

test('segmented restoration repaints without emitting or moving focus', () => {
  const { view, emitted } = controlled(SegmentedControl, { options: OPTIONS, modelValue: 'a' });
  buttons()[0].focus();
  view.update({ modelValue: 'c' });
  assert.deepEqual(emitted, []);
  assert.deepEqual(checked('aria-checked'), ['false', 'false', 'true']);
  assert.deepEqual(checked('tabindex'), ['-1', '-1', '0']);
  assert.equal(document.activeElement, buttons()[0]);
});

test('segmented clicks emit, including reselection; disabled choices do not', () => {
  const { emitted } = controlled(SegmentedControl, { options: OPTIONS, modelValue: 'a' });
  buttons()[2].click();
  buttons()[2].click();
  buttons()[1].click();
  assert.deepEqual(emitted, ['c', 'c']);
});

test('radio keys wrap, skip disabled choices, move focus and keep Home/End', () => {
  const { emitted } = controlled(SegmentedControl, { options: OPTIONS, modelValue: 'a' });
  assert.equal(key(buttons()[0], 'ArrowRight'), true);
  assert.equal(document.activeElement, buttons()[2]);
  key(buttons()[2], 'ArrowDown');
  key(buttons()[0], 'End');
  key(buttons()[2], 'Home');
  assert.deepEqual(emitted, ['c', 'a', 'c', 'a']);
  assert.deepEqual(checked('aria-checked'), ['true', 'false', 'false']);
});

test('arrows policy ignores Home/End; none leaves keys and tab order alone', () => {
  const arrows = controlled(SegmentedControl, { options: OPTIONS, modelValue: 'a', keyboard: 'arrows' });
  assert.equal(key(buttons()[0], 'End'), false);
  key(buttons()[0], 'ArrowLeft');
  assert.deepEqual(arrows.emitted, ['c']);
  arrows.view.dispose();
  const none = controlled(SegmentedControl, { options: OPTIONS, modelValue: 'a', keyboard: 'none' });
  assert.equal(key(buttons()[0], 'ArrowRight'), false);
  assert.deepEqual(none.emitted, []);
  assert.ok(buttons().every((b) => !b.hasAttribute('tabindex')));
});

test('tabs select on arrows with a roving stop and focus following', () => {
  const tabs = OPTIONS.map((tab) => ({ ...tab, controls: `p-${tab.value}` }));
  const { emitted } = controlled(TabList, { tabs, modelValue: 'c' });
  key(buttons()[2], 'ArrowRight');
  assert.equal(document.activeElement, buttons()[0]);
  assert.deepEqual(checked('aria-selected'), ['true', 'false', 'false']);
  assert.deepEqual(checked('tabindex'), ['0', '-1', '-1']);
  key(buttons()[0], 'End');
  buttons()[0].click();
  assert.deepEqual(emitted, ['a', 'c', 'a']);
});

test('switch, chip and disclosure flip their state through the owner', () => {
  for (const [component, props, attribute] of [
    [ToggleSwitch, { 'aria-label': 'Radio' }, 'aria-checked'],
    [FilterChip, { label: 'Military' }, 'aria-pressed'],
    [DisclosureRow, { label: 'Space', controls: 'space' }, 'aria-expanded'],
  ]) {
    const { view, emitted } = controlled(component, props);
    const [button] = buttons();
    button.click();
    assert.equal(button.getAttribute(attribute), 'true');
    button.click();
    assert.deepEqual(emitted, [true, false]);
    view.update({ disabled: true });
    button.click();
    assert.deepEqual(emitted, [true, false], `${attribute}: disabled does not emit`);
    view.dispose();
  }
});

test('action and icon buttons emit click unless disabled', () => {
  const clicks = [];
  const action = mount(ActionButton, { props: { label: 'Save', onClick: () => clicks.push('action') } });
  const icon = mount(IconButton, { props: { label: 'Close', onClick: () => clicks.push('icon') } });
  for (const button of buttons()) button.click();
  action.update({ disabled: true });
  icon.update({ disabled: true });
  for (const button of buttons()) button.click();
  assert.deepEqual(clicks, ['action', 'icon']);
});

test('select emits the chosen option value itself, not its string', () => {
  const { emitted } = controlled(SelectField, {
    options: [
      { value: 1, label: 'One' },
      { value: 10, label: 'Ten' },
    ],
    modelValue: 1,
  });
  const select = container.querySelector('select');
  select.selectedIndex = 1;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(emitted, [10]);
  assert.equal(select.options[1].selected, true);
});

test('number fields emit raw text on change, or on every input when live', () => {
  const settled = controlled(NumberField, { modelValue: 1 });
  const input = container.querySelector('input');
  input.value = '2.5';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(settled.emitted, []);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(settled.emitted, ['2.5']);
  settled.view.dispose();
  const live = controlled(NumberField, { modelValue: 1, live: true });
  const liveInput = container.querySelector('input');
  liveInput.value = '3';
  liveInput.dispatchEvent(new Event('input', { bubbles: true }));
  liveInput.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(live.emitted, ['3']);
});

test('sliders emit numbers on input', () => {
  const { emitted } = controlled(QuantitativeSlider, { modelValue: 0.2, min: 0, max: 1, step: 0.1 });
  const input = container.querySelector('input');
  input.value = '0.7';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(emitted, [0.7]);
});

test('a disabled selected choice gives the tab stop to the first enabled one, without emitting', () => {
  for (const [component, key] of [
    [SegmentedControl, 'options'],
    [TabList, 'tabs'],
  ]) {
    const { view, emitted } = controlled(component, { [key]: OPTIONS, modelValue: 'b' });
    assert.deepEqual(checked('tabindex'), ['0', '-1', '-1']);
    assert.equal(buttons()[1].getAttribute(key === 'tabs' ? 'aria-selected' : 'aria-checked'), 'true');
    assert.deepEqual(emitted, []);
    view.dispose();
  }
});

test('tabs follow their orientation: horizontal ignores Up/Down, vertical ignores Left/Right', () => {
  const horizontal = controlled(TabList, { tabs: OPTIONS, modelValue: 'a' });
  assert.equal(key(buttons()[0], 'ArrowDown'), false);
  horizontal.view.dispose();
  const vertical = controlled(TabList, { tabs: OPTIONS, modelValue: 'a', orientation: 'vertical' });
  assert.equal(container.querySelector('[role="tablist"]').getAttribute('aria-orientation'), 'vertical');
  assert.equal(key(buttons()[0], 'ArrowRight'), false);
  key(buttons()[0], 'ArrowDown');
  assert.deepEqual(vertical.emitted, ['c']);
});

test('select shows the model value, or nothing when no option matches', async () => {
  const options = OPTIONS.map(({ value, label }) => ({ value, label }));
  const { view } = controlled(SelectField, { options, modelValue: 'c' });
  const select = container.querySelector('select');
  assert.equal(select.selectedIndex, 2);
  view.update({ modelValue: 'missing' });
  assert.equal(select.selectedIndex, -1);
  view.update({ modelValue: 'b' });
  view.update({ options: options.filter((option) => option.value !== 'b') });
  assert.equal(select.selectedIndex, -1, 'the selected option was removed');
  view.update({ modelValue: 'c' });
  assert.equal(select.selectedIndex, 1);
});

test('select returns to the owner value when the owner refuses a choice', async () => {
  const { nextTick } = await import('vue');
  const choices = [];
  mount(SelectField, {
    props: {
      options: OPTIONS.map(({ value, label }) => ({ value, label })),
      modelValue: 'a',
      'onUpdate:modelValue': (value) => choices.push(value), // refuses: never updates
    },
  });
  const select = container.querySelector('select');
  select.selectedIndex = 2;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(choices, ['c']);
  await nextTick();
  assert.equal(select.selectedIndex, 0);
});

test('a disclosure row is named by its label and described by its description', () => {
  mount(DisclosureRow, { props: { label: 'Space', description: 'Updated 8s ago' } });
  const [button] = buttons();
  const label = document.getElementById(button.getAttribute('aria-labelledby'));
  const description = document.getElementById(button.getAttribute('aria-describedby'));
  assert.equal(label.textContent, 'Space');
  assert.equal(description.textContent, 'Updated 8s ago');
  mount(DisclosureRow, { props: { label: 'Environment' } });
  const second = buttons()[1];
  assert.notEqual(second.getAttribute('aria-labelledby'), button.getAttribute('aria-labelledby'));
  assert.equal(second.hasAttribute('aria-describedby'), false);
});

test('a busy switch stays focusable, says so, and ignores activation', () => {
  const { view, emitted } = controlled(ToggleSwitch, { 'aria-label': 'Live flights', busy: true });
  const [button] = buttons();
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  button.focus();
  assert.equal(document.activeElement, button);
  button.click();
  assert.deepEqual(emitted, []);
  view.update({ busy: false });
  assert.equal(button.hasAttribute('aria-busy'), false);
  assert.equal(button.hasAttribute('aria-disabled'), false);
  button.click();
  assert.deepEqual(emitted, [true]);
});

test('an icon button hides its icon from assistive technology', async () => {
  const { h } = await import('vue');
  const Wrapper = { setup: () => () => h(IconButton, { label: 'Close' }, () => h('i', 'x')) };
  mount(Wrapper);
  const icon = container.querySelector('button i');
  assert.equal(icon.parentElement.getAttribute('aria-hidden'), 'true');
});
