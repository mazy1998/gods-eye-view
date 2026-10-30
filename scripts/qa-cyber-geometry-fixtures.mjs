import {
  fixtures as palettes,
  storiesFixture,
} from './qa-cyber-precedence-fixtures.mjs';
import { JSDOM } from 'jsdom';
/** Fixed content isolates CSS geometry from feeds, fonts and app startup. */
const host = (html) =>
  `<div id="gev-legacy-host" class="gev-legacy-host" style="display:flex;flex-direction:column;width:380px;height:700px">${html}</div>`;
const samples = [
  { id: 'layers', html: '' },
  {
    id: 'stories',
    html: '<div class="stories-controls gev-surface"><div class="scene-controls"><select id="scene-select" class="gev-field" data-geometry="select"><option>Story</option></select></div><div class="scene-controls"><button id="scene-start-btn" class="scene-btn gev-action-button" data-geometry="play">Play</button></div></div>',
  },
  {
    id: 'tools',
    html: host(
      '<section id="pp-toggles" style="position:relative;inset:auto;opacity:1;width:380px"><section id="geo-import-group" class="pp-toggle-group gev-tools gev-surface" data-geometry="import-frame"><button id="geo-import-button" class="pp-toggle-btn" data-geometry="import-button">Import data</button></section><section id="draw-group" class="pp-toggle-group gev-tools gev-surface" data-geometry="draw-frame"><button id="draw-toggle" class="pp-toggle-btn" data-geometry="draw-button">Draw</button><div class="pp-slider-row visible"><input id="draw-label-input" class="pp-text-input" data-geometry="draw-label" placeholder="Label"></div></section></section>',
    ),
  },
  {
    id: 'voice',
    html: '<div id="command-dock"><div id="gev-voice-control" class="gev-surface" data-status="idle" data-geometry="frame"><div class="gev-voice-heading"><div class="gev-voice-kicker">AI AGENT</div><div id="gev-voice-status" data-geometry="status">OFF</div></div><button id="gev-voice-button" data-geometry="mic"><span class="gev-mic-orbit" data-geometry="orbit"><img src="/mic.svg" alt=""></span><span class="gev-mic-label">ON/OFF</span></button><div class="gev-voice-visualizer"></div><div class="gev-voice-readout"><div id="gev-voice-detail">VOICE STANDBY</div></div></div></div>',
  },
];

