import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStateChannel } from '../app/stateChannel.js';
import { container } from '../testSupport/componentDom.mjs';
const { SceneControls } = await import('./sceneControls.js');
const { SceneDirector } = await import('../scenes/director.js');
const { sceneElements } = await import('./scenePresentation.js');

function fixture() {
  const saved = { prompt: window.prompt, confirm: window.confirm };
  container.innerHTML =
    '<div id="scene-panel"><div id="scene-controls-body"></div></div><div id="scene-runtime"></div>';
  window.prompt = () => 'Renamed';
  window.confirm = () => true;
  const elements = sceneElements();
  const state = {
    scenes: [
      {
        id: 'scene-a',
        title: '<Scene A>',
        shots: [
          {
            id: 'shot-a',
            title: '<Shot A>',
            durationSec: 4,
            holdSec: 0.9,
            visual: { style: 'normal' },
          },
        ],
      },
    ],
    selectedSceneId: 'scene-a',
    selectedShotId: 'shot-a',
    running: false,
    hasRun: false,
    progress: 0,
    status: 'Ready',
    runtime: '',
    playbackActive: false,
    keyboardEnabled: false,
  };
  const calls = [];
  const actions = Object.fromEntries(
    [
      'selectScene',
      'selectShot',
      'renameShot',
      'create',
      'deleteScene',
      'capture',
      'update',
      'start',
      'stop',
      'next',
      'export',
      'import',
      'download',
      'load',
      'deleteShot',
    ].map((name) => [
      name,
      (...args) => {
        calls.push([name, ...args]);
      },
    ]),
  );
  const channel = createStateChannel(() => state);
  const owner = new SceneControls({
    read: () => state,
    actions,
    elements,
    subscribe: (listener) => channel.subscribe(listener),
  });
  return {
    owner,
    state,
    actions,
    elements,
    calls,
    document,
    publish(type, patch = {}) {
      Object.assign(state, patch);
      channel.publish({ type });
    },
    restore() {
      owner.destroy();
      channel.destroy();
      Object.assign(window, saved);
    },
  };
}

test('Scene controls render the supplied selection and running/download states', () => {
  const f = fixture();
  try {
    assert.equal(f.elements.select.children[0].textContent, '<Scene A>');
    assert.equal(f.elements.select.value, 'scene-a');
    assert.equal(
      f.elements.shots.children[0].children[0].children[0].textContent,
      '<Shot A>',
    );
    assert.equal(f.elements.stop.disabled, true);
    assert.equal(
      document.getElementById('scene-status').hasAttribute('role'),
      false,
    );
    assert.equal(f.elements.download.disabled, true);
    f.state.hasRun = true;
    f.owner.setButtons(true);
    assert.equal(f.elements.start.disabled, true);
    assert.equal(f.elements.capture.disabled, true);
    assert.equal(f.elements.stop.disabled, false);
    assert.equal(f.elements.download.disabled, false);
    assert.equal(f.elements.panel.classList.contains('running'), true);
    f.publish('progress-changed', { progress: 2 });
    assert.equal(f.elements.progress.style.width, '100%');
    f.publish('progress-changed', { progress: -1 });
    assert.equal(f.elements.progress.textContent, '0%');
  } finally {
    f.restore();
  }
});

test('Scene controls dispatch explicit actions and revoke replaced shot-row listeners', () => {
  const f = fixture();
  try {
    const row = f.elements.shots.children[0];
    const label = row.children[0].children[0];
    const load = row.children[0].children[1].children[0];
    f.elements.capture.click();
    f.elements.start.click();
    label.click();
    label.dispatchEvent(new Event('dblclick'));
    label.children[0].value = 'Renamed';
    label.children[0].dispatchEvent(new Event('blur'));
    load.click();
    assert.deepEqual(f.calls, [
      ['capture'],
      ['start', 'scene-a'],
      ['selectShot', 'shot-a'],
      ['renameShot', 'scene-a', 'shot-a', 'Renamed'],
      ['load', 'scene-a', 'shot-a'],
    ]);
    f.publish('shots-changed');
    label.click();
    load.click();
    assert.equal(f.calls.length, 5);
    f.elements.shots.children[0].children[0].children[1].children[0].click();
    assert.equal(f.calls.length, 6);
  } finally {
    f.restore();
  }
});

