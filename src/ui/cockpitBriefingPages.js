import CockpitNewsView from './cockpitViews/CockpitNewsView.vue';
import CockpitLocalView from './cockpitViews/CockpitLocalView.vue';

/**
 * Show the Cockpit briefing's News and Local pages. The Cockpit controller
 * owns the regional request and what the pages show; the views render it.
 * @param {(component: object, options: object) => {update(props: object): void, dispose(): void}} mount
 *   mountView, or a shell's mount that releases its views on dispose
 * @param {{news: Element|null, local: Element|null, cockpit: object}} options
 *   the two page sections and the Cockpit controller
 * @returns {{dispose(): void}}
 */
export function mountCockpitBriefingPages(mount, { news, local, cockpit }) {
  if (!cockpit?.subscribeBriefView) return { dispose() {} };
  const shown = cockpit.getBriefView();
  const newsView = news
    ? mount(CockpitNewsView, { parent: news, props: { news: shown.news } })
    : null;
  const localView = local
    ? mount(CockpitLocalView, { parent: local, props: { local: shown.local } })
    : null;
  const unsubscribe = cockpit.subscribeBriefView(
    ({ state }) => {
      newsView?.update({ news: state.news });
      localView?.update({ local: state.local });
    },
    { emitCurrent: false },
  );
  return {
    dispose() {
      unsubscribe();
      newsView?.dispose();
      localView?.dispose();
    },
  };
}