/** Read templates from the audited revision, so real selector ancestry is retained. */
export function createFixtures(read) {
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document;
  const load = (file, selector) => {
    const template = doc.createElement('template');
    template.innerHTML = read(file);
    const el = template.content.querySelector(selector);
    if (!el) throw Error(`Missing app fixture root: ${selector}`);
    el.classList.remove('collapsed');
    el.classList.add('active');
    el.style.cssText =
      'position:relative;inset:auto;transform:none;opacity:1;width:380px';
    return el;
  };
  const result = samples.map((sample) => {
    const sheet = {
      layers: 'layer-browser',
      stories: 'stories',
      tools: 'tool-views',
      voice: 'voice-dock-view',
    }[sample.id];
    const structuralExceptions =
      palettes.find((f) => f.sheet === sheet)?.structuralExceptions ?? [];
    if (sample.id === 'voice') return { ...sample, profile: 'default' };
    const original = doc.createElement('template');
    original.innerHTML = sample.html;
    let root,
      profile = 'default';
    if (sample.id === 'tools') {
      root = load('src/ui/templates/display-controls.html', '#pp-toggles');
      const body = root.querySelector('.pp-panel-body');
      if (!body) throw Error('Missing app tools body');
      const cards = [
        ...body.querySelectorAll('#draw-group, #geo-import-group'),
      ];
      if (cards.length !== 2) throw Error('Missing app tool cards');
      for (const card of cards) {
        const sampleCard = original.content.querySelector('#' + card.id);
        card.dataset.geometry = sampleCard.dataset.geometry;
        card.replaceChildren(...sampleCard.childNodes);
      }
      const navigation = read('src/ui/drawerNavigation.js');
      const destination =
        /id:\s*'tools'([\s\S]*?)\n\s*\}/.exec(navigation)?.[1] ?? '';
      const tools = /elements:\s*\[([^\]]+)\]/.exec(destination);
      if (tools) {
        const ids = [...tools[1].matchAll(/'([^']+)'/g)].map(
          (match) => match[1],
        );
        const hosted = ids
          .map((id) => cards.find((card) => card.id === id))
          .filter(Boolean);
        if (hosted.length !== 2)
          throw Error('Tools destination must host both tool cards');
        return {
          id: sample.id,
          profile: 'drawer',
          html: host(hosted.map((card) => card.outerHTML).join('')),
        };
      }
      profile = 'map-home';
      body.replaceChildren(...cards);
    } else {
      const id = sample.id === 'layers' ? 'data-panel' : 'scene-panel';
      root = load('src/ui/templates/layer-panels.html', '#' + id);
      root.querySelector('.panel-glow')?.remove();
      const inner = root.querySelector(
        sample.id === 'layers' ? '.data-panel-inner' : '.scene-panel-inner',
      );
      inner.dataset.geometry = 'frame';
      const header = inner.querySelector(':scope > .panel-header');
      header.dataset.geometry = 'header';
      for (const [key, selector] of [
        ['title', '.panel-title'],
        ['divider', '.panel-divider'],
        ['collapse', '.panel-collapse-btn'],
      ])
        header.querySelector(selector).dataset.geometry = key;
      if (sample.id === 'layers') {
        const mount = root.querySelector('#data-toggles');
        const source = read('src/ui/LayerPanelView.vue');
        const markup = doc.createElement('template');
        markup.innerHTML = source.slice(
          source.indexOf('<template>') + 10,
          source.lastIndexOf('</template>'),
        );
        const sourceRoot = markup.content.querySelector(
          'section.layer-browser',
        );
        const sourceInput = sourceRoot?.querySelector('input.layer-filter');
        if (!sourceRoot || !sourceInput)
          throw Error('Missing app layer finder');
        const view = sourceRoot.cloneNode(false);
        const input = sourceInput.cloneNode(false);
        input.dataset.geometry = 'search';
        if (sourceInput.parentElement.classList.contains('layer-search')) {
          profile = 'icon-finder';
          const wrapper = sourceInput.parentElement.cloneNode(false);
          const icon = sourceInput.parentElement.querySelector(
            '.material-symbols-outlined',
          );
          if (icon) wrapper.append(icon.cloneNode(true));
          wrapper.append(input);
          view.append(wrapper);
        } else view.append(input);
        const rows = doc.createElement('div');
        rows.style.height = '220px';
        rows.textContent = 'Layer rows';
        view.append(rows);
        mount.replaceChildren(view);
      } else {
        const source = read('src/ui/StoriesPanelView.vue');
        const markup = doc.createElement('template');
        markup.innerHTML = source.slice(
          source.indexOf('<template>') + 10,
          source.lastIndexOf('</template>'),
        );
        if (markup.content.querySelector('.stories-authoring')) {
          profile = 'playlist-cards';
          const content = doc.createElement('template');
          content.innerHTML = storiesFixture.html;
          const view = content.content.querySelector('.stories-controls');
          const probes = {
            library: '.stories-library',
            recipe: '.stories-recipe',
            art: '.stories-recipe-art',
            summary: '.stories-selected',
            play: '#scene-start-btn',
            select: '#scene-select',
            authoring: '.stories-authoring',
          };
          for (const [name, selector] of Object.entries(probes))
            view.querySelector(selector).dataset.geometry = name;
          const library = view.querySelector('.stories-library');
          for (let index = 0; index < 5; index++) {
            const card = library.firstElementChild.cloneNode(true);
            card.removeAttribute('data-geometry');
            library.append(card);
          }
          root.querySelector('#scene-controls-body').replaceChildren(view);
        } else
          root
            .querySelector('#scene-controls-body')
            .replaceChildren(
              original.content.querySelector('.stories-controls'),
            );
      }
    }
    return {
      id: sample.id,
      profile,
      html: host(root.outerHTML),
      structuralExceptions:
        sample.id === 'stories' && profile === 'playlist-cards'
          ? storiesFixture.structuralExceptions
          : structuralExceptions,
    };
  });
  if (read('src/ui/applicationShell.js').includes('component: SettingsView')) {
    const vueTemplate = (file) => {
      const source = read(file),
        template = doc.createElement('template');
      template.innerHTML = source.slice(
        source.indexOf('<template>') + 10,
        source.lastIndexOf('</template>'),
      );
      return template.content;
    };
    const view = vueTemplate('src/ui/settings/SettingsView.vue').querySelector(
      '.gev-settings',
    );
    const section = view.querySelector('.gev-settings-section');
    const providers = section.querySelector('.gev-settings-providers');
    const form = load('src/ui/templates/provider-settings.html', '#key-setup');
    form.removeAttribute('hidden');
    form.classList.add('key-setup-embedded', 'visible');
    form.style.width = '356px';
    form.dataset.geometry = 'provider-frame';
    form.querySelector('h2').dataset.geometry = 'provider-title';
    form.querySelector('#key-setup-description').remove();
    const prototype = vueTemplate(
      'src/ui/settings/ProviderKeyRows.vue',
    ).querySelector('.key-setup-row');
    if (!prototype?.querySelector('.key-setup-state'))
      throw Error('Missing provider state label');
    const rows = form.querySelector('[data-key-setup-rows]');
    const expectedGeometry = [];
    for (const [id, name, exposed] of [
      ['cesium', 'Cesium ion', true],
      ['google', 'Google Maps', true],
      ['openai', 'OpenAI', false],
    ]) {
      const row = prototype.cloneNode(false),
        header = prototype.querySelector('.key-setup-row-head').cloneNode(true);
      header.querySelector('.key-setup-external').remove();
      header.querySelector('.key-setup-get').remove();
      if (!exposed) header.querySelector('.key-setup-exposed').remove();
      const title = header.querySelector('strong'),
        state = header.querySelector('.key-setup-state');
      title.textContent = name;
      state.textContent = 'Not configured';
      header.querySelector('.key-setup-tier').textContent = '●';
      if (exposed)
        header.querySelector('.key-setup-exposed').textContent = 'browser-side';
      row.append(header);
      row.dataset.set = 'false';
      row.dataset.geometry = id + '-row';
      title.dataset.geometry = id + '-name';
      state.dataset.geometry = id + '-state';
      rows.append(row);
      for (const el of [title, state])
        expectedGeometry.push({
          node: el.dataset.geometry,
          property: 'textLines',
          value: 1,
          reason:
            'Provider names and their state pills each stay on one line; metadata may wrap independently.',
        });
      expectedGeometry.push({
        node: state.dataset.geometry,
        property: 'fontSize',
        value: 8,
        reason:
          'New provider states use the existing Cyber browser-side pill typography, rather than the body font.',
      });
      expectedGeometry.push({
        node: title.dataset.geometry,
        property: 'fontSize',
        value: 11.2,
        reason: 'Cyber retains its existing provider-name typography.',
      });
    }
    providers.replaceChildren(form);
    section.replaceChildren(providers);
    view.replaceChildren(section);
    for (const el of [view, ...view.querySelectorAll('*')])
      for (const attribute of [...el.attributes])
        if (/^(v-|:|@)/.test(attribute.name))
          el.removeAttribute(attribute.name);
    result.push({
      id: 'settings',
      profile: 'provider-headers',
      // The added metadata changes content height; frame insets and visibility
      // stay comparable, while explicit expectations pin the new header type.
      properties: [
        'visible',
        'display',
        'position',
        'backdrop',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopLeftRadius',
      ],
      html: `<div class="gev-drawer-body" style="width:390px;padding:0 12px">${view.outerHTML}</div>`,
      expectedGeometry,
      structuralExceptions: [
        {
          id: 'provider-status-pills',
          reason:
            'The hosted form gains compact status pills beside the existing product names. Fixed header content isolates wrapping from credentials and provider payloads; the existing frame and title remain visible.',
        },
      ],
    });
  }
  // Map & Look inside the real Display panel: its frame, DISPLAY header and
  // divider stay strict; the tabs, tiles and footer are its structural
  // exceptions. Seven style tiles and five map-source tiles show the columns.
  const mapLook = palettes.find((f) => f.sheet === 'map-look');
  const display = load('src/ui/templates/display-controls.html', '#pp-toggles');
  const content = doc.createElement('template');
  content.innerHTML = mapLook.html;
  const view = content.content.querySelector('.map-look');
  if (!view) throw Error('Missing Map & Look fixture');
  const grow = (selector, count) => {
    const first = view.querySelector(selector);
    for (
      let index = first.parentElement.children.length;
      index < count;
      index++
    )
      first.parentElement.append(first.cloneNode(true));
  };
  grow('.style-btn', 7);
  grow('.map-stack-chip:not(.unavailable)', 5);
  display.querySelector('.pp-panel-body').replaceChildren(view);
  display.dataset.geometry = 'frame';
  for (const [key, root, selector] of [
    ['header', display, '.pp-header-row'],
    ['title', display, '.pp-header-label'],
    ['divider', display, '.panel-divider'],
    ['collapse', display, '.panel-collapse-btn'],
    ['tabs', view, '.gev-tabs'],
    ['style-grid', view, '#style-buttons'],
    ['style-tile', view, '.style-btn'],
    ['style-tile-2', view, '.style-btn:nth-child(2)'],
    ['adjustments', view, '.map-look-adjustments'],
    ['hint', view, '.map-look-hint'],
    ['source-chips', view, '#map-stack-chips'],
    ['source-tile', view, '.map-stack-chip'],
    ['source-tile-2', view, '.map-stack-chip:nth-child(2)'],
    ['providers', view, '.map-look-providers'],
  ])
    root.querySelector(selector).dataset.geometry = key;
  result.push({
    id: 'map-look',
    profile: 'drawer',
    html: host(display.outerHTML),
    structuralExceptions: mapLook.structuralExceptions,
  });
  dom.window.close();
  const chrome = doc.createElement('template');
  chrome.innerHTML =
    read('src/ui/templates/scene-chrome.html') +
    read('src/ui/templates/provider-settings.html');
  const indicator = chrome.content.querySelector('#style-indicator');
  const corner = chrome.content.querySelector('#corner-actions');
  if (!indicator || !corner) throw Error('Missing shell visibility controls');
  indicator.dataset.geometry = 'style-readout';
  const value = doc.createElement('span');
  value.className = 'indicator-value';
  value.textContent = 'FLIR';
  indicator.append(value);
  corner.dataset.geometry = 'corner-row';
  corner.querySelector('#key-setup-chip')?.remove();
  const locale = corner.querySelector('#locale-picker');
  if (!locale) throw Error('Missing language picker host');
  locale.innerHTML =
    '<button class="locale-picker-button" data-geometry="language-chip">EN</button>';
  result.push({
    id: 'shell-visibility',
    profile: 'default',
    // Only presence and layout mode are compared here; the shell's frame
    // geometry has its own mounted comparisons. The font's display rule is
    // supplied locally so the audit never depends on an installed font.
    properties: ['visible', 'display'],
    html: `<style>.material-symbols-outlined{display:block}</style><nav class="gev-rail"><button class="gev-rail-item"><span class="gev-rail-icon material-symbols-outlined" data-geometry="rail-circle"><span class="gev-rail-glyph material-symbols-outlined">layers</span></span><span class="gev-rail-label">Layers</span></button></nav><div id="intel-hud"></div>${indicator.outerHTML}${corner.outerHTML}`,
  });
  // Supplement the original frame geometry with every real Tools control.
  // Structural content additions may change row height; none may hide an
  // existing header, field, action or state under Cyber.
  result.push({
    id: 'tools-visibility',
    profile: 'drawer',
    html: palettes
      .find((f) => f.sheet === 'tool-views')
      .html.replaceAll('data-audit=', 'data-geometry='),
    properties: ['visible'],
  });
  // Constrain the real card: an unconstrained fixture cannot expose a label
  // squeezed by a long heading. Metadata may wrap; state always fits one line.
  for (const width of [366, 320])
    for (const state of ['OFF', 'ON']) {
      const markup = doc.createElement('template');
      markup.innerHTML = palettes.find((f) => f.sheet === 'tool-views').html;
      const card = markup.content.querySelector('#directions-controls-body');
      const draw = markup.content.querySelector('#draw-group');
      const toggle = card.querySelector('.gev-tools-route-toggle');
      const label = toggle.querySelector('.gev-toggle-label');
      for (const element of [card, draw]) {
        element.style.width = width + 'px';
        element.style.boxSizing = 'border-box';
      }
      for (const row of draw.querySelectorAll('.pp-slider-row')) row.remove();
      toggle.setAttribute('aria-checked', String(state === 'ON'));
      label.textContent = state;
      toggle.dataset.geometry = 'switch';
      label.dataset.geometry = 'state';
      card.querySelector('.gev-tools-subtitle').dataset.geometry = 'metadata';
      draw.querySelector('.gev-tools-subtitle').dataset.geometry =
        'draw-metadata';
      result.push({
        id: `tools-header-${width}-${state.toLowerCase()}`,
        profile: 'drawer',
        html: host(card.outerHTML + draw.outerHTML),
        properties: ['visible'],
        expectedGeometry: [
          {
            node: 'state',
            property: 'textLines',
            value: 1,
            reason:
              'The visible switch state stays on one line, including at a narrow drawer width.',
          },
          {
            node: 'switch',
            property: 'height',
            value: 24,
            reason:
              'The state control retains the existing compact Cyber target height.',
          },
          {
            node: 'metadata',
            property: 'fontSize',
            value: 9,
            reason:
              'Directions metadata uses the compact Cyber metadata type, below its heading.',
          },
          {
            node: 'draw-metadata',
            property: 'fontSize',
            value: 9,
            reason:
              'Draw metadata must not be larger than its compact Cyber title.',
          },
        ],
      });
    }
  return result;
}
const reasons = {
  layers:
    'The added finder contributes a full-width field and natural content height. Expected values are specific to its actual plain or icon-wrapper structure; frame insets and headers remain strict.',
  stories:
    'The existing story surface inset narrows the transport rows and adds vertical spacing; the legacy outer frame and header remain strict.',
  tools:
    'The existing padded tool surfaces inset their controls by 12px. Expected boxes are measured inside the real panel body; card shifts and visibility remain strict.',
};
const existingExceptions = [
  ['layers', 'default', 'frame', 'height', 319, 360.796875],
  ['layers', 'default', 'search', 'display', 'inline-block', 'block'],
  ['layers', 'default', 'search', 'width', 169, 316],
  ['layers', 'default', 'search', 'height', 19, 34.796875],
  ['layers', 'default', 'search', 'x', 0, 13],
  ['layers', 'default', 'search', 'y', 0, 13],
  ['layers', 'default', 'search', 'paddingTop', 0, 8],
  ['layers', 'default', 'search', 'paddingRight', 0, 8],
  ['layers', 'default', 'search', 'paddingBottom', 0, 8],
  ['layers', 'default', 'search', 'paddingLeft', 0, 8],
  ['stories', 'default', 'frame', 'height', 149, 159],
  ['stories', 'default', 'select', 'width', 350, 332],
  ['stories', 'default', 'play', 'width', 350, 332],
  ['tools', 'default', 'draw-frame', 'height', 74, 100],
  ['tools', 'default', 'draw-frame', 'paddingTop', 0, 12],
  ['tools', 'default', 'draw-frame', 'paddingRight', 0, 12],
  ['tools', 'default', 'draw-frame', 'paddingBottom', 0, 12],
  ['tools', 'default', 'draw-frame', 'paddingLeft', 0, 12],
  ['tools', 'default', 'draw-button', 'width', 362, 336],
  ['tools', 'default', 'draw-button', 'x', 0, 13],
  ['tools', 'default', 'draw-button', 'y', 0, 13],
  ['tools', 'default', 'draw-label', 'width', 340, 314],
  ['tools', 'default', 'import-frame', 'height', 38, 64],
  ['tools', 'default', 'import-frame', 'y', 81, 107],
  ['tools', 'default', 'import-frame', 'paddingTop', 0, 12],
  ['tools', 'default', 'import-frame', 'paddingRight', 0, 12],
  ['tools', 'default', 'import-frame', 'paddingBottom', 0, 12],
  ['tools', 'default', 'import-frame', 'paddingLeft', 0, 12],
  ['tools', 'default', 'import-button', 'width', 362, 336],
  ['tools', 'default', 'import-button', 'x', 0, 13],
  ['tools', 'default', 'import-button', 'y', 0, 13],
  ['layers', 'icon-finder', 'frame', 'height', 320, 362.796875],
  ['layers', 'icon-finder', 'search', 'display', 'inline-block', 'block'],
  ['layers', 'icon-finder', 'search', 'width', 169, 316],
  ['layers', 'icon-finder', 'search', 'height', 19, 36.796875],
  ['layers', 'icon-finder', 'search', 'x', 57.796875, 0],
  ['layers', 'icon-finder', 'search', 'paddingTop', 0, 9],
  ['layers', 'icon-finder', 'search', 'paddingRight', 0, 12],
  ['layers', 'icon-finder', 'search', 'paddingBottom', 0, 9],
  ['layers', 'icon-finder', 'search', 'paddingLeft', 0, 36],
].map(([fixture, profile, node, property, reference, actual]) => ({
  fixture,
  profile: fixture === 'tools' ? 'map-home' : profile,
  node,
  property,
  reference,
  actual,
  reason: reasons[fixture],
}));

