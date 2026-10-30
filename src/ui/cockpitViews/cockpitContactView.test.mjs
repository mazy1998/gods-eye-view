import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../../testSupport/componentDom.mjs';

const { mountView } = await import('../mountView.js');
const { mountCockpitContact } = await import('../cockpitContact.js');
const { createStateChannel } = await import('../../app/stateChannel.js');
const { emptyContextReadout } = await import('../cockpitContext.js');

/** A stand-in for the Cockpit controller: its Contact view and operations. */
function cockpitDouble(contact) {
  const calls = [];
  let current = contact;
  const channel = createStateChannel(() => current);
  return {
    calls,
    show(next) {
      current = next;
      channel.publish();
    },
    getContactView: () => channel.getSnapshot(),
    subscribeContactView: (listener, options) =>
      channel.subscribe(listener, options),
    navigateContext: (direction, options) =>
      calls.push(['navigate', direction, options]),
    toggleContactPanel: () => calls.push(['toggle']),
    toggleWeather: () => calls.push(['weather']),
  };
}

const resting = {
  ...emptyContextReadout(),
  collapsed: false,
  weatherEnabled: false,
};

function mountPanel(contact = resting) {
  const panel = container.appendChild(document.createElement('aside'));
  panel.id = 'cockpit-context';
  const cockpit = cockpitDouble(contact);
  const mounted = mountCockpitContact(mountView, { panel, cockpit });
  return { panel, cockpit, mounted };
}

test('the Contact panel rests on its placeholders, weather off', () => {
  const { panel, mounted } = mountPanel();
  const $ = (selector) => panel.querySelector(selector);
  assert.equal($('.cockpit-context-kicker').textContent, 'CONTACT');
  assert.equal($('#cockpit-context-subject').textContent, 'CONTACTS · 250 KM');
  assert.equal(
    $('.cockpit-context-actions').getAttribute('aria-label'),
    'Contact navigation',
  );
  assert.equal(
    $('#cockpit-context-previous').getAttribute('aria-label'),
    'Previous — prior visited contact in the 250 km window',
  );
  assert.equal(
    $('#cockpit-context-next').getAttribute('aria-label'),
    'Next — nearest unvisited contact in the 250 km window',
  );
  assert.equal($('#cockpit-context-previous').disabled, false);
  assert.equal(
    $('#cockpit-context-toggle').getAttribute('aria-label'),
    'Collapse Contact panel',
  );
  assert.equal(
    $('#cockpit-context-toggle').getAttribute('aria-expanded'),
    'true',
  );
  assert.equal(panel.textContent.includes('GLOBAL CONTEXT'), false);
  assert.deepEqual(
    [...panel.querySelectorAll('[data-context-cohort]')].map((cell) => [
      cell.dataset.contextCohort,
      cell.querySelector('strong').textContent,
      cell.querySelector('small').textContent,
    ]),
    [
      ['flights', '—', 'OpenSky'],
      ['military', '—', 'adsb.lol'],
      ['ais-live-vessels', '—', 'AISStream'],
      ['military-installations', '—', 'OpenStreetMap'],
    ],
  );
  assert.equal(
    $('#cockpit-context-nearest-label').textContent,
    'NO AVAILABLE EXAMPLE',
  );
  assert.equal($('#cockpit-context-distance').textContent, '—');
  assert.equal($('#cockpit-context-updated').textContent, '--:--:--Z');
  const weather = $('#cockpit-weather-toggle');
  assert.equal(
    weather.getAttribute('aria-label'),
    'Enable cockpit weather effects',
  );
  assert.equal(weather.getAttribute('aria-pressed'), 'false');
  assert.equal($('#cockpit-weather-state').textContent, 'OFF');
  mounted.dispose();
  assert.equal(panel.childNodes.length, 0);
});

test('the Contact panel shows the readout, collapse and weather it is given', () => {
  const { panel, cockpit, mounted } = mountPanel();
  cockpit.show({
    ...resting,
    visible: true,
    state: 'uncertain',
    scope: 'EJA353 · 250 KM AIR/SEA WINDOW',
    canPrevious: false,
    cohorts: [
      { id: 'flights', count: '3', unknown: false },
      { id: 'ais-live-vessels', count: '?', unknown: true },
    ],
    nearest: 'FLIGHTS · <N1>',
    nearestLabel: 'FLIGHTS · <N1>',
    distance: '14 km',
    distanceLabel: '14 km',
    relative: -30,
    bearing: 'L 030°',
    uncertainty: '1 INPUT UNKNOWN · NOT AN ALL-CLEAR',
    updated: '12:00:00Z',
    collapsed: true,
    weatherEnabled: true,
  });
  const $ = (selector) => panel.querySelector(selector);
  assert.equal($('#cockpit-context-previous').disabled, true);
  const vessels = $('[data-context-cohort="ais-live-vessels"]');
  assert.equal(vessels.querySelector('strong').textContent, '?');
  assert.equal(vessels.classList.contains('unknown'), true);
  assert.equal($('[data-context-cohort="military"] strong').textContent, '—');
  assert.equal(
    $('#cockpit-context-nearest-label').textContent,
    'FLIGHTS · <N1>',
  );
  assert.equal($('#cockpit-context-nearest-label').querySelector('n1'), null);
  assert.equal(
    $('#cockpit-context-direction').style.transform,
    'rotate(-30deg)',
  );
  assert.equal($('#cockpit-context-bearing').textContent, 'L 030°');
  assert.equal(
    $('#cockpit-context-toggle').getAttribute('aria-label'),
    'Expand Contact panel',
  );
  assert.equal(
    $('#cockpit-context-toggle').getAttribute('aria-expanded'),
    'false',
  );
  assert.equal(
    $('#cockpit-context-toggle').textContent.trim(),
    'chevron_right',
  );
  assert.equal(
    $('#cockpit-weather-toggle').getAttribute('aria-label'),
    'Disable cockpit weather effects',
  );
  assert.equal(
    $('#cockpit-weather-toggle').getAttribute('aria-pressed'),
    'true',
  );
  assert.equal($('#cockpit-weather-state').textContent, 'ON');
  mounted.dispose();
});

test('Contact controls report to the Cockpit as the user', () => {
  const { panel, cockpit, mounted } = mountPanel();
  for (const id of [
    'cockpit-context-previous',
    'cockpit-context-next',
    'cockpit-context-toggle',
    'cockpit-weather-toggle',
  ])
    panel.querySelector(`#${id}`).click();
  assert.deepEqual(cockpit.calls, [
    ['navigate', -1, { origin: 'user' }],
    ['navigate', 1, { origin: 'user' }],
    ['toggle'],
    ['weather'],
  ]);
  mounted.dispose();
});
