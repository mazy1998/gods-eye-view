import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radioDomFixture } from '../testSupport/radioDomFixture.mjs';
const { RadioControls } = await import('./radioControls.js');
const { LocalSdrControls } = await import('./localSdrControls.js');

function internet() {
  const f = radioDomFixture();
  const stations = [
    {
      id: 'a',
      name: '<img src=x onerror=alert(1)>',
      tags: ['<script>'],
      homepage: 'https://example.com/',
    },
    { id: 'b', name: 'B' },
  ];
  let state = {
    enabled: true,
    categories: [{ id: 'all', label: 'All', count: 2, color: '#123456' }],
    filter: 'all',
    filteredCount: 2,
    stationCount: 2,
    volume: 0.8,
    audioState: 'stopped',
    selected: stations[0],
    selectedIndex: 0,
  };
  const calls = [];
  const radio = {
    getUIState: () => state,
    getTunerStations: () => stations,
    subscribe(fn) {
      fn(state);
      return () => calls.push('unsubscribe');
    },
    beginTuning: () => true,
    endTuning() {},
    cancelTuning() {
      calls.push('cancel');
    },
    previewTuningStation(id) {
      calls.push(['preview', id]);
    },
    commitTuningStation(id, options) {
      calls.push(['commit', id, options]);
      return { ok: true };
    },
    cycleStation(direction, options) {
      calls.push(['cycle', direction, options]);
      return true;
    },
    togglePlayback(options) {
      calls.push(['play', options]);
    },
    stopPlayback(options) {
      calls.push(['stop', options]);
    },
  };
  const controls = new RadioControls({
    elements: f.elements,
    view: f.view,
    radio,
    actions: {
      getLifecycle: () => null,
      preservePanelStateDuringClear: () => true,
      scheduleLayout() {},
      setParams(params, options) {
        calls.push(['params', params, options]);
        state = { ...state, ...params };
        controls._renderRadioState(state);
        return true;
      },
    },
  });
  controls.connect();
  return {
    ...f,
    controls,
    calls,
    state,
    render(patch) {
      state = { ...state, ...patch };
      controls._renderRadioState(state);
    },
    dispose() {
      controls.destroy();
      f.dispose();
    },
  };
}

test('radio card text, volume and all playback shortcuts project one owner snapshot', () => {
  const f = internet();
  try {
    assert.equal(
      f.elements._radioStationName.textContent,
      f.state.selected.name,
    );
    assert.equal(
      f.elements._radioStationName.children.length,
      0,
      'provider text cannot become markup',
    );
    assert.equal(f.elements._radioStationHomepage.rel, 'noopener noreferrer');
    for (const button of [
      f.elements._radioPlayBtn,
      f.elements._cockpitRadioPlayBtn,
    ])
      button.click();
    assert.deepEqual(
      f.calls.filter((c) => c[0] === 'play'),
      Array.from({ length: 2 }, () => ['play', { origin: 'user' }]),
    );
    f.render({ audioState: 'playing', volume: 0.34 });
    for (const input of [
      f.elements._radioVolume,
      f.elements._cockpitRadioVolume,
    ])
      assert.equal(input.value, '34');
    for (const button of [
      f.elements._radioPlayBtn,
      f.elements._cockpitRadioPlayBtn,
    ])
      assert.equal(
        button.getAttribute('aria-label'),
        'Pause selected radio station',
      );
    const input = f.elements._radioVolume;
    input.focus();
    input.value = '51';
    input.dispatchEvent(new Event('input'));
    f.render({ volume: 0.2 });
    assert.equal(input.value, '51', 'a focused edit stays owned by its draft');
    assert.equal(f.controls._radioVolumeDraft, '51');
    input.blur();
    f.render({ volume: 0.2 });
    assert.equal(input.value, '20');
    const retained = f.elements._radioPlayBtn;
    f.controls.destroy();
    const count = f.calls.length;
    retained.click();
    assert.equal(f.calls.length, count);
  } finally {
    f.dispose();
  }
});

