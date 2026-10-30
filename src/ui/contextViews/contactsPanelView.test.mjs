import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';

const { mountView } = await import('../mountView.js');
const { mountContactsPanel } = await import('../contactsPanel.js');
const { createStateChannel } = await import('../../app/stateChannel.js');

const RESULTS = {
  kind: 'results',
  revision: 3,
  subject: 'EJA353',
  window: '250 km',
  names: [],
  canPrevious: false,
  canNext: true,
  cohorts: [
    {
      id: 'flights',
      label: 'Flights',
      relationship: 'observed',
      count: '218',
      page: '2/4',
      source: 'adsb.lol',
      coverage: '',
      reason: 'observed or mapped nearby context',
      targets: [
        {
          key: 'flights:a1b2c3',
          layer: 'flights',
          id: 'a1b2c3',
          label: 'N30126',
          distance: '14 km',
          focusLabel: 'Focus N30126',
          names: [],
        },
        { key: 'unavailable:1', label: '—', distance: '20 km' },
      ],
    },
    {
      id: 'military-installations',
      label: 'Mapped installations',
      relationship: 'mapped',
      count: '?',
      page: '',
      source: 'OpenStreetMap',
      coverage: 'WITHIN 100 KM',
      reason: 'loading',
      targets: [
        {
          key: 'military-installations:w1',
          layer: 'military-installations',
          id: 'w1',
          label: 'Camp <Mabry>',
          distance: '9.4 km',
          focusLabel: 'Focus Camp <Mabry>',
          names: ['Area one', '<Area two>'],
        },
      ],
    },
  ],
};

/** A stand-in for the Contacts layer: its panel view and operations. */
function awarenessDouble(view) {
  const calls = [];
  let current = view;
  const channel = createStateChannel(() => current);
  return {
    calls,
    show(next) {
      current = next;
      channel.publish();
    },
    getPanelView: () => channel.getSnapshot(),
    subscribePanelView: (listener, options) =>
      channel.subscribe(listener, options),
    navigatePrevious: (options) => calls.push(['previous', options]),
    focusCurrent: (options) => calls.push(['focus', options]),
    navigateNext: (options) => calls.push(['next', options]),
    focusTarget: (layer, id, options) =>
      calls.push(['target', layer, id, options]),
  };
}

function mountPanel(view) {
  const panel = container.appendChild(document.createElement('aside'));
  panel.id = 'military-awareness-panel';
  const awareness = awarenessDouble(view);
  const mounted = mountContactsPanel(mountView, { panel, awareness });
  return { panel, awareness, mounted };
}

test('the panel shows the shipped standby until Contacts paints', () => {
  const { panel, awareness, mounted } = mountPanel({
    kind: 'initial',
    revision: 0,
  });
  assert.equal(
    panel.querySelector('.military-awareness-standby strong').textContent,
    'Contacts are off',
  );
  awareness.show({ kind: 'standby', ready: true, revision: 1 });
  assert.equal(
    panel.querySelector('.military-awareness-standby strong').textContent,
    'Ready',
  );
  awareness.show({ kind: 'empty', revision: 2 });
  assert.equal(panel.textContent.trim(), '');
  mounted.dispose();
  assert.equal(panel.childNodes.length, 0);
});

test('results read as the subject, its window, navigation and cohort rows', () => {
  const { panel, mounted } = mountPanel(RESULTS);
  assert.equal(
    panel.querySelector('.military-awareness-subject').textContent.trim(),
    'Near EJA353 · 250 km',
  );
  assert.equal(panel.querySelector('.military-awareness-heading'), null);
  const controls = panel.querySelector(
    '.military-awareness-controls[role="group"]',
  );
  assert.equal(
    controls.getAttribute('aria-label'),
    'Global Context navigation',
  );
  assert.equal(
    controls.querySelector('[data-awareness-action="previous"]').disabled,
    true,
  );
  assert.equal(
    controls.querySelector('[data-awareness-action="next"]').disabled,
    false,
  );
  const rows = [...panel.querySelectorAll('.military-awareness-row')];
  assert.deepEqual(
    rows.map((row) => [
      row.className,
      row.querySelector('strong').textContent,
      row.querySelector('b').textContent,
      row.querySelector('b').getAttribute('aria-live'),
      row.querySelector('small').textContent,
    ]),
    [
      [
        'military-awareness-row observed',
        'Flights',
        '218 · 2/4',
        'polite',
        'adsb.lol · observed or mapped nearby context',
      ],
      [
        'military-awareness-row mapped',
        'Mapped installations',
        '?',
        'polite',
        'OpenStreetMap · WITHIN 100 KM · loading',
      ],
    ],
  );
  const target = rows[0].querySelector('button[data-awareness-id]');
  assert.equal(target.dataset.awarenessLayer, 'flights');
  assert.equal(target.dataset.awarenessId, 'a1b2c3');
  assert.equal(target.getAttribute('aria-label'), 'Focus N30126');
  assert.equal(target.childNodes[0].textContent.trim(), 'N30126');
  assert.equal(target.querySelector('span').textContent, '14 km');
  const unavailable = rows[0].querySelector(
    '.military-awareness-target.unavailable',
  );
  assert.equal(unavailable.tagName, 'SPAN');
  assert.deepEqual(
    rows.map((row) =>
      [...row.querySelectorAll('.military-awareness-glyph')].map((glyph) => [
        glyph.textContent,
        glyph.getAttribute('aria-hidden'),
        glyph.nextElementSibling.dataset.awarenessId,
      ]),
    ),
    [[['flight', 'true', 'a1b2c3']], [['account_balance', 'true', 'w1']]],
    'a glyph beside each contact, outside its button',
  );
  assert.equal(unavailable.getAttribute('aria-label'), 'Unavailable');
  mounted.dispose();
});