const portExceptions = [
  ...existingExceptions,
  ...[
    ['import-frame', 'height', 31, 64],
    ['import-frame', 'paddingTop', 0, 12],
    ['import-frame', 'paddingRight', 0, 12],
    ['import-frame', 'paddingBottom', 0, 12],
    ['import-frame', 'paddingLeft', 0, 12],
    ['import-button', 'width', 380, 354],
    ['import-button', 'height', 31, 38],
    ['import-button', 'x', 0, 13],
    ['import-button', 'y', 0, 13],
    ['draw-frame', 'height', 67, 100],
    ['draw-frame', 'y', 31, 76],
    ['draw-frame', 'paddingTop', 0, 12],
    ['draw-frame', 'paddingRight', 0, 12],
    ['draw-frame', 'paddingBottom', 0, 12],
    ['draw-frame', 'paddingLeft', 0, 12],
    ['draw-button', 'width', 380, 354],
    ['draw-button', 'height', 31, 38],
    ['draw-button', 'x', 0, 13],
    ['draw-button', 'y', 0, 13],
    ['draw-label', 'width', 358, 332],
  ].map(([node, property, reference, actual]) => ({
    fixture: 'tools',
    profile: 'drawer',
    node,
    property,
    reference,
    actual,
    reason:
      'The drawer hosts these existing padded tool cards at full width with 38px minimum button targets. These exact inset and target-size differences from the original stylesheet are intentional; visibility, display and frame modes are not exempted.',
  })),
];

