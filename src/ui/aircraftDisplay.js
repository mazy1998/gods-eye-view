/**
 * Own the shared aircraft display preference. The Display view (ModelsGroup)
 * shows it from the visual state; onChange publishes that state.
 */
export class AircraftDisplay {
  constructor({ elements, readDataManager, layout, onChange = () => {} }) {
    Object.assign(this, elements, {
      readDataManager,
      _layoutRightPanels: layout,
      _onChange: onChange,
    });
    // Both aircraft layers default to models enabled in proximity mode.
    this._models3dEnabled = true;
    this._models3dMode = 'proximity';
  }
  get _dataManager() {
    return this.readDataManager();
  }
  _setModels3dParams(params, { origin = 'user' } = {}) {
    this._dataManager?.setLayerParams('flights', params, { origin });
    this._dataManager?.setLayerParams('military', params, { origin });
  }

  _syncModels3dFromLayerState(state) {
    const options = state?.options?.flights;
    if (!options) return;
    this._models3dEnabled = options.models3d === true;
    this._models3dMode = options.models3dMode === 'all' ? 'all' : 'proximity';
    // Paint first, so the right panels lay out around the view's new rows.
    this._onChange();
    this._layoutRightPanels();
  }

  _syncModels3dModeRow() {
    this._layoutRightPanels();
  }

  _initModels3dToggle() {
    this._onChange();
    this._syncModels3dModeRow();
  }

  _setModels3dEnabled(enabled) {
    this._models3dEnabled = !!enabled;
    this._setModels3dParams({ models3d: this._models3dEnabled });
    this._onChange();
  }

  _setModels3dMode(mode) {
    const normalized = mode === 'all' ? 'all' : 'proximity';
    this._models3dMode = normalized;
    this._setModels3dParams({ models3dMode: normalized });
    this._onChange();
  }

  /**
   * The 3D button's pressed state is part of the published state; kept as the
   * name callers already use.
   */
  _syncModels3dButtonState() {
    this._onChange();
  }
}
