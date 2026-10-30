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
    ['frame', 'height', 645.328125, 700, 'library-cap'],
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
    ['summary', 'x', 0, 9, 'playlist-summary'],
    ['summary', 'y', 193, 561, 'playlist-summary'],
    ['summary', 'paddingTop', 0, 12, 'playlist-summary'],
    ['play', 'width', 111.328125, 332, 'primary-transport'],
    ['play', 'height', 115.328125, 44, 'primary-transport'],
    ['authoring', 'width', 350, 332, 'authoring-order'],
    ['authoring', 'height', 183, 189, 'authoring-order'],
    ['authoring', 'x', 0, 9, 'authoring-order'],
    ['authoring', 'y', 372.328125, 776, 'authoring-order'],
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
];
