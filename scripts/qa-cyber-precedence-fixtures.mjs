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
const toolsHtml = `<section id="draw-group" class="gev-tools gev-surface" data-audit="draw-frame">${b('draw', 'pp-toggle-btn', 'id="draw-toggle" data-state-active data-state-pressed')}<div class="pp-slider-row visible"><div class="gev-segmented pp-mode-seg">${['area', 'line', 'pin'].map((x) => b(`shape-${x}`, 'gev-segment pp-mode-btn', 'role="radio" data-state-active data-state-checked')).join('')}</div></div><div id="draw-label-row" class="pp-slider-row visible">${input('draw-label', 'pp-text-input', 'text', 'id="draw-label-input"')}${select('draw-color', 'pp-select draw-color-select gev-field gev-field--compact', 'id="draw-color-select"')}${b('clear-board', 'draw-clear-btn gev-action-button gev-action-button--compact gev-action-button--danger', 'id="draw-clear"')}</div></section><section class="gev-tools gev-surface" data-audit="import-frame"><div class="gev-tools-drop-guide" data-audit="drop-guide">${b('choose-files', 'gev-action-button gev-action-button--compact', 'id="geo-import-button"')}</div><ul class="geo-import-list visible"><li class="geo-import-row" data-audit="import-row"><span class="geo-import-swatch own-styles" data-audit="import-swatch"></span>${b('import-toggle', 'geo-import-action', 'data-state-pressed')}${b('import-fly', 'geo-import-action')}${b('import-remove', 'geo-import-action')}</li></ul>${b('import-scene', 'gev-action-button gev-action-button--compact', 'id="geo-import-scene"')}</section>`;
const layerHtml = `<section class="layer-browser gev-surface">${input('layer-filter', 'layer-filter')}<div class="data-toggle-row" data-audit="layer-row">${b('layer-toggle', 'data-toggle-btn gev-toggle', 'data-state-checked', `<span class="gev-toggle-track" data-probe="track"><span class="gev-toggle-thumb" data-probe="thumb"></span></span>`)}${b('layer-details', 'layer-details')}<div class="data-toggle-controls">${b('layer-chip', 'data-toggle-chip', 'data-state-active data-state-pressed')}</div><ol class="data-row-list"><li>${b('layer-list', 'data-row-list-item', 'data-state-active data-state-current')}</li></ol></div><footer class="layer-footer" data-audit="layer-footer-frame">${b('clear-layers', 'gev-action-button')}${b('layer-footer-link', 'gev-action-button')}</footer><div class="layer-import" data-audit="layer-import-frame">${b('layer-import', 'gev-action-button gev-action-button--compact')}</div></section>`;
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
    `<span class="gev-rail-icon material-symbols-outlined" aria-hidden="true" data-probe="icon">${icon}</span><span class="gev-rail-label" data-probe="label">${id}</span>`,
  );
