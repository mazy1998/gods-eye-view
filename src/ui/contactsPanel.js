import ContactsPanelView from './contextViews/ContactsPanelView.vue';

/**
 * Show the Contacts layer's panel view in its panel. The layer owns what is
 * shown and the navigation; the view only reports which control was used.
 * @param {(component: object, options: object) => {update(props: object): void, dispose(): void}} mount
 *   mountView, or a shell's mount that releases its views on dispose
 * @param {{panel: Element|null, awareness: object}} options
 * @returns {{dispose(): void}}
 */
export function mountContactsPanel(mount, { panel, awareness }) {
  if (!panel || !awareness?.subscribePanelView) return { dispose() {} };
  const release = awareness.claimPanelView?.();
  const view = mount(ContactsPanelView, {
    parent: panel,
    props: {
      view: awareness.getPanelView(),
      onPrevious: () => awareness.navigatePrevious({ origin: 'user' }),
      onFocus: () => awareness.focusCurrent({ origin: 'user' }),
      onNext: () => awareness.navigateNext({ origin: 'user' }),
      onTarget: (layerId, id) =>
        awareness.focusTarget(layerId, id, { origin: 'user' }),
    },
  });
  const unsubscribe = awareness.subscribePanelView(
    ({ state }) => view.update({ view: state }),
    { emitCurrent: false },
  );
  return {
    dispose() {
      unsubscribe();
      view.dispose();
      release?.();
    },
  };
}
