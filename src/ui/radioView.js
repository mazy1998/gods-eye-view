import InternetRadioView from './InternetRadioView.vue';
import { mountView } from './mountView.js';

/** Mount before the shell collects native controls; keep the existing chrome. */
export function mountRadioView(doc = document, mount = mountView) {
  const marker = doc.querySelector('[data-radio-view="internet"]');
  if (!marker) return null;
  const view = mount(InternetRadioView, {
    parent: marker.parentNode,
    before: marker,
  });
  marker.remove();
  return view;
}
