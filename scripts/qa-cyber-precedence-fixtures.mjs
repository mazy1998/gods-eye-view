import layersStructure from './qa-cyber-layers-structure.json' with { type: 'json' };
import storiesStructure from './qa-cyber-stories-structure.json' with { type: 'json' };
import inspectStructure from './qa-cyber-inspect-structure.json' with { type: 'json' };
/** CSS-only samples mirroring the interactive classes/contexts of each port. */
const b = (key, cls = '', attrs = '', text = key) =>
  `<button type="button" data-audit="${key}" class="${cls}" ${attrs}>${text}</button>`;
const input = (key, cls = '', type = 'text', attrs = '') =>
  `<input data-audit="${key}" class="${cls}" type="${type}" value="25" ${attrs}>`;
const select = (key, cls = '', attrs = '') =>
  `<select data-audit="${key}" class="${cls}" ${attrs}><option>Sample</option></select>`;
const legacyActions = [
  '',
  '--danger',
  '--compact',
  '--compact gev-action-button--danger',
]
  .map((v, i) =>
    b(
      `action-${i}`,
      `gev-action-button${v}`,
      `data-state-active data-state-pressed`,
    ),
  )
  .join('');
const primitiveHtml = `<div class="gev-surface">${b('icon', 'gev-icon-button', 'data-state-pressed')}${b('icon-sm', 'gev-icon-button gev-icon-button--sm', 'data-state-pressed')}${b('toggle', 'gev-toggle', 'data-state-checked', `<span class="gev-toggle-track" data-probe="track"><span class="gev-toggle-thumb" data-probe="thumb"></span></span><span class="gev-toggle-label">Toggle</span>`)}${b('tab', 'gev-tab', 'data-state-selected')}${b('disclosure', 'gev-disclosure-row', '', 'Disclosure')}${b('chip', 'gev-chip', 'data-state-pressed')}${legacyActions}${input('text', 'gev-field')}${input('number', 'gev-field', 'number')}${select('select', 'gev-field')}${input('compact-text', 'gev-field gev-field--compact')}${input('compact-number', 'gev-field gev-field--compact', 'number')}${input('inline-number', 'gev-field gev-field--inline', 'number')}${select('inline-select', 'gev-field gev-field--inline')}${select('compact-select', 'gev-field gev-field--compact')}${input('range', 'gev-quantitative-slider', 'range')}${b('segment', 'gev-segment', 'role="radio" data-state-checked')}</div>`;
const locationHtml = `<div id="command-dock"><section id="location-bar" class="gev-surface"><div class="location-inner dock-popover-content">${b('place', 'location-pill', 'data-state-active')}${b('poi', 'poi-pill', 'data-state-active')}${b('pin', 'dock-pin-btn', 'data-state-pressed')}<div class="location-search-wrap gev-location-search gev-surface">${b('search', 'search-toggle-btn', 'id="search-toggle"')}${input('search-input', '', 'text', 'id="location-search"')}</div><div class="gev-location-results gev-surface"><div class="gev-location-result" data-audit="result-row">${b('fly', 'gev-location-fly')}</div></div></div></section></div><div class="gev-location-search gev-surface">${b('header-search', 'search-toggle-btn')}${input('header-input', '', 'text', 'id="location-search"')}</div><div class="gev-location-results gev-surface">${b('header-fly', 'gev-location-fly')}</div>`;
const toolIcon = (key, className = 'gev-tools-icon') => {
  const shape =
    key === 'draw-icon'
      ? '<path d="m3 21 1-6L16 3l5 5L9 20l-6 1Zm10-15 5 5M4 15l5 5" />'
      : key === 'directions-icon'
        ? '<circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M6 15V8a2 2 0 0 1 2-2h2m-1 12h7a2 2 0 0 0 2-2v-3" />'
        : '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />';
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${key === 'import-icon' ? '1.6' : '1.5'}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-audit="${key}">${shape}</svg>`;
};
const toolsHtml = `<div class="gev-drawer-body"><div class="gev-legacy-host"><section id="geo-import-group" class="pp-toggle-group gev-tools gev-surface" data-audit="import-frame"><header class="gev-tools-header">${toolIcon('import-icon')}<h3 class="gev-tools-title" data-audit="import-title">Import</h3><span class="gev-tools-count" data-audit="import-count">1</span></header><div class="gev-tools-drop-guide" data-audit="drop-guide">${toolIcon('upload-icon', 'gev-tools-upload')}<p class="gev-tools-prompt" data-audit="import-prompt">Drop map files onto the globe</p><p class="gev-tools-meta" data-audit="import-formats">GeoJSON · KML · KMZ · GPX</p>${b('choose-files', 'gev-action-button gev-action-button--compact', 'id="geo-import-button"', 'Choose files')}</div><ul class="geo-import-list visible"><li class="geo-import-row" data-audit="import-row"><span class="geo-import-swatch own-styles" data-audit="import-swatch"></span>${b('import-toggle', 'geo-import-action', 'data-state-pressed')}${b('import-fly', 'geo-import-action')}${b('import-remove', 'geo-import-action')}</li></ul>${b('import-scene', 'gev-action-button gev-action-button--compact gev-tools-scene-link', 'id="geo-import-scene"', 'Import scene<span aria-hidden="true">→</span>')}</section><section id="draw-group" class="pp-toggle-group gev-tools gev-surface" data-audit="draw-frame"><h3 class="gev-tools-title gev-tools-draw-header">${b('draw', 'pp-toggle-btn', 'id="draw-toggle" data-state-active data-state-pressed aria-label="Draw"', `${toolIcon('draw-icon', 'pp-icon gev-tools-icon')}<span class="pp-label" data-audit="draw-title">Draw</span><span class="gev-tools-state" aria-hidden="true" data-audit="draw-state">OFF</span>`)}</h3><div class="pp-slider-row visible"><div class="gev-segmented pp-mode-seg">${['area', 'line', 'pin'].map((x) => b(`shape-${x}`, 'gev-segment pp-mode-btn', 'role="radio" data-state-active data-state-checked')).join('')}</div></div><div id="draw-label-row" class="pp-slider-row visible">${input('draw-label', 'pp-text-input', 'text', 'id="draw-label-input"')}${select('draw-color', 'pp-select draw-color-select gev-field gev-field--compact', 'id="draw-color-select"')}${b('clear-board', 'draw-clear-btn gev-action-button gev-action-button--compact gev-action-button--danger', 'id="draw-clear"')}</div></section></div></div>`;
const inspectHtml = `<div class="gev-legacy-host"><div id="global-context-panel" class="panel-collapsible" data-context-mode="flights"><div class="global-context-panel-inner"><div class="panel-header"><span class="panel-title">CONTEXT</span><span class="panel-divider"></span><div id="context-radio-dock" class="context-radio-dock">${b('radio-toggle', 'context-radio-toggle', 'data-state-active', '<span class="material-symbols-outlined">radio</span>')}</div>${b('collapse', 'panel-collapse-btn')}</div><div class="cyber-panel-body"><div class="global-context-modes" role="tablist">${b('mode-contacts', 'context-mode-button', 'id="global-context-flights-btn" role="tab" aria-selected="true" data-state-active data-state-selected', '<span class="material-symbols-outlined">radar</span><span>Contacts</span>')}${b('mode-missions', 'context-mode-button', 'id="global-context-missions-btn" role="tab" aria-selected="false" data-state-selected', '<span class="material-symbols-outlined">rocket_launch</span><span>Missions</span>')}</div><div id="context-mode-standby" class="context-mode-standby"><strong data-audit="standby-title">Choose what to inspect</strong><span data-audit="standby-copy">Contacts — nearest planes, vessels and sites</span></div><section id="context-flights-view" class="context-mode-view"><aside id="military-awareness-panel"><div class="military-awareness-standby"><strong data-audit="awareness-standby">Ready</strong><span>Select a flight, vessel or mapped installation</span></div><div class="military-awareness-subject" data-audit="caption">Near EJA353 · 250 km</div><details class="military-awareness-names"><summary data-audit="names">Named areas (2)</summary><div>Area</div></details><div class="military-awareness-controls" role="group">${b('previous', '', 'data-awareness-action="previous"', 'Previous')}${b('focus', '', 'data-awareness-action="focus"', 'Focus')}${b('next', '', 'data-awareness-action="next" disabled', 'Next')}</div><section class="military-awareness-row observed"><div><strong data-audit="cohort">Flights</strong><b data-audit="count">218 · 2/4</b></div><small data-audit="source">adsb.lol · observed or mapped nearby context</small><ul><li>${b('target', 'military-awareness-target', 'data-awareness-layer="flights" data-awareness-id="a1"', 'N30126 <span data-probe="distance">14 km</span>')}</li><li><span class="military-awareness-target unavailable" data-audit="unavailable">— <span>20 km</span></span></li></ul></section><section class="military-awareness-row mapped">${b('site', 'military-awareness-target', 'data-awareness-layer="military-installations" data-awareness-id="w1"', 'Camp Mabry <span>9.4 km</span>')}</section><p class="military-awareness-note" tabindex="-1" data-awareness-focus-continuation data-audit="note">Open-source mapped/observed context.</p><section class="military-awareness-selected"><h3 data-audit="selected-name">EJA353</h3><p data-audit="selected-source">Flights · adsb.lol</p></section></aside><div class="global-context-actions">${b('cockpit', '', 'id="cockpit-entry"', '<span class="material-symbols-outlined">flight</span><span>Enter cockpit</span>')}${b('nearby', 'panel-layer-toggle', 'id="installations-search-btn" data-state-active', '<span class="material-symbols-outlined">account_balance</span><span>Search nearby sites</span>')}${b('tr3b', 'tr3b-toggle', 'id="tr3b-toggle" aria-pressed="false" data-state-pressed', '<span class="tr3b-toggle-glyph">🛸</span><span class="tr3b-toggle-label" data-probe="label">Reclassify as TR-3B</span>')}</div></section><section id="context-missions-view" class="context-mode-view"><div id="space-mission-panel-host"><div id="space-mission-roster" class="space-mission-roster"><div class="space-mission-roster-header"><div><strong data-audit="roster-title">Available missions</strong><span>Select a mission to inspect</span></div><output data-audit="roster-count">19 in 30 days</output></div><div class="space-mission-roster-list">${b('roster-item', 'space-mission-roster-item', 'data-mission-roster-index="0" data-mission-roster-id="m1"', '<span class="space-mission-roster-marker" style="--mission-roster-color:rgb(76,201,240)"></span><span class="space-mission-roster-copy"><strong data-probe="name">Falcon 9 Block 5</strong><small>SpaceX · 2026-10-13</small></span><span class="space-mission-roster-chevron">›</span>')}</div><p class="space-mission-roster-focus-continuation" tabindex="-1" data-audit="roster-hint">Tab previews a mission; Enter or Space selects it</p></div><aside id="space-mission-panel" class="context-space-mission-detail"><div class="space-mission-view-header"><span data-audit="mission-kicker">Selected mission</span>${b('mission-close', '', 'data-mission-close', '×')}</div><div class="space-mission-detail"><strong data-mission-title data-audit="mission-title">Falcon 9 Block 5</strong><span data-mission-field data-mission-provider data-audit="mission-provider">SpaceX</span><span data-mission-field data-audit="mission-fact"><small>Status</small><b data-mission-status data-probe="value">Launch Successful</b></span></div><section class="mission-data-section"><h4 data-audit="mission-section">Payload</h4><div class="mission-table-scroll"><table class="mission-data-table"><thead><tr><th data-audit="mission-th">Name</th></tr></thead><tbody><tr><td data-audit="mission-td">Starlink<small>SpaceX</small></td></tr><tr><td class="mission-table-empty" data-audit="mission-empty">No payload data</td></tr></tbody></table></div></section><div class="mission-replay-speed-control"><div class="mission-replay-speed-header"><label for="space-mission-replay-speed" data-audit="speed-label">Replay speed</label><output class="gev-slider-value" data-audit="speed-value">1×</output></div>${input('speed', 'gev-quantitative-slider', 'range', 'id="space-mission-replay-speed" min="0.25" max="4" step="0.25"')}<div class="mission-replay-speed-scale" data-audit="speed-scale"><span>0.25×</span></div></div><div class="mission-action-row">${b('mission-focus', 'mission-focus-button', 'data-mission-focus', 'Focus')}${b('mission-replay', 'mission-replay-button', 'data-mission-replay aria-pressed="false" data-state-pressed', 'Replay ascent')}<div class="mission-replay-transport is-paused" data-mission-replay-transport>${b('replay-toggle', '', 'data-mission-replay-toggle', '▶')}${b('replay-cancel', 'cancel', 'data-mission-replay-cancel', '×')}</div></div><div class="space-mission-nav">${b('mission-previous', 'mission-nav-button', 'data-mission-prev disabled', '‹ Previous')}<span class="mission-nav-index" data-audit="mission-index">1 / 19</span>${b('mission-next', 'mission-nav-button', 'data-mission-next', 'Next ›')}</div>${b('mission-show-all', 'panel-layer-toggle', 'data-mission-show-all', 'Show all missions')}</aside></div></section></div></div></div></div>`;
const layerHtml = `<section class="layer-browser gev-surface"><div class="layer-search"><span class="material-symbols-outlined" aria-hidden="true" data-audit="layer-search-glyph">search</span>${input('layer-filter', 'layer-filter')}</div><div class="data-toggle-row" data-audit="layer-row"><span class="data-icon material-symbols-outlined" aria-hidden="true" data-audit="layer-icon">flight</span><span class="data-name" data-audit="layer-name">Flights</span><span class="data-toggle-meta" data-audit="layer-meta">Flights · live</span>${b('layer-toggle', 'data-toggle-btn gev-toggle', 'data-state-checked', `<span class="gev-toggle-track" data-probe="track"><span class="gev-toggle-thumb" data-probe="thumb"></span></span>`)}${b('layer-details', 'layer-details')}<div class="data-toggle-controls">${b('layer-chip', 'data-toggle-chip', 'data-state-active data-state-pressed')}</div><ol class="data-row-list"><li>${b('layer-list', 'data-row-list-item', 'data-state-active data-state-current')}</li></ol></div>${b('layer-category', 'gev-action-button layer-category', 'aria-expanded="false" aria-controls="layer-category-0"', '<span class="material-symbols-outlined">satellite_alt</span><span>Space</span><span class="material-symbols-outlined">chevron_right</span>')}${b('layer-category-back', 'gev-action-button layer-category-back', '', 'Back to layers')}${b('layer-category-open', 'gev-action-button layer-category', 'aria-expanded="true" aria-controls="layer-category-1"', '<span class="material-symbols-outlined">air</span><span>Environment</span><span class="material-symbols-outlined">expand_more</span>')}<div class="data-toggle-row layer-route-row" data-layer-id="directions">${b('layer-route-link', 'gev-action-button layer-route-link', 'aria-controls="directions-controls-body"', '<span>Route planning → Tools / Directions</span><span class="material-symbols-outlined">chevron_right</span>')}</div><footer class="layer-footer" data-audit="layer-footer-frame">${b('clear-layers', 'gev-action-button')}${b('layer-footer-link', 'gev-action-button')}</footer><div class="layer-import" data-audit="layer-import-frame">${b('layer-import', 'gev-action-button gev-action-button--compact')}</div></section>`;
const weatherHtml = `<section class="weather-readout weather-controls gev-surface"><article class="rail-card weather-card is-open">${b('weather-disclosure', 'rail-card-header')}<div class="rail-card-body"><div class="rail-card-settings">${['model', 'field', 'units', 'motion', 'region', 'image', 'opacity'].map((x) => `<div class="rail-card-setting"><div class="rail-card-chips">${b(`weather-${x}`, 'gev-chip data-toggle-chip', 'data-state-active data-state-pressed')}</div></div>`).join('')}${input('cloud-filter', 'gev-quantitative-slider rail-card-setting-range', 'range')}</div><ol class="data-row-list"><li>${b('weather-roster', 'data-row-list-item', 'data-state-active')}</li></ol><footer class="rail-card-actions">${b('weather-action', 'data-toggle-chip')}<a data-audit="advisory" href="#" class="data-toggle-chip">Official advisory</a></footer><div class="rail-card-result">${b('clear-reading', 'data-toggle-chip')}</div></div></article><section class="rail-timeline">${b('earlier', 'data-toggle-chip')}${input('timeline', 'weather-timeline gev-quantitative-slider', 'range')}${b('later', 'data-toggle-chip')}${b('latest', 'data-toggle-chip', 'data-state-active data-state-pressed')}${b('play', 'data-toggle-chip', 'data-state-active data-state-pressed')}</section></section>`;
const imageryHtml = `<section id="recent-imagery-panel"><div class="recent-imagery-panel-inner gev-surface"><div id="recent-imagery-panel-body"><section class="recent-imagery-readout"><div class="ri-actions-row rail-card-actions">${['select-box', 'use-view', 'clear', 'zoom-in'].map((x) => b(x, 'data-toggle-chip', x === 'select-box' ? 'data-state-active data-state-pressed' : '')).join('')}</div><div class="ri-strip" data-audit="imagery-strip" tabindex="0"><div class="ri-card" data-audit="imagery-card" tabindex="0"><div class="ri-card-chips">${b('pin-a', 'data-toggle-chip', 'data-state-active data-state-pressed')}${b('pin-b', 'data-toggle-chip', 'data-state-active data-state-pressed')}</div></div></div><div class="ri-selection">${['image', 'vs', 'ab'].map((x) => b(`mode-${x}`, 'ri-mode-btn data-toggle-chip', 'data-state-active data-state-checked')).join('')}${b('unpin-a', 'data-toggle-chip')}${b('unpin-b', 'data-toggle-chip')}</div>${input('imagery-opacity', 'gev-quantitative-slider', 'range')}${b('swap', 'data-toggle-chip', 'data-state-active data-state-pressed')}<div class="ri-exports rail-card-actions">${b('export-a', 'data-toggle-chip')}${b('export-b', 'data-toggle-chip')}</div><div class="ri-details rail-card">${b('imagery-details', 'rail-card-header')}<div class="rail-card-actions">${b('empty-days', 'data-toggle-chip')}</div></div></section></div></div></section>`;
const radioHtml = `<section id="radio-panel"><div class="radio-panel-inner gev-surface">${b('radio-enable', 'panel-layer-toggle', 'id="radio-enable-btn" data-state-active data-state-pressed')}${select('radio-filter', 'gev-field', 'id="radio-filter"')}<div class="radio-tuner"><div class="radio-tuner-dial">${input('tuner', '', 'range', 'id="radio-tuner-slider"')}</div></div><div class="radio-transport">${['prev', 'play', 'next', 'stop'].map((x) => b(`radio-${x}`, '', `id="radio-${x}-btn" ${x === 'play' ? 'data-state-active' : ''}`)).join('')}</div>${input('radio-volume', 'gev-quantitative-slider', 'range', 'id="radio-volume"')}<div class="radio-links"><a data-audit="station-homepage" id="radio-station-homepage" href="#">Homepage</a></div><div class="sdr-radio-card">${['connect', 'locate', 'change-device', 'mode-fm', 'mode-adsb', 'tune', 'seek-back', 'seek-forward'].map((x) => b(`sdr-${x}`, x === 'connect' ? 'panel-layer-toggle' : '', `id="sdr-${x}-btn" data-state-active data-state-pressed`)).join('')}${select('sdr-gain', 'gev-field', 'id="sdr-gain-select"')}${input('sdr-frequency', 'gev-field', 'number', 'id="sdr-frequency-input"')}${input('sdr-volume', 'gev-quantitative-slider', 'range', 'id="sdr-volume"')}</div></div></section>`;

// The rail and drawer, with Layers current as when it is open. Hosted legacy
// controls inherit the legacy palette inside the drawer body.
const railItem = ([id, icon], current) =>
  b(
    id,
    'gev-rail-item',
    `data-destination="${id}" aria-controls="gev-drawer" aria-expanded="${current}"${current ? ' aria-current="true"' : ''}${id === 'tools' ? ' disabled' : ''}`,
    `<span class="gev-rail-icon material-symbols-outlined" aria-hidden="true" data-probe="icon"><span class="material-symbols-outlined">${icon}</span></span><span class="gev-rail-label" data-probe="label">${id}</span>`,
  );
const railItems = [
  ['layers', 'layers'],
  ['inspect', 'my_location'],
  ['map', 'map'],
  ['stories', 'local_movies'],
  ['tools', 'design_services'],
  ['settings', 'settings'],
];
// The header, map controls, status bar and Settings → Appearance, holding
// today's chrome as shellChrome.js places it.
const chromeHtml = `<header id="gev-header" class="gev-header gev-surface"><div id="gev-header-brand" class="gev-header-brand"></div><div class="gev-header-center"><div id="gev-header-search" class="gev-header-search" role="search"><div class="location-search-wrap gev-location-search gev-surface">${b('header-search-toggle', 'search-toggle-btn', 'id="search-toggle"')}${input('header-search', 'expanded', 'text', 'id="location-search"')}</div></div><div id="gev-header-places" class="gev-header-places"><div id="location-bar" class="panel-collapsible collapsed gev-location gev-surface"><div class="location-inner"><div class="location-toolbar">${b('places-toggle', 'dock-tray-toggle', 'id="location-bar-toggle" aria-expanded="false"', '<span class="location-toolbar-label">LOCATION</span>')}</div></div></div></div></div><div class="gev-header-end"><span class="gev-header-count">2 layers active</span><div id="gev-header-actions" class="gev-header-actions"><nav id="top-center-actions">${b('header-clear', '', 'id="clear-selected-layers"')}${b('header-share', '', 'id="share-btn"', '<span class="share-icon">S</span><span class="share-label">Share view</span>')}</nav></div></div></header><div id="gev-map-controls" class="gev-map-controls gev-surface" role="group">${b('map-north', '', 'id="north-up-view"')}${b('map-tilt', '', 'id="tilt-map-view" aria-pressed="false" data-state-pressed')}${b('map-home', '', 'id="reset-globe-view"')}</div><footer id="gev-status-bar" class="gev-status-bar"><span class="gev-status-item">30.2672° N, 97.7431° W</span><div id="gev-status-credits" class="gev-status-credits"></div></footer><section id="gev-appearance-settings" class="gev-appearance-settings gev-surface"><div class="gev-segmented" role="radiogroup">${b('appearance', 'gev-segment', 'role="radio" aria-checked="false" data-state-checked')}</div></section>`;
const shellHtml = `<nav class="gev-rail gev-surface" aria-label="Destinations"><div class="gev-rail-items" role="toolbar" aria-orientation="vertical" aria-label="Destinations">${railItems.map((item, i) => railItem(item, i === 0)).join('')}</div></nav><section id="gev-drawer" class="gev-drawer"><div class="gev-drawer-header gev-surface"><div class="gev-panel-header"><div class="gev-panel-header-text"><h2 class="gev-panel-header-title">Layers</h2></div><div class="gev-panel-header-actions">${b('close', 'gev-icon-button gev-icon-button--sm', 'aria-label="Close"', '<span class="material-symbols-outlined">close</span>')}</div></div></div><div class="gev-drawer-body"><div id="gev-legacy-host" class="gev-legacy-host">${b('hosted-action', 'scene-btn', '', 'Legacy action')}${input('hosted-input')}</div></div></section>${chromeHtml}`;

// Exact new-control exceptions: removing primitives.css removes these controls'
// own definitions and exposes browser defaults. None exempts a button's hover
// or pressed/selected palette, or any inside/outside surface difference.
const voiceHtml = `<div id="command-dock"><div id="gev-voice-control" class="gev-surface" data-audit="voice-frame" data-status="listening" data-speaker="user" data-provider-choice="true"><label class="gev-voice-provider-field" data-audit="provider-field">${select('voice-provider', '', 'id="gev-voice-provider"')}</label>${b('voice-settings', 'gev-voice-settings-button', 'aria-expanded="false"')}<div class="gev-voice-heading"><div id="gev-voice-status" data-audit="voice-status">LISTENING</div><span class="gev-voice-cost-value gev-voice-cost-warning" data-level="warn" data-audit="cost-warning">~$2.10</span></div>${b('voice-mic', '', 'id="gev-voice-button"', '<span class="gev-mic-orbit" data-audit="mic-orbit"></span><span class="gev-mic-label">MIC</span>')}<div class="gev-voice-visualizer"><span data-audit="voice-bar"></span></div><div id="gev-voice-help" class="gev-voice-help-tray" data-audit="help-tray"><span class="gev-voice-help-kicker">VOICE CONTROL</span></div><section class="gev-voice-panel" data-audit="voice-panel"><div class="gev-voice-panel-header">${b('preview-tab', 'gev-voice-panel-tab', 'role="tab" data-state-selected')}${b('settings-tab', 'gev-voice-panel-tab', 'role="tab" data-state-selected')}${b('voice-close', '', 'id="gev-voice-settings-close"')}</div><label class="gev-voice-preference" data-audit="voice-preference"><input type="checkbox"> Show Voice Preview</label>${select('voice-timeout', '', 'id="gev-voice-timeout-select"')}${input('voice-minutes', '', 'number', 'id="gev-voice-timeout-input"')}<div class="gev-voice-cost-settings">${b('voice-tier', 'gev-voice-tier-btn', 'data-state-pressed')}<span class="gev-voice-cost-value" data-level="ok" data-audit="cost-value">~$0.40</span></div></section><div class="gev-voice-error-tray" data-audit="error-tray"><div class="gev-voice-error-header">VOICE SYSTEM ERROR</div>${b('voice-error-dismiss', 'gev-voice-error-dismiss')}</div></div></div>`;
const baseProperties = [
  'color',
  'backgroundColor',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'outline',
];
const nativeExceptions = [
  ...['icon', 'icon-sm', 'tab', 'disclosure', 'chip'].flatMap((variant) =>
    ['rest', 'active', 'focus'].map((state) => ({
      variant,
      state,
      comparison: 'sheet',
      properties: baseProperties,
      reason:
        'New token-native control: sheet removal exposes browser defaults; Cyber hover/pressed/selected rules must still win.',
    })),
  ),
  ...['toggle', 'toggle/track', 'toggle/thumb'].flatMap((variant) =>
    [
      'rest',
      'active',
      'checked',
      'focus',
      ...(variant === 'toggle' ? [] : ['hover']),
    ].map((state) => ({
      variant,
      state,
      comparison: 'sheet',
      properties: baseProperties,
      reason:
        'New switch and its track/thumb have no legacy Cyber counterpart; preserve the semantic on/off indication and contrast.',
    })),
  ),
];
// Effective-edge exceptions pin the complete painted value, not just a reason:
// a new currentColor line or changed Cyber colour must still fail the audit.
const edges = ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'];
const plainStates = ['rest', 'hover', 'active', 'focus'];
const glass = 'rgba(206, 222, 226, 0.28)';
const red = 'rgb(196, 84, 84)';
const edgeException = (variant, state, comparison, expected, reason) => ({
  variant,
  state,
  comparison,
  properties: Object.keys(expected),
  expected,
  reason,
});
const allEdges = (value) => Object.fromEntries(edges.map((p) => [p, value]));
const nativeEdges = [
  ['icon', ['hover', 'pressed']],
  ['icon-sm', ['hover', 'pressed']],
  ['chip', ['hover', 'pressed']],
  ['tab', ['hover', 'selected']],
  ['toggle', ['hover']],
  ['disclosure', ['hover']],
].flatMap(([variant, states]) =>
  states.map((state) =>
    edgeException(
      variant,
      state,
      'sheet',
      variant === 'toggle'
        ? allEdges('none')
        : variant === 'tab' || variant === 'disclosure'
          ? {
              ...allEdges('none'),
              borderBottom: `${variant === 'tab' ? 2 : 1}px solid ${red}`,
            }
          : allEdges(`1px solid ${red}`),
      'New native control replaces the browser outset frame with its own geometry; its visible state border must retain Cyber red.',
    ),
  ),
);
const structuralEdges = (variant, expected, reason) =>
  plainStates.flatMap((state) =>
    ['sheet', 'surface'].map((comparison) =>
      edgeException(variant, state, comparison, expected, reason),
    ),
  );
const locationEdges = [
  ...structuralEdges(
    'result-row',
    { borderTop: `1px solid ${glass}` },
    'New result-row separator has no legacy border; use the Cyber glass colour, not text ink.',
  ),
  ...['fly', 'header-fly'].flatMap((variant) =>
    plainStates.flatMap((state) =>
      ['sheet', 'surface'].map((comparison) =>
        edgeException(
          variant,
          state,
          comparison,
          allEdges(`1px solid ${state === 'hover' ? red : glass}`),
          'New result action has a solid frame instead of a UA outset frame; Cyber owns its hover red and resting glass edge.',
        ),
      ),
    ),
  ),
];
const toolEdges = [
  ...['import-count', 'draw-state'].flatMap((variant) =>
    structuralEdges(
      variant,
      allEdges(`1px solid ${glass}`),
      'The new read-only count/state pill has a 1px Cyber glass edge; its inherited Cyber text and background remain strict.',
    ),
  ),
  ...structuralEdges(
    'drop-guide',
    allEdges(`1px dashed ${glass}`),
    'New drop-target guide uses a dashed Cyber glass edge.',
  ),
  ...structuralEdges(
    'import-row',
    { borderTop: `1px solid ${glass}` },
    'New import-row separator uses Cyber glass ink.',
  ),
  ...structuralEdges(
    'import-swatch',
    allEdges(`1px dashed ${glass}`),
    'Own-style swatch needs its dashed boundary; use Cyber glass ink.',
  ),
  ...['draw-frame', 'import-frame'].flatMap((variant) =>
    plainStates.map((state) => ({
      ...edgeException(
        variant,
        state,
        'surface',
        allEdges(`1px solid ${glass}`),
        'New surface frame vanishes with the adoption classes; its border must use Cyber glass ink.',
      ),
    })),
  ),
  // Surface background/elevation are intrinsic to a new container, not a legacy
  // control override. S6a maps their semantic tokens to Cyber's panel palette.
  ...['draw-frame', 'import-frame'].flatMap((variant) =>
    plainStates.map((state) => ({
      variant,
      state,
      comparison: 'surface',
      properties: ['backgroundColor', 'boxShadow'],
      reason:
        'Removing the new surface removes its background/elevation; S6a owns the Cyber semantic token mapping.',
    })),
  ),
];
const layerEdges = [
  ...structuralEdges(
    'layer-filter',
    allEdges('1px solid rgba(206, 222, 226, 0.24)'),
    'New filter replaces the browser inset frame with a solid edge; retain Cyber input border ink.',
  ),
  ...[
    ['layer-row', 'borderBottom'],
    ['layer-footer-frame', 'borderTop'],
    ['layer-import-frame', 'borderBottom'],
  ].flatMap(([variant, property]) =>
    structuralEdges(
      variant,
      { [property]: `1px solid ${glass}` },
      'New Layers separator has no legacy geometry; its full painted edge must use Cyber glass ink.',
    ),
  ),
  ...structuralEdges(
    'layer-details',
    allEdges('none'),
    'New disclosure glyph has no frame; Cyber hover and focus palette still applies.',
  ),
  ...['rest', 'active', 'focus'].map((state) => ({
    variant: 'layer-details',
    state,
    comparison: 'surface',
    properties: ['color', 'backgroundColor'],
    expected: {
      color: 'rgba(180, 198, 202, 0.58)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
    },
    reason:
      'New disclosure has an explicit Cyber glyph palette scoped to layer-browser in cyber.css; removing that context exposes UA defaults. Hover remains strict.',
  })),
];
// The rail has no legacy control or Cyber rule, so removing shell.css exposes
// browser button defaults. Each exception pins the Cyber token palette the
// sheet paints, the current destination in Cyber's red; the drawer header and
// the hosted legacy controls stay strict.
const railReason =
  'New rail destination control (with its icon and label): no legacy rail control or Cyber rail rule exists, so removing shell.css exposes browser defaults. The exact Cyber token palette is pinned.';
const railInk = 'rgb(233, 240, 241)';
const railMuted = 'rgba(226, 235, 236, 0.82)';
const railPaint = (current, state, disabled) => ({
  item: {
    ...(state === 'hover'
      ? {}
      : {
          color: current ? railInk : railMuted,
          backgroundColor: 'rgba(0, 0, 0, 0)',
        }),
    ...allEdges('none'),
  },
  icon: {
    ...(current ? { color: railInk } : {}),
    backgroundColor:
      state === 'hover' && !disabled
        ? 'rgba(255, 255, 255, 0.09)'
        : current
          ? 'rgba(196, 84, 84, 0.2)'
          : 'rgba(255, 255, 255, 0.06)',
    ...allEdges(
      `1px solid ${current ? 'rgba(196, 84, 84, 0.82)' : 'rgba(180, 198, 202, 0.58)'}`,
    ),
    ...(state === 'focus' ? { outline: '2px solid rgb(242, 245, 244)' } : {}),
  },
  label: state === 'hover' ? null : { color: current ? railInk : railMuted },
});
const railEdges = railItems.flatMap(([id], index) =>
  plainStates.flatMap((state) =>
    Object.entries(railPaint(index === 0, state, id === 'tools'))
      .filter(([, expected]) => expected)
      .map(([part, expected]) => ({
        variant: part === 'item' ? id : `${id}/${part}`,
        state,
        comparison: 'sheet',
        properties: Object.keys(expected),
        expected,
        reason: railReason,
      })),
  ),
);
// Camera controls retain the same native ADJUST button outside the advanced disclosure.
const cameraFixture = {
  sheet: 'camera-views',
  html: '<section id="cctv-panel"><div id="cctv-controls-body"><div class="camera-controls gev-surface"><div class="cctv-frame-wrap" data-audit="camera-frame"><span class="cctv-frame-caption">ACQUIRING FRAME</span></div><div id="cctv-meta" data-audit="camera-meta">Camera metadata</div><button class="scene-btn" data-audit="camera-enable" id="cctv-enable-btn" data-state-active data-state-pressed>camera-enable</button><button class="scene-btn" data-audit="camera-coverage" id="cctv-coverage-btn" data-state-active data-state-pressed>camera-coverage</button><button class="scene-btn" data-audit="camera-auto-hop" id="cctv-auto-hop-btn" data-state-active data-state-pressed>camera-auto-hop</button><button class="scene-btn" data-audit="camera-projection" id="cctv-projection-btn" data-state-active data-state-pressed>camera-projection</button><button class="gev-action-button scene-btn" data-audit="camera-nearest" id="cctv-nearest-btn">camera-nearest</button><button class="gev-action-button scene-btn" data-audit="camera-prev" id="cctv-prev-btn">camera-prev</button><button class="gev-action-button scene-btn" data-audit="camera-next" id="cctv-next-btn">camera-next</button><button class="gev-action-button scene-btn" data-audit="camera-focus" id="cctv-focus-btn">camera-focus</button><input id="cctv-camera-filter" class="gev-field" data-audit="camera-search" value="Camera search"><select id="cctv-camera-select" class="gev-field" data-audit="camera-select"><option>Camera name</option></select><div class="cctv-calibration-block"><button class="gev-disclosure-row" data-audit="camera-disclosure" aria-controls="cctv-calibration-editor" aria-expanded="false">CALIBRATION</button><div class="cctv-calibration-header"><button id="cctv-adjust-btn" class="scene-btn" data-audit="camera-adjust" data-state-active data-state-pressed>ADJUST</button></div><div id="cctv-calibration-editor"><button class="cctv-cal-value" data-audit="camera-heading" >camera-heading</button><input type="number" class="gev-field gev-field--inline cctv-cal-input" data-audit="camera-heading-input" value="20"><button class="gev-action-button scene-btn" data-audit="camera-save" >camera-save</button><button class="gev-action-button scene-btn" data-audit="camera-reset" >camera-reset</button></div></div><div id="cctv-summary" data-audit="camera-summary">Current camera summary</div></div></div></section><section id="street-level-panel"><div id="sl-body"><div class="street-level-controls gev-surface"><div class="sl-viewer-wrap"><div class="sl-viewer-bar"><div class="sl-viewer-tools"><button class="scene-btn" data-audit="street-expand" id="sl-viewer-expand" data-state-pressed>street-expand</button><div class="gev-segmented sl-seg"><button class="gev-segment sl-seg-btn" data-audit="street-fit" data-sl-render="letterbox" role="radio" data-state-checked>street-fit</button><button class="gev-segment sl-seg-btn is-active" data-audit="street-fill-active" data-sl-render="fill" role="radio" data-state-checked>street-fill-active</button></div></div><button class="sl-viewer-x" data-audit="street-close" id="sl-viewer-close">street-close</button></div><div class="sl-image-meta"><span class="sl-image-by" data-audit="street-author">Contributor</span><a class="sl-image-link" data-audit="street-source" href="#">Source</a></div></div><div class="sl-providers"><button class="gev-chip data-toggle-chip " data-audit="street-provider" data-state-active data-state-pressed>street-provider</button><button class="gev-chip data-toggle-chip active" data-audit="street-provider-active" data-state-active data-state-pressed>street-provider-active</button><button class="gev-chip data-toggle-chip chip-key-required" data-audit="street-provider-key" data-state-active data-state-pressed>street-provider-key</button></div><fieldset id="sl-controls"><div class="sl-seg"><button class="gev-segment sl-seg-btn" data-audit="street-pano" data-sl-pano="all" role="radio" data-state-checked>street-pano</button><button class="gev-segment sl-seg-btn is-active" data-audit="street-pano-active" data-sl-pano="pano" role="radio" data-state-checked>street-pano-active</button></div><input id="sl-since" type="range" class="gev-quantitative-slider sl-range" data-audit="street-since"></fieldset><button class="scene-btn sl-nearest-btn" data-audit="street-nearest" id="sl-nearest-btn">street-nearest</button><div class="sl-meta" data-audit="street-meta">Provider coverage</div><div class="sl-error" data-audit="street-error">Provider unavailable</div></div></div></section>',
  outsideClasses: ['gev-surface', 'camera-controls', 'street-level-controls'],
  exceptions: [],
};

// Rendered Stories panel, runtime and both native dialog modes. Exact frame
// exceptions cover only the new recipe card; existing controls stay unwaived.
export const storiesFixture = {
  sheet: 'stories',
  html: '<section id="scene-panel" class="panel-collapsible active"><div class="scene-panel-inner"><div class="panel-header"><span class="panel-title">SCENES</span><span class="panel-divider"></span><button class="panel-collapse-btn">−</button></div><div id="scene-controls-body"><div class="stories-controls gev-surface"><div class="gev-tabs" role="tablist" aria-label="Stories"><!--[--><button id="stories-browse-tab" type="button" class="gev-tab" role="tab" aria-selected="false" aria-controls="stories-browse" tabindex="-1" data-audit="panel-stories-browse-tab-0" data-state-selected="">Browse</button><button id="stories-create-tab" type="button" class="gev-tab" role="tab" aria-selected="true" aria-controls="stories-create" tabindex="0" data-audit="panel-stories-create-tab-1" data-state-selected="">Create</button><!--]--></div><section id="stories-browse" role="tabpanel" aria-labelledby="stories-browse-tab"><div class="stories-library"><!--[--><button type="button" class="stories-recipe active" aria-pressed="true" data-scene-recipe-id="story" data-audit="panel-button-4" data-state-active="" data-state-pressed=""><span class="stories-recipe-art" aria-hidden="true" data-audit="recipe-art"><span class="material-symbols-outlined">movie</span></span><span class="stories-recipe-copy"><span class="stories-recipe-title">Story</span><small>1 shot</small></span><span class="material-symbols-outlined stories-recipe-arrow" aria-hidden="true">chevron_right</span></button><!--]--></div></section><section id="stories-create" role="tabpanel" aria-labelledby="stories-create-tab"><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-capture-btn" data-audit="panel-scene-capture-btn-5"><!--[-->CAPTURE SHOT<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-update-shot-btn" data-audit="panel-scene-update-shot-btn-6"><!--[-->UPDATE SHOT<!--]--></button></div><div id="scene-shot-list" class="scene-shot-list"><!--v-if--><!--[--><div class="scene-shot-row active" data-scene-shot-id="shot" data-audit="panel-div-19" data-state-active=""><div class="scene-shot-top"><div class="scene-shot-label" title="Double-click to rename"><!--[-->Overview<!--]--></div><div class="scene-shot-actions"><button type="button" class="gev-action-button gev-action-button--compact scene-shot-btn" data-audit="panel-button-7"><!--[-->LOAD<!--]--></button><button type="button" class="gev-action-button gev-action-button--danger gev-action-button--compact scene-shot-btn scene-shot-danger" data-audit="panel-button-8"><!--[-->Delete shot<!--]--></button></div></div><div class="scene-shot-meta">NORMAL · OFF · 3.0s + 1.0s</div></div><!--]--></div></section><div class="stories-selected"><strong data-audit="playlist-label">Playlist</strong><small data-audit="playlist-count">49 shots</small></div><div class="scene-controls stories-transport"><button type="button" class="gev-action-button scene-btn" id="scene-start-btn" data-audit="panel-scene-start-btn-11"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>Play</button><button type="button" class="gev-action-button gev-action-button--danger scene-btn scene-btn-danger" disabled="" id="scene-stop-btn" data-audit="panel-scene-stop-btn-12"><!--[-->STOP<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-next-btn" data-audit="panel-scene-next-btn-13"><!--[-->NEXT<!--]--></button></div><div class="scene-progress"><div id="scene-progress-fill" style="width:50%;">50%</div></div><div id="scene-status" role="status">Ready</div><section class="stories-authoring" aria-label="Scene recipe"><h3>Scene recipe</h3><div class="scene-controls"><select id="scene-select" class="gev-field" aria-label="Scene recipe" value="story" data-audit="panel-scene-select-18"><!--[--><option value="story">Story</option><!--]--></select></div><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-new-btn" data-audit="panel-scene-new-btn-2"><!--[-->New scene<!--]--></button><button type="button" class="gev-action-button gev-action-button--danger scene-btn scene-btn-danger" id="scene-delete-btn" data-audit="panel-scene-delete-btn-3"><!--[-->Delete scene<!--]--></button></div><div class="scene-controls" data-director-authoring=""><button type="button" class="gev-action-button scene-btn" data-audit="panel-button-9"><!--[-->EDIT DETAILS<!--]--></button><button type="button" class="gev-action-button scene-btn" data-audit="panel-button-10"><!--[-->SHARE SCENE<!--]--></button></div><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-export-btn" data-audit="panel-scene-export-btn-14"><!--[-->EXPORT PRESETS<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-import-btn" data-audit="panel-scene-import-btn-15"><!--[-->IMPORT<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-download-btn" data-audit="panel-scene-download-btn-16"><!--[-->RUN LOG<!--]--></button><input id="scene-import-file" type="file" accept="application/json,.json" data-audit="panel-scene-import-file-17"></div></section></div></div></div></section><dialog data-director-dialog="" class="director-sharing-dialog stories-dialog gev-surface" aria-label="Edit scene details" data-audit="details-dialog-8" open=""><h2>Edit scene details</h2><p class="stories-dialog-context">Story / Overview</p><div class="stories-dialog-body"><!--[--><p>Camera positions use degrees and meters.</p><!--]--><div class="stories-details"><label>Anchors and data packs<textarea data-scene-detail="sceneText" rows="9" class="gev-field" aria-label="Anchors and data packs" data-audit="details-sceneText-6">{}</textarea></label><label>Shot camera, timing, packs and actions<textarea data-scene-detail="shotText" rows="9" class="gev-field" aria-label="Shot camera, timing, packs and actions" data-audit="details-shotText-7">{}</textarea></label><label>New anchor ID<input data-scene-detail="anchorName" class="gev-field" aria-label="New anchor ID" value="anchor" data-audit="details-anchorName-5"></label><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="details-button-0"><!--[-->Capture camera as anchor<!--]--></button><button type="button" class="gev-action-button" data-audit="details-button-1"><!--[-->Set move start to current camera<!--]--></button><button type="button" class="gev-action-button" data-audit="details-button-2"><!--[-->Use ordinary flight<!--]--></button></div></div><!--v-if--></div><p role="status">Ready</p><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="details-button-3"><!--[-->Cancel<!--]--></button><!--v-if--><button type="button" class="gev-action-button" data-director-apply-details="" data-audit="details-button-4"><!--[-->Apply details<!--]--></button><!--v-if--><!--v-if--></div></dialog><dialog data-director-dialog="" class="director-sharing-dialog stories-dialog gev-surface" aria-label="Share selected scene" data-audit="share-dialog-0" open=""><h2>Share selected scene</h2><!--v-if--><div class="stories-dialog-body"><!--[--><p>Explicit selected files only.</p><!--]--><!--v-if--><!--[--><label class="stories-file-chooser"><span>Choose data-pack files</span><input type="file" aria-label="Choose data-pack files" data-scene-assets="files" multiple="" data-audit="share-input-1"><span class="stories-file-row" aria-hidden="true" data-audit="share-span-2"><span data-audit="share-span-3">Choose files</span><span>No file chosen</span></span></label><label class="stories-file-chooser"><span>Or choose a data-pack folder</span><input type="file" aria-label="Or choose a data-pack folder" data-scene-assets="folder" multiple="" webkitdirectory="" data-audit="share-input-4"><span class="stories-file-row" aria-hidden="true" data-audit="share-span-5"><span data-audit="share-span-6">Choose files</span><span>No file chosen</span></span></label><!--]--></div><p role="status">Ready</p><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="share-button-7"><!--[-->Cancel<!--]--></button><!--v-if--><!--v-if--><button type="button" class="gev-action-button" data-audit="share-button-8"><!--[-->Download scene JSON<!--]--></button><button type="button" class="gev-action-button" data-audit="share-button-9"><!--[-->Download asset bundle<!--]--></button></div></dialog><div id="scene-runtime" class="stories-playback"><div class="stories-runtime"><span>Story / Overview</span><button type="button" class="gev-action-button gev-action-button--danger gev-action-button--compact stories-runtime-stop" id="scene-runtime-stop" data-audit="runtime-scene-runtime-stop-0"><!--[-->STOP<!--]--></button></div></div>',
  structuralExceptions: storiesStructure,
  outsideClasses: ['gev-surface', 'stories-controls', 'stories-playback'],
  exceptions: [
    {
      variant: 'panel-button-4',
      state: 'rest',
      comparison: 'sheet',
      properties: ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      expected: {
        borderTop: '1px solid rgba(206, 222, 226, 0.28)',
        borderRight: '1px solid rgba(206, 222, 226, 0.28)',
        borderBottom: '1px solid rgba(206, 222, 226, 0.28)',
        borderLeft: '1px solid rgba(206, 222, 226, 0.28)',
      },
      reason:
        'New recipe card has no legacy counterpart. Its defining sheet replaces the UA outset/inset frame with a 1px solid frame; the exact Cyber glass/red edge remains required.',
    },
    {
      variant: 'panel-button-4',
      state: 'hover',
      comparison: 'sheet',
      properties: ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      expected: {
        borderTop: '1px solid rgba(196, 84, 84, 0.82)',
        borderRight: '1px solid rgba(196, 84, 84, 0.82)',
        borderBottom: '1px solid rgba(196, 84, 84, 0.82)',
        borderLeft: '1px solid rgba(196, 84, 84, 0.82)',
      },
      reason:
        'New recipe card has no legacy counterpart. Its defining sheet replaces the UA outset/inset frame with a 1px solid frame; the exact Cyber glass/red edge remains required.',
    },
    {
      variant: 'panel-button-4',
      state: 'active',
      comparison: 'sheet',
      properties: ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      expected: {
        borderTop: '1px solid rgba(196, 84, 84, 0.82)',
        borderRight: '1px solid rgba(196, 84, 84, 0.82)',
        borderBottom: '1px solid rgba(196, 84, 84, 0.82)',
        borderLeft: '1px solid rgba(196, 84, 84, 0.82)',
      },
      reason:
        'New recipe card has no legacy counterpart. Its defining sheet replaces the UA outset/inset frame with a 1px solid frame; the exact Cyber glass/red edge remains required.',
    },
    {
      variant: 'panel-button-4',
      state: 'pressed',
      comparison: 'sheet',
      properties: ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      expected: {
        borderTop: '1px solid rgba(206, 222, 226, 0.28)',
        borderRight: '1px solid rgba(206, 222, 226, 0.28)',
        borderBottom: '1px solid rgba(206, 222, 226, 0.28)',
        borderLeft: '1px solid rgba(206, 222, 226, 0.28)',
      },
      reason:
        'New recipe card has no legacy counterpart. Its defining sheet replaces the UA outset/inset frame with a 1px solid frame; the exact Cyber glass/red edge remains required.',
    },
    {
      variant: 'panel-button-4',
      state: 'focus',
      comparison: 'sheet',
      properties: ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      expected: {
        borderTop: '1px solid rgba(196, 84, 84, 0.82)',
        borderRight: '1px solid rgba(196, 84, 84, 0.82)',
        borderBottom: '1px solid rgba(196, 84, 84, 0.82)',
        borderLeft: '1px solid rgba(196, 84, 84, 0.82)',
      },
      reason:
        'New recipe card has no legacy counterpart. Its defining sheet replaces the UA outset/inset frame with a 1px solid frame; the exact Cyber glass/red edge remains required.',
    },
  ],
};
const voiceCardHtml = `<div id="command-dock"><div id="gev-voice-control" class="gev-surface"><section id="gev-voice-card" class="gev-voice-card" data-busy="true" data-audit="card"><div class="gev-voice-card-header"><span class="gev-voice-card-kicker" data-audit="card-kicker">VOICE</span><span class="gev-voice-card-phase" data-audit="card-phase">RUNNING</span><button class="gev-voice-card-dismiss" data-audit="card-dismiss">×</button></div><p class="gev-voice-card-caption" data-role="assistant"><span class="gev-voice-card-who" data-audit="card-who">GEV</span>Reply</p><p class="gev-voice-card-pointer"><span class="gev-voice-card-pointer-label" data-audit="card-pointer">Here</span></p><ol class="gev-voice-card-plan" data-audit="card-plan">${['pending', 'running', 'done', 'failed', 'cancelled'].map((status) => `<li class="gev-voice-card-step" data-status="${status}" data-audit="card-step-${status}">Step</li>`).join('')}</ol><div class="gev-voice-card-result" data-audit="card-result"><div class="gev-voice-card-result-title" data-audit="card-title">Result</div>${['live', 'stale', 'degraded', 'fallback', 'partial', 'unavailable'].map((tone) => `<span class="gev-voice-card-chip" data-tone="${tone}" data-audit="card-chip-${tone}">${tone}</span>`).join('')}<ul class="gev-voice-card-lines"><li data-audit="card-line">Literal result</li></ul><ol class="gev-voice-card-referents"><li data-audit="card-referent">Reference</li></ol><details class="gev-voice-card-notes" open><summary data-audit="card-notes-open">NOTES &amp; SOURCES</summary></details><details class="gev-voice-card-notes"><summary data-audit="card-notes-closed">NOTES &amp; SOURCES</summary></details></div></section></div></div>`;

// Mirrors DirectionsView inside its existing Transport row. The new host is
// transparent under Cyber; all chip/list skins remain legacy-owned.
const directionsHtml = `<section id="data-panel"><div id="data-toggles" class="layer-browser gev-surface"><div class="data-toggle-row" data-layer-id="directions"><section id="directions-controls-body" class="directions-view gev-surface" data-audit="directions-frame"><div class="data-toggle-meta" data-audit="directions-summary">Drive · 2.1 km · 5 min</div><div class="data-toggle-controls">${['mode-car', 'mode-foot', 'mode-bike', 'set-a', 'set-b', 'swap', 'fly', 'clear'].map((id) => b(`directions-${id}`, 'data-toggle-chip', `data-chip-id="${id}" data-state-active data-state-pressed`, id)).join('')}${b('directions-fly-busy', 'data-toggle-chip chip-loading', 'data-chip-id="fly" aria-busy="true" disabled', 'FLY ···')}</div><ol class="data-row-list"><li>${b('directions-step', 'data-row-list-item', 'data-list-item-id="step-0" data-state-active', '<span class="data-row-list-lead" data-audit="directions-step-lead">1 · 100 m</span><span class="data-row-list-text" data-audit="directions-step-text">Continue straight</span>')}</li><li>${b('directions-current', 'data-row-list-item current', 'data-list-item-id="step-1" aria-current="step" data-state-active', '<span class="data-row-list-lead">200 m</span><span class="data-row-list-text">Turn right</span>')}</li><li>${b('directions-truncated', 'data-row-list-item note', 'data-list-item-id="step-truncated" disabled', '<span class="data-row-list-text">Only the first steps shown</span>')}</li></ol></section></div></div></section>`;
const toolsDirectionsHtml = `<div class="gev-drawer-body"><div class="gev-legacy-host">${directionsHtml
  .match(/<section id="directions-controls-body"[\s\S]*?<\/section>/)[0]
  .replace(
    'class="directions-view gev-surface"',
    'class="directions-view directions-view--hosted gev-surface" tabindex="-1"',
  )
  .replace(
    '<div class="data-toggle-meta"',
    `<header class="directions-header gev-tools-header">${toolIcon('directions-icon')}<h3 class="gev-tools-title">Directions</h3>${b('directions-switch', 'gev-toggle gev-tools-route-toggle', 'role="switch" data-state-checked', '<span class="gev-toggle-track" data-probe="track"><span class="gev-toggle-thumb"></span></span><span class="gev-toggle-label">ON</span>')}</header><div class="data-toggle-meta"`,
  )
  .replaceAll('data-audit="', 'data-audit="tools-')}</div></div>`;

const settingsAppearanceHtml = `<section class="gev-settings gev-surface"><div id="corner-actions">${b('provider-launcher', '', 'id="key-setup-chip"')}${b('locale-launcher', 'locale-picker-button')}</div><div class="gev-settings-providers"><aside id="key-setup" class="visible key-setup-embedded" data-audit="provider-frame"><header class="key-setup-header">${b('provider-close', 'key-setup-close')}</header><h2 id="key-setup-title" data-audit="provider-title">Power up the globe</h2><div class="key-setup-rows">${['false', 'true'].map((set) => `<section class="key-setup-row" data-set="${set}" data-audit="provider-row-${set}"><div class="key-setup-row-head"><strong>Provider</strong><span class="key-setup-state" data-audit="provider-state-${set}">${set === 'true' ? 'Configured' : 'Not configured'}</span><span class="key-setup-led" data-audit="provider-led-${set}"></span><span class="key-setup-exposed" data-audit="provider-exposed-${set}">Browser-side</span><span class="key-setup-external" data-audit="provider-external-${set}">External</span></div><div class="key-setup-fields">${input(`provider-password-${set}`, '', 'password')}</div><a href="#" class="key-setup-get" data-audit="provider-link-${set}">Get key</a>${b(`provider-remove-${set}`, 'key-setup-remove')}${b(`provider-oauth-${set}`, 'key-setup-cloud-auth-toggle', 'data-state-disabled')}</section>`).join('')}</div>${b('provider-more', 'gev-action-button key-setup-more', 'aria-expanded="false"', '+ 7 more providers')}<footer class="key-setup-footer">${b('provider-save', 'key-setup-apply', 'data-state-disabled')}</footer></aside></div><details class="gev-settings-storage"><summary data-audit="provider-storage">How keys are stored</summary></details></section>`;

const cockpitHtml = `<section id="cockpit-hud" data-layer="flights"><div class="cockpit-topline"><div class="cockpit-vision-controls" role="group" data-audit="vision-group">${b('vision-previous', 'cockpit-vision-nav', 'id="cockpit-vision-previous"', '<span class="material-symbols-outlined">chevron_left</span><small data-probe="label">PREV</small>')}${b('vision-current', 'cockpit-vision-current', 'id="cockpit-vision-current" data-cockpit-vision="optical"', '<small data-probe="kicker">CURRENT</small><strong id="cockpit-vision-current-label" data-probe="value">NORMAL</strong>')}${b('vision-next', 'cockpit-vision-nav', 'id="cockpit-vision-next"', '<small>NEXT</small><span class="material-symbols-outlined">chevron_right</span>')}</div></div><aside id="cockpit-context" class="cockpit-context-window" data-state="uncertain" data-audit="contact-frame"><header class="cockpit-context-header"><div><span class="cockpit-context-kicker" data-audit="contact-kicker">CONTACT</span><strong id="cockpit-context-subject" data-audit="contact-subject">EJA353 · 250 KM</strong></div><nav class="cockpit-context-actions">${b('contact-previous', '', 'id="cockpit-context-previous" disabled', '<span class="material-symbols-outlined">skip_previous</span>')}${b('contact-next', '', 'id="cockpit-context-next"', '<span class="material-symbols-outlined">skip_next</span>')}${b('contact-toggle', '', 'id="cockpit-context-toggle" aria-expanded="true"', '<span class="material-symbols-outlined">chevron_left</span>')}</nav><span class="cockpit-context-qualifier" data-audit="contact-qualifier">CONTEXT ONLY</span></header><div class="cockpit-context-cohorts"><div data-context-cohort="flights" data-audit="cohort"><span data-probe="label-2">FLT</span><strong data-probe="count">12</strong><small data-probe="source">OpenSky</small></div><div class="unknown" data-context-cohort="military" data-audit="cohort-unknown"><span>MIL</span><strong data-probe="count-2">—</strong><small>adsb.lol</small></div></div><div class="cockpit-context-nearest"><span id="cockpit-context-direction" class="material-symbols-outlined" data-audit="contact-direction">navigation</span><div><small data-audit="nearest-caption">NEAREST OBSERVED / MAPPED</small><strong id="cockpit-context-nearest-label" data-audit="nearest-value">N30126</strong></div><span id="cockpit-context-bearing" data-audit="bearing">045°</span><span id="cockpit-context-distance" data-audit="distance">14 KM</span></div><footer class="cockpit-context-footer"><span id="cockpit-context-uncertainty" data-audit="uncertainty">AVAILABLE INPUTS ONLY</span>${b('weather', 'cockpit-context-weather', 'id="cockpit-weather-toggle" data-state-pressed', '<span data-probe="label-3">WX</span><strong id="cockpit-weather-state" data-probe="state">ON</strong>')}<time id="cockpit-context-updated" data-audit="updated">12:00:00Z</time></footer></aside><aside id="cockpit-signal-stream" class="cockpit-signal-window" data-audit="brief-frame"><section id="cockpit-route" class="cockpit-route-card" data-audit="route-card"><div class="cockpit-route-heading"><span class="cockpit-route-kicker" data-audit="route-kicker">ESTIMATED FLIGHT PLAN</span><small id="cockpit-route-status" data-audit="route-status">ARROW · ESTIMATED DIRECTION</small></div><div class="cockpit-route-endpoints"><div class="cockpit-route-airport" data-audit="route-airport"><span data-probe="label-4">FROM</span><strong id="cockpit-route-from" data-probe="value-2">AUS</strong></div><span class="cockpit-route-arrow material-symbols-outlined" data-audit="route-arrow">east</span></div></section><header class="cockpit-signal-header"><div class="cockpit-brief-heading"><span id="cockpit-brief-kicker" class="cockpit-signal-kicker" data-audit="brief-kicker"><i data-probe="dot"></i> LIVE SIGNALS</span><strong id="cockpit-brief-subtitle" data-audit="brief-subtitle">OBSERVED / MAPPED PINGS</strong></div><nav class="cockpit-brief-actions">${b('brief-previous', '', 'id="cockpit-brief-previous"', '<span class="material-symbols-outlined">chevron_left</span>')}<span id="cockpit-brief-position" data-audit="brief-position">1 / 3</span>${b('brief-auto', '', 'id="cockpit-brief-auto" data-state-pressed', 'CYCLE OFF')}${b('brief-collapse', '', 'id="cockpit-signal-toggle" aria-expanded="true"', '<span class="material-symbols-outlined">right_panel_close</span>')}</nav></header><div class="cockpit-brief-stage"><section data-cockpit-brief-page="signals"><ol id="cockpit-signal-list" class="cockpit-signal-list"><li class="track" data-audit="signal-track"><time data-probe="time">12:00</time><div><strong data-probe="title">TRACK LOCKED</strong><span data-probe="detail">SWA5004</span></div></li><li class="military actionable" data-audit="signal-military"><time>12:01</time><div>${b('signal-target', 'cockpit-signal-target', '', '<span class="cockpit-signal-target-label" data-probe="label-5">RCH123</span><span class="cockpit-signal-target-rule"></span>')}<span>MIL · 20 KM</span></div></li><li class="warning" data-audit="signal-warning"><time>12:02</time><div><strong data-probe="title-2">FEED UNAVAILABLE</strong><span>adsb.lol</span></div></li><li class="nearby" data-audit="signal-nearby"><time>12:03</time><div><strong>NEARBY</strong><span>N30126</span></div></li></ol></section><section data-cockpit-brief-page="news"><p id="cockpit-news-status" class="cockpit-brief-status" data-state="unavailable" data-audit="news-status">NEWS UNAVAILABLE</p><ol id="cockpit-news-list" class="cockpit-news-list"><li data-audit="news-item"><a href="#" data-audit="news-link"><strong data-probe="title-3">Headline</strong><span data-probe="meta">Source · 2 h</span></a></li></ol></section><section data-cockpit-brief-page="local"><div class="cockpit-local-place" data-audit="local-place"><strong data-probe="value-3">Austin</strong><small data-probe="coordinates">30.27 N · 97.74 W</small></div><div class="cockpit-local-grid" data-audit="local-grid"><div data-audit="local-cell"><span data-probe="label-6">TEMP</span><strong data-probe="value-4">21°C</strong><small data-probe="note">FEELS 20°C</small></div></div><a class="cockpit-weather-credit" href="#" data-audit="weather-credit">Open-Meteo</a></section></div><footer class="cockpit-signal-footer"><span id="cockpit-brief-source" data-audit="brief-source">SOURCE-BACKED EVENTS</span><nav class="cockpit-brief-tabs">${b('brief-tab', '', 'data-cockpit-brief-index="0" aria-current="true"', 'SIG')}${b('brief-tab-other', '', 'data-cockpit-brief-index="1"', 'NEWS')}</nav></footer></aside><aside id="cockpit-utility-controls" class="cockpit-utility-controls"><div class="cockpit-utility-control"><div class="cockpit-utility-launcher" data-cockpit-launcher="display" data-audit="display-launcher"><span data-probe="label-7">DISPLAY</span><span class="cockpit-utility-divider" data-probe="divider"></span>${b('display-glyph', 'cockpit-utility-glyph', 'id="cockpit-display-toggle-btn" aria-expanded="false"', '+')}</div></div><div class="cockpit-utility-control is-expanded"><div class="cockpit-utility-launcher" data-cockpit-launcher="radio" data-audit="radio-launcher"><span data-probe="label-8">RADIO</span><span class="cockpit-utility-divider" data-probe="divider-2"></span>${b('radio-glyph', 'cockpit-utility-glyph', 'id="cockpit-radio-toggle-btn" aria-expanded="true"', '−')}</div><div id="cockpit-radio-panel" class="cockpit-utility-popover cockpit-radio-compact" data-audit="radio-popover"><strong id="cockpit-radio-station" class="cockpit-radio-station" data-audit="radio-station">KUTX 98.9</strong>${b('radio-enable', 'panel-layer-toggle', 'id="cockpit-radio-enable-btn" data-state-pressed', 'ENABLED')}<div class="cockpit-radio-transport">${b('radio-previous', '', 'id="cockpit-radio-prev-btn"', '◀◀')}${b('radio-play', '', 'id="cockpit-radio-play-btn" data-state-active', '▶')}</div><label class="cockpit-radio-volume" for="cockpit-radio-volume" data-audit="radio-volume"><span data-probe="label-9">VOLUME</span>${input('radio-volume-input', 'gev-quantitative-slider', 'range', 'id="cockpit-radio-volume" min="0" max="100"')}<output id="cockpit-radio-volume-value" class="gev-slider-value" data-probe="value-5">80%</output></label></div></div></aside></section>`;
export const fixtures = [
  {
    sheet: 'feedback-views',
    html: `<aside id="first-run-launcher" class="gev-surface visible"><div class="first-run-choices">${b('mission', '', 'data-first-run-choice="contacts" aria-disabled="false"', '<span class="material-symbols-outlined" data-probe="icon">radar</span><span><strong>Live contacts</strong><small data-probe="copy">Aircraft and vessels</small></span><span class="first-run-arrow" data-probe="arrow">→</span>')}</div><div class="first-run-footer">${b('dismiss', 'first-run-dismiss')}${input('suppress', '', 'checkbox')}</div></aside><div id="global-loading-status" class="gev-surface"><span id="global-loading-label" data-audit="loading">Loading</span><span id="global-loading-detail" data-audit="detail">Detail</span></div>${['error', 'retry', 'cancelled', 'complete'].map((state) => `<div id="global-loading-status" class="gev-surface" data-state="${state}" data-audit="notice-${state}"><span id="global-loading-label" data-probe="label">${state}</span><span id="global-loading-detail" data-probe="detail">Detail</span></div>`).join('')}<div id="traffic-sync-chip" class="gev-surface visible" data-audit="traffic"><span id="traffic-sync-label" data-probe="label">Roads</span><span id="traffic-sync-progress" data-probe="progress">30%</span></div><div id="toast" class="gev-surface visible" data-audit="toast">Saved</div><div class="loader-content" data-audit="startup"><h2 data-probe="title">GOD'S EYE VIEW</h2><p class="loader-status" data-probe="status">Initializing...</p></div><p class="loader-status startup-error" style="color:var(--gev-error-text)" data-audit="startup-error">Error: unavailable</p><div class="cesium-credit-lightbox" data-gev-credit-surface><a data-audit="credit-link" href="#">Provider</a>${b('credit-close', 'cesium-credit-lightbox-close')}</div>`,
  },
  {
    sheet: 'primitives',
    html: primitiveHtml,
    exceptions: [...nativeExceptions, ...nativeEdges],
  },
  {
    sheet: 'location-views',
    exceptions: locationEdges,
    html: locationHtml,
    outsideClasses: [
      'gev-surface',
      'gev-location-search',
      'gev-location-results',
    ],
  },
  {
    sheet: 'tool-views',
    exceptions: toolEdges,
    html: toolsHtml + toolsDirectionsHtml,
    outsideClasses: ['gev-surface', 'gev-tools'],
  },
  {
    sheet: 'layer-browser',
    structuralExceptions: layersStructure,
    exceptions: layerEdges,
    html: layerHtml,
    outsideClasses: ['gev-surface', 'layer-browser'],
  },
  {
    sheet: 'weather-controls',
    html: weatherHtml,
    outsideClasses: ['gev-surface', 'weather-controls'],
  },
  { sheet: 'recent-imagery-view', html: imageryHtml },
  { sheet: 'radio-views', html: radioHtml },
  { sheet: 'shell', html: shellHtml, exceptions: railEdges },
  cameraFixture,
  { sheet: 'voice-dock-view', html: voiceHtml },
  {
    sheet: 'settings-appearance',
    html: settingsAppearanceHtml,
    structuralExceptions: [
      {
        id: 'settings-sections',
        reason:
          'Providers, Voice and Language & help share one destination with a native tab order. Cyber keeps its own palette and existing provider form title, frame and type.',
        expected: { sections: ['providers', 'voice', 'language'] },
      },
      {
        id: 'embedded-provider-form',
        reason:
          'The original form moves from its fixed dialog into the Providers section without cloning fields. Its dialog trap rests while the drawer owns focus; the original role and home return on exit.',
        expected: { role: 'region', mode: 'embedded' },
      },
      {
        id: 'provider-composition',
        reason:
          'Three primary cards precede the remaining mounted cards behind a disclosure; links follow their password fields, and storage guidance moves into a native details disclosure. Cyber retains its existing title, typography and frame.',
        expected: { primary: ['cesium-ion', 'google-maps', 'openai'] },
      },
    ],
  },
  storiesFixture,
  { sheet: 'voice-card-view', html: voiceCardHtml },

  {
    sheet: 'inspect',
    structuralExceptions: inspectStructure,
    html: inspectHtml,
    outsideClasses: ['gev-legacy-host'],
  },
  {
    sheet: 'directions',
    html:
      directionsHtml.replace(
        'id="directions-controls-body"',
        'id="directions-controls-home"',
      ) + toolsDirectionsHtml,
    outsideClasses: ['gev-surface', 'directions-view'],
  },
  { sheet: 'cockpit-views', html: cockpitHtml },
];
