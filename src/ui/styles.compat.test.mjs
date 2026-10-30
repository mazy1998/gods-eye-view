import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';
import { readStylesheet } from '../testSupport/readStylesheet.mjs';
const layout = await import('gods-eye-view/ui/layout');

test('published styles leave independent layout rails visible and conceal only shell-owned rails', () => {
  assert.equal(typeof layout.layoutLeftPanelRail, 'function');
  assert.equal(typeof layout.layoutRightPanelRail, 'function');
  const entry = import.meta.resolve('gods-eye-view/ui/styles');
  assert.match(readFileSync(new URL(entry), 'utf8'), /import.*style\.css/);
  const css = readStylesheet(new URL('../../style.css', entry));
  const rule = css.match(
    /body[^{}]*:is\(#left-panel-stack, #right-context-rail\)\s*\{[^}]*\}/,
  )?.[0];
  assert.ok(rule);
  const style = document.createElement('style');
  style.textContent = rule;
  document.head.append(style);
  container.innerHTML =
    '<aside id="left-panel-stack"></aside><aside id="right-context-rail"></aside>';
  const rails = [...container.querySelectorAll('aside')];
  for (const rail of rails)
    assert.notEqual(getComputedStyle(rail).display, 'none');
  const shell = document.createElement('nav');
  shell.className = 'gev-rail';
  container.append(shell);
  for (const rail of rails)
    assert.equal(getComputedStyle(rail).display, 'none');
  shell.remove();
  for (const rail of rails)
    assert.notEqual(getComputedStyle(rail).display, 'none');
});

test('published styles apply shell offsets only while an application rail is present', () => {
  const css = readStylesheet(
    new URL('../../style.css', import.meta.resolve('gods-eye-view/ui/styles')),
  );
  const targets = {
    'title-bar': ['left', '11px'],
    'intel-hud': ['left', '12px'],
    'command-dock': ['bottom', '15px'],
    toast: ['bottom', '16px'],
  };
  const rules = Object.keys(targets).map((id) => {
    const rule = css.match(
      new RegExp(
        `body(?::has\\(\\.gev-rail\\))?:not\\(\\.mobile-shell\\):not\\(\\.cockpit-mode\\) #${id}\\s*\\{[^}]*\\}`,
      ),
    )?.[0];
    assert.ok(rule, id);
    // Resolve token lengths because jsdom does not evaluate variables in bottom calc().
    return rule
      .replaceAll('var(--gev-rail-width)', '72px')
      .replaceAll('var(--gev-status-height)', '24px')
      .replaceAll('var(--gev-space-2)', '8px');
  });
  const style = document.createElement('style');
  style.textContent =
    '#title-bar{left:11px}#intel-hud{left:12px}#command-dock{bottom:15px}#toast{bottom:16px}' +
    rules.join('\n');
  document.head.append(style);
  container.innerHTML = Object.keys(targets)
    .map((id) => `<div id="${id}"></div>`)
    .join('');
  const value = (id, prop) =>
    getComputedStyle(document.getElementById(id))[prop];
  for (const [id, [prop, original]] of Object.entries(targets))
    assert.equal(value(id, prop), original, id);
  const shell = document.createElement('nav');
  shell.className = 'gev-rail';
  container.append(shell);
  for (const [id, [prop, original]] of Object.entries(targets))
    assert.notEqual(value(id, prop), original, id);
  shell.remove();
  for (const [id, [prop, original]] of Object.entries(targets))
    assert.equal(value(id, prop), original, id);
});

test('desktop HUD frame offsets require the application rail in native hosts', () => {
  const css = readStylesheet(
    new URL('../../style.css', import.meta.resolve('gods-eye-view/ui/styles')),
  );
  // Evaluate the desktop selectors directly; jsdom does not evaluate width queries.
  const start = css.indexOf('/* The style readout and the HUD frame');
  const end = css.indexOf('/* The Share button shows its label', start);
  assert.ok(start >= 0 && end > start);
  const rules = [...css.slice(start, end).matchAll(/(body[^{}]+)\{([^}]+)\}/g)];
  assert.equal(rules.length, 4);
  container.innerHTML =
    '<div id="style-indicator"></div><div id="intel-hud" data-variant="cyber"><i class="hud-top-left"></i><i class="hud-bottom-left"></i><i class="hud-top-right"></i><i class="hud-bottom-right"></i></div>';
  const targets = [
    [document.getElementById('style-indicator')],
    [document.getElementById('intel-hud')],
    [...container.querySelectorAll('.hud-top-left, .hud-bottom-left')],
    [...container.querySelectorAll('.hud-top-right, .hud-bottom-right')],
  ];
  const assertMatched = (expected) => {
    for (const [index, [, selector]] of rules.entries())
      for (const target of targets[index])
        assert.equal(
          target.matches(selector.trim()),
          expected,
          selector.trim(),
        );
  };
  assertMatched(false);
  const shell = container.appendChild(document.createElement('nav'));
  shell.className = 'gev-rail';
  assertMatched(true);
  shell.remove();
  assertMatched(false);
});
