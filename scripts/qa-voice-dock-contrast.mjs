#!/usr/bin/env node
/**
 * Rendered contrast of the voice dock's microphone glyph: in each appearance
 * and in Cyber, idle and active, the glyph's strongest pixel against the
 * orbit's background inside the glyph box must reach 3:1 (WCAG 1.4.11 non-text contrast).
 * Measured from screenshot pixels, so filters, opacity and translucent layers
 * over the globe all count.
 */
import puppeteer from 'puppeteer';

const MINIMUM = 3;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let checks = 0;
let failures = 0;
const check = (name, passed, detail) => {
  checks++;
  console.log(
    `[${passed ? 'PASS' : 'FAIL'}] ${name} ${JSON.stringify(detail)}`,
  );
  if (!passed) failures++;
};

/** Background (most common colour) and the glyph pixel that contrasts most. */
const measure = (base64) =>
  page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data: px } = context.getImageData(0, 0, image.width, image.height);
    const luminance = ([r, g, b]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const counts = new Map();
    for (let i = 0; i < px.length; i += 4) {
      const key = `${px[i]},${px[i + 1]},${px[i + 2]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const background = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]
      .split(',')
      .map(Number);
    let best = { ratio: 1, colour: background };
    for (const key of counts.keys()) {
      const colour = key.split(',').map(Number);
      const value = ratio(colour, background);
      if (value > best.ratio) best = { ratio: value, colour };
    }
    return {
      background: `rgb(${background})`,
      glyph: `rgb(${best.colour})`,
      ratio: Math.round(best.ratio * 100) / 100,
    };
  }, base64);

try {
  await page.goto(
    `${process.env.QA_BASE_URL || 'http://127.0.0.1:4189'}/?welcome=0`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForFunction(
    () =>
      document.getElementById('loading-screen')?.classList.contains('hidden') &&
      document.querySelector('#gev-voice-button .gev-mic-orbit img'),
    { timeout: 90000 },
  );
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
  await page.mouse.move(5, 5);
  for (const look of ['original', 'transparent-dark', 'light', 'cyber']) {
    for (const status of ['idle', 'listening']) {
      await page.evaluate(
        (look, status) => {
          const html = document.documentElement;
          if (look === 'cyber') {
            html.setAttribute('data-ui-theme', 'cyber');
            html.removeAttribute('data-gev-appearance');
          } else {
            html.removeAttribute('data-ui-theme');
            html.setAttribute('data-gev-appearance', look);
          }
          // Presentation only: the owner is not involved in this probe.
          document.getElementById('gev-voice-control').dataset.status = status;
        },
        look,
        status,
      );
      // The glyph's own box: the orbit's ring is outside it, so the strongest
      // pixel is the glyph and the commonest is the orbit behind it.
      const glyph = await page.$('#gev-voice-button .gev-mic-orbit img');
      const shot = await glyph.screenshot({ encoding: 'base64' });
      const result = await measure(shot);
      check(
        `mic glyph ${look} ${status} reaches ${MINIMUM}:1`,
        result.ratio >= MINIMUM,
        result,
      );
    }
  }
  check('no page errors', errors.length === 0, errors);
} finally {
  await browser.close();
}
console.log(`${checks} checks; ${failures} failures`);
process.exitCode = failures ? 1 : 0;
