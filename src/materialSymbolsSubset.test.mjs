import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, babelParse } from 'vue/compiler-sfc';

const SRC_ROOT = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(SRC_ROOT, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');

/** The glyph written as element text: `<span class="material-symbols-outlined">radar</span>`. */
const SPAN_TEXT =
  /class="[^"]*material-symbols-outlined[^"]*"[^>]*>\s*([a-z0-9_]+)\s*</g;
/** A whole `textContent =` statement, across lines, so a multi-line ternary is read once. */
const TEXT_ASSIGNMENT = /(?:textContent|innerText)\s*=\s*([^;]{0,400})/gs;
const STRING_LITERAL = /['"`]([a-z0-9_]{2,})['"`]/g;
/** A glyph drawn by a stylesheet: `content: 'chevron_right'` on an icon-font pseudo-element. */
const CSS_CONTENT = /content:\s*['"]([a-z0-9_]{2,})['"]/g;

/**
 * Files that SHIP markup. Tests assert on markup, they do not render it.
 *
 * The panel markup lives in `src/ui/templates/*.html`, so HTML under `src` is
 * read as well: a glyph named only in a template is still a glyph the font has
 * to carry. So are views' templates and stylesheets that draw a glyph with
 * `content`.
 */
function sourceFiles(directory = SRC_ROOT) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(absolute));
    else if (
      entry.isFile() &&
      /\.(js|mjs|html|vue|css)$/.test(entry.name) &&
      !entry.name.endsWith('.test.mjs')
    ) {
      files.push(absolute);
    }
  }
  return [...files.sort(), INDEX_HTML];
}

/** Static icon text, expressions and file-local icon maps in a component. */
function vueGlyphs(source) {
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, []);
  const bindings = new Map();
  for (const script of [descriptor.script, descriptor.scriptSetup]) {
    if (!script) continue;
    const ast = babelParse(script.content, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    for (const statement of ast.program.body) {
      const declaration = statement.declaration ?? statement;
      if (declaration.type !== 'VariableDeclaration') continue;
      for (const item of declaration.declarations)
        if (item.id.type === 'Identifier')
          bindings.set(item.id.name, item.init);
    }
  }
  const found = new Set();
  const add = (text) => {
    if (/^[a-z][a-z0-9_]+$/.test(text)) found.add(text);
  };
  const values = (node, seen = new Set()) => {
    if (!node) return;
    if (node.type === 'StringLiteral') add(node.value);
    else if (node.type === 'Identifier' && !seen.has(node.name)) {
      values(bindings.get(node.name), new Set([...seen, node.name]));
    } else if (node.type === 'ObjectExpression') {
      for (const property of node.properties) values(property.value, seen);
    } else if (node.type === 'ArrayExpression') {
      for (const item of node.elements) values(item, seen);
    } else if (node.type === 'ConditionalExpression') {
      values(node.consequent, seen);
      values(node.alternate, seen);
    } else if (node.type === 'LogicalExpression') {
      values(node.left, seen);
      values(node.right, seen);
    } else if (
      node.type === 'MemberExpression' ||
      node.type === 'OptionalMemberExpression'
    ) {
      values(node.object, seen);
    } else if (node.type === 'NewExpression' && node.callee.name === 'Map') {
      for (const argument of node.arguments) values(argument, seen);
    } else if (node.type === 'CallExpression') {
      if (
        node.callee.object?.name === 'Object' &&
        node.callee.property?.name === 'entries'
      )
        for (const argument of node.arguments) values(argument, seen);
      else if (node.callee.type === 'MemberExpression')
        values(node.callee.object, seen);
    }
  };
  const visit = (node) => {
    const icon =
      node.type === 1 &&
      node.props.some(
        (prop) =>
          (prop.type === 6 &&
            prop.name === 'class' &&
            prop.value?.content.includes('material-symbols-outlined')) ||
          (prop.type === 7 &&
            prop.name === 'bind' &&
            prop.arg?.content === 'class' &&
            prop.exp?.content.includes('material-symbols-outlined')),
      );
    if (icon)
      for (const child of node.children) {
        if (child.type === 2) add(child.content.trim());
        if (child.type === 5) {
          const ast = babelParse(`const glyph = (${child.content.content});`, {
            sourceType: 'module',
            plugins: ['typescript'],
          });
          values(ast.program.body[0].declarations[0].init);
        }
      }
    for (const child of node.children ?? []) visit(child);
  };
  if (descriptor.template?.ast) visit(descriptor.template.ast);
  return found;
}

/**
 * Glyph names the sources ask the icon font for.
 *
 * Errs WIDE on purpose. A name the font does not carry costs nothing — Google
 * ignores an unknown `icon_names` entry and still returns 200 — while a glyph
 * the subset is missing breaks the interface SILENTLY: the ligature never
 * forms, so the element renders the literal word `right_panel_open` instead of
 * falling back to a visible box.
 *
 * A literal to the LEFT of a `?` is the condition being tested, not the text
 * being shown, so it is dropped: `status === 'loading' ? …` must not enrol
 * `loading`. Optional chaining is neutralised first — `payload?.newsStatus`
 * is not a ternary, and splitting on its `?` would keep the condition.
 * @returns {Map<string, string>} glyph -> the first file that names it.
 */
