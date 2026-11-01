import { aircraftPresentation } from './aircraftPresentation.js';

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
  const owner = () => layers[selected?.layerId];
  const read = () => {
    const layer = owner();
    const info =
      selected?.layerId === 'local-adsb'
        ? layer?.getSelectedAircraftInfo?.()
        : layer?.getTrackedInfo?.();
    if (!info || String(info.icao24).toLowerCase() !== selected?.icao)
      return null;
    return { ...info, source: info.source || layer.getStats?.().source };
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
    const presentation = aircraftPresentation(info, now());
    const serialized = JSON.stringify(presentation);
    if (serialized === lastPaint) return;
    lastPaint = serialized;
    slot.show({ id: 'aircraft', title: presentation.title, icon: 'flight' });
    view?.update({ presentation });
  };
  const select = (layerId, id) => {
    revision++;
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
      mount({ body }) {
        const current = read();
        if (!current) {
          queueMicrotask(paint);
          return () => {};
        }
        const presentation = aircraftPresentation(current, now());
        view = mount(body, { presentation });
        timer = schedule(paint, 5000);
        return () => {
          cancel(timer);
          timer = null;
          view?.dispose();
          view = null;
        };
      },
      close() {
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
    const { layerId, id } = event.detail || {};
    const ticket = ++revision;
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
    revision++;
    removeTracked?.();
    unsubscribe();
    for (const [type, listener] of bindings)
      events.removeEventListener(type, listener);
    withdraw();
  };
}
