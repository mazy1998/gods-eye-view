#!/usr/bin/env node
/** Phone destination restoration and Cyber Search hosting, against a local preview. */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { contrastRatio, parseColor } from './check-token-contrast.mjs';

const output = process.argv[process.argv.indexOf('--out') + 1];
if (!process.argv.includes('--out') || !output)
  throw Error('--out is required');
const results = { checks: [], errors: [] };
const check = (name, pass, detail) => {
  results.checks.push({ name, pass: Boolean(pass), detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
};
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    ...(process.platform === 'darwin'
      ? ['--use-angle=metal', '--enable-gpu']
      : ['--use-angle=swiftshader']),
  ],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => results.errors.push(error.message));
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });
  const url = new URL(process.env.QA_BASE_URL || 'http://localhost:4184');
  url.searchParams.set('welcome', '0');
  url.hash =
    'lat=40.7128&lon=-74.006&alt=3000&heading=0&pitch=-45&v=2&map=osm&ui=s.c.0';
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      window.__godsEyeView?.styleManager?._mobileShell &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 60000 },
  );
  const restored = await page.evaluate(() => {
    const ui = window.__godsEyeView.styleManager;
    const opened = ui._mobileShell.channel.getSnapshot();
    ui._mobileShell.setSheet(null);
    const scene = ui._panelChrome
      ._buildSharePanelState()
      .specs.find((spec) => spec.id === 'scene-panel');
    return { opened, scene };
  });
  check(
    'a cold Stories share opens its phone destination',
    restored.opened.sheet === 'more' &&
      restored.opened.destination === 'stories',
    restored,
  );
  check(
    'closing the sheet retains its restored panel preference',
    restored.scene?.collapsed === false,
    restored.scene,
  );
  const columns = await page.evaluate(() => {
    const bar = document.getElementById('mobile-tab-bar');
    return {
      tracks: getComputedStyle(bar).gridTemplateColumns.split(' '),
      widths: [...bar.children].map((el) => el.getBoundingClientRect().width),
    };
  });
  check(
    'four tabs occupy four equal tracks',
    columns.tracks.length === 4 &&
      Math.max(...columns.widths) - Math.min(...columns.widths) < 1,
    columns,
  );
  await page.evaluate(() => {
    const ui = window.__godsEyeView.styleManager;
    ui.setHudLayout('cyber');
    ui.setHudVisible('off');
    ui._mobileShell.setSheet('search');
  });
  const hosted = await page.evaluate(() => {
    const panel = document.getElementById('location-bar');
    const reference = document.createElement('div');
    reference.id = 'command-dock';
    reference.style.cssText =
      'position:fixed!important;display:block!important;visibility:hidden;inset:0 auto auto 0;width:366px;pointer-events:none';
    const clone = panel.cloneNode(true);
    reference.append(clone);
    document.body.append(reference);
    const sample = (root) => {
      const deck = root.querySelector('#location-bar-popover');
      const pill = root.querySelector('.location-pill');
      const pick = (node, pseudo, properties) => {
        const style = getComputedStyle(node, pseudo);
        return Object.fromEntries(properties.map((key) => [key, style[key]]));
      };
      return {
        title: pick(deck, '::before', ['content', 'color', 'fontSize']),
        frame: pick(deck, '::after', [
          'backgroundImage',
          'borderTopColor',
          'borderTopWidth',
          'borderTopStyle',
          'clipPath',
        ]),
        pill: pick(pill, null, [
          'backgroundImage',
          'borderTopColor',
          'borderTopStyle',
          'clipPath',
        ]),
      };
    };
    try {
      const actual = sample(panel),
        expected = sample(clone);
      const field = panel.querySelector('#location-search');
      return {
        actual,
        expected,
        visible: panel.checkVisibility({
          visibilityProperty: true,
          opacityProperty: true,
        }),
        fieldVisible: field.checkVisibility({
          visibilityProperty: true,
          opacityProperty: true,
        }),
        parent: panel.parentElement.id,
        unclippedPills: [
          ...panel.querySelectorAll('.location-pill, .poi-pill'),
        ].every((pill) => pill.scrollWidth <= pill.clientWidth + 1),
      };
    } finally {
      reference.remove();
    }
  });
  check(
    'the borrowed Search deck preserves Cyber title, frame and pill skin',
    JSON.stringify(hosted.actual) === JSON.stringify(hosted.expected) &&
      hosted.actual.title.content.includes('NAVIGATION DECK'),
    hosted,
  );
  check(
    'the original Search field remains visible in the phone host',
    hosted.visible &&
      hosted.fieldVisible &&
      hosted.parent === 'mobile-sheet-panels',
    hosted,
  );
  check(
    'Search pill labels keep their full width in the native scroller',
    hosted.unclippedPills,
    hosted,
  );
  const tools = await page.evaluate(() => {
    const ui = window.__godsEyeView.styleManager;
    ui._mobileShell.setDestination('map');
    const hiddenAtHome = ['draw-group', 'geo-import-group'].every(
      (id) =>
        !document
          .getElementById(id)
          .checkVisibility({ visibilityProperty: true, opacityProperty: true }),
    );
    ui._mobileShell.setDestination('tools');
    return {
      hiddenAtHome,
      visibleInTools: ['draw-group', 'geo-import-group'].every((id) =>
        document
          .getElementById(id)
          .checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      ),
    };
  });
  check(
    'Import and Draw appear only in Tools',
    tools.hiddenAtHome && tools.visibleInTools,
    tools,
  );
  for (const width of [390, 430]) {
    await page.setViewport({
      width,
      height: width === 390 ? 844 : 932,
      isMobile: true,
      hasTouch: true,
    });
    await page.evaluate(() => {
      const ui = window.__godsEyeView.styleManager;
      ui.setHudLayout('tactical');
      ui.setHudVisible('off');
      ui._appearance.set('light');
      ui._mobileShell.setDestination('map');
    });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const tabs = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '#mobile-sheet-panels [role="tab"][aria-controls^="map-look-"]',
        ),
      ].map((tab) => {
        const backgrounds = [];
        for (let node = tab; node; node = node.parentElement) {
          backgrounds.push(getComputedStyle(node).backgroundColor);
          if (node.id === 'mobile-sheet') break;
        }
        return {
          text: tab.textContent.trim(),
          color: getComputedStyle(tab).color,
          backgrounds,
          visible: tab.checkVisibility({
            visibilityProperty: true,
            opacityProperty: true,
          }),
        };
      }),
    );
    const composite = (front, back) =>
      front
        .slice(0, 3)
        .map((value, i) => value * front[3] + back[i] * (1 - front[3]));
    const measured = tabs.map((tab) => ({
      ...tab,
      // Bound the scene behind the translucent sheet with black and white.
      contrast: Math.min(
        ...[
          [0, 0, 0],
          [255, 255, 255],
        ].map((backdrop) => {
          const background = tab.backgrounds.reduceRight(
            (back, color) => composite(parseColor(color), back),
            backdrop,
          );
          return contrastRatio(
            composite(parseColor(tab.color), background),
            background,
          );
        }),
      ),
    }));
    check(
      `Light Map & Look tabs meet 4.5:1 at ${width}px`,
      measured.length === 3 &&
        measured.every((tab) => tab.visible && tab.contrast >= 4.5),
      measured,
    );
  }
  check(
    'no uncaught browser errors',
    results.errors.length === 0,
    results.errors,
  );
} finally {
  await browser.close();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
}
if (results.checks.some((item) => !item.pass)) process.exitCode = 1;