test('the Vue tuner keeps native focus and paints owner keyboard preview, cancel and commit', () => {
  const f = internet();
  const input = f.elements._radioTunerSlider;
  const key = (type, key) =>
    input.dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true, cancelable: true }),
    );
  try {
    input.focus();
    assert.equal(input.disabled, false);
    assert.equal(input.max, '1');
    key('keydown', 'ArrowRight');
    assert.equal(input.value, '1');
    assert.match(input.getAttribute('aria-valuetext'), /^B, station 2 of 2$/);
    assert.equal(document.activeElement, input);
    assert.equal(
      f.elements._radioTuner.classList.contains('is-dragging'),
      true,
    );
    key('keydown', 'Escape');
    assert.equal(input.value, '0');
    assert.ok(f.calls.includes('cancel'));
    key('keydown', 'ArrowRight');
    key('keyup', 'ArrowRight');
    assert.deepEqual(
      f.calls.find((c) => c[0] === 'commit'),
      ['commit', 'b', { origin: 'user' }],
    );
    assert.equal(
      f.elements._radioTuner.classList.contains('is-dragging'),
      false,
    );
    assert.equal(document.activeElement, input);
  } finally {
    f.dispose();
  }
});

test('local receiver permissions remain explicit and detached controls cannot request them', async () => {
  const f = radioDomFixture();
  const calls = [];
  const state = {
    webUsbSupported: true,
    connected: false,
    status: 'idle',
    mode: 'fm',
    gain: 'auto',
    frequencyHz: 98_500_000,
    volume: 0.8,
    locationStatus: 'unknown',
  };
  const receiver = {
    getState: () => state,
    subscribe(fn) {
      fn(state);
      return () => calls.push('unsubscribe');
    },
    async connect(mode) {
      calls.push(['connect', mode]);
      return false;
    },
    requestReceiverLocation() {
      calls.push('location');
    },
    async changeDevice() {
      calls.push('device');
      return false;
    },
  };
  const controls = new LocalSdrControls({ document, receiver });
  try {
    assert.deepEqual(
      calls,
      [],
      'mount and subscription do not request permissions',
    );
    const connect = document.getElementById('sdr-connect-btn');
    connect.click();
    document.getElementById('sdr-locate-btn').click();
    document.getElementById('sdr-change-device-btn').click();
    assert.deepEqual(calls, [['connect', 'fm'], 'location', 'device']);
    controls.destroy();
    const count = calls.length;
    connect.click();
    assert.equal(calls.length, count);
    assert.equal(
      document.getElementById('sdr-connect-btn'),
      null,
      'dispose removes the owned content',
    );
  } finally {
    controls.destroy();
    f.dispose();
  }
});

test('a refused native filter edit restores the view without clearing the pinned tuner band', () => {
  const f = internet();
  try {
    f.render({
      presentationActive: false,
      lifecycleUncertain: true,
      categories: [
        { id: 'all', label: 'All', count: 2, color: '' },
        { id: 'talk', label: 'Talk', count: 1, color: '' },
      ],
    });
    const pool = [{ id: 'retained-preview' }];
    f.controls._radioTunerPool = pool;
    f.controls._radioTunerBandPinnedForNavigation = true;
    f.elements._radioFilter.value = 'talk';
    f.elements._radioFilter.dispatchEvent(
      new Event('change', { bubbles: true }),
    );
    assert.equal(f.elements._radioFilter.value, 'all');
    assert.equal(f.controls._radioTunerPool, pool);
    assert.equal(f.controls._radioTunerBandPinnedForNavigation, true);
    assert.equal(
      f.calls.some((call) => call[0] === 'params'),
      false,
    );
  } finally {
    f.dispose();
  }
});

