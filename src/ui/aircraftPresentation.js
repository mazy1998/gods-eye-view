import { formatNumber, t } from '../i18n/index.js';
import { AIRCRAFT_CLASS_LABELS } from '../data/aircraftClass.js';
import { formatQuantity, quantitySeparator, unitLabel } from './unitLabels.js';

/** Format existing selected-owner data; missing measurements are omitted. */
export function aircraftPresentation(info, now = Date.now(), nearby = []) {
  const text = (value) => String(value ?? '').trim();
  const number = (value, digits = 0) =>
    formatNumber(value, { maximumFractionDigits: digits });
  const measure = (value, unit, digits = 0) =>
    Number.isFinite(value)
      ? formatQuantity(value, unit, {
          useGrouping: true,
          maximumFractionDigits: digits,
        })
      : '';
  const row = (label, value) => ({ label, value });
  const metric = (label, value, unit) =>
    Number.isFinite(value)
      ? {
          label,
          value: measure(value, unit),
          number: number(value),
          unit: unitLabel(unit),
          separator: quantitySeparator(unitLabel(unit)),
        }
      : null;
  const altitude = Number.isFinite(info.altitudeM)
    ? info.altitudeM / 0.3048
    : null;
  const speed = Number.isFinite(info.velocityMps)
    ? info.velocityMps * 1.9438444924406
    : null;
  const track = Number.isFinite(info.track)
    ? ((Math.round(info.track) % 360) + 360) % 360
    : null;
  const telemetry = [
    info.onGround
      ? {
          label: t('Altitude'),
          value: t('On ground'),
          number: t('On ground'),
          unit: '',
          separator: '',
        }
      : metric(t('Altitude'), altitude, 'ft'),
    metric(t('Ground speed'), speed, 'kt'),
    track === null
      ? null
      : {
          label: t('Ground track'),
          value: `${number(track)}°`,
          number: number(track),
          unit: '°',
          separator: '',
        },
  ].filter(Boolean);
  const details = [
    row(t('Type'), text(info.typeName || info.typeCode)),
    row(t('Registration'), text(info.registration)),
    row('ICAO24', text(info.icao24).toUpperCase()),
    row(t('Callsign'), text(info.callsign)),
    row(
      t('Vertical speed'),
      measure(
        Number.isFinite(info.verticalRateMps)
          ? (info.verticalRateMps * 60) / 0.3048
          : null,
        'ft/min',
      ),
    ),
    row(t('Squawk'), text(info.squawk)),
    row(
      t('Category'),
      AIRCRAFT_CLASS_LABELS[info.category]
        ? t(AIRCRAFT_CLASS_LABELS[info.category])
        : text(info.category),
    ),
  ].filter((item) => item.value);
  const endpoint = (airport, fallback) => ({
    code: text(airport?.code || fallback),
    name: text(airport?.name),
  });
  const origin = endpoint(info.route?.origin, info.origin);
  const destination = endpoint(info.route?.destination, info.destination);
  return {
    title:
      text(info.callsign) ||
      text(info.registration) ||
      text(info.icao24) ||
      t('Aircraft'),
    kind:
      info.layerId === 'military'
        ? t('Military')
        : info.layerId === 'local-adsb'
          ? t('Local ADS-B')
          : t('Flight'),
    operator: text(info.airline || info.operator),
    telemetry,
    details,
    route: origin.code && destination.code ? { origin, destination } : null,
    nearby: nearby.map((contact) => ({
      key: contact.key,
      label: text(contact.label) || contact.id.toUpperCase(),
      distance: measure(contact.distanceM / 1000, 'km', 1),
      altitude: measure(
        Number.isFinite(contact.altitudeM) ? contact.altitudeM / 0.3048 : null,
        'ft',
      ),
    })),
    source: text(info.source) || '',
    sourceLabel: t('Source'),
    received: Number.isFinite(info.lastContactAtMs)
      ? t('Received {seconds} s ago', {
          seconds: number(
            Math.max(0, Math.floor((now - info.lastContactAtMs) / 1000)),
          ),
        })
      : t('Receive time unavailable'),
    stale: info.stale ? t('Stale source') : '',
    emergency: text(info.emergencyBroadcast),
  };
}