const railItems = [
  ['layers', 'layers'],
  ['inspect', 'my_location'],
  ['map', 'map'],
  ['stories', 'movie'],
  ['tools', 'construction'],
  ['settings', 'settings'],
];
const shellHtml = `<nav class="gev-rail gev-surface" aria-label="Destinations"><div class="gev-rail-items" role="toolbar" aria-orientation="vertical" aria-label="Destinations">${railItems.map((item, i) => railItem(item, i === 0)).join('')}</div></nav><section id="gev-drawer" class="gev-drawer"><div class="gev-drawer-header gev-surface"><div class="gev-panel-header"><div class="gev-panel-header-text"><h2 class="gev-panel-header-title">Layers</h2></div><div class="gev-panel-header-actions">${b('close', 'gev-icon-button gev-icon-button--sm', 'aria-label="Close"', '<span class="material-symbols-outlined">close</span>')}</div></div></div><div class="gev-drawer-body"><div id="gev-legacy-host" class="gev-legacy-host">${b('hosted-action', 'scene-btn', '', 'Legacy action')}${input('hosted-input')}</div></div></section>`;

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
const storiesFixture = {
  sheet: 'stories',
  html: '<section id="scene-panel"><div id="scene-controls-body"><div class="stories-controls gev-surface"><div class="gev-tabs" role="tablist" aria-label="Stories"><!--[--><button id="stories-browse-tab" type="button" class="gev-tab" role="tab" aria-selected="false" aria-controls="stories-browse" tabindex="-1" data-audit="panel-stories-browse-tab-0" data-state-selected="">Browse</button><button id="stories-create-tab" type="button" class="gev-tab" role="tab" aria-selected="true" aria-controls="stories-create" tabindex="0" data-audit="panel-stories-create-tab-1" data-state-selected="">Create</button><!--]--></div><div class="scene-controls"><select id="scene-select" class="gev-field" aria-label="Scene recipe" value="story" data-audit="panel-scene-select-18"><!--[--><option value="story">Story</option><!--]--></select></div><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-new-btn" data-audit="panel-scene-new-btn-2"><!--[-->New scene<!--]--></button><button type="button" class="gev-action-button gev-action-button--danger scene-btn scene-btn-danger" id="scene-delete-btn" data-audit="panel-scene-delete-btn-3"><!--[-->Delete scene<!--]--></button></div><section id="stories-browse" role="tabpanel" aria-labelledby="stories-browse-tab"><div class="stories-library"><!--[--><button type="button" class="stories-recipe active" aria-pressed="true" data-scene-recipe-id="story" data-audit="panel-button-4" data-state-active="" data-state-pressed=""><span>Story</span><small>1 shot</small></button><!--]--></div></section><section id="stories-create" role="tabpanel" aria-labelledby="stories-create-tab"><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-capture-btn" data-audit="panel-scene-capture-btn-5"><!--[-->CAPTURE SHOT<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-update-shot-btn" data-audit="panel-scene-update-shot-btn-6"><!--[-->UPDATE SHOT<!--]--></button></div><div id="scene-shot-list" class="scene-shot-list"><!--v-if--><!--[--><div class="scene-shot-row active" data-scene-shot-id="shot" data-audit="panel-div-19" data-state-active=""><div class="scene-shot-top"><div class="scene-shot-label" title="Double-click to rename"><!--[-->Overview<!--]--></div><div class="scene-shot-actions"><button type="button" class="gev-action-button gev-action-button--compact scene-shot-btn" data-audit="panel-button-7"><!--[-->LOAD<!--]--></button><button type="button" class="gev-action-button gev-action-button--danger gev-action-button--compact scene-shot-btn scene-shot-danger" data-audit="panel-button-8"><!--[-->Delete shot<!--]--></button></div></div><div class="scene-shot-meta">NORMAL · OFF · 3.0s + 1.0s</div></div><!--]--></div></section><div class="scene-controls" data-director-authoring=""><button type="button" class="gev-action-button scene-btn" data-audit="panel-button-9"><!--[-->EDIT DETAILS<!--]--></button><button type="button" class="gev-action-button scene-btn" data-audit="panel-button-10"><!--[-->SHARE SCENE<!--]--></button></div><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-start-btn" data-audit="panel-scene-start-btn-11"><!--[-->START<!--]--></button><button type="button" class="gev-action-button gev-action-button--danger scene-btn scene-btn-danger" disabled="" id="scene-stop-btn" data-audit="panel-scene-stop-btn-12"><!--[-->STOP<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-next-btn" data-audit="panel-scene-next-btn-13"><!--[-->NEXT<!--]--></button></div><div class="scene-progress"><div id="scene-progress-fill" style="width:50%;">50%</div></div><div id="scene-status" role="status">Ready</div><div class="scene-controls"><button type="button" class="gev-action-button scene-btn" id="scene-export-btn" data-audit="panel-scene-export-btn-14"><!--[-->EXPORT PRESETS<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-import-btn" data-audit="panel-scene-import-btn-15"><!--[-->IMPORT<!--]--></button><button type="button" class="gev-action-button scene-btn" id="scene-download-btn" data-audit="panel-scene-download-btn-16"><!--[-->RUN LOG<!--]--></button><input id="scene-import-file" type="file" accept="application/json,.json" data-audit="panel-scene-import-file-17"></div></div></div></section><dialog data-director-dialog="" class="director-sharing-dialog stories-dialog gev-surface" aria-label="Edit scene details" data-audit="details-dialog-8" open=""><h2>Edit scene details</h2><p class="stories-dialog-context">Story / Overview</p><div class="stories-dialog-body"><!--[--><p>Camera positions use degrees and meters.</p><!--]--><div class="stories-details"><label>Anchors and data packs<textarea data-scene-detail="sceneText" rows="9" class="gev-field" aria-label="Anchors and data packs" data-audit="details-sceneText-6">{}</textarea></label><label>Shot camera, timing, packs and actions<textarea data-scene-detail="shotText" rows="9" class="gev-field" aria-label="Shot camera, timing, packs and actions" data-audit="details-shotText-7">{}</textarea></label><label>New anchor ID<input data-scene-detail="anchorName" class="gev-field" aria-label="New anchor ID" value="anchor" data-audit="details-anchorName-5"></label><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="details-button-0"><!--[-->Capture camera as anchor<!--]--></button><button type="button" class="gev-action-button" data-audit="details-button-1"><!--[-->Set move start to current camera<!--]--></button><button type="button" class="gev-action-button" data-audit="details-button-2"><!--[-->Use ordinary flight<!--]--></button></div></div><!--v-if--></div><p role="status">Ready</p><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="details-button-3"><!--[-->Cancel<!--]--></button><!--v-if--><button type="button" class="gev-action-button" data-director-apply-details="" data-audit="details-button-4"><!--[-->Apply details<!--]--></button><!--v-if--><!--v-if--></div></dialog><dialog data-director-dialog="" class="director-sharing-dialog stories-dialog gev-surface" aria-label="Share selected scene" data-audit="share-dialog-0" open=""><h2>Share selected scene</h2><!--v-if--><div class="stories-dialog-body"><!--[--><p>Explicit selected files only.</p><!--]--><!--v-if--><!--[--><label class="stories-file-chooser"><span>Choose data-pack files</span><input type="file" aria-label="Choose data-pack files" data-scene-assets="files" multiple="" data-audit="share-input-1"><span class="stories-file-row" aria-hidden="true" data-audit="share-span-2"><span data-audit="share-span-3">Choose files</span><span>No file chosen</span></span></label><label class="stories-file-chooser"><span>Or choose a data-pack folder</span><input type="file" aria-label="Or choose a data-pack folder" data-scene-assets="folder" multiple="" webkitdirectory="" data-audit="share-input-4"><span class="stories-file-row" aria-hidden="true" data-audit="share-span-5"><span data-audit="share-span-6">Choose files</span><span>No file chosen</span></span></label><!--]--></div><p role="status">Ready</p><div class="stories-dialog-actions"><button type="button" class="gev-action-button" data-audit="share-button-7"><!--[-->Cancel<!--]--></button><!--v-if--><!--v-if--><button type="button" class="gev-action-button" data-audit="share-button-8"><!--[-->Download scene JSON<!--]--></button><button type="button" class="gev-action-button" data-audit="share-button-9"><!--[-->Download asset bundle<!--]--></button></div></dialog><div id="scene-runtime" class="stories-playback"><div class="stories-runtime"><span>Story / Overview</span><button type="button" class="gev-action-button gev-action-button--danger gev-action-button--compact stories-runtime-stop" id="scene-runtime-stop" data-audit="runtime-scene-runtime-stop-0"><!--[-->STOP<!--]--></button></div></div>',
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
    html: toolsHtml,
    outsideClasses: ['gev-surface', 'gev-tools'],
  },
  {
    sheet: 'layer-browser',
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
  storiesFixture,
];
