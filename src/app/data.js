import { LayerLifecycle } from '../data/lifecycle.js';
import { LayerPresentation } from './layerPresentation.js';
import { createCyberSonarScene } from '../cyberSonarScene.js';
import { panelAwareVisibility } from './embed.js';
/** Reveal the existing details view, then focus its retained entry control. */
export function revealLayerDetails(styleManager, panelId, doc = document) {
  if (panelId === 'directions-controls-body') {
    const phone = styleManager._mobileShell;
    const opened = phone?.channel.getSnapshot()?.active
      ? phone.setDestination('tools')
      : styleManager._drawer?.open('tools');
    if (!opened) return false;
    const section = doc.getElementById(panelId);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView?.({ block: 'nearest' });
    return true;
  }
  const result = styleManager.setPanelCollapsed(panelId, false, {
    explicit: true,
  });
  const controlId = {
    'cctv-panel': 'cctv-enable-btn',
    'street-level-panel': 'sl-status',
  }[panelId];
  if (controlId) {
    const control = doc.getElementById(controlId);
    control?.focus({ preventScroll: true });
    control?.scrollIntoView?.({ block: 'nearest' });
  }
  return result;
}

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
    openDetails: (panelId) => revealLayerDetails(styleManager, panelId),
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
