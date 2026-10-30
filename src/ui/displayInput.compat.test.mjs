import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const display = await import('gods-eye-view/ui/display');
const input = await import('gods-eye-view/ui/input');

test('published Display binder calls the native style action and removes it on destroy', () => {
  container.innerHTML =
    '<button data-style="thermal"></button><output>normal</output>';
  const button = container.querySelector('button');
  const output = container.querySelector('output');
  const control = display.bindDisplayControls({
    elements: { styleButtons: [button] },
    actions: {
      setStyle: (style) => {
        output.textContent = style;
      },
    },
  });
  button.click();
  assert.equal(output.textContent, 'thermal');
  control.destroy();
  control.destroy();
  output.textContent = 'normal';
  button.click();
  assert.equal(output.textContent, 'normal');
});

test('published parameter factory renders arbitrary host uniforms and revokes old input handlers', () => {
  assert.equal(typeof input.createStyleParameters, 'function');
  let value = 0.25;
  let changed = 0;
  const control = input.createStyleParameters({ container });
  const props = {
    uniforms: { gain: { label: 'Gain', min: 0, max: 1 } },
    readValue: () => value,
    writeValue: (name, next) => {
      assert.equal(name, 'gain');
      value = next;
    },
    onChange: () => changed++,
  };
  control.render(props);
  const retired = container.querySelector('input');
  assert.equal(retired.getAttribute('aria-label'), 'Gain');
  assert.equal(retired.value, '0.25');
  retired.value = '0.75';
  retired.dispatchEvent(new Event('input'));
  assert.equal(value, 0.75);
  assert.equal(changed, 1);
  assert.equal(container.querySelector('.param-value').textContent, '0.75');
  value = 0.5;
  control.render(props);
  assert.equal(container.querySelector('input').value, '0.5');
  retired.value = '0.9';
  retired.dispatchEvent(new Event('input'));
  assert.equal(value, 0.5);
  const retained = container.querySelector('input');
  control.clear();
  retained.dispatchEvent(new Event('input'));
  assert.equal(value, 0.5);
  control.render(props);
  const last = container.querySelector('input');
  control.destroy();
  control.destroy();
  last.dispatchEvent(new Event('input'));
  control.render(props);
  assert.equal(container.children.length, 0);
  assert.equal(changed, 1);
});
