import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';

const { mountView } = await import('../mountView.js');
const { mountMissionPanels } = await import('../missionPanels.js');
const { createStateChannel } = await import('../../app/stateChannel.js');
const { createPanel } = await import('../../layers/launches/panel.js');

const REPLAY = {
  available: true,
  active: false,
  paused: false,
  phase: '',
  speed: 1,
  speedText: '1×',
  progress: '20%',
};

const DETAIL = {
  id: 'mission-b',
  title: 'STARLINK <GROUP>',
  provider: 'SpaceX',
  status: 'Go for Launch',
  site: '',
  time: '2026-10-30T10:00:00Z',
  orbit: 'LEO',
  ascent: 'ESTIMATED',
  distance: '',
  speed: '7.60 KM/S',
  speedTitle: '27,360 km/h',
  payloads: [
    {
      key: '0',
      name: 'Starlink <V2> ×21',
      detail: 'SpaceX',
      type: 'Communications',
      destination: 'LEO',
    },
  ],
  morePayloads: '+2 additional payload records',
  stages: [],
  position: '2 / 3',
  canPrevious: true,
  canNext: false,
};

const ROSTER_ITEMS = [
  {
    index: 1,
    id: 'mission-b',
    label: 'STARLINK <GROUP>',
    provider: 'SpaceX',
    date: '2026-10-30',
    color: 'rgb(76,201,240)',
  },
  {
    index: 0,
    id: 'mission-a',
    label: 'ARTEMIS',
    provider: 'NASA',
    date: '2026-10-29',
    color: 'rgb(255,159,67)',
  },
];

/** A stand-in for the Space Missions layer: its panel view and operations. */
function launchesDouble(view) {
  const calls = [];
  let current = view;
  const channel = createStateChannel(() => current);
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  const actions = Object.fromEntries(
    [
      'select',
      'previous',
      'next',
      'deselect',
      'focusSite',
      'replay',
      'togglePause',
      'cancelReplay',
      'setReplaySpeed',
      'pointerEnter',
      'pointerLeave',
      'focus',
      'blur',
    ].map((name) => [name, record(name)]),
  );
  return {
    calls,
    show(next) {
      current = next;
      channel.publish();
    },
    getMissionPanelView: () => channel.getSnapshot(),
    subscribeMissionPanelView: (listener, options) =>
      channel.subscribe(listener, options),
    getMissionPanelActions: () => actions,
  };
}

function mountPanels(view) {
  const host = container.appendChild(document.createElement('div'));
  host.id = 'space-mission-panel-host';
  const roster = host.appendChild(document.createElement('div'));
  roster.id = 'space-mission-roster';
  const launches = launchesDouble(view);
  const mounted = mountMissionPanels(mountView, { roster, host, launches });
  return { host, roster, launches, mounted };
}

const initial = {
  roster: { revision: 0, loaded: false, count: 0, items: [] },
  detail: null,
  replay: { ...REPLAY, available: false },
};

test('the roster loads, lists missions and reports an empty window', () => {
  const { roster, launches, mounted } = mountPanels(initial);
  const count = roster.querySelector('[data-mission-roster-count]');
  const list = roster.querySelector('[data-mission-roster-list]');
  assert.equal(count.textContent, '—');
  assert.equal(
    list.textContent.trim(),
    'Loading missions from the last 30 days',
  );
  assert.equal(
    roster.lastElementChild.dataset.missionRosterFocusContinuation,
    '',
  );
  launches.show({
    ...initial,
    roster: { revision: 1, loaded: true, count: 3, items: ROSTER_ITEMS },
  });
  assert.equal(count.textContent, '3 in 30 days');
  const rows = [...list.querySelectorAll('.space-mission-roster-item')];
  assert.deepEqual(
    rows.map((row) => [
      row.dataset.missionRosterIndex,
      row.dataset.missionRosterId,
      row.getAttribute('aria-label'),
      row.querySelector('strong').textContent,
      row.querySelector('small').textContent,
      row
        .querySelector('.space-mission-roster-marker')
        .style.getPropertyValue('--mission-roster-color'),
      row.querySelector('.space-mission-roster-chevron').textContent,
    ]),
    [
      [
        '1',
        'mission-b',
        'Select STARLINK <GROUP>',
        'STARLINK <GROUP>',
        'SpaceX · 2026-10-30',
        'rgb(76,201,240)',
        '›',
      ],
      [
        '0',
        'mission-a',
        'Select ARTEMIS',
        'ARTEMIS',
        'NASA · 2026-10-29',
        'rgb(255,159,67)',
        '›',
      ],
    ],
  );
  assert.equal(list.querySelector('group'), null, 'names render as text');
  launches.show({
    ...initial,
    roster: { revision: 2, loaded: true, count: 0, items: [] },
  });
  assert.equal(list.textContent.trim(), 'No missions in the last 30 days');
  mounted.dispose();
  assert.equal(roster.childNodes.length, 0);
});

