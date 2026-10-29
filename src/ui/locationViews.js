import SearchField from './locationViews/SearchField.vue';
import SearchResults from './locationViews/SearchResults.vue';
import MiniStatus from './locationViews/MiniStatus.vue';
import LocationPin from './locationViews/LocationPin.vue';

/** Mount before shell element collection, so every owner receives the live input.
 * SearchField and SearchResults have independent seats for the header handoff.
 */
export function mountLocationViews(mount, doc = document) {
  const views = {};
  for (const [name, component] of Object.entries({
    search: SearchField,
    results: SearchResults,
    status: MiniStatus,
    pin: LocationPin,
  })) {
    const seat = doc.querySelector(`[data-location-view="${name}"]`);
    views[name] = mount(component, { parent: seat.parentNode, before: seat });
    seat.remove();
  }
  return views;
}