test('Scene Escape and recording presentation follow playback and release on destruction', () => {
  const f = fixture();
  const escape = () =>
    f.document.dispatchEvent(
      Object.assign(new Event('keydown'), { key: 'Escape' }),
    );
  try {
    escape();
    assert.deepEqual(f.calls, []);
    f.state.running = true;
    f.owner.setPlaybackActive(true);
    f.owner.setPlaybackKeyboardEnabled(true);
    f.publish('runtime-changed', { runtime: 'Scene A / Shot A' });
    escape();
    assert.deepEqual(f.calls, [['stop', 'Stopped (Esc)']]);
    f.owner.destroy();
    f.owner.destroy();
    f.owner.setPlaybackKeyboardEnabled(true);
    escape();
    f.elements.capture.click();
    f.owner.run('capture');
    assert.equal(f.calls.length, 1);
    assert.equal(
      f.document.body.classList.contains('scene-playback-mode'),
      false,
    );
    assert.equal(f.elements.runtime.textContent, '');
    assert.equal(f.owner.unsubscribe, null);
    assert.equal(f.owner.playbackKeyRemover, null);
    assert.equal(f.elements.new.isConnected, false);
    assert.equal(f.elements.shots.isConnected, false);
  } finally {
    f.restore();
  }
});

test('a file import finishing after disposal cannot clear the retained file control', async () => {
  const f = fixture();
  try {
    let finish;
    f.actions.import = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    Object.defineProperty(f.elements.file, 'files', {
      configurable: true,
      value: [{ name: 'project.json' }],
    });
    Object.defineProperty(f.elements.file, 'value', {
      configurable: true,
      writable: true,
      value: 'project.json',
    });
    f.elements.file.dispatchEvent(new Event('change'));
    f.owner.destroy();
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.elements.file.value, 'project.json');
    assert.equal(f.elements.status.textContent, 'Ready');
  } finally {
    f.restore();
  }
});

test('Scene action failures are visible only while that action still owns presentation', async () => {
  const f = fixture();
  try {
    let reject;
    f.actions.load = () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      });
    let pending = f.owner.run('load', 'scene-a', 'shot-a');
    reject(new Error('unavailable'));
    await pending;
    assert.equal(f.elements.status.textContent, 'Scene action failed');
    pending = f.owner.run('load', 'scene-a', 'shot-a');
    f.owner.run('selectShot', 'shot-a');
    f.owner.updateStatus('Current selection');
    reject(new Error('obsolete'));
    await pending;
    assert.equal(f.elements.status.textContent, 'Current selection');
    pending = f.owner.run('load', 'scene-a', 'shot-a');
    f.owner.destroy();
    reject(new Error('disposed'));
    await pending;
    assert.equal(f.elements.status.textContent, 'Current selection');
  } finally {
    f.restore();
  }
});

test('creation and deletion prompts precede their model actions and remain inert after disposal', () => {
  const f = fixture();
  try {
    let prompts = 0;
    window.prompt = () => {
      prompts++;
      return null;
    };
    window.confirm = () => {
      prompts++;
      return false;
    };
    f.elements.new.click();
    f.elements.delete.click();
    f.owner.deleteShot('scene-a', 'shot-a');
    assert.deepEqual(f.calls, []);
    window.prompt = () => {
      prompts++;
      return 'New title';
    };
    window.confirm = () => {
      prompts++;
      return true;
    };
    f.elements.new.click();
    f.elements.delete.click();
    f.owner.deleteShot('scene-a', 'shot-a');
    assert.deepEqual(f.calls, [
      ['create', 'New title'],
      ['deleteScene'],
      ['deleteShot', 'scene-a', 'shot-a'],
    ]);
    f.owner.destroy();
    f.owner.createScene();
    f.owner.deleteSelectedScene();
    f.owner.deleteShot('scene-a', 'shot-a');
    assert.equal(prompts, 6);
  } finally {
    f.restore();
  }
});

test('the real director preserves a selected shot label for the following double-click', async () => {
  const f = fixture();
  const previousStorage = globalThis.localStorage;
  let director;
  try {
    f.owner.destroy();
    globalThis.localStorage = {
      getItem: () => JSON.stringify({ version: 3, scenes: f.state.scenes }),
      setItem() {},
    };
    director = new SceneDirector({ camera: { cancelFlight() {} } }, {}, {});
    Object.assign(f.elements, sceneElements());
    const label = f.elements.shots.children[0].children[0].children[0];
    label.click();
    assert.equal(f.elements.shots.children[0].children[0].children[0], label);
    label.dispatchEvent(new Event('dblclick'));
    label.children[0].value = 'Renamed';
    label.children[0].dispatchEvent(new Event('blur'));
    assert.equal(director._getSelectedScene().shots[0].title, 'Renamed');
  } finally {
    await director?.destroy();
    globalThis.localStorage = previousStorage;
    f.restore();
  }
});

