#!/usr/bin/env node
/** Deterministic Cyber palette audit. No dev server, app/provider calls or screenshots.
 * Usage and fixture/exception format: docs/CYBER-PRECEDENCE.md. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { fixtures as builtins } from './qa-cyber-precedence-fixtures.mjs';

export const STATES = [
  'rest',
  'hover',
  'active',
  'pressed',
  'checked',
  'selected',
  'focus',
];
export const PROPERTIES = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'outline',
  'boxShadow',
  'textShadow',
  'fill',
  'stroke',
];
const root = fileURLToPath(new URL('../', import.meta.url));
const nameOf = (value) => path.basename(value).replace(/\.css$/, '');
export function parseArgs(args) {
  const options = {
    repo: root,
    out: 'qa-artifacts/cyber-precedence/report.json',
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') {
      options.help = true;
      continue;
    }
    if (
      !['--stylesheets', '--fixture', '--repo', '--revision', '--out'].includes(
        flag,
      ) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    const key = flag.slice(2);
    if (Object.hasOwn(options, key) && !['repo', 'out'].includes(key))
      throw new Error(`Duplicate argument: ${flag}`);
    options[key] = args[++i];
  }
  options.repo = path.resolve(options.repo);
  if (options.stylesheets)
    options.stylesheets = [
      ...new Set(options.stylesheets.split(',').map((s) => nameOf(s.trim()))),
    ];
  return options;
}
export function validateFixture(fixture) {
  if (
    !fixture ||
    !/^[a-z0-9-]+$/.test(fixture.sheet) ||
    typeof fixture.html !== 'string' ||
    !fixture.html.includes('data-audit=') ||
    fixture.html.length > 1_000_000
  )
    throw new Error(
      'Fixture needs a sheet name and bounded HTML with data-audit controls',
    );
  if (
    fixture.outsideClasses &&
    (!Array.isArray(fixture.outsideClasses) ||
      fixture.outsideClasses.some((s) => !/^[\w-]+$/.test(s)))
  )
    throw new Error('outsideClasses must be literal class names');
  for (const exception of fixture.exceptions || []) {
    if (
      !exception ||
      typeof exception.variant !== 'string' ||
      !exception.variant ||
      exception.variant.includes('*') ||
      !STATES.includes(exception.state) ||
      !['sheet', 'surface'].includes(exception.comparison) ||
      !Array.isArray(exception.properties) ||
      !exception.properties.length ||
      exception.properties.some((p) => !PROPERTIES.includes(p)) ||
      typeof exception.reason !== 'string' ||
      !exception.reason.trim() ||
      (exception.expected !== undefined &&
        (!exception.expected ||
          typeof exception.expected !== 'object' ||
          Object.keys(exception.expected).length !==
            exception.properties.length ||
          exception.properties.some(
            (p) => typeof exception.expected[p] !== 'string',
          )))
    )
      throw new Error(`Invalid reasoned exception in ${fixture.sheet}`);
  }
  return fixture;
}
export function matchingException(
  exceptions,
  variant,
  state,
  comparison,
  property,
  present,
) {
  return exceptions.find(
    (e) =>
      e.variant === variant &&
      e.state === state &&
      e.comparison === comparison &&
      e.properties.includes(property) &&
      (!e.expected || e.expected[property] === present),
  );
}
const readSource = (options, filename) =>
  options.revision
    ? execFileSync('git', ['show', `${options.revision}:${filename}`], {
        cwd: options.repo,
        encoding: 'utf8',
        maxBuffer: 8_000_000,
      })
    : fs.readFileSync(path.join(options.repo, filename), 'utf8');

/** Browser-side paint oracle, also tested with synthetic computed styles. */
export function snapshotStyles(properties) {
  const values = {};
  for (const side of ['inside', 'outside'])
    for (const el of document.querySelectorAll(`#${side} [data-audit]`)) {
      for (const [suffix, node] of [
        ['', el],
        ...[...el.querySelectorAll('[data-probe]')].map((n) => [
          `/${n.dataset.probe}`,
          n,
        ]),
      ]) {
        const style = getComputedStyle(node);
        values[`${side}/${el.dataset.audit}${suffix}`] = Object.fromEntries(
          properties.map((p) => {
            if (/^(?:border(?:Top|Right|Bottom|Left)|outline)$/.test(p)) {
              const width = style[`${p}Width`],
                kind = style[`${p}Style`];
              return [
                p,
                !parseFloat(width) || kind === 'none' || kind === 'hidden'
                  ? 'none'
                  : `${width} ${kind} ${style[`${p}Color`]}`,
              ];
            }
            return [p, style[p]];
          }),
        );
      }
    }
  return values;
}