test('roster rows report pointer, focus and selection to the layer', () => {
  const { roster, launches, mounted } = mountPanels({
    ...initial,
    roster: { revision: 1, loaded: true, count: 3, items: ROSTER_ITEMS },
  });
  const [first, second] = roster.querySelectorAll(
    '[data-mission-roster-index]',
  );
  first.dispatchEvent(new MouseEvent('mouseenter'));
  first.dispatchEvent(new MouseEvent('mouseleave'));
  first.dispatchEvent(new FocusEvent('focus'));
  first.dispatchEvent(new FocusEvent('blur', { relatedTarget: second }));
  first.dispatchEvent(
    new FocusEvent('blur', {
      relatedTarget: roster.querySelector(
        '[data-mission-roster-focus-continuation]',
      ),
    }),
  );
  first.click();
  assert.deepEqual(launches.calls, [
    ['pointerEnter', 1],
    ['pointerLeave'],
    ['focus', 1],
    ['blur', 0],
    ['blur', null],
    ['select', 1],
  ]);
  mounted.dispose();
});

test('the selected mission panel is hidden until a mission is selected', () => {
  const { host, launches, mounted } = mountPanels(initial);
  const panel = host.querySelector('#space-mission-panel');
  assert.equal(panel.tagName, 'ASIDE');
  assert.equal(panel.previousElementSibling.id, 'space-mission-roster');
  assert.equal(panel.className, 'context-space-mission-detail');
  assert.equal(panel.getAttribute('aria-label'), 'Selected Space Mission');
  assert.equal(panel.hidden, true);
  launches.show({ ...initial, detail: DETAIL, replay: REPLAY });
  assert.equal(panel.hidden, false);
  const field = (name) => panel.querySelector(`[data-mission-${name}]`);
  assert.equal(field('title').textContent, 'STARLINK <GROUP>');
  assert.equal(field('provider').textContent, 'SpaceX');
  assert.equal(field('provider').hidden, false);
  assert.equal(field('status').textContent, 'Go for Launch');
  assert.equal(field('status').previousElementSibling.textContent, 'Status');
  assert.equal(field('site').closest('[data-mission-field]').hidden, true);
  assert.equal(field('distance').closest('[data-mission-field]').hidden, true);
  assert.equal(field('speed').getAttribute('title'), '27,360 km/h');
  assert.equal(field('ascent-source').textContent, 'ESTIMATED');
  const payloadRows = field('payloads').querySelectorAll('tr');
  assert.equal(payloadRows.length, 2);
  assert.equal(
    payloadRows[0].querySelector('td').textContent.trim(),
    'Starlink <V2> ×21SpaceX',
  );
  assert.equal(payloadRows[0].querySelector('v2'), null);
  assert.equal(
    payloadRows[1].querySelector('.mission-table-empty').textContent.trim(),
    '+2 additional payload records',
  );
  assert.equal(field('stages-section').hidden, true);
  assert.equal(
    field('stages').textContent.trim(),
    'No stage re-entry or recovery data',
  );
  assert.equal(field('index').textContent, '2 / 3');
  assert.equal(field('prev').disabled, false);
  assert.equal(field('next').disabled, true);
  launches.show({ ...initial, detail: null, replay: REPLAY });
  assert.equal(panel.hidden, true);
  mounted.dispose();
  assert.equal(host.querySelector('#space-mission-panel'), null);
});

test('replay controls follow the layer and the speed reports the native value', () => {
  const { host, launches, mounted } = mountPanels({
    ...initial,
    detail: DETAIL,
    replay: { ...REPLAY, available: false },
  });
  const panel = host.querySelector('#space-mission-panel');
  const speedControl = panel.querySelector('.mission-replay-speed-control');
  const replay = panel.querySelector('[data-mission-replay]');
  const transport = panel.querySelector('[data-mission-replay-transport]');
  const toggle = panel.querySelector('[data-mission-replay-toggle]');
  const input = panel.querySelector('#space-mission-replay-speed');
  assert.equal(speedControl.hidden, true);
  assert.equal(replay.hidden, true);
  assert.equal(replay.disabled, true);
  assert.equal(transport.hidden, true);
  assert.deepEqual(
    ['min', 'max', 'step'].map((name) => input.getAttribute(name)),
    ['0.25', '4', '0.25'],
  );
  assert.equal(input.value, '1');
  launches.show({ ...initial, detail: DETAIL, replay: REPLAY });
  assert.equal(speedControl.hidden, false);
  assert.equal(replay.hidden, false);
  assert.equal(replay.getAttribute('aria-pressed'), 'false');
  launches.show({
    ...initial,
    detail: DETAIL,
    replay: {
      ...REPLAY,
      active: true,
      paused: true,
      phase: 'T minus 3, paused',
      speed: 2.5,
      speedText: '2.50×',
      progress: '60%',
    },
  });
  assert.equal(replay.hidden, true);
  assert.equal(replay.getAttribute('aria-pressed'), 'true');
  assert.equal(transport.hidden, false);
  assert.equal(transport.classList.contains('is-paused'), true);
  assert.equal(transport.getAttribute('aria-label'), 'T minus 3, paused');
  assert.equal(toggle.textContent.trim(), '▶');
  assert.equal(toggle.getAttribute('aria-label'), 'Resume replay');
  assert.equal(input.value, '2.5');
  assert.equal(input.style.getPropertyValue('--replay-speed-progress'), '60%');
  assert.equal(
    panel.querySelector('[data-mission-replay-speed-output]').textContent,
    '2.50×',
  );
  input.value = '3.25';
  input.dispatchEvent(new Event('input'));
  assert.deepEqual(launches.calls.at(-1), ['setReplaySpeed', '3.25']);
  mounted.dispose();
});

