export function _syncContextModeButtons({ presentationOnly = false } = {}) {
  if (this.destroyed) return;
  const flightsActive = this._contextMode === 'flights';
  const missionsActive = this._contextMode === 'space-missions';
  const camerasShown = this._shownContextTab === 'cameras';
  const panel = this._globalContextPanel;
  panel?.classList.toggle('context-enabled', flightsActive || missionsActive);
  panel?.setAttribute('data-context-mode', this._contextMode || 'none');
  this._globalContextFlightsBtn?.classList.toggle(
    'active',
    flightsActive && !camerasShown,
  );
  this._globalContextFlightsBtn?.setAttribute(
    'aria-selected',
    String(flightsActive && !camerasShown),
  );
  this._globalContextMissionsBtn?.classList.toggle(
    'active',
    missionsActive && !camerasShown,
  );
  this._globalContextMissionsBtn?.setAttribute(
    'aria-selected',
    String(missionsActive && !camerasShown),
  );
  this._globalContextCamerasBtn?.classList.toggle('active', camerasShown);
  this._globalContextCamerasBtn?.setAttribute(
    'aria-selected',
    String(camerasShown),
  );
  const transitionBusy = Boolean(this._contextModeChanging);
  const exitingMissions =
    this._spaceMissionsExit?.generation === this._contextModeGeneration;
  if (this._exitSpaceMissionsBtn) {
    const focused =
      this._exitSpaceMissionsBtn.ownerDocument?.activeElement ===
      this._exitSpaceMissionsBtn;
    this._exitSpaceMissionsBtn.hidden = !(
      missionsActive ||
      this._contextModeEntering === 'space-missions' ||
      exitingMissions
    );
    const busy = Boolean(exitingMissions || this._clearSelectedLayersPromise);
    this._exitSpaceMissionsBtn.setAttribute('aria-busy', String(busy));
    this._exitSpaceMissionsBtn.setAttribute('aria-disabled', String(busy));
    if (this._exitSpaceMissionsBtn.hidden && focused)
      (camerasShown
        ? this._globalContextCamerasBtn
        : this._globalContextMissionsBtn
      )?.focus?.({ preventScroll: true });
  }
  // Both Context choices stay in the ordinary Tab sequence. Arrow keys still
  // provide tablist navigation, but must not be the only way to reach Space
  // Missions from the keyboard. Semantic busy state keeps them perceivable
  // while synchronous click guards prevent a second transition.
  for (const button of [
    this._globalContextFlightsBtn,
    this._globalContextMissionsBtn,
  ]) {
    if (!button) continue;
    button.disabled = false;
    button.tabIndex = 0;
    button.setAttribute('aria-disabled', String(transitionBusy));
    button.setAttribute('aria-busy', String(transitionBusy));
  }
  if (this._contextModeStandby)
    this._contextModeStandby.hidden =
      camerasShown || flightsActive || missionsActive;
  if (this._contextFlightsView)
    this._contextFlightsView.hidden = camerasShown || !flightsActive;
  if (this._contextMissionsView)
    this._contextMissionsView.hidden = camerasShown || !missionsActive;
  if (this._contextCamerasView) this._contextCamerasView.hidden = !camerasShown;
  if (!presentationOnly) this.cockpitView?.syncEntry();
  // Every _contextMode mutation funnels through here; the sync no-ops until
  // the transaction settles, so this is the activation/deactivation edge.
  if (!presentationOnly) this.actions.syncDetection();
  this.actions.scheduleLayout();
}
