/** Mount only our two control labels; Cesium retains the live provider list. */
import { mountView } from './mountView.js';
import LiteralText from './feedback/LiteralText.vue';
import { t } from '../i18n/index.js';

export function mountCreditText(root = document) {
  const views = [];
  for (const [selector, text] of [
    ['#cesium-credits .cesium-credit-expand-link', t('Data attribution')],
    ['.cesium-credit-lightbox-title', t('Data provided by:')],
  ]) {
    const parent = root.querySelector(selector);
    if (!parent) continue;
    parent.replaceChildren();
    views.push(mountView(LiteralText, { parent, props: { text } }));
  }
  const lightbox = root.querySelector('.cesium-credit-lightbox');
  // Cesium replaces className when choosing its mobile/desktop layout.
  // A data marker survives that owner operation without fighting it.
  lightbox?.setAttribute('data-gev-credit-surface', '');
  return () => {
    for (const view of views) view.dispose();
    lightbox?.removeAttribute('data-gev-credit-surface');
  };
}
