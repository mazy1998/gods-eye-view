import CockpitContactView from './cockpitViews/CockpitContactView.vue';

/**
 * Show the Cockpit's Contact panel. The Cockpit controller derives what it
 * shows and owns navigation, collapse and the weather request; the view
 * reports which control was used.
 * @param {(component: object, options: object) => {update(props: object): void, dispose(): void}} mount
 *   mountView, or a shell's mount that releases its views on dispose
 * @param {{panel: Element|null, cockpit: object}} options
 * @returns {{dispose(): void}}
 */
export function mountCockpitContact(mount, { panel, cockpit }) {
  if (!panel || !cockpit?.subscribeContactView) return { dispose() {} };
  const view = mount(CockpitContactView, {
    parent: panel,
    props: {
      contact: cockpit.getContactView(),
      onPrevious: () => cockpit.navigateContext(-1, { origin: 'user' }),
      onNext: () => cockpit.navigateContext(1, { origin: 'user' }),
      onToggle: () => cockpit.toggleContactPanel(),
      onWeather: () => cockpit.toggleWeather(),
    },
  });
  const unsubscribe = cockpit.subscribeContactView(
    ({ state }) => view.update({ contact: state }),
    { emitCurrent: false },
  );
  return {
    dispose() {
      unsubscribe();
      view.dispose();
    },
  };
}
