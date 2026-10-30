import { msg } from '../i18n/marker.js';

export const MOBILE_MORE_DESTINATIONS = Object.freeze(
  [
    {
      id: 'map',
      label: msg('Map & Look'),
      panels: ['pp-toggles'],
      elements: [],
    },
    {
      id: 'stories',
      label: msg('Stories'),
      panels: ['scene-panel'],
      elements: [],
    },
    {
      id: 'tools',
      label: msg('Tools'),
      panels: [],
      elements: [
        'geo-import-group',
        'draw-group',
        'directions-controls-body',
        'tools-scene-import',
      ],
    },
    {
      id: 'settings',
      label: msg('Settings'),
      panels: [],
      elements: [],
    },
  ].map((item) =>
    Object.freeze({
      ...item,
      panels: Object.freeze(item.panels),
      elements: Object.freeze(item.elements),
    }),
  ),
);

export const MOBILE_SHEET_PANELS = Object.freeze({
  layers: Object.freeze([
    'data-panel',
    'weather-panel',
    'recent-imagery-panel',
  ]),
  inspect: Object.freeze([
    'global-context-panel',
    'cctv-panel',
    'street-level-panel',
  ]),
  search: Object.freeze(['location-bar']),
  more: Object.freeze(MOBILE_MORE_DESTINATIONS.flatMap((item) => item.panels)),
});
export const MOBILE_SHEET_ELEMENTS = Object.freeze({
  layers: Object.freeze(['radio-panel']),
});
export const MOBILE_TABS = Object.freeze(
  [
    { sheet: 'layers', label: msg('Layers'), icon: 'layers' },
    { sheet: 'inspect', label: msg('Inspect'), icon: 'my_location' },
    { sheet: 'search', label: msg('Search'), icon: 'search' },
    { sheet: 'more', label: msg('More'), icon: 'more_horiz' },
  ].map(Object.freeze),
);
