import test from 'node:test';
import assert from 'node:assert/strict';
import { sliderFill } from './sliderFill.js';

test('a slider fill is its value along its range, in units of its width', () => {
  assert.deepEqual(sliderFill(49, 0, 100), { '--gev-slider-fill': '49cqw' });
  assert.deepEqual(sliderFill(0.85, 0, 1), { '--gev-slider-fill': '85cqw' });
  assert.deepEqual(sliderFill('15', 10, 30), { '--gev-slider-fill': '25cqw' });
});

test('a slider fill stays within its track', () => {
  assert.deepEqual(sliderFill(-5, 0, 100), { '--gev-slider-fill': '0cqw' });
  assert.deepEqual(sliderFill(250, 0, 200), { '--gev-slider-fill': '100cqw' });
  assert.deepEqual(sliderFill(5, 3, 3), { '--gev-slider-fill': '0cqw' });
  assert.deepEqual(sliderFill(undefined, 0, 1), {
    '--gev-slider-fill': '0cqw',
  });
});
