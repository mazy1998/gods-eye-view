// The selected style's parameter rows: one labelled slider per uniform, the
// value in the UI language, writes through setStyleParam, and rows a caller
// still holds are inert once a style change replaces them or the view's
// operations are cleared and it is disposed (the old generated rows' contract).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../../testSupport/componentDom.mjs';

const { default: StyleParametersView } =
  await import('./StyleParametersView.vue');
const { STYLES } = await import('../visualPresets.js');

const defaults = (style) =>
  Object.fromEntries(
    Object.entries(STYLES[style].uniforms).map(([name, meta]) => [
      name,
      meta.default,
    ]),
  );
const thermal = () => defaults('thermal');

test('rows keep labels, bounds, precision and the current values', (t) => {
  const view = mount(StyleParametersView, {
    props: { state: { style: 'thermal', styleParams: { thermal: thermal() } } },
  });
  t.after(() => view.dispose());
  const rows = [...document.querySelectorAll('.param-slider-row')];
  assert.equal(rows.length, Object.keys(STYLES.thermal.uniforms).length);
  const [label, slider, value] = rows[0].children;
  assert.equal(label.className, 'param-label');
  assert.equal(label.textContent, 'Sensitivity');
  assert.equal(slider.getAttribute('aria-label'), 'Sensitivity');
  assert.equal(slider.type, 'range');
  assert.equal(slider.className, 'gev-quantitative-slider param-slider');
  assert.equal(slider.min, '0');
  assert.equal(slider.max, '1');
  assert.equal(slider.step, '0.01');
  assert.equal(slider.value, '0.75');
  assert.equal(value.textContent, '0.75');
  const pixelation = rows.find((row) => row.textContent.includes('Pixelation'));
  assert.equal(pixelation.children[1].step, '0.1');
  assert.equal(pixelation.children[2].textContent, '1.5');
});

test('input writes the numeric value through setStyleParam', (t) => {
  const calls = [];
  const view = mount(StyleParametersView, {
    props: {
      state: { style: 'thermal', styleParams: { thermal: thermal() } },
      actions: { setStyleParam: (...args) => calls.push(args) },
    },
  });
  t.after(() => view.dispose());
  const slider = document.querySelector('.param-slider');
  slider.value = '0.4';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(calls, [['thermal', 'sensitivity', 0.4]]);
});

test('Normal has no rows, and a style change replaces them', (t) => {
  const view = mount(StyleParametersView, {
    props: { state: { style: 'normal', styleParams: {} } },
  });
  t.after(() => view.dispose());
  assert.equal(document.querySelectorAll('.param-slider-row').length, 0);
  view.update({
    state: { style: 'thermal', styleParams: { thermal: thermal() } },
  });
  assert.equal(
    document.querySelectorAll('.param-slider-row').length,
    Object.keys(STYLES.thermal.uniforms).length,
  );
  view.update({ state: { style: 'normal', styleParams: {} } });
  assert.equal(document.querySelectorAll('.param-slider-row').length, 0);
});

test('a row a style change replaced stays inert, even back on its style', (t) => {
  const calls = [];
  const view = mount(StyleParametersView, {
    props: {
      state: { style: 'thermal', styleParams: { thermal: thermal() } },
      actions: { setStyleParam: (...args) => calls.push(args) },
    },
  });
  t.after(() => view.dispose());
  const retired = document.querySelector('.param-slider');
  const nvg = { surveillance: defaults('surveillance') };
  view.update({ state: { style: 'surveillance', styleParams: nvg } });
  retired.value = '0.9';
  retired.dispatchEvent(new Event('input', { bubbles: true }));
  view.update({
    state: { style: 'thermal', styleParams: { thermal: thermal() } },
  });
  retired.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(calls, []);
  const current = document.querySelector('.param-slider');
  assert.notEqual(current, retired);
  current.value = '0.4';
  current.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(calls, [['thermal', 'sensitivity', 0.4]]);
});

test('a retained row is inert once operations are cleared and the view disposed', () => {
  const calls = [];
  const view = mount(StyleParametersView, {
    props: {
      state: { style: 'thermal', styleParams: { thermal: thermal() } },
      actions: { setStyleParam: (...args) => calls.push(args) },
    },
  });
  const slider = document.querySelector('.param-slider');
  view.update({ actions: null });
  view.dispose();
  slider.value = '0.2';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(calls, []);
});
