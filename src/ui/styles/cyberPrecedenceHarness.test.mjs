import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  matchingException,
  parseArgs,
  validateFixture,
  runCli,
  snapshotStyles,
} from '../../../scripts/qa-cyber-precedence.mjs';
import { fixtures } from '../../../scripts/qa-cyber-precedence-fixtures.mjs';

test('Cyber QA accepts explicit sheets/fixtures and rejects ambiguous arguments', () => {
  assert.deepEqual(
    parseArgs([
      '--stylesheets',
      'primitives,src/ui/styles/tool-views.css,primitives',
    ]).stylesheets,
    ['primitives', 'tool-views'],
  );
  assert.equal(parseArgs(['--fixture', 'sample.json']).fixture, 'sample.json');
  assert.throws(() => parseArgs(['--stylesheets']), /incomplete/);
  assert.throws(() => parseArgs(['--ignore-failures']), /Unknown/);
  assert.throws(
    () => parseArgs(['--fixture', 'a', '--fixture', 'b']),
    /Duplicate/,
  );
});

test('Cyber CLI runs through a symlink instead of silently succeeding', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-cyber-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const alias = path.join(dir, 'repo');
  fs.symlinkSync(
    fileURLToPath(new URL('../../../', import.meta.url)),
    alias,
    'dir',
  );
  const result = spawnSync(
    process.execPath,
    [path.join(alias, 'scripts/qa-cyber-precedence.mjs'), '--help'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: node scripts\/qa-cyber-precedence/);
});

test('Cyber CLI requires a matching JSON artifact, not just a returned pass', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-cyber-artifact-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'report.json'),
    report = { failures: 0, results: [] };
  await assert.rejects(
    runCli(['--out', out], async () => report),
    /ENOENT/,
  );
  fs.writeFileSync(out, '{}');
  await assert.rejects(
    runCli(['--out', out], async () => report),
    /does not match/,
  );
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(await runCli(['--out', out], async () => report), 0);
});

test('paint oracle detects visible currentColor edges and ignores invisible edges', (t) => {
  const node = { dataset: { audit: 'border' }, querySelectorAll: () => [] };
  for (const [key, value] of Object.entries({
    getComputedStyle: () => style,
    document: { querySelectorAll: () => [node] },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, key, previous)
        : delete globalThis[key],
    );
  }
  let style = {
    borderTopWidth: '0px',
    borderTopStyle: 'none',
    borderTopColor: 'rgb(255, 255, 255)',
    outlineWidth: '0px',
    outlineStyle: 'none',
    outlineColor: 'rgb(255, 255, 255)',
  };
  const before = snapshotStyles(['borderTop', 'outline']);
  style = {
    ...style,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    outlineWidth: '2px',
    outlineStyle: 'dashed',
  };
  const after = snapshotStyles(['borderTop', 'outline']);
  assert.equal(before['inside/border'].borderTop, 'none');
  assert.equal(
    after['inside/border'].borderTop,
    '1px solid rgb(255, 255, 255)',
  );
  assert.equal(after['inside/border'].outline, '2px dashed rgb(255, 255, 255)');
  style.borderTopStyle = 'hidden';
  style.outlineWidth = '0px';
  assert.deepEqual(snapshotStyles(['borderTop', 'outline']), before);
});

test('Cyber QA exceptions need an exact control, state, comparison, property and reason', () => {
  const exception = {
    variant: 'new-control',
    state: 'rest',
    comparison: 'sheet',
    properties: ['backgroundColor'],
    reason: 'The new control has no legacy rest definition.',
  };
  const fixture = {
    sheet: 'example',
    html: '<button data-audit="new-control">New</button>',
    exceptions: [exception],
  };
  assert.equal(validateFixture(fixture), fixture);
  for (const patch of [
    { reason: '' },
    { reason: '  ' },
    { variant: '*' },
    { state: '*' },
    { comparison: '*' },
    { properties: ['*'] },
    { expected: {} },
    { expected: { backgroundColor: 42 } },
  ])
    assert.throws(
      () =>
        validateFixture({
          ...fixture,
          exceptions: [{ ...exception, ...patch }],
        }),
      /exception/,
    );
  assert.equal(
    matchingException(
      [exception],
      'new-control',
      'rest',
      'sheet',
      'backgroundColor',
    ),
    exception,
  );
  for (const args of [
    ['new-control', 'hover', 'sheet', 'backgroundColor'],
    ['new-control', 'rest', 'surface', 'backgroundColor'],
    ['another-control', 'rest', 'sheet', 'backgroundColor'],
    ['new-control', 'rest', 'sheet', 'color'],
  ])
    assert.equal(matchingException([exception], ...args), undefined);
});

