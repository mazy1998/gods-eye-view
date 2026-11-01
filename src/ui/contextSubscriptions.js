import { t } from '../i18n/index.js';
import {
  contextLayerEnableBlockReason,
  isExplicitUserIntentOrigin,
  runWithContextModeChanging,
  settleContextModeChange,
  shouldCaptureContextSession,
  shouldDeferContextEntryDuringClear,
} from '../contextModePolicy.js';

export function connectContextManager(manager) {
  this.disconnect();
  if (this.destroyed) return;
  this._dataManager = manager || null;
  this._contextManagerUnsubscribe = this._dataManager?.subscribe?.((change) => {
    if (String(change?.type || '').startsWith('visibility'))
      this._handleContextLayerChange(change);
  });
  if (typeof this._dataManager?.subscribeVisibilityRequests === 'function') {
    this._dataManagerVisibilityRequestUnsubscribe =
      this._dataManager.subscribeVisibilityRequests((change) => {
        if (this.destroyed) return;
        const exiting =
          this._spaceMissionsExit?.generation === this._contextModeGeneration
            ? this._spaceMissionsExit
            : null;
        if (
          contextLayerEnableBlockReason({
            contextMode: exiting
              ? 'space-missions'
              : this._contextModeEntering || this._contextMode,
            change,
          }) &&
          isExplicitUserIntentOrigin(change.origin, change.layerId)
        ) {
          this._pendingMissionLayerEnables.set(change.layerId, {
            intentEpoch: change.intentEpoch,
            notify: false,
            waitForClear: Boolean(
              this._clearSelectedLayersPromise &&
              this._contextModeDeferredEntryIntent,
            ),
          });
          if (
            this._clearSelectedLayersPromise &&
            this._contextModeDeferredEntryIntent
          )
            this._contextModeDeferredEntryIntent = null;
          exiting?.deferredLayerIds.add(change.layerId);
        }
        if (shouldCaptureContextSession(change)) {
          // This event is synchronous with intent publication, before an
          // awaited guard or Clear All can alter the rest of the layer set.
          // Manager effective visibility already includes both the new entry
          // intent and Clear's reserved OFF baseline.
          this._captureContextSessionSnapshot({
            excludeLayerIds: [change.layerId],
          });
          if (
            shouldDeferContextEntryDuringClear({
              change,
              clearInFlight: Boolean(this._clearSelectedLayersPromise),
            })
          ) {
            this._contextModeDeferredEntryIntent = {
              layerId: change.layerId,
              intentEpoch: change.intentEpoch,
              origin: change.origin,
            };
            this._contextModeEntering = 'space-missions';
            this._syncContextModeButtons();
          }
        } else if (
          change?.layerId === 'rocket-launches' &&
          change.enabled === false &&
          isExplicitUserIntentOrigin(change.origin, change.layerId)
        ) {
          this._contextModeDeferredEntryIntent = null;
          if (this._clearSelectedLayersPromise) {
            this._contextSessionSnapshot = null;
            this._contextModeEntering = null;
            this._syncContextModeButtons();
          }
        }
      });
  }
  if (typeof this._dataManager?.addVisibilityGuard === 'function') {
    this._dataManagerVisibilityGuardUnsubscribe =
      this._dataManager.addVisibilityGuard(async (change) => {
        if (this.destroyed) return null;
        const layerName =
          this._dataManager?.layers?.get(change.layerId)?.module?.name ||
          change.layerId;
        const exiting =
          this._spaceMissionsExit?.generation === this._contextModeGeneration
            ? this._spaceMissionsExit
            : null;
        const reason = contextLayerEnableBlockReason({
          contextMode: exiting
            ? 'space-missions'
            : this._contextModeEntering || this._contextMode,
          change,
          layerName,
        });
        const restoringExit =
          exiting &&
          ['context-restore', 'context-intent-replay'].includes(change.origin);
        if (reason && !restoringExit) {
          if (!isExplicitUserIntentOrigin(change.origin, change.layerId))
            return reason;
          const pending = this._pendingMissionLayerEnables.get(
            change.layerId,
          ) || { intentEpoch: change.intentEpoch };
          pending.notify = true;
          this._pendingMissionLayerEnables.set(change.layerId, pending);
          if (this._clearSelectedLayersPromise && pending.waitForClear)
            await this._clearSelectedLayersPromise;
          const exited = await this.exitSpaceMissions({
            deferredEntry: pending.waitForClear,
          });
          pending.exitFailed = exited !== true;
          if (!exited || this.destroyed) return reason;
          return contextLayerEnableBlockReason({
            contextMode: this._contextModeEntering || this._contextMode,
            change,
            layerName,
          });
        }
        if (
          change.enabled &&
          ['military-awareness', 'rocket-launches'].includes(change.layerId) &&
          shouldCaptureContextSession(change) &&
          (!this._contextModeChanging ||
            (change.layerId === 'rocket-launches' &&
              this._contextModeDeferredEntryIntent?.intentEpoch ===
                change.intentEpoch))
        ) {
          const entryMode =
            change.layerId === 'rocket-launches' ? 'space-missions' : null;
          const deferredClearEntry =
            this._contextModeDeferredEntryIntent?.intentEpoch ===
            change.intentEpoch;
          // A deferred entry owns the state after Clear settles. Restoring
          // Clear's transient busy flag here would leave Context stuck.
          const priorChanging = deferredClearEntry
            ? false
            : this._contextModeChanging;
          const generation = this._contextModeGeneration;
          const notificationToken =
            change.notificationToken || Symbol('direct-context-shell-entry');
          const ownsNotificationToken = !change.notificationToken;
          if (ownsNotificationToken) {
            this._userFacingContextNotificationTokens.add(notificationToken);
          }
          this._contextModeEntering = entryMode;
          this._contextModeChanging = true;
          try {
            if (deferredClearEntry) {
              await this._clearSelectedLayersManagerPromise;
              if (this.destroyed) return false;
              if (
                this._contextModeDeferredEntryIntent?.intentEpoch !==
                change.intentEpoch
              )
                return false;
              this._contextModeDeferredEntryIntent = null;
            }
            await this._clearLayersOutsideContextMode(entryMode, {
              notificationToken,
            });
            if (this.destroyed) return false;
          } catch (error) {
            if (this.destroyed || generation !== this._contextModeGeneration)
              return false;
            this._contextModeEntering = null;
            console.warn(`[Context] ${change.layerId} isolation failed`, error);
            try {
              await this._restoreContextSession({
                excludeLayerIds: [change.layerId],
                notificationToken,
              });
            } catch (restoreError) {
              console.warn(
                `[Context] ${change.layerId} rollback failed`,
                restoreError,
              );
            }
            return t(
              '{mode} could not start because another layer did not stop cleanly',
              {
                mode:
                  entryMode === 'space-missions'
                    ? t('Space Missions')
                    : t('Context'),
              },
            );
          } finally {
            if (ownsNotificationToken) {
              this._userFacingContextNotificationTokens.delete(
                notificationToken,
              );
            }
            if (!this.destroyed && generation === this._contextModeGeneration)
              settleContextModeChange(this, priorChanging);
          }
        }
        return null;
      });
  }
  if (typeof this._dataManager?.subscribeBeforeDestroy === 'function') {
    this._dataManagerBeforeDestroyUnsubscribe =
      this._dataManager.subscribeBeforeDestroy(async ({ layerId } = {}) => {
        if (this.destroyed || !this._contextSessionSnapshot) return;
        await runWithContextModeChanging(this, async () => {
          this._contextMode = null;
          this.cockpitView?.exit({ restoreTracking: false });
          this._syncContextModeButtons();
          await this._restoreContextSession({
            excludeLayerIds: layerId ? [layerId] : [],
          });
        });
      });
  }
  this._syncContextModeButtons();
}
