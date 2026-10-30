import { LayerLifecycle } from '../data/lifecycle.js';
import { LayerPresentation } from './layerPresentation.js';
import { createCyberSonarScene } from '../cyberSonarScene.js';
import { panelAwareVisibility } from './embed.js';
/** Register the application layer catalog before allowing state restoration. */
export function createApplicationData({
  scene: { viewer, mapStackController },
  controls: { styleManager },
  catalog,
  allowQaRegistration,
  onData,
  defer,
}) {
  // Initialize data layer manager
  const dataManager = new LayerLifecycle(viewer, {
    allowQaRegistration,
    // A panel's host may report it hidden while it is on screen; its layers
    // keep polling (see keepPanelRendering in embed.js).
    visibilityTarget: panelAwareVisibility(document),
    getSourceAvailability: catalog?.getSourceAvailability,
  });
  defer(async () => {
    await dataManager.destroyAll();
    if (dataManager.layers.size)
      throw new Error(
        `Data layers could not be destroyed: ${[...dataManager.layers.keys()].join(', ')}`,
      );
  });
  const presentation = new LayerPresentation(dataManager, {
    weatherClock: catalog?.weatherClock,
    channel: styleManager._layerBindings?.channel,
    clearChannel: styleManager._contextControls?.clearChannel,
    clearSelectedLayers: () => styleManager.clearSelectedLayers(),
    drawerChannel: styleManager._drawer?.channel,
    phoneChannel: styleManager._mobileShell?.channel,
    openDetails: (panelId) => {
      if (panelId === 'directions-controls-body') {
        const phone = styleManager._mobileShell;
        const opened = phone?.channel.getSnapshot()?.active
          ? phone.setDestination('tools')
          : styleManager._drawer?.open('tools');
        if (!opened) return false;
        const section = document.getElementById(panelId);
        section?.focus({ preventScroll: true });
        section?.scrollIntoView?.({ block: 'nearest' });
        return true;
      }
      return styleManager.setPanelCollapsed(panelId, false, { explicit: true });
    },
  });
  defer(() => presentation.destroy());
  onData?.(dataManager);
  if (!catalog?.layers || !catalog?.metadata)
    throw new TypeError('An application layer catalog is required');
  for (const layer of catalog.layers) dataManager.register(layer);
  for (const layer of catalog.layers) layer.attachDataManager?.(dataManager);
  for (const layer of catalog.layers)
    layer.attachMapStackController?.(mapStackController);
  // Restoration starts only after the caller's complete registry is sealed.
  dataManager.finalizeRegistrations(catalog.metadata);
  if (allowQaRegistration) {
    window.__gevQaRegisterLayer = (targetManager, layerModule) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.registerForQa(layerModule);
    };
    window.__gevQaUnregisterLayer = (targetManager, layerId) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.unregisterForQa(layerId);
    };
    const register = window.__gevQaRegisterLayer;
    const unregister = window.__gevQaUnregisterLayer;
    defer(() => {
      if (window.__gevQaRegisterLayer === register)
        delete window.__gevQaRegisterLayer;
      if (window.__gevQaUnregisterLayer === unregister)
        delete window.__gevQaUnregisterLayer;
    });
  }
  presentation.mount(document.getElementById('data-toggles'));
  styleManager.attachDataManager(dataManager);
  defer(createCyberSonarScene(viewer, dataManager));

  return { dataManager, catalog, presentation };
}
