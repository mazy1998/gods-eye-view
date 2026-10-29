/**
 * One component policy for every compile path: the browser build, the
 * boundary gate and the node:test hooks. Template settings such as
 * `isCustomElement` go here so the paths cannot drift.
 */
export const vueCompilerOptions = Object.freeze({});

/**
 * Why a parsed component is not allowed, or null. Components keep CSS in
 * src/ui/styles, where the token guard and English CSS parity cover it, and
 * keep JavaScript blocks inline.
 * @param {import('vue/compiler-sfc').SFCDescriptor} descriptor
 * @returns {string|null}
 */
export function componentBlockProblem({
  template,
  script,
  scriptSetup,
  styles,
}) {
  if (styles.length)
    return 'Components keep their CSS in src/ui/styles, not in <style> blocks';
  if ([template, script, scriptSetup].some((block) => block?.src))
    return 'Component blocks must be inline';
  if ([script, scriptSetup].some((block) => block?.lang && block.lang !== 'js'))
    return 'Component scripts must be JavaScript';
  if (template?.lang && template.lang !== 'html')
    return 'Component templates must be HTML';
  return null;
}
