/** The startup owner keeps its message while Vue paints the existing cover. */
import { mountView } from './mountView.js';
import StartupContent from './feedback/StartupContent.vue';

let current;
export function createStartupFeedback(loadingScreen) {
  const parent = loadingScreen.querySelector('.loader-content');
  parent.replaceChildren();
  let status = '';
  let error = false;
  const view = mountView(StartupContent, { parent, props: { status, error } });
  current = {
    // Compatibility input for scene/controls, which only write messages. This
    // is an owner operation, never a DOM node or a readback of painted text.
    get textContent() {
      return status;
    },
    set textContent(value) {
      status = String(value ?? '');
      view.update({ status, error });
    },
    fail(message) {
      error = true;
      this.textContent = message;
    },
    destroy() {
      view.dispose();
      if (current === this) current = null;
    },
  };
  return current;
}
export function showStartupError(message) {
  current?.fail(message);
}