test('panel controls report to the layer', () => {
  const { host, launches, mounted } = mountPanels({
    ...initial,
    detail: { ...DETAIL, canNext: true },
    replay: { ...REPLAY, active: true },
  });
  for (const hook of [
    'close',
    'focus',
    'replay-toggle',
    'replay-cancel',
    'prev',
    'next',
    'show-all',
  ])
    host.querySelector(`[data-mission-${hook}]`).click();
  launches.show({ ...initial, detail: DETAIL, replay: REPLAY });
  host.querySelector('[data-mission-replay]').click();
  assert.deepEqual(
    launches.calls.map(([name]) => name),
    [
      'deselect',
      'focusSite',
      'togglePause',
      'cancelReplay',
      'previous',
      'next',
      'deselect',
      'replay',
    ],
  );
  mounted.dispose();
});

test('telemetry updates leave the roster rows in place', () => {
  const view = {
    ...initial,
    roster: { revision: 1, loaded: true, count: 3, items: ROSTER_ITEMS },
    detail: DETAIL,
    replay: REPLAY,
  };
  const { host, roster, launches, mounted } = mountPanels(view);
  const row = roster.querySelector('[data-mission-roster-id="mission-a"]');
  launches.show({ ...view, detail: { ...DETAIL, speed: '7.61 KM/S' } });
  assert.equal(
    host.querySelector('[data-mission-speed]').textContent,
    '7.61 KM/S',
  );
  assert.equal(
    roster.querySelector('[data-mission-roster-id="mission-a"]'),
    row,
  );
  mounted.dispose();
});

test('a roster refresh returns focus to the same mission, or past the list', () => {
  const launches = [
    { id: 'mission-a', name: 'Artemis', provider: 'NASA', launchTime: '' },
    { id: 'mission-b', name: 'Starlink', provider: 'SpaceX', launchTime: '' },
  ];
  const state = {
    _launches: launches,
    _missionView: initial,
    _missionRoster: null,
  };
  state._missionChannel = createStateChannel(() => state._missionView);
  const panel = createPanel({
    state,
    parts: {
      overlays: { shortMissionLabel: (name) => name },
      model: { missionMarkerColor: () => ({ toCssColorString: () => 'red' }) },
      policyHelpers: {
        missionRosterEntries: (items) =>
          items.map((launch, index) => ({ launch, index })).reverse(),
      },
    },
  });
  const focused = [];
  const host = container.appendChild(document.createElement('div'));
  const roster = host.appendChild(document.createElement('div'));
  state._missionRoster = roster;
  state._missionRosterPreviewOwnership = {
    reset: () => focused.push('reset'),
    focus: (index) => focused.push(index),
  };
  const mounted = mountMissionPanels(mountView, {
    roster,
    host,
    launches: {
      getMissionPanelView: () => state._missionChannel.getSnapshot(),
      subscribeMissionPanelView: (listener, options) =>
        state._missionChannel.subscribe(listener, options),
      getMissionPanelActions: () => ({
        ...launchesDouble(initial).getMissionPanelActions(),
        focus: (index) => state._missionRosterPreviewOwnership.focus(index),
      }),
    },
  });
  panel.renderMissionRoster();
  roster.querySelector('[data-mission-roster-id="mission-b"]').focus();
  state._launches = [launches[1], launches[0]];
  panel.renderMissionRoster();
  const active = document.activeElement;
  assert.equal(active.dataset.missionRosterId, 'mission-b');
  assert.equal(active.dataset.missionRosterIndex, '0');
  assert.deepEqual(focused, ['reset', 1, 'reset', 0]);
  state._launches = [launches[0]];
  panel.renderMissionRoster();
  assert.equal(
    document.activeElement,
    roster.querySelector('[data-mission-roster-focus-continuation]'),
  );
  mounted.dispose();
});
