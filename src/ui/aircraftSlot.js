import { aircraftPresentation } from './aircraftPresentation.js';
import { nearbyAircraft } from './aircraftNearby.js';

/**
 * Bridge existing aircraft selections into the shared slot. Feed notifications
 * refresh only the selected owner; they never claim the slot. A camera replacing
 * the card therefore stays there until another explicit aircraft selection.
 */
export function connectAircraftSlot({
  slot,
  viewer,
  layers,
  events,
  subscribePresentation,
  readSelectedContext,
  mount,
  readNearby = nearbyAircraft,
  readAvailability = () => ({ cockpit: false, contacts: false }),
  enterCockpit = () => false,
  openContacts = () => false,
  now = Date.now,
  schedule = setInterval,
  cancel = clearInterval,
}) {
  let selected = null;
  let view = null;
  let timer = null;
  let revision = 0;
  let destroyed = false;
  let lastPaint = '';
  let cacheKey = null;
  let cachedAt = -Infinity;
  let nearby = [];
  let availability = {};
  let actionBusy = false;
  let actionGeneration = 0;
  const owner = () => layers[selected?.layerId];
  const read = () => {
    const layer = owner();
    const info =
      selected?.layerId === 'local-adsb'
        ? layer?.getSelectedAircraftInfo?.()
        : layer?.getTrackedInfo?.();
    if (!info || String(info.icao24).toLowerCase() !== selected?.icao)
      return null;
    return {
      ...info,
      layerId: selected.layerId,
      source: info.source || layer.getStats?.().source,
    };
  };
  const cardProps = (info) => {
    const at = now();
    const key = `${selected.layerId}:${selected.icao}`;
    if (key !== cacheKey || at - cachedAt >= 1000) {
      cacheKey = key;
      cachedAt = at;
      const context = readSelectedContext();
      const entity =
        selected.layerId === 'local-adsb'
          ? context?.entity
          : viewer.trackedEntity;
      const position =
        entity?.gevTrackedId === key ? entity.gevDisplayPosition?.() : null;
      nearby = readNearby(layers, selected, info, position);
      availability = readAvailability(selected);
    }
    return {
      presentation: aircraftPresentation(info, at, nearby),
      availability: {
        ...availability,
        contacts: Boolean(availability.contacts && !actionBusy),
      },
    };
  };
  const withdraw = () => {
    selected = null;
    slot.hide('aircraft');
  };
  const paint = () => {
    if (destroyed || !selected || slot.current() !== 'aircraft') return;
    const info = read();
    if (!info) {
      withdraw();
      return;
    }
    const props = view
      ? cardProps(info)
      : { presentation: aircraftPresentation(info, now()) };
    const serialized = JSON.stringify(props);
    if (serialized === lastPaint) return;
    lastPaint = serialized;
    slot.show({
      id: 'aircraft',
      title: props.presentation.title,
      icon: 'flight',
    });
    view?.update(props);
  };
  const actions = {
    cockpit() {
      if (!view || !selected || !read() || !readAvailability(selected).cockpit)
        return false;
      return enterCockpit({ ...selected });
    },
    async contacts() {
      if (
        !view ||
        !selected ||
        !read() ||
        actionBusy ||
        !readAvailability(selected).contacts
      )
        return false;
      const target = { ...selected };
      const generation = actionGeneration;
      const isCurrent = () => !destroyed && generation === actionGeneration;
      actionBusy = true;
      paint();
      try {
        return await openContacts(target, isCurrent);
      } finally {
        actionBusy = false;
        cacheKey = null;
        paint();
      }
    },
    nearby(key) {
      if (!view || !selected) return false;
      const target = nearby.find((row) => row.key === key);
      if (!target) return false;
      const layer = layers[target.layerId];
      const changed =
        target.layerId === 'local-adsb'
          ? Boolean(layer?.selectAircraft?.(target.id))
          : Boolean(layer?.trackById?.(target.id, { origin: 'user' }));
      if (changed)
        queueMicrotask(() => {
          if (
            !destroyed &&
            selected?.layerId === target.layerId &&
            selected?.icao === target.id &&
            slot.current() === 'aircraft'
          )
            view?.focus?.();
        });
      return changed;
    },
  };
  const select = (layerId, id) => {
    revision++;
    actionGeneration++;
    cacheKey = null;
    if (!layers[layerId] || !id) {
      withdraw();
      return;
    }
    selected = { layerId, icao: String(id).toLowerCase() };
    const info = read();
    if (!info) {
      withdraw();
      return;
    }
    lastPaint = '';
    slot.show({
      id: 'aircraft',
      title: aircraftPresentation(info, now()).title,
      icon: 'flight',
      mount({ body, actions: header }) {
        const current = read();
        if (!current) {
          queueMicrotask(paint);
          return () => {};
        }
        view = mount(body, { ...cardProps(current), actions }, header);
        timer = schedule(paint, 1000);
        return () => {
          cancel(timer);
          timer = null;
          view?.dispose();
          view = null;
        };
      },
      close() {
        actionGeneration++;
        const closing = selected;
        const layer = owner();
        // A delayed close must not stop a newer aircraft owned by this layer.
        if (closing && read()) {
          if (closing.layerId === 'local-adsb')
            layer.deselectAircraft?.(closing.icao);
          else layer.stopTracking?.({ origin: 'user' });
        }
        withdraw();
      },
      replaced() {
        actionGeneration++;
        selected = null;
        revision++;
      },
    });
    paint();
  };
  const selectEntity = (entity) => {
    const match = /^(flights|military|local-adsb):(.+)$/.exec(
      entity?.gevTrackedId || '',
    );
    if (match) select(match[1], match[2]);
    else withdraw();
  };
  const onTracked = () => {
    if (viewer.trackedEntity?.gevSelectionOrigin === 'programmatic') {
      revision++;
      // An automatic handoff can invalidate an older card, but cannot claim
      // the slot or disturb a camera or independently selected receiver.
      if (
        selected &&
        selected.layerId !== 'local-adsb' &&
        viewer.trackedEntity.gevTrackedId !==
          `${selected.layerId}:${selected.icao}`
      )
        withdraw();
      return;
    }
    if (viewer.trackedEntity) selectEntity(viewer.trackedEntity);
    else if (selected && selected.layerId !== 'local-adsb') {
      revision++;
      withdraw();
    }
  };
  const onContext = (event) => {
    const record = event.detail;
    if (record?.layerId === 'local-adsb') selectEntity(record.entity);
    else {
      revision++;
      withdraw();
    }
  };
  // The awareness event is emitted before its Context record is registered.
  // Its id already identifies the owner, so no stale Context snapshot is read.
  const onAircraft = (event) => {
    const { layerId, id, origin } = event.detail || {};
    const ticket = ++revision;
    if (origin === 'programmatic') return;
    queueMicrotask(() => {
      if (!destroyed && ticket === revision) select(layerId, id);
    });
  };
  const onClear = (event) => {
    if (selected?.layerId === event.detail?.layerId) {
      revision++;
      withdraw();
    }
  };
  const removeTracked =
    viewer.trackedEntityChanged?.addEventListener(onTracked);
  const bindings = [
    ['gev:entity-selected', onContext],
    ['gev:awareness-subject-selected', onAircraft],
    ['gev:entity-selection-cleared', onClear],
  ];
  for (const [type, listener] of bindings)
    events.addEventListener(type, listener);
  const unsubscribe = subscribePresentation((entity) => {
    if (
      selected &&
      entity?.gevTrackedId === `${selected.layerId}:${selected.icao}`
    )
      paint();
  });
  const context = readSelectedContext();
  if (context?.layerId === 'local-adsb') selectEntity(context.entity);
  else if (viewer.trackedEntity) onTracked();
  return () => {
    destroyed = true;
    actionGeneration++;
    revision++;
    removeTracked?.();
    unsubscribe();
    for (const [type, listener] of bindings)
      events.removeEventListener(type, listener);
    withdraw();
  };
}
