#!/usr/bin/env node
/**
 * Primitive components in all three appearances, on dev. Serves its own
 * fixture page (nothing joins the app bundle), mounts every primitive inside
 * a ported `.gev-surface` panel beside an unported legacy sample, and per
 * appearance: screenshots it, measures each visible text's contrast against
 * its composited background (over black and white backdrops), checks the
 * keyboard focus ring against the panel, and proves the legacy sample is
 * unchanged.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4189';
const fixture = `${base}/__qa-primitives`;
const out = 'qa-shots/primitives';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1180 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  const text = message.text();
  // Vite's HMR socket is irrelevant to a fixture page and may be blocked.
  if (/\[vite\]|WebSocket connection/.test(text)) return;
  if (message.type() === 'error' || text.includes('[Vue warn]')) errors.push(text);
});
const cdp = await page.createCDPSession();
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
await page.setRequestInterception(true);
page.on('request', (request) =>
  request.url().endsWith('/favicon.ico')
    ? request.respond({ status: 204 })
    : request.url() === fixture
    ? request.respond({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Primitives</title>
<style>
  html, body { overflow: auto; }
  /* Measure settled colours, not a transition between appearances. */
  *, *::before, *::after { transition: none !important; }
  html body { background: linear-gradient(115deg, #1d3b2a 0%, #3f6b4a 22%, #c9d6c2 38%, #1e4f78 55%, #0d2238 72%, #e9eef0 88%); min-height: 100vh; }
  #stage { display: flex; gap: 32px; align-items: flex-start; padding: 32px; }
  .qa-panel { width: 400px; padding-bottom: 16px; }
  .qa-section { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px; }
  .qa-legacy { width: 320px; padding: 16px; display: grid; gap: 8px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--panel-radius); }
</style></head><body><div id="stage"></div></body></html>`,
      })
    : request.continue(),
);


/** Each visible text in the panel with its worst contrast against the
    backgrounds composited behind it, over black and white backdrops. */
function auditTexts() {
  const parse = (value) => {
    const m = value.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const over = ([r, g, b, a], base) => [r, g, b].map((c, i) => c * a + base[i] * (1 - a));
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const surface = document.getElementById('qa-surface');
  /** Worst ratio of `ink` against the composited backgrounds behind `el`. */
  const worst = (el, ink) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg[3] > 0) layers.unshift(bg);
      if (node === surface) break;
    }
    return Math.min(
      ...[[0, 0, 0], [255, 255, 255]].map((backdrop) => {
        const paint = layers.reduce((acc, layer) => over(layer, acc), backdrop);
        return ratio(over(ink, paint), paint);
      }),
    );
  };
  const texts = [];
  for (const el of surface.querySelectorAll('*')) {
    // Inactive controls (disabled, or busy with aria-disabled) are exempt.
    if (el.closest('[aria-hidden="true"], :disabled, [aria-disabled="true"], option')) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText && !el.matches('select, input[type="number"]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const ink = parse(getComputedStyle(el).color);
    texts.push({
      what: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.textContent || el.value).trim().slice(0, 24)}"`,
      ratio: Math.round(worst(el, ink) * 100) / 100,
    });
  }
  return texts;
}

let checks = 0;
let failures = 0;
const check = (name, passed, detail) => {
  checks++;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  if (!passed) {
    failures++;
    console.log(JSON.stringify(detail));
  }
};