test('the end of the list is the explanatory note focus continues to', () => {
  const { panel, mounted } = mountPanel(RESULTS);
  const note = panel.querySelector('[data-awareness-focus-continuation]');
  assert.equal(note.tagName, 'P');
  assert.equal(note.className, 'military-awareness-note');
  assert.equal(note.getAttribute('tabindex'), '-1');
  assert.match(note.textContent, /not evidence of absence\.$/);
  assert.equal(
    note.previousElementSibling.className,
    'military-awareness-row mapped',
  );
  mounted.dispose();
});

test('the selected contact closes the panel with its cohort and source', () => {
  const { panel, awareness, mounted } = mountPanel({
    ...RESULTS,
    subjectSource: 'Flights · adsb.lol',
  });
  const selected = panel.lastElementChild;
  assert.equal(selected.className, 'military-awareness-selected');
  assert.equal(selected.getAttribute('aria-label'), 'Selected contact');
  assert.equal(selected.querySelector('h3').textContent, 'EJA353');
  assert.equal(selected.querySelector('p').textContent, 'Flights · adsb.lol');
  assert.equal(
    selected.previousElementSibling.dataset.awarenessFocusContinuation,
    '',
  );
  awareness.show({ ...RESULTS, revision: 4, subjectSource: '' });
  assert.equal(panel.lastElementChild.querySelector('p'), null);
  mounted.dispose();
});

test('names, callsigns and areas render as text', () => {
  const { panel, mounted } = mountPanel(RESULTS);
  const site = panel.querySelector('[data-awareness-id="w1"]');
  assert.equal(site.childNodes[0].textContent.trim(), 'Camp <Mabry>');
  assert.equal(site.querySelector('mabry'), null);
  const areas = site.parentElement.querySelector('.military-awareness-names');
  assert.equal(
    areas.querySelector('summary').textContent.trim(),
    'Named areas (2)',
  );
  assert.equal(areas.querySelector('div').textContent, 'Area one<Area two>');
  assert.equal(areas.querySelectorAll('div br').length, 1);
  assert.equal(areas.querySelector('area'), null);
  mounted.dispose();
});

test('controls report to the Contacts layer as the user', () => {
  const { panel, awareness, mounted } = mountPanel({
    ...RESULTS,
    canPrevious: true,
  });
  for (const action of ['previous', 'focus', 'next'])
    panel.querySelector(`[data-awareness-action="${action}"]`).click();
  panel.querySelector('[data-awareness-id="a1b2c3"]').click();
  assert.deepEqual(awareness.calls, [
    ['previous', { origin: 'user' }],
    ['focus', { origin: 'user' }],
    ['next', { origin: 'user' }],
    ['target', 'flights', 'a1b2c3', { origin: 'user' }],
  ]);
  mounted.dispose();
});

test('an open Named areas list closes when the panel content changes', () => {
  const { panel, awareness, mounted } = mountPanel(RESULTS);
  const areas = () => panel.querySelector('.military-awareness-names');
  areas().open = true;
  const button = panel.querySelector('[data-awareness-id="a1b2c3"]');
  awareness.show({ ...RESULTS, canPrevious: true });
  assert.equal(areas().open, true, 'the same revision keeps it open');
  awareness.show({ ...RESULTS, revision: RESULTS.revision + 1 });
  assert.equal(areas().open, false, 'new content closes it, as it did');
  assert.equal(
    panel.querySelector('[data-awareness-id="a1b2c3"]'),
    button,
    'a contact that stays keeps its button, and with it any focus',
  );
  mounted.dispose();
});
