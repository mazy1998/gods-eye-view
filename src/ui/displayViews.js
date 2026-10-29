import HudGroup from './displayViews/HudGroup.vue';
import DetectionGroup from './displayViews/DetectionGroup.vue';
import ModelsGroup from './displayViews/ModelsGroup.vue';
import ScopeGroup from './displayViews/ScopeGroup.vue';
import CelestialGroup from './displayViews/CelestialGroup.vue';
import CleanViewToggle from './displayViews/CleanViewToggle.vue';

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
  for (const [name, component] of Object.entries(GROUPS)) {
    const wrapper = doc.querySelector(`[data-display-group="${name}"]`);
    if (!wrapper) continue;
    wrapper.removeAttribute('data-display-group');
    views[name] = mount(component, { parent: wrapper });
  }
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
