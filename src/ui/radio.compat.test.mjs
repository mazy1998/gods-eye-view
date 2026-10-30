import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const { RadioControls } = await import('gods-eye-view/ui/radio');

test('published RadioControls paints supplied native transport, station and tuner controls without a Vue mount', () => {
  container.innerHTML =
    '<section><button id="enable"></button><select></select><strong></strong><span id="meta"></span><span id="tags"></span><button id="prev"></button><button id="play"></button><button id="next"></button><button id="stop"></button><input type="range" min="0" max="100"><output></output><p></p><a></a><div id="tuner" hidden><input type="range"><span></span></div></section>';
  const panel = container.querySelector('section');
  const by = (s) => panel.querySelector(s);
  const elements = {
    _radioPanel: panel,
    _radioEnableBtn: by('#enable'),
    _radioFilter: by('select'),
    _radioStationName: by('strong'),
    _radioStationMeta: by('#meta'),
    _radioStationTags: by('#tags'),
    _radioPrevBtn: by('#prev'),
    _radioPlayBtn: by('#play'),
    _radioNextBtn: by('#next'),
    _radioStopBtn: by('#stop'),
    _radioVolume: by('input'),
    _radioVolumeValue: by('output'),
    _radioPlaybackState: by('p'),
    _radioStationHomepage: by('a'),
    _radioTuner: by('#tuner'),
    _radioTunerSlider: by('#tuner input'),
    _radioTunerValue: by('#tuner span'),
  };
  const selected = {
    id: 'a',
    name: '<Station>',
    countryCode: 'GB',
    codec: 'mp3',
    tags: ['local'],
  };
  const state = {
    enabled: true,
    filter: 'all',
    categories: [{ id: 'all', label: 'All', count: 1, color: '#0099aa' }],
    filteredCount: 1,
    stationCount: 1,
    selected,
    selectedIndex: 0,
    audioState: 'paused',
    volume: 0.4,
  };
  let notify;
  let unsubscribed = 0;
  const calls = [];
  const radio = {
    subscribe: (fn) => {
      notify = fn;
      fn(state);
      return () => unsubscribed++;
    },
    getTunerStations: () => [selected],
    cycleStation: (d) => {
      calls.push(d);
      return true;
    },
    endTuning: () => {},
  };
  const actions = {
    setParams: ({ volume }) => calls.push(volume),
    getLifecycle: () => null,
    preservePanelStateDuringClear: () => false,
    scheduleLayout() {},
    isRegistered: () => true,
    isEnabled: () => true,
    setPanelCollapsed() {},
    setSignalCollapsed() {},
    revealStyleParameters() {},
  };
  const control = new RadioControls({ elements, radio, actions, canvas: null });
  control.connect();
  assert.equal(elements._radioStationName.textContent, '<Station>');
  assert.equal(panel.querySelector('station'), null);
  assert.equal(elements._radioFilter.options.length, 1);
  assert.equal(elements._radioPlayBtn.disabled, false);
  assert.equal(elements._radioPlayBtn.textContent, 'RESUME');
  assert.equal(elements._radioVolume.value, '40');
  assert.equal(elements._radioTuner.hidden, false);
  assert.equal(elements._radioTunerSlider.max, '0');
  elements._radioNextBtn.click();
  assert.deepEqual(calls, [1]);
  elements._radioVolume.value = '20';
  elements._radioVolume.dispatchEvent(new Event('input'));
  assert.equal(calls.at(-1), 0.2);
  state.audioState = 'playing';
  state.volume = 0.6;
  notify(state);
  assert.equal(elements._radioPlayBtn.textContent, 'PAUSE');
  assert.equal(elements._radioVolumeValue.textContent, '60%');
  control.destroy();
  control.destroy();
  const name = elements._radioStationName.textContent;
  notify({ ...state, selected: { name: 'Late' } });
  elements._radioNextBtn.click();
  assert.equal(elements._radioStationName.textContent, name);
  assert.equal(unsubscribed, 1);
  assert.deepEqual(calls, [1, 0.2]);
});