export async function audit(options) {
  const started = performance.now();
  if (options.revision)
    options = {
      ...options,
      revision: execFileSync(
        'git',
        [
          'rev-parse',
          '--verify',
          '--end-of-options',
          `${options.revision}^{commit}`,
        ],
        { cwd: options.repo, encoding: 'utf8' },
      ).trim(),
    };
  const supplied = options.fixture
    ? JSON.parse(fs.readFileSync(path.resolve(options.fixture), 'utf8'))
    : builtins;
  const available = (Array.isArray(supplied) ? supplied : [supplied]).map(
    validateFixture,
  );
  const ported = options.fixture
    ? available.map((f) => f.sheet)
    : [
        ...(
          readSource(options, 'src/ui/styles/tokens.test.mjs').match(
            /const PORTED = new Set\(\[([\s\S]*?)\]\.map/,
          )?.[1] || ''
        ).matchAll(/['"]([^'"]+)['"]/g),
      ]
        .map((m) => m[1])
        .filter((n) => n !== 'tokens');
  const selected = options.stylesheets || ported;
  if (!selected.length || selected.length > 30)
    throw new Error('Expected 1–30 ported sheets');
  const jobs = selected.map((sheet) => {
    const fixture = available.find((f) => f.sheet === sheet);
    if (!fixture)
      throw new Error(
        `No fixture for ${sheet}; supply --fixture or add its explicit built-in fixture`,
      );
    return fixture;
  });
  const imports = [
    ...readSource(options, 'style.css').matchAll(/@import '([^']+)';/g),
  ].map((m) => m[1].replace(/^\.\//, ''));
  const sheets = imports.map((filename) => ({
    filename,
    css: readSource(options, filename),
  }));
  for (const fixture of jobs)
    if (!imports.includes(`src/ui/styles/${fixture.sheet}.css`))
      throw new Error(`${fixture.sheet} is not imported by style.css`);
  const report = {
    revision: options.revision || 'working tree',
    appearances: ['original', 'light', 'transparent-dark'],
    results: [],
  };
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 15_000,
    timeout: 30_000,
  });
  try {
    for (const fixture of jobs) {
      const page = await browser.newPage();
      page.setDefaultTimeout(15_000);
      await page.setViewport({ width: 1440, height: 1000 });
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        void request.abort();
      });
      const styles = sheets
        .map(
          ({ filename, css }) =>
            `<style${filename === `src/ui/styles/${fixture.sheet}.css` ? ' id="audit-sheet"' : ''}>${css}</style>`,
        )
        .join('');
      await page.setContent(
        `<html data-ui-theme="cyber"><head>${styles}<style>*,*::before,*::after{transition:none!important;animation:none!important}body{overflow:auto!important}</style></head><body><div id="inside">${fixture.html}</div><div id="outside">${fixture.html}</div></body></html>`,
        { waitUntil: 'domcontentloaded' },
      );
      // Duplicate legacy IDs intentionally preserve identical CSS contexts.
      const metadata = await page.evaluate(
        (classes) => {
          for (const el of document.querySelectorAll('#outside *'))
            el.classList.remove(...classes);
          return [...document.querySelectorAll('#inside [data-audit]')].map(
            (el) => ({
              key: el.dataset.audit,
              states: [
                'rest',
                'hover',
                'active',
                'focus',
                ...['pressed', 'checked', 'selected'].filter((s) =>
                  el.hasAttribute(`data-state-${s}`),
                ),
              ],
              probes: [...el.querySelectorAll('[data-probe]')].map(
                (n) => n.dataset.probe,
              ),
            }),
          );
        },
        fixture.outsideClasses || ['gev-surface'],
      );
      if (
        !metadata.length ||
        metadata.length > 200 ||
        new Set(metadata.map((m) => m.key)).size !== metadata.length ||
        metadata.some(
          (m) =>
            !/^[\w-]+$/.test(m.key) ||
            m.probes.some((probe) => !/^[\w-]+$/.test(probe)) ||
            new Set(m.probes).size !== m.probes.length,
        )
      )
        throw new Error(
          `${fixture.sheet}: expected 1–200 uniquely named data-audit controls`,
        );
      const variants = metadata.flatMap((m) => [
        m.key,
        ...m.probes.map((p) => `${m.key}/${p}`),
      ]);
      for (const exception of fixture.exceptions || [])
        if (!variants.includes(exception.variant))
          throw new Error(
            `${fixture.sheet}: exception names missing variant ${exception.variant}`,
          );
      const cdp = await page.createCDPSession();
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      const { root: dom } = await cdp.send('DOM.getDocument');
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
        nodeId: dom.nodeId,
        selector: '[data-audit]',
      });
      const measure = () => page.evaluate(snapshotStyles, PROPERTIES);
      const result = {
        sheet: fixture.sheet,
        variants,
        samples: [],
        mismatches: [],
        allowed: [],
      };
      for (const appearance of report.appearances) {
        await page.evaluate((a) => {
          document.documentElement.dataset.gevAppearance = a;
        }, appearance);
        for (const state of STATES) {
          await page.evaluate((state) => {
            for (const el of document.querySelectorAll('[data-audit]')) {
              el.classList.toggle(
                'active',
                state === 'active' && el.hasAttribute('data-state-active'),
              );
              for (const key of ['pressed', 'checked', 'selected']) {
                if (state === key && el.hasAttribute(`data-state-${key}`))
                  el.setAttribute(`aria-${key}`, 'true');
                else el.removeAttribute(`aria-${key}`);
              }
            }
          }, state);
          const forced =
            state === 'hover'
              ? ['hover']
              : state === 'active'
                ? ['active']
                : state === 'focus'
                  ? ['focus', 'focus-visible']
                  : [];
          await Promise.all(
            nodeIds.map((nodeId) =>
              cdp.send('CSS.forcePseudoState', {
                nodeId,
                forcedPseudoClasses: forced,
              }),
            ),
          );
          const present = await measure();
          await page.$eval('#audit-sheet', (node) => {
            node.sheet.disabled = true;
          });
          const removed = await measure();
          await page.$eval('#audit-sheet', (node) => {
            node.sheet.disabled = false;
          });
          for (const variant of variants) {
            if (
              !metadata
                .find((m) => m.key === variant.split('/')[0])
                .states.includes(state)
            )
              continue;
            const key = `inside/${variant}`,
              outside = present[`outside/${variant}`];
            result.samples.push({
              appearance,
              state,
              variant,
              present: present[key],
              removed: removed[key],
              outside,
            });
            for (const [comparison, other] of [
              ['sheet', removed[key]],
              ['surface', outside],
            ])
              for (const property of PROPERTIES) {
                if (present[key][property] === other[property]) continue;
                const exception = matchingException(
                  fixture.exceptions || [],
                  variant,
                  state,
                  comparison,
                  property,
                  present[key][property],
                );
                const difference = {
                  appearance,
                  state,
                  variant,
                  comparison,
                  property,
                  present: present[key][property],
                  reference: other[property],
                };
                if (exception)
                  result.allowed.push({
                    ...difference,
                    reason: exception.reason,
                  });
                else result.mismatches.push(difference);
              }
          }
        }
      }
      report.results.push(result);
      console.log(
        `[${result.mismatches.length ? 'FAIL' : 'PASS'}] ${fixture.sheet}: ${variants.length} variants; ${result.samples.length} state samples; ${result.mismatches.length} unexpected colour differences; ${result.allowed.length} reasoned new-control differences`,
      );
      for (const mismatch of result.mismatches.slice(0, 12))
        console.log(
          `  ${mismatch.appearance}/${mismatch.state}/${mismatch.variant} ${mismatch.comparison} ${mismatch.property}: ${mismatch.reference} -> ${mismatch.present}`,
        );
      await page.close();
    }
  } finally {
    await browser.close();
  }
  report.failures = report.results.reduce((n, r) => n + r.mismatches.length, 0);
  report.durationMs = Math.round(performance.now() - started);
  const filename = path.resolve(options.out);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
/** An audit is successful only after its JSON artifact is actually written. */
export async function runCli(args, runAudit = audit) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(
      'Usage: node scripts/qa-cyber-precedence.mjs [--stylesheets primitives,location-views] [--fixture fixture.json] [--repo path] [--revision commit] [--out report.json]\nNo server required. Default: every PORTED sheet except token definitions. See docs/CYBER-PRECEDENCE.md.',
    );
    return 0;
  }
  const report = await runAudit(options);
  const saved = fs.readFileSync(path.resolve(options.out), 'utf8');
  if (saved !== `${JSON.stringify(report, null, 2)}\n`)
    throw new Error('Audit output artifact does not match this run');
  return report.failures ? 1 : 0;
}
if (
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) ===
    fs.realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`Cyber audit error: ${error.message}`);
    process.exitCode = 2;
  }
}