function referencedGlyphs() {
  const found = new Map();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const add = (glyph) => {
      if (!found.has(glyph)) found.set(glyph, relative);
    };
    if (file.endsWith('.vue'))
      for (const glyph of vueGlyphs(source)) add(glyph);
    for (const match of source.matchAll(SPAN_TEXT)) add(match[1]);
    if (file.endsWith('.css'))
      for (const match of source.matchAll(CSS_CONTENT)) add(match[1]);
    for (const match of source.matchAll(TEXT_ASSIGNMENT)) {
      const statement = match[1].replaceAll('?.', '.');
      const assigned = statement.includes('?')
        ? statement.slice(statement.indexOf('?') + 1)
        : statement;
      for (const literal of assigned.matchAll(STRING_LITERAL)) add(literal[1]);
    }
  }
  return found;
}

/** The `icon_names` list index.html asks Google for. */
function subsettedGlyphs(html = readFileSync(INDEX_HTML, 'utf8')) {
  const match =
    /Material\+Symbols\+Outlined[^"]*[?&]icon_names=([a-z0-9_,]+)/.exec(html);
  assert.ok(
    match,
    'index.html must request Material Symbols with an icon_names subset',
  );
  return new Set(match[1].split(','));
}

test('every glyph the sources render is in the icon_names subset', () => {
  const subset = subsettedGlyphs();
  const missing = [...referencedGlyphs()]
    .filter(([glyph]) => !subset.has(glyph))
    .map(([glyph, file]) => `${glyph} (${file})`);

  assert.deepEqual(
    missing,
    [],
    'Glyphs named by the sources but absent from the index.html icon_names list. ' +
      'Add them there — an unlisted glyph renders as its own name on screen: ' +
      missing.join(', '),
  );
});

test('every Layers category icon is in the icon_names subset', () => {
  // The categories draw `group.icon` from layerPanel.js's presentation table,
  // which the text scan above cannot follow into a template expression.
  const source = readFileSync(path.join(SRC_ROOT, 'ui/layerPanel.js'), 'utf8');
  const table = source.slice(
    source.indexOf('const PANEL_GROUPS ='),
    source.indexOf('const PANEL_ORDER ='),
  );
  const icons = [...table.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)].map(
    ([, icon]) => icon,
  );
  // Seven groups plus the fallback for layers no group names.
  assert.equal(icons.length, 8);
  const subset = subsettedGlyphs();
  assert.deepEqual(
    icons.filter((icon) => !subset.has(icon)),
    [],
  );
});

test('every selection slot icon is in the icon_names subset', async () => {
  // The slot draws its item's icon from the state, which the text scan above
  // cannot follow; the camera viewers name theirs in cameraSlot.js.
  const { SLOT_CAMERA_PANELS } = await import('./ui/cameraSlot.js');
  const icons = Object.values(SLOT_CAMERA_PANELS).map(({ icon }) => icon);
  const subset = subsettedGlyphs();
  assert.deepEqual(
    icons.filter((icon) => !subset.has(icon)),
    [],
  );
});

test('the unused Material Icons Round family is not loaded', () => {
  // A second icon font, 173 kB, for a family no source ever uses — and
  // src/cockpitMarkup.test.mjs already asserts the markup must not use it.
  const html = readFileSync(INDEX_HTML, 'utf8');
  assert.doesNotMatch(
    html,
    /Material\+Icons\+Round/,
    'index.html loads an icon font nothing renders',
  );
});

test('Vue icon maps and conditional text are checked without enrolling unrelated labels or conditions', () => {
  const source = `<script setup>
    const categoryIcons = { Space: 'satellite_alt', Events: 'sensors' };
    const icons = new Map(Object.entries({ 'gnss-integrity': 'gps_off' }));
    const labels = { idle: 'irrelevant' };
    </script><template>
    <span class="material-symbols-outlined">{{ categoryIcons[group] }}</span>
    <span class="material-symbols-outlined">{{ status === 'idle' ? 'expand_more' : 'chevron_right' }}</span>
    <span :class="{ 'material-symbols-outlined': true }">{{ icons.get(id) }}</span>
    <p>{{ labels.idle }}</p></template>`;
  assert.deepEqual([...vueGlyphs(source)].sort(), [
    'chevron_right',
    'expand_more',
    'gps_off',
    'satellite_alt',
    'sensors',
  ]);
  const incomplete = new Set(['chevron_right', 'gps_off', 'satellite_alt']);
  assert.deepEqual(
    [...vueGlyphs(source)].filter((glyph) => !incomplete.has(glyph)).sort(),
    ['expand_more', 'sensors'],
  );
});