try {
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await import('/style.css');
    const mountSource = await (await fetch('/src/ui/mountView.js')).text();
    const vueUrl = mountSource.match(/from\s+["']([^"']*vue[^"']*)["']/)[1];
    const { h, reactive } = await import(vueUrl);
    const { mountView } = await import('/src/ui/mountView.js');
    const load = async (name) =>
      (await import(`/src/ui/primitives/${name}.vue`)).default;
    const [
      ActionButton,
      DisclosureRow,
      FilterChip,
      IconButton,
      NumberField,
      PanelHeader,
      QuantitativeSlider,
      SegmentedControl,
      SelectField,
      StatusBadge,
      SurfaceCard,
      TabList,
      ToggleSwitch,
    ] = await Promise.all(
      [
        'ActionButton',
        'DisclosureRow',
        'FilterChip',
        'IconButton',
        'NumberField',
        'PanelHeader',
        'QuantitativeSlider',
        'SegmentedControl',
        'SelectField',
        'StatusBadge',
        'SurfaceCard',
        'TabList',
        'ToggleSwitch',
      ].map(load),
    );
    // The owner: plain state, applied on every emit, as a feature owner would.
    const state = reactive({
      tab: 'all',
      flights: true,
      military: false,
      space: false,
      environment: true,
      aircraft: true,
      vessels: false,
      quality: 'medium',
      pinned: true,
      style: 'sat',
      zoom: '12',
      bloom: 0.4,
    });
    const bind = (key) => ({
      modelValue: state[key],
      'onUpdate:modelValue': (value) => (state[key] = value),
    });
    const section = (...children) => h('div', { class: 'qa-section' }, children);
    // Legacy-backed variants, mounted in the surface and in the unported
    // sample with the same data-qa key so the Cyber pass can compare them.
    const QUALITY = [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High', disabled: true },
    ];
    const STYLES = [
      { value: 'sat', label: 'Satellite' },
      { value: 'osm', label: 'Streets' },
    ];
    const LEGACY_BACKED = {
      segmented: [SegmentedControl, { label: 'Quality', options: QUALITY, modelValue: 'medium' }],
      action: [ActionButton, { label: 'SHARE VIEW' }],
      'action-danger': [ActionButton, { label: 'CLEAR ACTIVE', variant: 'danger' }],
      'action-compact': [ActionButton, { label: 'RESET', size: 'compact' }],
      'action-compact-danger': [ActionButton, { label: 'DELETE', variant: 'danger', size: 'compact' }],
      select: [SelectField, { label: 'Map style', options: STYLES, modelValue: 'sat' }],
      number: [NumberField, { label: 'Zoom', min: 0, max: 20, density: 'compact', modelValue: '12' }],
      slider: [QuantitativeSlider, { label: 'Bloom', min: 0, max: 1, step: 0.1, modelValue: 0.4 }],
      'badge-pill': [StatusBadge, { label: 'LIVE' }],
      'badge-box': [StatusBadge, { label: 'CAL · CURATED', appearance: 'box' }],
      'badge-plain': [StatusBadge, { label: 'updated 8s ago', appearance: 'plain' }],
    };
    const legacyBacked = (key, extra = {}) => {
      const [component, props] = LEGACY_BACKED[key];
      return h(component, { ...props, ...extra, 'data-qa': key });
    };
    const Gallery = {
      setup: () => () =>
        h('div', { class: 'gev-surface qa-panel', id: 'qa-surface' }, [
          h(
            PanelHeader,
            { title: 'Layers', subtitle: 'Choose what appears on the globe' },
            { actions: () => h(IconButton, { label: 'Close', size: 'sm' }, () => '✕') },
          ),
          h(TabList, {
            ...bind('tab'),
            label: 'Layer list',
            tabs: [
              { value: 'all', label: 'All layers' },
              { value: 'active', label: 'Active' },
              { value: 'mine', label: 'My data' },
            ],
          }),
          section(
            h(ToggleSwitch, { ...bind('flights'), label: 'Live flights' }),
            h(ToggleSwitch, { ...bind('military'), label: 'Military flights' }),
            h(ToggleSwitch, { label: 'Street traffic', disabled: true }),
            h(ToggleSwitch, { label: 'Radar (loading)', modelValue: true, busy: true }),
          ),
          h(
            DisclosureRow,
            { ...bind('space'), label: 'Space', description: 'Satellites · launches' },
            { icon: () => '★' },
          ),
          h(DisclosureRow, { ...bind('environment'), label: 'Environment' }),
          section(
            h(FilterChip, { ...bind('aircraft'), label: 'Aircraft' }),
            h(FilterChip, { ...bind('vessels'), label: 'Vessels' }),
            h(IconButton, { label: 'Pin view', pressed: state.pinned, onClick: () => (state.pinned = !state.pinned) }, () => '⌖'),
            h(IconButton, { label: 'Settings' }, () => '⚙'),
          ),
          section(legacyBacked('segmented', bind('quality'))),
          section(
            legacyBacked('action'),
            legacyBacked('action-danger'),
            legacyBacked('action-compact'),
            legacyBacked('action-compact-danger'),
          ),
          section(
            legacyBacked('select', bind('style')),
            legacyBacked('number', bind('zoom')),
            legacyBacked('slider', bind('bloom')),
          ),
          section(
            legacyBacked('badge-pill'),
            legacyBacked('badge-box'),
            legacyBacked('badge-plain'),
          ),
          section(
            h(SurfaceCard, { title: 'Live flights' }, () =>
              h('p', { class: 'qa-card-text' }, '1,248 aircraft · OpenSky'),
            ),
          ),
        ]),
    };
    const stage = document.getElementById('stage');
    mountView(Gallery, { parent: stage });
    // Unported legacy controls: must look the same in every appearance.
    const legacy = stage.appendChild(document.createElement('div'));
    legacy.className = 'qa-legacy';
    legacy.id = 'qa-legacy';
    mountView({ setup: () => () => Object.keys(LEGACY_BACKED).map((key) => legacyBacked(key)) }, { parent: legacy });
  });

  check(
    'tokens and primitive stylesheets are loaded',
    await page.evaluate(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue('--gev-text').trim() !== '' &&
        getComputedStyle(document.querySelector('.gev-toggle-track')).width === '36px',
    ),
  );

  const legacySnapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#qa-legacy *')].map((el) => {
        const cs = getComputedStyle(el);
        return [el.tagName, cs.color, cs.backgroundColor, cs.borderTopColor].join('|');
      }),
    );
  const legacyDefault = await legacySnapshot();

  for (const appearance of ['original', 'transparent-dark', 'light']) {
    await page.evaluate((value) => {
      if (value === 'original') delete document.documentElement.dataset.gevAppearance;
      else document.documentElement.dataset.gevAppearance = value;
    }, appearance);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${out}/${appearance}.png`, fullPage: true });

    const audit = await page.evaluate(auditTexts);
    const low = audit.filter((t) => t.ratio < 4.5);
    check(`${appearance}: all ${audit.length} visible texts in the panel meet 4.5:1`, low.length === 0, low);

    // Forced interaction states: hover, pressed and keyboard focus restyle text
    // and tints, so each is measured like the resting state.
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: '#qa-surface :is(button, select, input)',
    });
    for (const state of [['hover'], ['hover', 'active'], ['focus', 'focus-visible']]) {
      for (const nodeId of nodeIds)
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state });
      const forced = await page.evaluate(auditTexts);
      for (const nodeId of nodeIds)
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      const weakState = forced.filter((t) => t.ratio < 4.5);
      check(
        `${appearance}: :${state.join(':')} on ${nodeIds.length} controls keeps all ${forced.length} texts at 4.5:1`,
        weakState.length === 0,
        weakState,
      );
    }

    // Keyboard focus: every tab stop in the panel shows a ring at 3:1.
    await page.evaluate(() => document.activeElement?.blur());
    const rings = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        const surface = document.getElementById('qa-surface');
        if (!surface.contains(el)) return null;
        const cs = getComputedStyle(el);
        const parse = (v) => v.match(/^rgba?\(([^)]+)\)$/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        const lum = ([r, g, b]) =>
          [r, g, b]
            .map((c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4))
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const [sr, sg, sb, sa = 1] = parse(getComputedStyle(surface).backgroundColor);
        const outline = parse(cs.outlineColor);
        const worst = Math.min(
          ...[0, 255].map((b) => {
            const paint = [sr, sg, sb].map((c) => c * sa + b * (1 - sa));
            const [hi, lo] = [lum(outline), lum(paint)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
          }),
        );
        return { what: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`, style: cs.outlineStyle, width: cs.outlineWidth, ratio: Math.round(worst * 100) / 100 };
      });
      if (ring) rings.push(ring);
    }
    const weak = rings.filter((r) => r.style === 'none' || parseFloat(r.width) < 2 || r.ratio < 3);
    check(`${appearance}: ${rings.length} keyboard stops show a 2px ring at 3:1`, rings.length >= 12 && weak.length === 0, { weak, rings: rings.length });

    check(
      `${appearance}: the unported legacy sample is unchanged`,
      JSON.stringify(await legacySnapshot()) === JSON.stringify(legacyDefault),
    );
  }

  // Cyber keeps its own palette inside a ported surface: each legacy-backed
  // variant must render exactly as the same variant in the unported sample,
  // at rest and under forced hover and focus, with or without an appearance.
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds: keyed } = await cdp.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '[data-qa]',
  });
  for (const appearance of [null, 'light']) {
    await page.evaluate((value) => {
      const root = document.documentElement;
      root.dataset.uiTheme = 'cyber';
      if (value) root.dataset.gevAppearance = value;
      else delete root.dataset.gevAppearance;
    }, appearance);
    const mismatches = [];
    for (const state of [[], ['hover'], ['focus', 'focus-visible']]) {
      for (const nodeId of keyed)
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state });
      mismatches.push(
        ...(await page.evaluate((label) => {
          const props = ['color', 'background-color', 'background-image', 'border-top-color', 'box-shadow', 'outline-color', 'opacity'];
          const read = (el) => props.map((p) => `${p}=${getComputedStyle(el).getPropertyValue(p)}`).join('|');
          return [...document.querySelectorAll('#qa-surface [data-qa]')].flatMap((inside) => {
            const outside = document.querySelector(`#qa-legacy [data-qa="${inside.dataset.qa}"]`);
            const [a, b] = [read(inside), read(outside)];
            return a === b ? [] : [{ state: label, key: inside.dataset.qa, inside: a, outside: b }];
          });
        }, state.join(':') || 'rest')),
      );
      for (const nodeId of keyed)
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    check(
      `Cyber${appearance ? ` over ${appearance}` : ''}: ${keyed.length / 2} legacy-backed variants in the surface match the unported sample at rest, hover and focus`,
      mismatches.length === 0,
      mismatches.slice(0, 4),
    );
    // Token-native primitives take Cyber's palette from the Cyber tokens:
    // none paints the original cyan, and their texts meet 4.5:1 at rest and
    // in forced states. Legacy-backed controls (badges, segmented, buttons,
    // fields, sliders) are held to Cyber's own legacy look above instead.
    const LEGACY_BACKED =
      '.gev-status-badge, .gev-segmented, .gev-action-button, .scene-btn, .gev-field, .gev-quantitative-slider';
    const label = `Cyber${appearance ? ` over ${appearance}` : ''}`;
    // The surface frame takes Cyber's panel surface and shadow through the
    // Cyber tokens, measured against a sample painted with Cyber's own
    // variables.
    const frame = await page.evaluate(() => {
      const sample = document.createElement('div');
      sample.style.background = 'var(--cyber-panel-surface)';
      sample.style.boxShadow = 'var(--cyber-panel-shadow)';
      document.body.append(sample);
      const read = (el) => {
        const cs = getComputedStyle(el);
        return { background: cs.backgroundColor, shadow: cs.boxShadow };
      };
      const result = {
        surface: read(document.getElementById('qa-surface')),
        cyber: read(sample),
      };
      sample.remove();
      return result;
    });
    check(
      `${label}: the surface frame uses Cyber's panel surface and shadow`,
      JSON.stringify(frame.surface) === JSON.stringify(frame.cyber),
      frame,
    );
    const { nodeIds: controls } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: '#qa-surface :is(button, select, input)',
    });
    for (const state of [[], ['hover'], ['focus', 'focus-visible']]) {
      for (const nodeId of controls)
        await cdp.send('CSS.forcePseudoState', {
          nodeId,
          forcedPseudoClasses: state,
        });
      const cyan = await page.evaluate(
        (legacy) =>
          [...document.querySelectorAll('#qa-surface *')].flatMap((el) => {
            if (el.closest(legacy)) return [];
            const cs = getComputedStyle(el);
            return [
              'color',
              'background-color',
              'border-top-color',
              'outline-color',
            ]
              .map((name) => cs.getPropertyValue(name))
              .filter((value) =>
                /^rgba?\((0, 212, 255|157, 239, 255)\b/.test(value),
              )
              .map(
                (value) =>
                  `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${value}`,
              );
          }),
        LEGACY_BACKED,
      );
      const weak = (await page.evaluate(auditTexts)).filter(
        (t) =>
          t.ratio < 4.5 &&
          !/^\w+\.(gev-status-badge|gev-segment|gev-action-button|scene-btn|gev-field|gev-quantitative-slider)\b/.test(
            t.what,
          ),
      );
      for (const nodeId of controls)
        await cdp.send('CSS.forcePseudoState', {
          nodeId,
          forcedPseudoClasses: [],
        });
      const when = state.length ? `:${state.join(':')}` : 'at rest';
      check(
        `${label}: token-native primitives use Cyber's palette, not the original cyan, ${when}`,
        cyan.length === 0,
        cyan.slice(0, 6),
      );
      check(
        `${label}: every text in the surface meets 4.5:1 ${when}`,
        weak.length === 0,
        weak.slice(0, 6),
      );
    }
  }
  await page.evaluate(() => delete document.documentElement.dataset.uiTheme);

  // One owner round trip in the real browser.
  await page.evaluate(() => delete document.documentElement.dataset.gevAppearance);
  const flip = await page.evaluate(async () => {
    const row = document.querySelector('.gev-disclosure-row');
    const before = row.getAttribute('aria-expanded');
    row.click();
    // The gallery's own state repaints on Vue's scheduler.
    await Promise.resolve();
    return [before, row.getAttribute('aria-expanded')];
  });
  check('a click reaches the owner and repaints', flip[0] === 'false' && flip[1] === 'true', flip);
  check('no page errors or Vue warnings', errors.length === 0, errors);
} catch (error) {
  failures++;
  console.error(error);
} finally {
  await browser.close();
}
console.log(`${checks} checks; ${failures} failures`);
process.exitCode = failures ? 1 : 0;
