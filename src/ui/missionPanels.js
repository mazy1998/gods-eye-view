import MissionRosterView from './contextViews/MissionRosterView.vue';
import MissionDetailView from './contextViews/MissionDetailView.vue';

/**
 * Show the Space Missions layer's roster and selected mission in the Missions
 * view. The layer owns what is shown, selection, replay and the roster
 * preview; the views only report which control was used.
 * @param {(component: object, options: object) => {update(props: object): void, dispose(): void}} mount
 *   mountView, or a shell's mount that releases its views on dispose
 * @param {{roster: Element|null, host: Element|null, launches: object}} options
 *   roster is the roster's container, host the element the selected mission's
 *   panel follows the roster in
 * @returns {{dispose(): void}}
 */
export function mountMissionPanels(mount, { roster, host, launches }) {
  if (!launches?.subscribeMissionPanelView) return { dispose() {} };
  const actions = launches.getMissionPanelActions();
  let shown = launches.getMissionPanelView();
  const rosterView = roster
    ? mount(MissionRosterView, {
        parent: roster,
        props: {
          roster: shown.roster,
          onSelect: actions.select,
          onPointerEnter: actions.pointerEnter,
          onPointerLeave: actions.pointerLeave,
          onFocus: actions.focus,
          onBlur: actions.blur,
        },
      })
    : null;
  const detailView = host
    ? mount(MissionDetailView, {
        parent: host,
        props: {
          detail: shown.detail,
          replay: shown.replay,
          onDeselect: actions.deselect,
          onFocusSite: actions.focusSite,
          onReplay: actions.replay,
          onTogglePause: actions.togglePause,
          onCancelReplay: actions.cancelReplay,
          onReplaySpeed: actions.setReplaySpeed,
          onPrevious: actions.previous,
          onNext: actions.next,
        },
      })
    : null;
  const unsubscribe = launches.subscribeMissionPanelView(
    ({ state }) => {
      // Telemetry and replay publish often; the roster changes only when
      // the mission list is refreshed.
      if (state.roster.revision !== shown.roster.revision)
        rosterView?.update({ roster: state.roster });
      detailView?.update({ detail: state.detail, replay: state.replay });
      shown = state;
    },
    { emitCurrent: false },
  );
  return {
    dispose() {
      unsubscribe();
      rosterView?.dispose();
      detailView?.dispose();
    },
  };
}