const structureReasons = Object.fromEntries(
  storiesFixture.structuralExceptions.map((e) => [e.id, e.reason]),
);
const mapLookReasons = Object.fromEntries(
  palettes
    .find((f) => f.sheet === 'map-look')
    .structuralExceptions.map((e) => [e.id, e.reason]),
);
export const exceptions = [
  {
    fixture: 'shell-visibility',
    node: 'rail-circle',
    property: 'display',
    reference: 'block',
    actual: 'flex',
    reason:
      'The shared rail centres its glyph in the existing circle using a flex wrapper; Cyber keeps its circle frame, palette and typography. This visible layout-mode change is deliberate.',
  },
  ...portExceptions,
  ...[
    ['library', 'display', 'block', 'grid', 'library-cap'],
    ['recipe', 'display', 'inline-block', 'grid', 'recipe-art-cards'],
    ['art', 'display', 'inline', 'grid', 'recipe-art-cards'],
    ['summary', 'display', 'block', 'flex', 'playlist-summary'],
    ['play', 'display', 'block', 'flex', 'primary-transport'],
    ['authoring', 'display', 'block', 'flex', 'authoring-order'],
    ['frame', 'height', 954, 700, 'library-cap'],
    ['library', 'width', 350, 332, 'library-cap'],
    ['library', 'height', 38, 360, 'library-cap'],
    ['recipe', 'width', 84.28125, 332, 'recipe-art-cards'],
    ['recipe', 'height', 19, 84, 'recipe-art-cards'],
    ['recipe', 'paddingTop', 0, 12, 'recipe-art-cards'],
    ['recipe', 'paddingRight', 0, 12, 'recipe-art-cards'],
    ['recipe', 'paddingBottom', 0, 12, 'recipe-art-cards'],
    ['recipe', 'paddingLeft', 0, 12, 'recipe-art-cards'],
    ['art', 'width', 0, 56, 'recipe-art-cards'],
    ['art', 'height', 15, 56, 'recipe-art-cards'],
    ['art', 'x', 2, 13, 'recipe-art-cards'],
    ['art', 'y', 2, 14, 'recipe-art-cards'],
    ['summary', 'width', 350, 332, 'playlist-summary'],
    ['summary', 'height', 19, 50, 'playlist-summary'],
    ['summary', 'y', 38, 368, 'playlist-summary'],
    ['summary', 'paddingTop', 0, 12, 'playlist-summary'],
    ['play', 'width', 350, 332, 'primary-transport'],
    ['play', 'height', 354, 44, 'primary-transport'],
    ['authoring', 'width', 350, 332, 'authoring-order'],
    ['authoring', 'height', 183, 189, 'authoring-order'],
    ['authoring', 'y', 205, 249, 'authoring-order'],
    ['select', 'width', 350, 332, 'authoring-order'],
  ].map(([node, property, reference, actual, reason]) => ({
    fixture: 'stories',
    profile: 'playlist-cards',
    node,
    property,
    reference,
    actual,
    reason: structureReasons[reason],
  })),
  ...[
    ['frame', 'height', 1024.984375, 700, 'map-look-tabs'],
    ['tabs', 'display', 'block', 'flex', 'map-look-tabs'],
    ['tabs', 'width', 362, 354, 'map-look-tabs'],
    ['tabs', 'height', 19, 40, 'map-look-tabs'],
    ['tabs', 'x', 0, 4, 'map-look-tabs'],
    ['tabs', 'y', 0, 4, 'map-look-tabs'],
    ['style-grid', 'display', 'block', 'grid', 'style-tiles'],
    ['style-grid', 'width', 362, 354, 'style-tiles'],
    ['style-grid', 'height', 315, 434.125, 'style-tiles'],
    ['style-tile', 'display', 'flex', 'grid', 'style-tiles'],
    ['style-tile', 'position', 'relative', 'static', 'style-tiles'],
    ['style-tile', 'width', 78, 171, 'style-tiles'],
    ['style-tile', 'height', 45, 99.53125, 'style-tiles'],
    ['style-tile', 'paddingTop', 14, 0, 'style-tiles'],
    ['style-tile', 'paddingRight', 16, 0, 'style-tiles'],
    ['style-tile', 'paddingBottom', 10, 0, 'style-tiles'],
    ['style-tile', 'paddingLeft', 16, 0, 'style-tiles'],
    ['style-tile-2', 'display', 'flex', 'grid', 'style-tiles'],
    ['style-tile-2', 'position', 'relative', 'static', 'style-tiles'],
    ['style-tile-2', 'width', 78, 171, 'style-tiles'],
    ['style-tile-2', 'height', 45, 99.53125, 'style-tiles'],
    ['style-tile-2', 'x', 0, 183, 'style-tiles'],
    ['style-tile-2', 'y', 45, 0, 'style-tiles'],
    ['style-tile-2', 'paddingTop', 14, 0, 'style-tiles'],
    ['style-tile-2', 'paddingRight', 16, 0, 'style-tiles'],
    ['style-tile-2', 'paddingBottom', 10, 0, 'style-tiles'],
    ['style-tile-2', 'paddingLeft', 16, 0, 'style-tiles'],
    ['adjustments', 'display', 'block', 'flex', 'image-adjustments'],
    ['adjustments', 'width', 362, 354, 'image-adjustments'],
    ['adjustments', 'height', 89, 103.59375, 'image-adjustments'],
    ['adjustments', 'y', 315, 446.125, 'image-adjustments'],
    ['adjustments', 'paddingTop', 0, 12, 'image-adjustments'],
    ['hint', 'display', 'block', 'flex', 'panel-footer'],
    ['hint', 'width', 362, 354, 'panel-footer'],
    ['hint', 'height', 272.390625, 27.59375, 'panel-footer'],
    ['hint', 'y', 404, 561.71875, 'panel-footer'],
    ['hint', 'paddingTop', 0, 12, 'panel-footer'],
    ['source-chips', 'width', 362, 354, 'map-source-tiles'],
    ['source-chips', 'height', 20, 148, 'map-source-tiles'],
    ['source-chips', 'y', 41, 47.1875, 'map-source-tiles'],
    ['source-tile', 'width', 69.1875, 173, 'map-source-tiles'],
    ['source-tile', 'height', 20, 44, 'map-source-tiles'],
    ['source-tile', 'paddingTop', 4, 8, 'map-source-tiles'],
    ['source-tile', 'paddingRight', 7, 12, 'map-source-tiles'],
    ['source-tile', 'paddingBottom', 4, 8, 'map-source-tiles'],
    ['source-tile', 'paddingLeft', 7, 12, 'map-source-tiles'],
    ['source-tile-2', 'width', 69.203125, 173, 'map-source-tiles'],
    ['source-tile-2', 'height', 20, 44, 'map-source-tiles'],
    ['source-tile-2', 'x', 73.1875, 181, 'map-source-tiles'],
    ['source-tile-2', 'paddingTop', 4, 8, 'map-source-tiles'],
    ['source-tile-2', 'paddingRight', 7, 12, 'map-source-tiles'],
    ['source-tile-2', 'paddingBottom', 4, 8, 'map-source-tiles'],
    ['source-tile-2', 'paddingLeft', 7, 12, 'map-source-tiles'],
    ['providers', 'display', 'inline-block', 'flex', 'panel-footer'],
    ['providers', 'width', 188.59375, 354, 'panel-footer'],
    ['providers', 'height', 203.59375, 44, 'panel-footer'],
    ['providers', 'x', 0, 4, 'panel-footer'],
    ['providers', 'y', 764.390625, 864.5, 'panel-footer'],
    ['providers', 'paddingTop', 0, 8, 'panel-footer'],
    ['providers', 'paddingBottom', 0, 8, 'panel-footer'],
    ['providers', 'borderTopWidth', 2, 0, 'panel-footer'],
    ['providers', 'borderRightWidth', 2, 0, 'panel-footer'],
    ['providers', 'borderBottomWidth', 2, 0, 'panel-footer'],
    ['providers', 'borderLeftWidth', 2, 0, 'panel-footer'],
  ].map(([node, property, reference, actual, reason]) => ({
    fixture: 'map-look',
    profile: 'drawer',
    node,
    property,
    reference,
    actual,
    reason: mapLookReasons[reason],
  })),
];
