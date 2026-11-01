import { Cartesian3 } from 'cesium';

/** Query loaded, enabled aircraft only. No Contacts session or source request. */
export function nearbyAircraft(layers, selected, info, cachedPosition = null) {
  const center =
    cachedPosition ||
    (Number.isFinite(info.latitude) && Number.isFinite(info.longitude)
      ? Cartesian3.fromDegrees(
          info.longitude,
          info.latitude,
          Number.isFinite(info.altitudeM) ? info.altitudeM : 0,
        )
      : null);
  if (!center) return [];
  const candidates = [];
  for (const layerId of ['flights', 'military']) {
    for (const row of layers[layerId]?.getNearby?.(center, Infinity, 4) || []) {
      candidates.push({
        layerId,
        id: String(row.icao24 || '').toLowerCase(),
        label: row.callsign || row.id,
        distanceM: row.distance,
        altitudeM: Number.isFinite(row.altitudeM)
          ? row.altitudeM
          : Number.isFinite(row.altitudeFt)
            ? row.altitudeFt * 0.3048
            : null,
      });
    }
  }
  for (const row of layers['local-adsb']?.getAnalystRecords?.(Infinity) || []) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
    const position = Cartesian3.fromDegrees(
      row.lon,
      row.lat,
      Number.isFinite(row.altitudeM) ? row.altitudeM : 0,
    );
    candidates.push({
      layerId: 'local-adsb',
      id: String(row.icao24 || '').toLowerCase(),
      label: row.callsign || row.icao24,
      distanceM: Cartesian3.distance(center, position),
      altitudeM: row.altitudeM,
    });
  }
  const seen = new Set([selected.icao]);
  return candidates
    .filter(
      (row) => row.id && Number.isFinite(row.distanceM) && row.distanceM >= 0,
    )
    .sort(
      (a, b) =>
        a.distanceM - b.distanceM ||
        `${a.layerId}:${a.id}`.localeCompare(`${b.layerId}:${b.id}`, 'en'),
    )
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .slice(0, 3)
    .map((row) => ({ ...row, key: `${row.layerId}:${row.id}` }));
}
