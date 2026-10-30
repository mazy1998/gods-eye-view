#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { createFixtures, exceptions } from './qa-cyber-geometry-fixtures.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export function parseArgs(args) {
  const options = { repo: root, baseline: 'f2c6ff08', tolerance: 1 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') return { help: true };
    if (
      !['--repo', '--baseline', '--revision', '--out', '--tolerance'].includes(
        flag,
      ) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw Error(`Unknown or incomplete argument: ${flag}`);
    options[flag.slice(2)] = args[++i];
  }
  if (!options.out) throw Error('--out is required');
  options.repo = path.resolve(options.repo);
  options.tolerance = Number(options.tolerance);
  if (
    !Number.isFinite(options.tolerance) ||
    options.tolerance < 0 ||
    options.tolerance > 2
  )
    throw Error('Tolerance must be between 0 and 2 CSS pixels');
  return options;
}
const read = (o, ref, filename) =>
  ref
    ? execFileSync('git', ['show', `${ref}:${filename}`], {
        cwd: o.repo,
        encoding: 'utf8',
        maxBuffer: 8_000_000,
      })
    : fs.readFileSync(path.join(o.repo, filename), 'utf8');
function styles(o, ref) {
  return [...read(o, ref, 'style.css').matchAll(/@import '([^']+)'/g)]
    .map(([, filename]) => read(o, ref, filename))
    .join('\n');
}
export function compare(reference, actual, tolerance) {
  return typeof reference === 'number' && typeof actual === 'number'
    ? Math.abs(reference - actual) <= tolerance
    : reference === actual;
}
export function checkExpectedGeometry(expectations = [], snapshot) {
  return expectations.flatMap(({ node, property, value, reason }) => {
    const actual = snapshot[node]?.[property];
    return compare(value, actual, 0.05)
      ? []
      : [{ node, property, reference: value, actual, reason }];
  });
}
function hidesContent(e) {
  return (
    ['visible', 'visibility', 'opacity'].includes(e.property) ||
    (e.property === 'display' && [e.reference, e.actual].includes('none'))
  );
}
export function matchingException(
  entries,
  fixture,
  difference,
  tolerance,
  profile = 'default',
) {
  return entries.find(
    (e) =>
      !hidesContent(e) &&
      e.fixture === fixture &&
      (e.profile ?? 'default') === profile &&
      e.node === difference.node &&
      e.property === difference.property &&
      compare(e.reference, difference.reference, tolerance) &&
      compare(e.actual, difference.actual, tolerance),
  );
}
export function validateExceptions(entries) {
  for (const e of entries) {
    if (
      hidesContent(e) ||
      ![
        'layers',
        'stories',
        'tools',
        'voice',
        'shell-visibility',
        'settings',
        'map-look',
      ].includes(e.fixture) ||
      !e.node ||
      !e.property ||
      !Object.hasOwn(e, 'reference') ||
      !Object.hasOwn(e, 'actual') ||
      typeof e.reason !== 'string' ||
      !e.reason.trim()
    )
      throw Error('Invalid geometry exception');
  }
}
export async function audit(options) {
  // Resolve refs before handing them to git show; no checkout, server or build.
  for (const key of ['baseline', 'revision'])
    if (options[key])
      options[key] = execFileSync(
        'git',
        [
          'rev-parse',
          '--verify',
          '--end-of-options',
          `${options[key]}^{commit}`,
        ],
        { cwd: options.repo, encoding: 'utf8' },
      ).trim();
  validateExceptions(exceptions);
  const report = {
    baseline: options.baseline,
    revision: options.revision || 'working tree',
    tolerancePx: options.tolerance,
    results: [],
    failures: 0,
  };
  const css = [
    styles(options, options.baseline),
    styles(options, options.revision),
  ];
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const fixtureRead = (filename) =>
      read(
        options,
        options.revision === options.baseline ? null : options.revision,
        filename,
      );
    for (const fixture of createFixtures(fixtureRead)) {
      const snapshots = [];
      for (const sheet of css) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1586, height: 992 });
        await page.setRequestInterception(true);
        page.on('request', (r) => r.abort());
        await page.setContent(
          `<html data-ui-theme="cyber"><head><style>${sheet}</style><style>*{animation:none!important;transition:none!important}body{margin:0}.stories-controls .material-symbols-outlined{font-size:0!important}button,input,select{font-family:monospace!important}</style></head><body>${fixture.html}</body></html>`,
        );
        snapshots.push(
          await page.evaluate(
            (typography) =>
              Object.fromEntries(
                [...document.querySelectorAll('[data-geometry]')].map((el) => {
                  const s = getComputedStyle(el),
                    r = el.getBoundingClientRect(),
                    parent = el.parentElement.getBoundingClientRect();
                  const values = {
                    visible: el.checkVisibility({
                      visibilityProperty: true,
                      opacityProperty: true,
                    }),
                    display: s.display,
                    position: s.position,
                    width: r.width,
                    height: r.height,
                    x: r.x - parent.x,
                    y: r.y - parent.y,
                    backdrop: s.backdropFilter,
                  };
                  if (typography) {
                    values.fontSize = parseFloat(s.fontSize);
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    values.textLines = new Set(
                      [...range.getClientRects()]
                        .filter((r) => r.width > 0)
                        .map((r) => r.top),
                    ).size;
                  }
                  for (const name of [
                    'paddingTop',
                    'paddingRight',
                    'paddingBottom',
                    'paddingLeft',
                    'borderTopWidth',
                    'borderRightWidth',
                    'borderBottomWidth',
                    'borderLeftWidth',
                    'borderTopLeftRadius',
                  ])
                    values[name] = parseFloat(s[name]) || 0;
                  return [el.dataset.geometry, values];
                }),
              ),
            Boolean(fixture.expectedGeometry),
          ),
        );
        await page.close();
      }
      const result = {
        fixture: fixture.id,
        profile: fixture.profile,
        structuralExceptions: fixture.structuralExceptions ?? [],
        expectedGeometry: fixture.expectedGeometry ?? [],
        reference: snapshots[0],
        actual: snapshots[1],
        mismatches: [],
        allowed: [],
      };
      for (const [node, values] of Object.entries(snapshots[0]))
        for (const [property, reference] of Object.entries(values)) {
          if (fixture.properties && !fixture.properties.includes(property))
            continue;
          const actual = snapshots[1][node]?.[property];
          if (compare(reference, actual, options.tolerance)) continue;
          const difference = { node, property, reference, actual };
          const exception = matchingException(
            exceptions,
            fixture.id,
            difference,
            options.tolerance,
            fixture.profile,
          );
          if (exception)
            result.allowed.push({ ...difference, reason: exception.reason });
          else result.mismatches.push(difference);
        }
      result.mismatches.push(
        ...checkExpectedGeometry(fixture.expectedGeometry, snapshots[1]),
      );
      report.failures += result.mismatches.length;
      report.results.push(result);
      console.log(
        `[${result.mismatches.length ? 'FAIL' : 'PASS'}] ${fixture.id}: ${result.mismatches.length} unexpected geometry differences; ${result.allowed.length} reasoned exceptions`,
      );
      for (const d of result.mismatches)
        console.log(`  ${d.node}.${d.property}: ${d.reference} -> ${d.actual}`);
    }
  } finally {
    await browser.close();
  }
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  fs.writeFileSync(options.out, JSON.stringify(report, null, 2) + '\n');
  return report;
}
export async function runCli(args) {
  const o = parseArgs(args);
  if (o.help) {
    console.log(
      'Usage: node scripts/qa-cyber-geometry.mjs --out report.json [--revision ref] [--baseline ref] [--repo path] [--tolerance pixels]',
    );
    return 0;
  }
  const report = await audit(o);
  return report.failures ? 1 : 0;
}
if (
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) ===
    fs.realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`Cyber geometry error: ${error.message}`);
    process.exitCode = 2;
  }
}
