import { t } from '../i18n/index.js';

/** Pure detailed-card projection of the existing radio/lifecycle snapshot. */
export function radioCardView(state = {}) {
  const enabled = Boolean(state.enabled);
  const lifecycleState =
    state.lifecycleState || (enabled ? 'enabled' : 'disabled');
  const transitioning =
    lifecycleState === 'enabling' || lifecycleState === 'disabling';
  const uncertain = Boolean(state.lifecycleUncertain);
  const interactive = enabled && !transitioning && !uncertain;
  const selected = state.selected || null;
  const activePlayback = ['playing', 'buffering'].includes(state.audioState);
  const categories = state.categories || [];
  const filter = state.filter || 'all';
  const category = categories.find((item) => item.id === filter);
  const place = selected
    ? [selected.state, selected.countryCode].filter(Boolean).join(' · ')
    : '';
  const signal = selected
    ? [selected.codec, selected.bitrate ? `${selected.bitrate} kbps` : '']
        .filter(Boolean)
        .join(' · ')
    : '';
  const tags = Array.isArray(selected?.tags) ? selected.tags.slice(0, 8) : [];
  const action = activePlayback
    ? t('Pause')
    : state.audioState === 'paused'
      ? t('Resume')
      : t('Play');
  const stationName = selected?.name || t('station');
  const catalogSuffix = state.degraded
    ? state.stale
      ? t(' · stale/degraded directory')
      : t(' · degraded directory')
    : state.stale
      ? t(' · stale directory')
      : '';
  const outsideFilter =
    selected && state.selectedIndex < 0 ? t(' · outside current filter') : '';
  const messages = {
    stopped: enabled
      ? t('Ready — playback starts only from your action')
      : t('Radio off'),
    loading: t('Connecting directly to broadcaster…'),
    buffering: t('Buffering broadcaster stream…'),
    playing: t('Playing {station}', { station: stationName }),
    paused: t('Paused {station}', { station: stationName }),
    // Playback keeps its messages in English (msg()); shown in the UI language.
    error: state.audioError
      ? t(state.audioError)
      : t('Broadcaster stream unavailable'),
  };
  const voiceSuffix = state.voiceDucked
    ? t(' · muted during voice interaction')
    : state.voiceRestoring
      ? t(' · restoring volume after voice')
      : '';
  const tuningSuffix = state.tuningAwaitingStationId
    ? state.audioState === 'error'
      ? t(' · static indicates no broadcaster audio')
      : t(' · tuning static until broadcaster starts')
    : '';
  const unavailable = state.tuningUnavailableStationId
    ? t('Station unavailable after directory refresh — choose another channel')
    : null;
  const lifecycleMessage = transitioning
    ? lifecycleState === 'enabling'
      ? t('Radio is enabling…')
      : t('Radio is disabling…')
    : null;
  const uncertainMessage = uncertain
    ? t('Radio lifecycle is uncertain — use Enable or Disable to reconcile')
    : null;
  // Directory errors are msg() literals from the radio layer's ingestion.
  const directoryError = state.error ? t(state.error) : null;
  const statusText = `${uncertainMessage || unavailable || lifecycleMessage || directoryError || messages[state.audioState] || t('Ready')}${tuningSuffix}${voiceSuffix}${catalogSuffix}${outsideFilter}`;
  const statusError = Boolean(
    uncertainMessage ||
    unavailable ||
    state.error ||
    state.audioState === 'error',
  );

  return {
    enabled,
    transitioning,
    interactive,
    categories,
    filter,
    filterColor: category?.color || '',
    filterDisabled: !interactive || !state.stationCount,
    enableLabel: transitioning
      ? lifecycleState === 'enabling'
        ? t('ENABLING')
        : t('DISABLING')
      : uncertain
        ? t('RECONCILE')
        : enabled
          ? t('DISABLE')
          : t('ENABLE'),
    enableAria: uncertain
      ? t('Reconcile Radio — lifecycle uncertain')
      : enabled
        ? t('Disable Radio')
        : t('Enable Radio'),
    tunerAvailable: interactive && state.filteredCount > 0,
    band:
      filter === 'all'
        ? t('DIRECTORY BAND')
        : t('{category} BAND', {
            category: String(category?.label || filter).toUpperCase(),
          }),
    name: selected?.name || t('NO STATION SELECTED'),
    meta: selected
      ? [place, signal].filter(Boolean).join('  /  ') ||
        t('Directory metadata only')
      : state.loading
        ? t('Loading station directory…')
        : t('Choose a globe marker or use next.'),
    tags: tags.length ? t('TAGS · {tags}', { tags: tags.join(' · ') }) : '',
    homepage: selected?.homepage || null,
    transportDisabled: !interactive || !(state.filteredCount > 0),
    activePlayback,
    playLabel: activePlayback
      ? t('PAUSE')
      : state.audioState === 'paused'
        ? t('RESUME')
        : t('PLAY'),
    playAria: t('{action} {target} radio station', {
      action,
      target: selected ? t('selected') : t('nearest'),
    }),
    stopDisabled: !interactive || state.audioState === 'stopped',
    statusText,
    statusError,
  };
}
