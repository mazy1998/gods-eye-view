import { mountView } from './mountView.js';
import SceneDialogView from './SceneDialogView.vue';

/** The sharing owner supplies drafts and operations; this adapter owns native modal lifetime. */
export function mountSceneDialog(view, close) {
  const mounted = mountView(SceneDialogView, {
    parent: document.body,
    props: { view, close },
  });
  const element = mounted.element;
  element.showModal();
  return {
    update: (view) => mounted.update({ view }),
    // Apply/commit adopts native values even when no input event was dispatched.
    readDetails: () =>
      Object.fromEntries(
        [...element.querySelectorAll('[data-scene-detail]')].map((node) => [
          node.dataset.sceneDetail,
          node.value,
        ]),
      ),
    readAssets: () =>
      Object.fromEntries(
        [...element.querySelectorAll('[data-scene-assets]')].map((node) => [
          node.dataset.sceneAssets,
          [...node.files],
        ]),
      ),
    dispose() {
      element.close();
      mounted.dispose();
    },
  };
}
