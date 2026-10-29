import { mountView } from './mountView.js';
import PlacePills from './locationViews/PlacePills.vue';
import { locationMiniStatus } from '../locationStatus.js';
import { t } from '../i18n/index.js';
import { localizePlaceName } from './placeNames.js';

const POI_KEYS = ['Q', 'W', 'E', 'R', 'T'];

/**
 * locationStatus.js placeholder lines, built by the module itself; renderStatus
 * swaps them for translated text. Place names are shown as they are.
 */
const LOCATION_MINI_EMPTY = Object.freeze(locationMiniStatus());
const LOCATION_MINI_SEARCHED_PLACEHOLDER = Object.freeze(
  locationMiniStatus({ searchedLabel: '·' }),
);

/** Location DOM, keyboard handling and pending row animation over supplied actions. */
export class LocationControls {
  constructor({
    elements,
    field,
    views,
    getSearchState,
    cities,
    getExpandedCity,
    onCity,
    onPoi,
    onSearch,
    onSearchEdit,
    onSearchOpen,
    isSearchAlwaysShown,
    onReset,
    doc = document,
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
  }) {
    Object.assign(this, {
      elements,
      views,
      cities,
      getExpandedCity,
      onCity,
      onPoi,
      onSearch,
      onReset,
      doc,
      requestFrame,
      cancelFrame,
    });
    this.removers = [];
    this.pillViews = [];
    this.frame = null;
    this.destroyed = false;
    this.rowGeneration = 0;
    this.cityView = mountView(PlacePills, {
      parent: elements.pills,
      props: {
        kind: 'city',
        items: Object.entries(cities).map(([id, city]) => ({
          id,
          label: localizePlaceName(city.name),
        })),
        onChoose: (id) => {
          if (!this.destroyed) onCity(id);
        },
      },
    });
    this.poiView = mountView(PlacePills, {
      parent: elements.poiRow,
      props: { kind: 'poi', items: [] },
    });
    this.pillViews.push(this.cityView, this.poiView);
    views.search.update({
      onToggle: () => {
        if (this.destroyed) return;
        onSearchOpen?.();
        if (isSearchAlwaysShown?.()) field.open();
        else field.toggle();
      },
      onSubmit: (query) => {
        if (this.destroyed) return;
        // Submit captures native autofill/programmatic input as a user intent too.
        field.edit(query);
        void onSearch(field.getState().query);
      },
      onEdit: (query) => {
        if (this.destroyed) return;
        field.edit(query);
        onSearchEdit?.();
      },
      onBlur: () => {
        if (!this.destroyed && !field.getState().query) onSearchEdit?.();
      },
    });
    views.results.update({
      onFly: () => {
        if (this.destroyed) return;
        const state = getSearchState();
        if (state.status === 'found' && !state.searching)
          void onSearch(state.query);
      },
    });
    this.removers.push(
      field.subscribe(({ state }) => {
        views.search.update(state);
        views.results.update({
          error: state.error,
          dismissed: state.resultDismissed,
        });
      }),
    );
    this.bind(doc, 'keydown', (event) => {
      const cityId = getExpandedCity();
      if (
        !cityId ||
        event.target?.matches?.('select, input, textarea') ||
        event.target === elements.search
      )
        return;
      const index = POI_KEYS.indexOf(event.key.toUpperCase());
      if (index !== -1 && index < (cities[cityId]?.pois.length || 0))
        onPoi(cityId, index);
    });
    for (const button of elements.resetButtons)
      this.bind(button, 'click', onReset);
  }
  bind(element, event, handler, removers = this.removers) {
    if (!element) return;
    const listener = (...args) => {
      if (!this.destroyed) return handler(...args);
    };
    element.addEventListener(event, listener);
    removers.push(() => element.removeEventListener(event, listener));
  }
  cancelExpansion() {
    this.rowGeneration++;
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
  }
  showPois(cityId) {
    if (this.destroyed) return;
    const city = this.cities[cityId];
    if (!city) return;
    this.cancelExpansion();
    const generation = this.rowGeneration;
    this.poiView.update({
      key: cityId,
      selected: null,
      items: city.pois.map((poi, index) => ({
        id: index,
        label: poi.name,
        keyHint: POI_KEYS[index] || index + 1,
      })),
      onChoose: (index) => {
        if (!this.destroyed && generation === this.rowGeneration)
          this.onPoi(cityId, index);
      },
    });
    this.frame = this.requestFrame(() => {
      if (this.destroyed || generation !== this.rowGeneration) return;
      this.frame = null;
      this.elements.poiRow.classList.add('expanded');
      this.elements.divider.classList.add('visible');
    });
  }
  hidePois() {
    if (this.destroyed) return;
    this.cancelExpansion();
    this.elements.poiRow.classList.remove('expanded');
    this.elements.divider.classList.remove('visible');
  }
  highlightPoi(index) {
    if (this.destroyed) return;
    this.poiView.update({ selected: index });
  }
  highlightCity(id) {
    if (this.destroyed) return;
    this.cityView.update({ selected: id });
  }
  renderStatus(record) {
    if (this.destroyed || !this.elements.statusCity || !this.elements.statusPoi)
      return;
    // A preset city shows its name in the UI language; the record stays English.
    const state = record?.city?.name
      ? {
          ...record,
          city: { ...record.city, name: localizePlaceName(record.city.name) },
        }
      : record;
    const lines = locationMiniStatus(state);
    const city =
      lines.city === LOCATION_MINI_EMPTY.city
        ? t('📍 Location: --')
        : lines.city;
    let poi;
    if (lines.poi === LOCATION_MINI_EMPTY.poi) {
      poi = t('Landmark: --');
    } else if (lines.poi === LOCATION_MINI_SEARCHED_PLACEHOLDER.poi) {
      poi = t('Searched location');
    } else {
      poi = lines.poi;
    }
    this.views.status.update({ city, poi });
  }
  createOrbitIndicator() {
    if (this.destroyed) return null;
    if (!this.orbitIndicator) {
      this.orbitIndicator = this.doc.createElement('div');
      this.orbitIndicator.id = 'orbit-indicator';
      const icon = this.doc.createElement('span');
      icon.className = 'orbit-icon';
      icon.textContent = '↻';
      this.orbitIndicator.append(icon, ` ${t('ORBIT')}`);
      this.doc.body.appendChild(this.orbitIndicator);
    }
    return this.orbitIndicator;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelExpansion();
    for (const remove of this.removers.splice(0)) remove();
    for (const view of this.pillViews.splice(0)) view.dispose();
    this.orbitIndicator?.remove();
  }
}
