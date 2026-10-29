// Lets node:test import single-file components: `.vue` modules compile to an
// ES module in-process, as @vitejs/plugin-vue compiles them for the browser,
// under the same component policy (build/vue.js). Loaded with `--import`.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { componentBlockProblem, vueCompilerOptions } from '../build/vue.js';

// Loaded with the first component, so suites without one pay nothing for it.
let sfcCompiler;
const compiler = () =>
  (sfcCompiler ??= createRequire(import.meta.url)('vue/compiler-sfc'));

/** Compile a component to an ES module whose default export is the component. */
export function compileSfc(source, filename) {
  const { compileScript, compileTemplate, parse } = compiler();
  const { descriptor, errors } = parse(source, { filename });
  const fail = (message) => {
    throw new Error(`${filename}: ${message}`);
  };
  if (errors.length) fail(errors[0].message);
  const problem = componentBlockProblem(descriptor);
  if (problem) fail(problem);
  const { script, scriptSetup, template } = descriptor;
  const id = createHash('sha256').update(filename).digest('hex').slice(0, 8);
  const compiled =
    script || scriptSetup
      ? compileScript(descriptor, {
          id,
          inlineTemplate: true,
          genDefaultAs: '_sfc_main',
          templateOptions: { compilerOptions: vueCompilerOptions },
        })
      : { content: 'const _sfc_main = {};' };
  let code = compiled.content;
  if (template && !scriptSetup) {
    const render = compileTemplate({
      source: template.content,
      filename,
      id,
      compilerOptions: {
        ...vueCompilerOptions,
        bindingMetadata: compiled.bindings,
      },
    });
    if (render.errors.length) fail(String(render.errors[0]));
    code += `\n${render.code.replace(/^export function render/m, 'function render')}\n_sfc_main.render = render;`;
  }
  return `${code}\nexport default _sfc_main;\n`;
}

registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.vue'))
      return nextLoad(url, context);
    const filename = fileURLToPath(url);
    return {
      format: 'module',
      source: compileSfc(readFileSync(filename, 'utf8'), filename),
      shortCircuit: true,
    };
  },
});
