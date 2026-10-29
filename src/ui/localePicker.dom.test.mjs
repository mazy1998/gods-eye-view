// The mounted picker: real view, real controller, in a DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { mountLocalePicker } = await import('./localePicker.js');

const NAMES = { en: 'English', es: 'Español', ru: 'Русский', 'zh-CN': '简体中文' };
function mount({ locales = ['en', 'es', 'ru', 'zh-CN'], threshold = 8 } = {}) {
  const root = container.appendChild(document.createElement('div'));
  root.id = 'locale-picker';
  const chosen = [];
  const picker = mountLocalePicker({
    root,
    current: 'en',
    locales,
    nativeNames: NAMES,
    searchThreshold: threshold,
    onSelect: (code) => chosen.push(code),
  });
  const q = (selector) => root.querySelector(selector);
  const key = (name, target = document.activeElement) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
    );
  return { root, picker, chosen, q, key };
}

test('the button opens the list on the current language and Enter chooses', () => {
  const { root, picker, chosen, q, key } = mount();
  const button = q('.locale-picker-button');
  assert.equal(button.getAttribute('aria-label'), 'Language: English');
  assert.equal(q('.locale-picker-popup').hidden, true);
  assert.equal(q('.locale-picker-list').children.length, 0, 'no rows while closed');
  button.click();
  assert.equal(q('.locale-picker-list').children.length, 4);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(q('.locale-picker-popup').hidden, false);
  assert.ok(root.classList.contains('is-open'));
  const list = q('.locale-picker-list');
  assert.equal(document.activeElement, list, 'focus moves into the list at once');
  assert.equal(list.getAttribute('aria-activedescendant'), 'locale-picker-option-en');
  key('ArrowDown');
  const active = list.getAttribute('aria-activedescendant');
  assert.notEqual(active, 'locale-picker-option-en');
  assert.ok(document.getElementById(active).classList.contains("is-active"));
  key('Enter');
  assert.equal(chosen.length, 1);
  assert.equal(`locale-picker-option-${chosen[0]}`, active);
  assert.equal(q('.locale-picker-popup').hidden, true);
  assert.equal(document.activeElement, button, 'focus returns to the button');
  picker.destroy();
  assert.equal(root.children.length, 0);
});

test('Escape and an outside pointer close without choosing', () => {
  const { picker, chosen, q, key } = mount();
  const button = q('.locale-picker-button');
  button.click();
  key('Escape');
  assert.equal(picker.isOpen(), false);
  assert.equal(document.activeElement, button);
  button.click();
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  assert.equal(picker.isOpen(), false);
  assert.deepEqual(chosen, []);
});

test('with a search field, typing filters and an empty result says so', () => {
  const { q } = mount({ threshold: 2 });
  q('.locale-picker-button').click();
  const search = q('.locale-picker-search');
  assert.equal(document.activeElement, search);
  search.value = 'русс';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(
    [...q('.locale-picker-list').children].map((li) => li.dataset.locale),
    ['ru'],
  );
  assert.equal(search.getAttribute('aria-activedescendant'), 'locale-picker-option-ru');
  search.value = 'zzz';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(q('.locale-picker-list').children.length, 0);
  assert.equal(q('.locale-picker-empty').hidden, false);
});
