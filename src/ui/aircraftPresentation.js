import { formatNumber, t } from '../i18n/index.js';
import { formatQuantity } from './unitLabels.js';

/** A selected owner's measurements, not values parsed from its on-globe label. */
export function aircraftPresentation(info, now = Date.now()) {
  const text = (value) => String(value ?? '').trim();
  const number = (value, digits = 0) =>
    Number.isFinite(value)
      ? formatNumber(value, { maximumFractionDigits: digits })
      : '—';
  const measure = (value, unit, digits = 0) =>
    Number.isFinite(value)
      ? formatQuantity(value, unit, {
          useGrouping: true,
          maximumFractionDigits: digits,
        })
      : '—';
  const row = (label, value) => ({ label, value });
  const identity = [
    row('ICAO', text(info.icao24).toUpperCase()),
    row(t('Registration'), text(info.registration)),
  ].filter((item) => item.value);
  const route = [
    row(t('Origin'), text(info.origin)),
    row(t('Destination'), text(info.destination)),
  ].filter((item) => item.value);
  const received = Number.isFinite(info.lastContactAtMs)
    ? t('Received {seconds} s ago', {
        seconds: number(
          Math.max(0, Math.floor((now - info.lastContactAtMs) / 1000)),
        ),
      })
    : t('Receive time unavailable');
  return {
    title:
      text(info.callsign) ||
      text(info.registration) ||
      text(info.icao24) ||
      t('Aircraft'),
    subtitle: [
      text(info.typeName || info.typeCode),
      text(info.airline || info.operator),
    ]
      .filter(Boolean)
      .join(' · '),
    identity,
    telemetry: [
      row(
        t('Altitude'),
        info.onGround
          ? t('On ground')
          : measure(
              Number.isFinite(info.altitudeM) ? info.altitudeM / 0.3048 : null,
              'ft',
            ),
      ),
      row(
        t('Ground speed'),
        measure(
          Number.isFinite(info.velocityMps)
            ? info.velocityMps * 1.9438444924406
            : null,
          'kt',
        ),
      ),
      row(
        t('Ground track'),
        Number.isFinite(info.track)
          ? `${number(((info.track % 360) + 360) % 360)}°`
          : '—',
      ),
      row(
        t('Vertical speed'),
        measure(
          Number.isFinite(info.verticalRateMps)
            ? (info.verticalRateMps * 60) / 0.3048
            : null,
          'ft/min',
        ),
      ),
      row(t('Squawk'), text(info.squawk) || '—'),
      row(
        t('Position'),
        Number.isFinite(info.latitude) && Number.isFinite(info.longitude)
          ? `${number(info.latitude, 4)}, ${number(info.longitude, 4)}`
          : '—',
      ),
    ],
    route,
    source: text(info.source) || '—',
    sourceLabel: t('Source'),
    received,
    stale: info.stale ? t('Stale source') : '',
    emergency: text(info.emergencyBroadcast),
  };
}