test('inline shot names save on Enter, cancel on Escape, and reject blank names', () => {
  const f = fixture();
  const key = (name) => Object.assign(new Event('keydown'), { key: name });
  try {
    const label = f.elements.shots.children[0].children[0].children[0];
    for (const [value, commitKey] of [
      ['Cancelled', 'Escape'],
      ['   ', 'Enter'],
      [' New name ', 'Enter'],
    ]) {
      label.dispatchEvent(new Event('dblclick'));
      const input = label.children[0];
      input.value = value;
      input.dispatchEvent(key(commitKey));
      input.dispatchEvent(new Event('blur'));
    }
    assert.deepEqual(f.calls, [
      ['renameShot', 'scene-a', 'shot-a', 'New name'],
    ]);
    assert.equal(
      label.textContent,
      '<Shot A>',
      'the model owns the next render',
    );
  } finally {
    f.restore();
  }
});

test('Scene controls consume current state, preserve rows on progress, and unsubscribe on destruction', () => {
  const f = fixture();
  try {
    f.owner.destroy();
    Object.assign(f.state, {
      status: 'Ready to resume',
      progress: 0.25,
      runtime: '',
      playbackActive: false,
      keyboardEnabled: false,
    });
    const channel = createStateChannel(() => f.state);
    const owner = new SceneControls({
      read: () => f.state,
      actions: f.actions,
      elements: f.elements,
      subscribe: (listener) => channel.subscribe(listener),
    });
    assert.equal(f.elements.status.textContent, 'Ready to resume');
    const row = f.elements.shots.children[0];
    f.state.progress = 0.5;
    channel.publish({ type: 'progress-changed' });
    assert.equal(f.elements.shots.children[0], row);
    f.state.status = 'Project exported';
    channel.publish({ type: 'project-exported' });
    assert.equal(f.elements.status.textContent, 'Project exported');
    owner.destroy();
    f.state.status = 'Late';
    channel.publish({ type: 'status-changed' });
    assert.equal(f.elements.status.textContent, 'Project exported');
    assert.equal(owner.unsubscribe, null);
    channel.destroy();
  } finally {
    f.restore();
  }
});

test('Browse selects a recipe without starting playback and New opens Create', () => {
  const f = fixture();
  try {
    assert.equal(document.getElementById('stories-browse').hidden, false);
    document.querySelector('[data-scene-recipe-id]').click();
    assert.deepEqual(f.calls, [['selectScene', 'scene-a']]);
    f.elements.new.click();
    assert.equal(document.getElementById('stories-create').hidden, false);
    assert.equal(
      f.calls.some(([name]) => name === 'start'),
      false,
    );
  } finally {
    f.restore();
  }
});

test('a detached rename input cannot finish the following draft', () => {
  const f = fixture(),
    warnings = [],
    prior = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const label = f.elements.shots.querySelector('.scene-shot-label');
    label.dispatchEvent(new Event('dblclick'));
    const stale = label.querySelector('input');
    stale.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    label.dispatchEvent(new Event('dblclick'));
    const current = label.querySelector('input');
    current.value = 'Current draft';
    current.dispatchEvent(new Event('input'));
    stale.value = 'Obsolete';
    stale.dispatchEvent(new Event('blur'));
    assert.equal(label.querySelector('input'), current);
    assert.equal(f.owner.renameDraft.value, 'Current draft');
    current.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    assert.deepEqual(f.calls, [
      ['renameShot', 'scene-a', 'shot-a', 'Current draft'],
    ]);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = prior;
    f.restore();
  }
});

test('the existing runtime overlay exposes Stop independently of the panel and tears it down', () => {
  const f = fixture();
  try {
    f.state.running = true;
    f.owner.setButtons(true);
    f.publish('runtime-changed', { runtime: 'Example / Overview' });
    f.elements.panel.hidden = true;
    document.getElementById('scene-runtime-stop').click();
    assert.deepEqual(f.calls, [['stop', 'Stopped']]);
    assert.equal(f.elements.runtime.classList.contains('active'), true);
    f.owner.destroy();
    assert.equal(document.getElementById('scene-runtime-stop'), null);
    assert.equal(f.elements.runtime.classList.contains('active'), false);
  } finally {
    f.restore();
  }
});

