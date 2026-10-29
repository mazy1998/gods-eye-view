import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
import { utcClock } from './railTimeline.js';
import { createRailTimelineState } from './railTimelineState.js';
const { mountView } = await import('./mountView.js');
const { default: WeatherTimeline } = await import('./WeatherTimeline.vue');
const ticks = [
  '2026-09-22T01:00:00Z',
  '2026-09-22T01:05:00Z',
  '2026-09-22T01:10:00Z',
];
const props = {
  ticks,
  index: 2,
  mode: 'latest',
  playing: false,
  readout: 'Latest',
  disabled: false,
};
function fixture(actions = {}) {
  const owner = createRailTimelineState(actions);
  const view = mountView(WeatherTimeline, {
    parent: container,
    props: { state: owner.channel.getSnapshot(), actions: owner },
  });
  const unsubscribe = owner.channel.subscribe(({ state }) =>
    view.update({ state }),
  );
  owner.update(props);
  return {
    owner,
    destroy() {
      unsubscribe();
      owner.destroy();
      view.dispose();
    },
  };
}

test('preview is immediate, commits are coalesced and native drag identity and tick mapping stay stable', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previews = [],
    commits = [];
  const f = fixture({
    onPreview: (tick) => {
      previews.push(tick);
      return tick;
    },
    onCommit: (tick) => commits.push(tick),
  });
  try {
    const slider = container.querySelector('input');
    const row = slider.parentElement;
    assert.equal(slider.getAttribute('aria-label'), 'Observed history');
    slider.value = '0';
    slider.dispatchEvent(new Event('input'));
    assert.deepEqual(commits, []);
    assert.deepEqual(previews, [ticks[0]]);
    assert.equal(slider.getAttribute('aria-valuetext'), '09-22 01:00 UTC');
    f.owner.update({
      ...props,
      ticks: ticks.slice(1),
      index: 1,
      readout: 'Refresh',
    });
    assert.equal(slider.parentElement, row);
    assert.equal(row.children[1], slider);
    assert.equal(slider.value, '0');
    assert.equal(slider.max, '2');
    assert.equal(
      container.querySelector('.rail-timeline-readout').textContent,
      ticks[0],
    );
    t.mock.timers.tick(149);
    assert.equal(commits.length, 0);
    slider.value = '1';
    slider.dispatchEvent(new Event('input'));
    t.mock.timers.tick(1);
    assert.deepEqual(commits, [ticks[1]]);
    slider.value = '2';
    slider.dispatchEvent(new Event('input'));
    slider.dispatchEvent(new Event('change'));
    assert.deepEqual(commits, [ticks[1], ticks[2]]);
    t.mock.timers.tick(150);
    assert.equal(commits.length, 2);
    assert.equal(slider.max, '1');
  } finally {
    f.destroy();
  }
});

test('timeline transport calls the owner and destruction cancels drafts and retained controls', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const f = fixture({
    onCommit: () => calls.push('commit'),
    onStep: (n) => calls.push(n),
    onLatest: () => calls.push('latest'),
    onPlay: () => calls.push('play'),
  });
  try {
    f.owner.update({ ...props, index: 1 });
    const buttons = [...container.querySelectorAll('button')];
    for (const label of ['‹', '›', 'Latest', 'Play'])
      buttons.find((n) => n.textContent === label).click();
    assert.deepEqual(calls, [-1, 1, 'latest', 'play']);
    f.owner.update({ ...props, playing: true });
    assert.ok(buttons.some((n) => n.textContent === 'Pause'));
    const slider = container.querySelector('input');
    slider.value = '0';
    slider.dispatchEvent(new Event('change'));
    assert.equal(calls.at(-1), 'commit');
    slider.dispatchEvent(new Event('input'));
    f.destroy();
    for (const button of buttons) button.click();
    t.mock.timers.tick(150);
    assert.equal(calls.length, 5);
    assert.equal(container.children.length, 0);
  } finally {
    f.destroy();
  }
});

test('UTC endpoints follow the advertised range and invalid times stay empty', () => {
  assert.equal(utcClock('invalid'), '');
  assert.equal(utcClock(ticks[0]), '01:00 UTC');
  const f = fixture();
  try {
    const endpoints = container.querySelector('.rail-timeline-endpoints');
    assert.equal(endpoints.parentElement.className, 'rail-timeline-track');
    assert.deepEqual(
      [...endpoints.children].map((n) => n.textContent),
      ['01:00 UTC', '01:10 UTC'],
    );
    f.owner.update({ ...props, ticks: ticks.slice(1) });
    assert.equal(endpoints.children[0].textContent, '01:05 UTC');
  } finally {
    f.destroy();
  }
});

test('a late observer receives the owned drag even after a commit timer and a clock refresh', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const commits = [];
  const owner = createRailTimelineState({
    onPreview: (tick) => `Preview ${tick}`,
    onCommit: (tick) => commits.push(tick),
  });
  owner.update(props);
  owner.preview(1);
  t.mock.timers.tick(150);
  owner.update({
    ...props,
    ticks: ticks.slice(1),
    index: 0,
    readout: 'Refresh',
  });
  let shown;
  const unsubscribe = owner.channel.subscribe(({ state }) => {
    shown = state;
  });
  assert.deepEqual(shown.ticks, ticks);
  assert.equal(shown.index, 1);
  assert.equal(shown.readout, `Preview ${ticks[1]}`);
  assert.equal(Object.isFrozen(shown.ticks), true);
  owner.blur();
  assert.deepEqual(commits, [ticks[1], ticks[1]]);
  assert.deepEqual(shown.ticks, ticks.slice(1));
  assert.equal(shown.index, 0);
  owner.preview(1);
  unsubscribe();
  owner.destroy();
  t.mock.timers.tick(150);
  assert.equal(commits.length, 2, 'destroy cancels a pending draft');
});
