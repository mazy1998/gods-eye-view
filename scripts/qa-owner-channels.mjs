#!/usr/bin/env node
/** Owner channels on dev: real visual controls publish their change once, layer views follow. */
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
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
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(
    `${process.env.QA_BASE_URL || 'http://127.0.0.1:4189'}/?welcome=0`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForFunction(
    () =>
      window.__godsEyeView?.styleManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 60000 },
  );
  // Each step runs a real entry point, then reports the publications it caused.
  const steps = await page.evaluate(async () => {
    const shell = window.__godsEyeView.styleManager;
    const owner = shell._visualSettings;
    const seen = [];
    owner.channel.subscribe(({ state }) => seen.push(state), {
      emitCurrent: false,
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    const input = (id, value) => {
      const slider = document.getElementById(id);
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const run = async (name, act, read) => {
      const from = seen.length;
      await act();
      await settle();
      const published = seen.slice(from);
      return {
        name,
        count: published.length,
        value: published.length ? read(published.at(-1)) : null,
        // The channel carries the view state: getVisualState() plus display
        // settings that share links and stories do not carry.
        current: read(owner.getViewState()),
        matches:
          published.length > 0 &&
          JSON.stringify(published.at(-1)) ===
            JSON.stringify(owner.getViewState()),
      };
    };
    for (const id of ['pp-toggles']) {
      shell.setPanelCollapsed(id, false, { persist: false, syncShare: false });
    }
    const out = [];
    out.push(
      await run(
        'voice setHudVisible(off)',
        () => shell.setHudVisible('off'),
        (s) => s.hud.visible,
      ),
    );
    out.push(
      await run(
        'HUD toggle button',
        () => document.getElementById('hud-toggle').click(),
        (s) => s.hud.visible,
      ),
    );
    out.push(
      await run(
        'Display scope toggle',
        () => document.getElementById('scope-toggle').click(),
        (s) => s.scope.enabled,
      ),
    );
    out.push(
      await run(
        'Display scope feather',
        () => input('scope-feather-slider', 37),
        (s) => s.scope.featherPct,
      ),
    );
    out.push(
      await run(
        'sharpen slider',
        () => input('sharpen-intensity-slider', 73),
        (s) => s.sharpen.intensity,
      ),
    );
    out.push(
      await run(
        'bloom toggle',
        () => document.getElementById('bloom-toggle').click(),
        (s) => s.bloom.enabled,
      ),
    );
    // Display settings outside share links publish directly (S11a).
    out.push(
      await run(
        'celestial ring',
        () => document.getElementById('celestial-toggle').click(),
        (s) => s.celestial.enabled,
      ),
    );
    out.push(
      await run(
        'Cyber sonar toggle',
        () => document.getElementById('cyber-sonar-toggle').click(),
        (s) => s.sonar.enabled,
      ),
    );
    out.push(
      await run(
        'Cyber sonar rings',
        () => input('cyber-sonar-rings', 5),
        (s) => s.sonar.rings,
      ),
    );
    out.push(
      await run(
        '3D models toggle',
        () => document.getElementById('models3d-toggle').click(),
        (s) => s.models3d.enabled,
      ),
    );
    out.push(
      await run(
        '3D models mode (All)',
        () => document.getElementById('models3d-mode-all').click(),
        (s) => s.models3d.mode,
      ),
    );
    out.push(
      await run(
        'clean view',
        () => document.getElementById('clean-view-toggle').click(),
        (s) => s.cleanView,
      ),
    );
    out.push(
      await run(
        'clean view exit',
        () => document.getElementById('clean-view-exit').click(),
        (s) => s.cleanView,
      ),
    );
    out.push(
      await run(
        'style button (Noir)',
        () => document.querySelector('.style-btn[data-style="noir"]').click(),
        (s) => s.style,
      ),
    );
    out.push(
      await run(
        'map-source chip (OSM)',
        async () => {
          document.querySelector('[data-stack-id="osm"]').click();
          for (let i = 0; i < 200; i++) {
            if (shell.mapStackController.getActiveId() === 'osm') break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        },
        (s) => s.mapStack,
      ),
    );
    out.push(
      await run(
        'no change: a repeated sync publishes nothing',
        () => shell._syncShareState(),
        (s) => s.style,
      ),
    );
    return out;
  });
  const expected = {
    'voice setHudVisible(off)': false,
    'HUD toggle button': true,
    'Display scope toggle': undefined,
    'Display scope feather': 37,
    'sharpen slider': 73,
    'bloom toggle': undefined,
    'celestial ring': undefined,
    'Cyber sonar toggle': undefined,
    'Cyber sonar rings': 5,
    '3D models toggle': undefined,
    '3D models mode (All)': 'all',
    'clean view': true,
    'clean view exit': false,
    'style button (Noir)': 'noir',
    'map-source chip (OSM)': 'osm',
  };
  for (const step of steps) {
    if (step.name.startsWith('no change')) {
      check(step.name, step.count === 0, step);
      continue;
    }
    const want = expected[step.name];
    check(
      `${step.name} publishes the new state`,
      step.matches &&
        step.value === step.current &&
        (want === undefined || step.value === want),
      step,
    );
    // Repeated syncs within one change (a style's preset, a map switch's
    // progress) publish once, because unchanged state is not published again.
    check(`${step.name} publishes exactly once`, step.count === 1, step);
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(steps.map((step) => [step.name, step.count])),
    ),
  );
  check('no uncaught browser errors', errors.length === 0, errors);
} finally {
  await browser.close();
}
console.log(`${checks} checks; ${failures} failures`);
process.exitCode = failures ? 1 : 0;
