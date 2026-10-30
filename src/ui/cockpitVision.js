import CockpitVisionView from './cockpitViews/CockpitVisionView.vue';

/**
 * Show the Cockpit's vision style controls. The Cockpit controller owns the
 * style and its cycle; the view reports which control was used.
 * @param {(component: object, options: object) => {update(props: object): void, dispose(): void}} mount
 *   mountView, or a shell's mount that releases its views on dispose
 * @param {{group: Element|null, cockpit: object}} options
 * @returns {{dispose(): void}}
 */
export function mountCockpitVision(mount, { group, cockpit }) {
  if (!group || !cockpit?.subscribeVisionView) return { dispose() {} };
  const view = mount(CockpitVisionView, {
    parent: group,
    props: {
      mode: cockpit.getVisionView().mode,
      onPrevious: () => cockpit.cycleVisionMode(-1),
      onCurrent: () => cockpit.cycleVisionMode(1),
      onNext: () => cockpit.cycleVisionMode(1),
    },
  });
  const unsubscribe = cockpit.subscribeVisionView(
    ({ state }) => view.update({ mode: state.mode }),
    { emitCurrent: false },
  );
  return {
    dispose() {
      unsubscribe();
      view.dispose();
    },
  };
}
