import HudGroup from './displayViews/HudGroup.vue';
import DetectionGroup from './displayViews/DetectionGroup.vue';
import ModelsGroup from './displayViews/ModelsGroup.vue';
import ScopeGroup from './displayViews/ScopeGroup.vue';
import CelestialGroup from './displayViews/CelestialGroup.vue';
import CleanViewToggle from './displayViews/CleanViewToggle.vue';
import ImageAdjustmentGroup from './displayViews/ImageAdjustmentGroup.vue';
import StyleParametersView from './displayViews/StyleParametersView.vue';
import MapLookView from './mapLook/MapLookView.vue';

// Which tab slot each wrapper moves into, in the order the tab shows them.
const SLOTS = {
  parameters: ['#param-slider-panel'],
  adjustments: [
    '[data-display-group="sharpen"]',
    '[data-display-group="bloom"]',
  ],
  display: [
    '[data-display-group="hud"]',
    '[data-display-group="detection"]',
    '[data-display-group="models3d"]',
    '[data-display-group="scope"]',
    '[data-display-group="celestial"]',
    '[data-display-view="clean-view"]',
  ],
};

const GROUPS = {
  hud: HudGroup,
  detection: DetectionGroup,
  models3d: ModelsGroup,
  scope: ScopeGroup,
  celestial: CelestialGroup,
};

/**
 * Mount the Display groups before shell element collection, so owners and
 * readers that look controls up by id get the views' nodes. Each group renders
 * inside its own wrapper, which stays in the markup: Cockpit's portal moves
 * that wrapper, and the view moves with it. Clean UI has no wrapper; it takes
 * its seat's place.
 * @param {(component: object, options: object) => object} mount
 * @returns {Record<string, {update(props: object): void}>}
 */
export function mountDisplayViews(mount, doc = document) {
  const views = {};
  // Map & Look's tabs come first; each wrapper then moves once into its slot,
  // where Cockpit's portal can still take it and give it back.
  const body = doc.querySelector('#pp-toggles .pp-panel-body');
  if (body) {
    views.mapLook = mount(MapLookView, {
      parent: body,
      before: body.firstChild,
    });
    for (const [name, selectors] of Object.entries(SLOTS)) {
      const slot = views.mapLook.element.querySelector(
        `[data-map-look-slot="${name}"]`,
      );
      for (const selector of selectors) {
        const node = doc.querySelector(selector);
        if (slot && node) slot.append(node);
      }
    }
  }
  for (const [name, component] of Object.entries(GROUPS)) {
    const wrapper = doc.querySelector(`[data-display-group="${name}"]`);
    if (!wrapper) continue;
    wrapper.removeAttribute('data-display-group');
    views[name] = mount(component, { parent: wrapper });
  }
  for (const kind of ['bloom', 'sharpen']) {
    const wrapper = doc.querySelector(`[data-display-group="${kind}"]`);
    if (!wrapper) continue;
    wrapper.removeAttribute('data-display-group');
    views[kind] = mount(ImageAdjustmentGroup, {
      parent: wrapper,
      props: { kind },
    });
  }
  // The parameter rows render inside #param-sliders, which stays the
  // styleManager's _sliderContainer inside the panel Cockpit's portal moves.
  const sliders = doc.getElementById('param-sliders');
  if (sliders)
    views.styleParameters = mount(StyleParametersView, { parent: sliders });
  const seat = doc.querySelector('[data-display-view="clean-view"]');
  if (seat) {
    views.cleanView = mount(CleanViewToggle, {
      parent: seat.parentNode,
      before: seat,
    });
    seat.remove();
  }
  return views;
}

/**
 * Give the mounted groups their operations and the visual owner's state.
 * Every change paints before the publishing operation returns. The views get
 * gated operations: once disconnected, a control a caller still holds is
 * inert, as the native binder's removed listeners left it.
 * @returns {() => void} disconnect
 */
export function connectDisplayViews(views, { channel, actions }) {
  let live = actions;
  const gated = Object.fromEntries(
    Object.keys(actions).map((name) => [
      name,
      (...args) => live?.[name]?.(...args),
    ]),
  );
  for (const view of Object.values(views)) view.update({ actions: gated });
  const unsubscribe = channel.subscribe(({ state }) => {
    for (const view of Object.values(views)) view.update({ state });
  });
  return () => {
    live = null;
    unsubscribe();
  };
}