test('recording hides runtime Stop but preserves captions and restores Stop outside recording', () => {
  const f = fixture();
  const style = document.createElement('style');
  style.textContent = ['action-button', 'scenes', 'recording', 'stories']
    .map((sheet) =>
      readFileSync(new URL(`./styles/${sheet}.css`, import.meta.url), 'utf8'),
    )
    .join('\n');
  document.head.append(style);
  try {
    f.state.running = true;
    f.owner.setButtons(true);
    f.publish('runtime-changed', { runtime: 'Example / Overview' });
    f.elements.panel.hidden = true;
    const stop = document.getElementById('scene-runtime-stop');
    assert.notEqual(getComputedStyle(stop).display, 'none');
    assert.equal(getComputedStyle(stop).pointerEvents, 'auto');
    document.body.classList.add('recording-mode');
    assert.equal(getComputedStyle(stop).display, 'none');
    assert.equal(getComputedStyle(f.elements.runtime).visibility, 'visible');
    assert.equal(
      f.elements.runtime.querySelector('span').textContent,
      'Example / Overview',
    );
    f.publish('runtime-changed', { runtime: '' });
    assert.equal(getComputedStyle(f.elements.runtime).display, 'none');
    f.publish('runtime-changed', { runtime: 'Example / Overview' });
    assert.notEqual(getComputedStyle(f.elements.runtime).display, 'none');
    document.body.classList.remove('recording-mode');
    assert.notEqual(getComputedStyle(stop).display, 'none');
    stop.click();
    assert.deepEqual(f.calls, [['stop', 'Stopped']]);
  } finally {
    document.body.classList.remove('recording-mode');
    style.remove();
    f.restore();
  }
});

test('collapsed Scenes shows only its header and keeps the independent playback Stop reachable', () => {
  const f = fixture();
  const style = document.createElement('style');
  style.textContent = readFileSync(
    new URL('./styles/scenes.css', import.meta.url),
    'utf8',
  );
  document.head.append(style);
  const header = document.createElement('button');
  header.className = 'panel-header';
  header.textContent = 'Scenes';
  f.elements.panel.prepend(header);
  try {
    const body = document.getElementById('scene-controls-body');
    assert.ok(body.querySelector('#stories-browse-tab'));
    assert.ok(body.querySelector('#stories-browse button'));
    assert.notEqual(getComputedStyle(body).display, 'none');
    f.state.running = true;
    f.owner.setButtons(true);
    f.publish('runtime-changed', { runtime: 'Example / Overview' });
    f.elements.panel.classList.add('collapsed');
    assert.equal(getComputedStyle(body).display, 'none');
    assert.notEqual(getComputedStyle(header).display, 'none');
    const stop = document.getElementById('scene-runtime-stop');
    assert.equal(f.elements.panel.contains(stop), false);
    assert.notEqual(getComputedStyle(stop).display, 'none');
    stop.click();
    assert.deepEqual(f.calls, [['stop', 'Stopped']]);
    f.elements.panel.classList.remove('collapsed');
    assert.notEqual(getComputedStyle(body).display, 'none');
  } finally {
    style.remove();
    f.restore();
  }
});

test('Play summary counts the playlist while starting from the selected scene', () => {
  const f = fixture();
  try {
    f.state.scenes.push({
      id: 'scene-b',
      title: 'B',
      shots: [
        { id: 'b-1', title: 'B1', durationSec: 1, holdSec: 1, visual: {} },
        { id: 'b-2', title: 'B2', durationSec: 1, holdSec: 1, visual: {} },
      ],
    });
    f.state.selectedSceneId = 'scene-b';
    f.state.selectedShotId = 'b-1';
    f.owner.read = () => ({ ...f.state, scenes: [...f.state.scenes] });
    f.publish('shots-changed');
    assert.equal(
      document.querySelector('.stories-selected strong').textContent,
      'Playlist',
    );
    assert.equal(
      document.querySelector('.stories-selected small').textContent.trim(),
      '3 shots',
    );
    f.elements.start.click();
    assert.deepEqual(f.calls, [['start', 'scene-b']]);
  } finally {
    f.restore();
  }
});
