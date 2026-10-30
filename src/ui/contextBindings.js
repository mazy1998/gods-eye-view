import { t } from '../i18n/index.js';
import { shouldExpandGlobalContextPanel } from '../rightRailPolicy.js';

export function _initGlobalContextPanel() {
  const contextTabs = [
    this._globalContextFlightsBtn,
    this._globalContextMissionsBtn,
    this._globalContextCamerasBtn,
  ].filter(Boolean);
  contextTabs.forEach((tab, index) =>
    this.listen(tab, 'keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowRight')
        nextIndex = (index + 1) % contextTabs.length;
      else if (event.key === 'ArrowLeft')
        nextIndex = (index - 1 + contextTabs.length) % contextTabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = contextTabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      contextTabs[nextIndex].focus({ preventScroll: true });
      contextTabs[nextIndex].click();
    }),
  );
  this.listen(this._globalContextFlightsBtn, 'click', () => {
    if (
      this.destroyed ||
      this._contextModeChanging ||
      this._clearSelectedLayersPromise
    )
      return;
    if (
      this._shownContextTab === 'cameras' &&
      this._contextMode === 'flights'
    ) {
      this.showInspectTab('context');
      return;
    }
    const nextMode = this._contextMode === 'flights' ? null : 'flights';
    this.showInspectTab('context');
    this._claimContextVisualAuthority();
    void this._runUserFacingContextAction(
      (notificationToken) =>
        this._selectContextMode(nextMode, { notificationToken }),
      t('Contacts could not complete the requested transition; try again'),
    ).then((succeeded) => {
      if (
        !this.destroyed &&
        nextMode &&
        shouldExpandGlobalContextPanel({
          action: 'contacts',
          explicitUserAction: true,
          succeeded: succeeded === true,
        })
      )
        this.actions.setPanelCollapsed('global-context-panel', false, {
          explicit: true,
        });
    });
  });
  this.listen(this._globalContextMissionsBtn, 'click', () => {
    if (
      this.destroyed ||
      this._contextModeChanging ||
      this._clearSelectedLayersPromise
    )
      return;
    if (
      this._shownContextTab === 'cameras' &&
      this._contextMode === 'space-missions'
    ) {
      this.showInspectTab('context');
      return;
    }
    const nextMode =
      this._contextMode === 'space-missions' ? null : 'space-missions';
    this.showInspectTab('context');
    this._claimContextVisualAuthority();
    void this._runUserFacingContextAction(
      (notificationToken) =>
        this._selectContextMode(nextMode, { notificationToken }),
      t(
        'Space Missions could not complete the requested transition; try again',
      ),
    ).then((succeeded) => {
      if (
        !this.destroyed &&
        nextMode &&
        shouldExpandGlobalContextPanel({
          action: 'space-missions',
          explicitUserAction: true,
          succeeded: succeeded === true,
        })
      )
        this.actions.setPanelCollapsed('global-context-panel', false, {
          explicit: true,
        });
    });
  });
  this.listen(this._globalContextCamerasBtn, 'click', () => {
    this.showInspectTab('cameras');
  });
  this.listen(this._installationsSearchBtn, 'click', () => {
    if (
      this.destroyed ||
      !this._dataManager?.layers?.has('military-installations')
    )
      return;
    if (this.nearbySitesBusy) return;
    this._setNearbySitesBusy(true);
    void this._runUserFacingContextAction(async (notificationToken) => {
      const enabled = await this._dataManager.setEnabled(
        'military-installations',
        true,
        {
          origin: 'user',
          notificationToken,
        },
      );
      if (
        this.destroyed ||
        enabled === false ||
        !this._dataManager.isEnabled('military-installations')
      )
        return false;
      const searched = await this.installations.searchNearby?.();
      if (this.destroyed || searched === false) return false;
      const stats = this.installations.getStats?.();
      this.showToast(
        stats?.statusMessage ||
          (stats?.status === 'zoom-in'
            ? t('Zoom in to search mapped installations')
            : t('Nearby installations refreshed')),
      );
      return true;
    }, t('Nearby installations could not be refreshed; try again')).finally(
      () => this._setNearbySitesBusy(false),
    );
  });
}
