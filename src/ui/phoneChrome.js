import { mountView } from './mountView.js';
import PhoneShellView from './PhoneShellView.vue';

/** One phone-chrome mount; the native panel host is kept empty by Vue. */
export function createPhoneChrome({
  documentRef,
  state,
  actions,
  appearance,
  settingsSurface,
}) {
  const view = mountView(PhoneShellView, {
    parent: documentRef.body,
    props: { state, actions, appearance, settingsSurface },
  });
  const element = view.element;
  return {
    backdrop: element.querySelector('#mobile-sheet-backdrop'),
    tabBar: element.querySelector('#mobile-tab-bar'),
    host: element.querySelector('#mobile-sheet-panels'),
    surface: element.querySelector('#mobile-sheet'),
    scrollArea: element.querySelector('.phone-sheet-scroll'),
    update: (state) => view.update({ state }),
    destroy: () => view.dispose(),
  };
}
