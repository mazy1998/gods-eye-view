import '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { createSceneSharing } = await import('./sharing.js');

function fixture(t) {
  const dialog = window.HTMLDialogElement.prototype;
  const previous = { showModal: dialog.showModal, close: dialog.close };
  dialog.showModal = function () {
    this.open = true;
  };
  dialog.close = function () {
    this.open = false;
  };
  const project = {
    version: 6,
    scenes: [
      {
        id: 'scene',
        title: 'Example',
        shots: [
          {
            id: 'shot',
            title: 'Overview',
            durationSec: 3,
            holdSec: 1,
            camera: { lat: 1, lon: 2, alt: 300, pitch: -45 },
            visual: { style: 'normal' },
            layers: {},
          },
        ],
      },
    ],
  };
  const applied = [];
  const director = {
    _project: project,
    _selectedSceneId: 'scene',
    _selectedShotId: 'shot',
    _getSelectedScene: () => project.scenes[0],
    styleManager: {
      getCameraState: () => ({
        lat: 3,
        lon: 4,
        alt: 500,
        heading: 0,
        pitch: -40,
        roll: 0,
      }),
    },
    _bundleAssets: { snapshot: () => new Map() },
    importProjectFile: async (_file, options) => {
      applied.push(options.prepared.project);
      return true;
    },
    _updateStatus() {},
  };
  const owner = createSceneSharing(director);
  t.after(() => {
    owner.destroy();
    Object.assign(dialog, previous);
  });
  const click = (text) =>
    [...document.querySelectorAll('[data-director-dialog] button')]
      .find((b) => b.textContent === text)
      .click();
  return { owner, director, applied, click };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test('Apply adopts programmatic scene and shot textarea values without input events', async (t) => {
  const f = fixture(t);
  f.owner.edit();
  const [scene, shot] = document.querySelectorAll(
    '[data-director-dialog] textarea',
  );
  const changed = JSON.parse(shot.value);
  changed.durationSec = 7.25;
  scene.value = JSON.stringify({
    anchors: [
      {
        id: 'custom',
        lat: 10,
        lon: 20,
        alt: 600,
        altitudeReference: 'ellipsoid',
      },
    ],
  });
  shot.value = JSON.stringify(changed);
  document.querySelector('[data-director-apply-details]').click();
  await settled();
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].scenes[0].shots[0].durationSec, 7.25);
  assert.equal(f.applied[0].scenes[0].anchors[0].id, 'custom');
  assert.equal(document.querySelector('[data-director-dialog]'), null);
});

test('draft actions adopt native fields and Cancel leaves the saved project unchanged', async (t) => {
  const f = fixture(t),
    before = JSON.stringify(f.director._project);
  f.owner.edit();
  document.querySelector('[aria-label="New anchor ID"]').value =
    'typed-without-event';
  f.click('Capture camera as anchor');
  await settled();
  const scene = document.querySelector('[aria-label="Anchors and data packs"]');
  assert.equal(JSON.parse(scene.value).anchors[0].id, 'typed-without-event');
  f.click('Cancel');
  assert.equal(JSON.stringify(f.director._project), before);
  assert.equal(f.applied.length, 0);
});

test('a discarded details editor cannot apply over its replacement', async (t) => {
  const f = fixture(t);
  f.owner.edit();
  const stale = document.querySelector('[data-director-apply-details]');
  f.owner.close();
  f.owner.edit();
  stale.click();
  await settled();
  assert.equal(f.applied.length, 0);
  assert.ok(document.querySelector('[data-director-dialog]'));
});

for (const typed of ['sceneText', 'shotText']) {
  test(`typing ${typed} preserves a native edit in the other details field through Apply`, async (t) => {
    const f = fixture(t);
    f.owner.edit();
    const scene = document.querySelector('[data-scene-detail="sceneText"]');
    const shot = document.querySelector('[data-scene-detail="shotText"]');
    scene.value = JSON.stringify({
      anchors: [
        {
          id: 'mixed-edit',
          lat: 10,
          lon: 20,
          alt: 600,
          altitudeReference: 'ellipsoid',
        },
      ],
    });
    const changed = JSON.parse(shot.value);
    changed.durationSec = 8.5;
    shot.value = JSON.stringify(changed);
    const values = [scene.value, shot.value];
    (typed === 'sceneText' ? scene : shot).dispatchEvent(
      new Event('input', { bubbles: true }),
    );
    assert.deepEqual([scene.value, shot.value], values);
    document.querySelector('[data-director-apply-details]').click();
    await settled();
    assert.equal(f.applied.length, 1);
    assert.equal(f.applied[0].scenes[0].anchors[0].id, 'mixed-edit');
    assert.equal(f.applied[0].scenes[0].shots[0].durationSec, 8.5);
  });
}
