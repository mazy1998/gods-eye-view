import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { compileSfc } from '../../scripts/vue-sfc-hooks.mjs';

const require = createRequire(import.meta.url);

test('the component compiler loads with the first component, not with the hooks', () => {
  const compiler = require.resolve('@vue/compiler-sfc');
  assert.equal(require.cache[compiler], undefined);
  compileSfc('<template><span>OK</span></template>', '/tmp/Lazy.vue');
  assert.notEqual(require.cache[compiler], undefined);
});

test('template-only and script components compile to a default export', () => {
  const templateOnly = compileSfc(
    '<template><span class="badge">{{ 1 + 1 }}</span></template>',
    '/tmp/Badge.vue',
  );
  assert.match(templateOnly, /_sfc_main\.render = render;/);
  assert.match(templateOnly, /export default _sfc_main;\s*$/);
  const setup = compileSfc(
    "<script setup>\nconst label = 'x';\n</script>\n<template><b>{{ label }}</b></template>",
    '/tmp/Setup.vue',
  );
  assert.match(setup, /export default _sfc_main;\s*$/);
});

test('components keep CSS in src/ui/styles and every block inline', () => {
  for (const [source, message] of [
    [
      '<template><i /></template><style>i { color: red; }</style>',
      /Badge\.vue: Components keep their CSS in src\/ui\/styles/,
    ],
    ['<template src="./badge.html"></template>', /blocks must be inline/],
    ['<script src="./badge.js"></script>', /blocks must be inline/],
    [
      '<script setup lang="ts">\nconst a: number = 1;\n</script>',
      /scripts must be JavaScript/,
    ],
    ['<template lang="pug">i</template>', /templates must be HTML/],
  ])
    assert.throws(() => compileSfc(source, '/tmp/Badge.vue'), message);
});
