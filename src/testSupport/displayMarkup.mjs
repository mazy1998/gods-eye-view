// The application markup as it stands once the Display views are mounted: Map
// & Look's tabs open the panel body, and the group wrappers and the Clean UI
// seat in the template are filled with each view's server-rendered markup at
// its first-paint defaults. Markup guards that used to read those controls
// from the template read them here, unchanged. (Mounting also moves each
// wrapper into its tab; the markup keeps template order.)
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import HudGroup from '../ui/displayViews/HudGroup.vue';
import DetectionGroup from '../ui/displayViews/DetectionGroup.vue';
import ModelsGroup from '../ui/displayViews/ModelsGroup.vue';
import ScopeGroup from '../ui/displayViews/ScopeGroup.vue';
import CelestialGroup from '../ui/displayViews/CelestialGroup.vue';
import CleanViewToggle from '../ui/displayViews/CleanViewToggle.vue';
import ImageAdjustmentGroup from '../ui/displayViews/ImageAdjustmentGroup.vue';
import MapLookView from '../ui/mapLook/MapLookView.vue';

const render = (component, props = {}) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

const GROUPS = {
  hud: HudGroup,
  detection: DetectionGroup,
  models3d: ModelsGroup,
  scope: ScopeGroup,
  celestial: CelestialGroup,
};

/** @param {string} html markup containing the Display template */
export async function withDisplayViews(html) {
  const body = '<div class="pp-panel-body" data-rail-scroller>';
  let out = html.replace(body, body + (await render(MapLookView)));
  for (const [name, component] of Object.entries(GROUPS)) {
    out = out.replace(
      `<div class="pp-toggle-group" data-display-group="${name}"></div>`,
      `<div class="pp-toggle-group">${await render(component)}</div>`,
    );
  }
  for (const kind of ['bloom', 'sharpen']) {
    out = out.replace(
      `<div class="pp-toggle-group" data-display-group="${kind}"></div>`,
      `<div class="pp-toggle-group">${await render(ImageAdjustmentGroup, { kind })}</div>`,
    );
  }
  return out.replace(
    '<span data-display-view="clean-view" hidden></span>',
    await render(CleanViewToggle),
  );
}