test('the expanded Radio reads in the drawer language outside Cyber, and Cyber keeps its own', async () => {
  const { readFileSync } = await import('node:fs');
  const style = document.createElement('style');
  style.textContent = ['radio.css', 'radio-views.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  const f = radioDomFixture({ sdr: true });
  try {
    const computed = (id) => getComputedStyle(document.getElementById(id));
    // Static labels: sentence case from their upper-case strings.
    for (const id of ['radio-prev-btn', 'radio-play-btn', 'sdr-tune-btn'])
      assert.equal(computed(id).textTransform, 'lowercase', id);
    assert.equal(computed('radio-prev-btn').minHeight, '36px');
    // Station text and the receiver's acronym label keep their own case.
    assert.equal(computed('radio-station-name').textTransform, 'none');
    assert.equal(
      getComputedStyle(document.querySelector('label[for="sdr-volume"] > span'))
        .textTransform,
      'none',
    );
    assert.equal(
      getComputedStyle(
        document.querySelector('label[for="radio-volume"] > span'),
      ).textTransform,
      'lowercase',
    );
    // One mode at a time, as a segmented track.
    const mode = getComputedStyle(document.querySelector('.sdr-mode-row'));
    assert.equal(mode.paddingTop, '2px');
    // Acronyms stay as written.
    assert.equal(
      document.querySelector('.sdr-radio-heading strong').textContent.trim(),
      'Local RTL-SDR',
    );
    // The volume tracks fill to their value.
    assert.equal(
      document
        .getElementById('sdr-volume')
        .style.getPropertyValue('--gev-slider-fill'),
      '80cqw',
    );

    document.documentElement.dataset.uiTheme = 'cyber';
    assert.notEqual(computed('radio-prev-btn').textTransform, 'lowercase');
    assert.notEqual(computed('radio-prev-btn').minHeight, '36px');
    // Cyber reads the mixed-case acronym labels in their original capitals.
    const heading = document.querySelector('.sdr-radio-heading strong');
    const frequency = document.querySelector(
      'label[for="sdr-frequency-input"]',
    );
    assert.equal(getComputedStyle(heading).textTransform, 'uppercase');
    assert.equal(computed('sdr-seek-back-btn').textTransform, 'uppercase');
    assert.equal(getComputedStyle(frequency).textTransform, 'uppercase');
    document.documentElement.lang = 'zh-CN';
    assert.notEqual(getComputedStyle(frequency).textTransform, 'uppercase');
  } finally {
    document.documentElement.removeAttribute('lang');
    delete document.documentElement.dataset.uiTheme;
    style.remove();
    f.dispose();
  }
});

test('the Cockpit Radio card reads like the drawer Radio row outside Cyber, and Cyber keeps its own', async () => {
  const { readFileSync } = await import('node:fs');
  const style = document.createElement('style');
  style.textContent = ['cockpit.css', 'cockpit-views.css']
    .map((name) =>
      readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  const f = radioDomFixture();
  try {
    const css = (selector) =>
      getComputedStyle(document.querySelector(selector));
    assert.ok(document.querySelector('#cockpit-hud #cockpit-radio-panel'));
    // Static labels: sentence case from their upper-case strings.
    for (const selector of [
      '#cockpit-radio-enable-btn',
      '.cockpit-radio-volume > span',
    ])
      assert.equal(css(selector).textTransform, 'lowercase', selector);
    // The station keeps its own case, in the sans face.
    assert.equal(css('#cockpit-radio-station').textTransform, 'none');
    assert.match(css('#cockpit-radio-station').font, /--gev-font-sans/);
    assert.match(css('#cockpit-radio-play-btn').font, /--gev-font-sans/);

    document.documentElement.dataset.uiTheme = 'cyber';
    assert.notEqual(
      css('#cockpit-radio-enable-btn').textTransform,
      'lowercase',
    );
    assert.doesNotMatch(css('#cockpit-radio-station').font, /--gev-font-sans/);
  } finally {
    delete document.documentElement.dataset.uiTheme;
    style.remove();
    f.dispose();
  }
});
