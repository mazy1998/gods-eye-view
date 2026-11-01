import test from 'node:test';
import assert from 'node:assert/strict';
import { Cartesian3 } from 'cesium';
import { nearbyAircraft } from './aircraftNearby.js';

test('Nearby merges loaded source queries, excludes the subject and deduplicates ICAOs', () => {
  const calls = [];
  const query = (rows) => (center, range, limit) => {
    calls.push({ center, range, limit });
    return rows;
  };
  const center = Cartesian3.fromDegrees(0, 0, 1000);
  const rows = nearbyAircraft(
    {
      flights: {
        getNearby: query([
          { icao24: 'self', distance: 0 },
          { icao24: 'dup', id: 'CIV', distance: 500, altitudeM: 3048 },
          { icao24: 'far', distance: 700 },
        ]),
      },
      military: {
        getNearby: query([
          { icao24: 'mil', id: 'MIL', distance: 200, altitudeFt: 10000 },
          { icao24: 'dup', distance: 600 },
        ]),
      },
      'local-adsb': {
        getAnalystRecords: () => [
          {
            icao24: 'loc',
            callsign: 'LOCAL',
            lat: 0,
            lon: 0.001,
            altitudeM: 1000,
          },
          { icao24: 'bad', lat: null, lon: null },
        ],
      },
    },
    { icao: 'self' },
    {},
    center,
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ['local-adsb:loc', 'military:mil', 'flights:dup'],
  );
  assert.equal(rows[1].altitudeM, 3048);
  assert.equal(rows[2].label, 'CIV');
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (call) =>
        call.center === center && call.range === Infinity && call.limit === 4,
    ),
  );
});

test('missing position and disabled source snapshots produce no invented nearby contacts', () => {
  assert.deepEqual(nearbyAircraft({}, { icao: 'a' }, {}), []);
  assert.deepEqual(
    nearbyAircraft(
      {
        flights: { getNearby: () => [] },
        'local-adsb': { getAnalystRecords: () => [] },
      },
      { icao: 'a' },
      { latitude: 0, longitude: 0 },
    ),
    [],
  );
});