test('built-in exceptions keep interactive palettes strict and pin new structural edges', () => {
  for (const fixture of fixtures) validateFixture(fixture);
  const primitive = fixtures.find((fixture) => fixture.sheet === 'primitives');
  for (const variant of ['icon', 'icon-sm', 'chip', 'disclosure'])
    assert.equal(
      matchingException(
        primitive.exceptions,
        variant,
        'hover',
        'sheet',
        'backgroundColor',
      ),
      undefined,
      variant,
    );
  for (const fixture of fixtures)
    for (const exception of fixture.exceptions || []) {
      if (exception.comparison !== 'surface') continue;
      if (
        ['draw-frame', 'import-frame'].includes(exception.variant) &&
        exception.properties.every((p) =>
          ['backgroundColor', 'boxShadow'].includes(p),
        )
      )
        continue;
      assert.ok(
        exception.expected,
        'structural surface edges pin their complete painted value',
      );
      if (
        exception.variant === 'layer-details' &&
        exception.properties.includes('color')
      ) {
        assert.ok(['rest', 'active', 'focus'].includes(exception.state));
        assert.deepEqual(exception.expected, {
          color: 'rgba(180, 198, 202, 0.58)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        });
      } else assert.ok(exception.properties.every((p) => /^border/.test(p)));
    }
  const row = fixtures.find((f) => f.sheet === 'location-views').exceptions;
  assert.equal(
    matchingException(
      row,
      'result-row',
      'rest',
      'sheet',
      'borderTop',
      '1px solid rgb(255, 255, 255)',
    ),
    undefined,
  );
  assert.ok(
    matchingException(
      row,
      'result-row',
      'rest',
      'sheet',
      'borderTop',
      '1px solid rgba(206, 222, 226, 0.28)',
    ),
  );
  assert.equal(
    matchingException(
      row,
      'result-row',
      'rest',
      'sheet',
      'borderTop',
      '2px solid rgba(206, 222, 226, 0.28)',
    ),
    undefined,
  );
});

test('Layers separator exceptions reject text ink and wrong geometry', () => {
  const layer = fixtures.find((f) => f.sheet === 'layer-browser');
  for (const [variant, property] of [
    ['layer-row', 'borderBottom'],
    ['layer-footer-frame', 'borderTop'],
    ['layer-import-frame', 'borderBottom'],
  ]) {
    assert.ok(layer.html.includes(`data-audit="${variant}"`));
    for (const state of ['rest', 'hover', 'active', 'focus']) {
      for (const comparison of ['sheet', 'surface']) {
        assert.ok(
          matchingException(
            layer.exceptions,
            variant,
            state,
            comparison,
            property,
            '1px solid rgba(206, 222, 226, 0.28)',
          ),
        );
        for (const wrong of [
          '1px solid rgb(242, 245, 244)',
          '2px solid rgba(206, 222, 226, 0.28)',
          '1px dashed rgba(206, 222, 226, 0.28)',
        ])
          assert.equal(
            matchingException(
              layer.exceptions,
              variant,
              state,
              comparison,
              property,
              wrong,
            ),
            undefined,
          );
      }
    }
  }
  assert.equal(
    matchingException(
      layer.exceptions,
      'layer-details',
      'hover',
      'surface',
      'backgroundColor',
    ),
    undefined,
  );
});
