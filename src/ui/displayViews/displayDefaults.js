/**
 * What the Display groups show before the visual owner is connected: the
 * values the legacy markup shipped, so the first paint matches it.
 */
export const displayDefaults = Object.freeze({
  hud: { visible: false, variant: 'tactical' },
  sonar: {
    enabled: true,
    rings: 8,
    range: 100,
    intensity: 70,
    opacity: 84,
    sector: 24,
  },
  detection: {
    mode: 'OFF',
    density: 50,
    allocation: 'ELASTIC',
    fadePct: 7,
    outsideOpacityPct: 1,
  },
  models3d: { enabled: true, mode: 'proximity' },
  scope: { enabled: true, featherPct: 100 },
  celestial: { enabled: false, eligible: true },
  cleanView: false,
  bloom: { enabled: false, intensity: 0 },
  sharpen: { enabled: false, intensity: 49 },
});
