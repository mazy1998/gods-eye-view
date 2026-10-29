import { withShareSignal } from '../director/sharing/lifetime.js';
import {
  readSceneShare,
  createSceneBundle,
  BUNDLE_SOURCE,
} from '../director/sharing/bundle.js';
import { describeSceneShare } from '../director/sharing/preview.js';
import { stringifySceneDocument } from '../director/document.js';
import {
  editSceneDetails,
  selectSceneDocument,
} from '../director/authoring.js';
import { mountSceneDialog } from '../ui/sceneSharing.js';
import { PACK_LIMITS } from '../director/packs/manifest.js';
import { t, tn } from '../i18n/index.js';
import { displaySceneTitle, displayShotTitle } from './recipes.js';

function download(text, name) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
const subset = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, value[key]]),
  );
const sceneKeys = ['anchors', 'dataPacks'];
const shotKeys = [
  'camera',
  'move',
  'durationSec',
  'holdSec',
  'dataPackIds',
  'interactions',
];
const json = (value) => JSON.stringify(value, null, 2);
const mimeFor = (file) =>
  file.type ||
  {
    json: 'application/json',
    geojson: 'application/geo+json',
    png: 'image/png',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  }[file.name.split('.').at(-1)];

/** Own staged imports, author drafts and share bytes separately from playback and project state. */
export function createSceneSharing(director) {
  let dialog,
    controller,
    presentation,
    detailsDraft,
    assetDraft,
    disposed = false,
    staged = null,
    busy = false;
  const alive = (owner) =>
    !disposed && controller === owner && !owner.signal.aborted;
  const chosen = (files) =>
    files.length === 1
      ? files[0].name
      : files.length
        ? tn(files.length, '{count} file selected', '{count} files selected')
        : '';
  function paint() {
    if (!dialog || disposed) return;
    dialog.update({
      ...presentation,
      texts: [...presentation.texts],
      actions: { ...presentation.actions },
      details: detailsDraft ? { ...detailsDraft } : null,
      files: chosen(assetDraft?.files || []),
      folder: chosen(assetDraft?.folder || []),
    });
  }
  function close() {
    controller?.abort();
    controller = null;
    dialog?.dispose();
    dialog = null;
    presentation = null;
    detailsDraft = null;
    assetDraft = null;
    staged = null;
    busy = false;
  }
  function open(title, mode) {
    close();
    if (disposed) return null;
    controller = new AbortController();
    presentation = {
      title,
      mode,
      texts: [],
      status: '',
      applyDisabled: false,
      actions: {},
    };
    dialog = mountSceneDialog({ ...presentation }, close);
    return controller;
  }
  function addText(text) {
    presentation.texts.push(text);
    paint();
  }
  function setStatus(text) {
    presentation.status = text;
    paint();
  }
  async function run(owner, job) {
    if (!alive(owner) || busy) return;
    busy = true;
    try {
      await job();
    } catch (error) {
      if (alive(owner))
        setStatus(
          error?.name === 'SceneDocumentError'
            ? error.message
            : t(
                'Could not complete this action. Check the file, references and selected assets.',
              ),
        );
    } finally {
      if (alive(owner)) busy = false;
    }
  }
  const currentProject = () => json(director._project);
  function inventory(input) {
    const report = describeSceneShare(input, {
      sourceIds: director._dataPacks.sourceIds(),
      layerIds: director.dataManager.getAll().map((l) => l.id),
    });
    const texts = [
      [
        tn(report.scenes, '{count} scene', '{count} scenes'),
        tn(report.shots, '{count} shot', '{count} shots'),
        tn(report.packs.length, '{count} data pack', '{count} data packs'),
      ].join(' · '),
    ];
    for (const pack of report.packs)
      texts.push(
        t(
          '{scene} / {pack}: {status}. File: {path}. {attribution} · {license}',
          {
            scene: pack.scene,
            pack: pack.id,
            status: t(pack.status),
            path: pack.path,
            attribution: pack.attribution.text,
            license: pack.attribution.license,
          },
        ),
      );
    if (report.missingLayers.length)
      texts.push(
        t('Unavailable layers: {layers}', {
          layers: report.missingLayers.join(', '),
        }),
      );
    if (report.externalContent)
      texts.push(
        t(
          'Uses registered content or linked media. Those external files are not included in a scene bundle. Their original notices still apply.',
        ),
      );
    if (report.bundledBytes)
      texts.push(
        t(
          '{bytes} bundled bytes verified. Files stay in memory for this session. Reimport the bundle after reloading the app.',
          { bytes: report.bundledBytes },
        ),
      );
    presentation.texts.push(...texts);
    paint();
    return report;
  }

  async function preview(file) {
    const owner = open(t('Review scene import'), 'import');
    if (!owner) return;
    const expected = currentProject();
    addText(t('Nothing is loaded or changed until you apply this file.'));
    await run(owner, async () => {
      const input = await readSceneShare(file, { signal: owner.signal });
      if (!alive(owner)) return;
      staged = input;
      inventory(input);
      setStatus(t('Ready to import'));
      addText(
        t(
          'Apply replaces the current project. Export your current project first if you want to keep both.',
        ),
      );
      presentation.actions.applyImport = () =>
        run(owner, async () => {
          if (expected !== currentProject()) throw new Error('Project changed');
          presentation.applyDisabled = true;
          paint();
          const ok = await director.importProjectFile(file, {
            prepared: input,
            expectedProject: expected,
            signal: owner.signal,
          });
          if (alive(owner)) {
            if (ok) close();
            else {
              presentation.applyDisabled = false;
              setStatus(
                t(
                  'Import was not applied. The current project may have changed.',
                ),
              );
            }
          }
        });
      paint();
    });
  }
  function edit() {
    const scene = director._getSelectedScene(),
      shot = scene?.shots.find((s) => s.id === director._selectedShotId);
    if (!scene || !shot) {
      director._updateStatus(t('Select a scene and shot first'));
      return;
    }
    const owner = open(t('Edit scene details'), 'details');
    if (!owner) return;
    const original = structuredClone(director._project),
      expected = currentProject();
    presentation.context = `${displaySceneTitle(scene)} / ${displayShotTitle(shot.title, shot, scene)}`;
    addText(
      t(
        'Camera positions use degrees and meters above the ellipsoid. Drafts are validated before they replace your saved scene.',
      ),
    );
    const draft = (detailsDraft = {
      sceneText: json(subset(scene, sceneKeys)),
      shotText: json(subset(shot, shotKeys)),
      anchorName: 'anchor-1',
    });
    const adopt = () => {
      if (alive(owner) && detailsDraft === draft)
        Object.assign(draft, dialog.readDetails());
    };
    presentation.actions.inputDetail = (key, value) => {
      if (!alive(owner) || detailsDraft !== draft || !Object.hasOwn(draft, key))
        return;
      adopt();
      draft[key] = value;
      paint();
    };
    presentation.actions.captureAnchor = () =>
      run(owner, async () => {
        adopt();
        const details = JSON.parse(draft.sceneText),
          camera = director.styleManager.getCameraState();
        if (!camera) throw new Error('Camera unavailable');
        const anchors = details.anchors || [];
        if (anchors.some((a) => a.id === draft.anchorName))
          throw new Error('Duplicate anchor');
        details.anchors = [
          ...anchors,
          {
            id: draft.anchorName,
            lat: camera.lat,
            lon: camera.lon,
            alt: camera.alt,
            altitudeReference: 'ellipsoid',
          },
        ];
        editSceneDetails(
          original,
          scene.id,
          shot.id,
          details,
          JSON.parse(draft.shotText),
        );
        draft.sceneText = json(details);
        setStatus(t('Anchor added to draft'));
      });
    presentation.actions.moveStart = () =>
      run(owner, async () => {
        adopt();
        const details = JSON.parse(draft.shotText),
          camera = director.styleManager.getCameraState();
        if (!camera) throw new Error('Camera unavailable');
        details.move = {
          from: {
            ...subset(camera, [
              'lat',
              'lon',
              'alt',
              'heading',
              'pitch',
              'roll',
            ]),
            altitudeReference: 'ellipsoid',
          },
          easing: 'cubic-in-out',
        };
        if (!details.camera.anchorId)
          details.camera.altitudeReference = 'ellipsoid';
        details.durationSec = Math.max(0.2, details.durationSec || 3);
        editSceneDetails(
          original,
          scene.id,
          shot.id,
          JSON.parse(draft.sceneText),
          details,
        );
        draft.shotText = json(details);
        setStatus(
          t('Move added to draft; destination remains the shot camera'),
        );
      });
    presentation.actions.ordinaryFlight = () => {
      if (!alive(owner)) return;
      try {
        adopt();
        const details = JSON.parse(draft.shotText);
        delete details.move;
        draft.shotText = json(details);
        paint();
      } catch {
        setStatus(t('Invalid shot JSON'));
      }
    };
    presentation.actions.applyDetails = () =>
      run(owner, async () => {
        adopt();
        if (expected !== currentProject()) throw new Error('Project changed');
        const project = editSceneDetails(
          original,
          scene.id,
          shot.id,
          JSON.parse(draft.sceneText),
          JSON.parse(draft.shotText),
        );
        const ok = await director.importProjectFile(
          {
            name: 'scene details',
            text: async () => stringifySceneDocument(project),
          },
          {
            prepared: { project, assets: director._bundleAssets.snapshot() },
            expectedProject: expected,
            signal: owner.signal,
            selection: { sceneId: scene.id, shotId: shot.id },
          },
        );
        if (alive(owner) && ok) close();
      });
    paint();
  }
  function share() {
    let project;
    try {
      project = selectSceneDocument(
        director._project,
        director._selectedSceneId,
      );
    } catch {
      director._updateStatus(t('Select a scene first'));
      return;
    }
    const owner = open(t('Share selected scene'), 'share');
    if (!owner) return;
    const paths = new Set(
      project.scenes.flatMap((s) =>
        (s.dataPacks || [])
          .filter((p) => p.source.adapter === BUNDLE_SOURCE)
          .map((p) => p.source.path),
      ),
    );
    const existing = new Map(
      [...director._bundleAssets.snapshot()].filter(([path]) =>
        paths.has(path),
      ),
    );
    staged = { project, assets: existing };
    inventory(staged);
    addText(
      t(
        'Scene JSON preserves authored settings and attribution. It does not include asset files. Bundles include only pack files you choose here or previously imported bundle files.',
      ),
    );
    presentation.actions.shareJson = () => {
      if (alive(owner)) download(stringifySceneDocument(project), 'scene.json');
    };
    const assets = (assetDraft = { files: [], folder: [] });
    const adoptAssets = () => {
      if (alive(owner) && assetDraft === assets)
        Object.assign(assets, dialog.readAssets());
    };
    presentation.actions.chooseAssets = () => {
      adoptAssets();
      paint();
    };
    presentation.actions.shareBundle = () =>
      run(owner, async () => {
        adoptAssets();
        const selected = [...assets.files, ...assets.folder];
        const packs = project.scenes.flatMap((s) => s.dataPacks || []);
        const text = await createSceneBundle(
          project,
          async (pack, { signal }) => {
            if (
              pack.source.adapter === BUNDLE_SOURCE &&
              existing.has(pack.source.path)
            )
              return existing.get(pack.source.path);
            const exact = selected.filter(
              (f) =>
                f.webkitRelativePath === pack.source.path ||
                f.webkitRelativePath?.split('/').slice(1).join('/') ===
                  pack.source.path,
            );
            const name = pack.source.path.split('/').at(-1),
              matches = exact.length
                ? exact
                : selected.filter((f) => f.name === name);
            const keys = new Set(
              packs
                .filter((p) => p.source.path.split('/').at(-1) === name)
                .map((p) => JSON.stringify(p.source)),
            );
            if (matches.length !== 1 || (!exact.length && keys.size > 1))
              throw new Error('Missing or ambiguous file');
            const file = matches[0];
            if (!file.size || file.size > PACK_LIMITS.bytes)
              throw new Error('Asset size limit');
            const bytes = new Uint8Array(
              await withShareSignal(file.arrayBuffer(), signal),
            );
            signal.throwIfAborted();
            return { bytes, mimeType: mimeFor(file) };
          },
          { signal: owner.signal },
        );
        if (alive(owner)) {
          download(text, 'scene.gevbundle.json');
          setStatus(t('Asset bundle downloaded'));
        }
      });
    paint();
  }

  return {
    preview,
    edit,
    share,
    close,
    getState: () => ({
      open: !!dialog,
      busy,
      stagedAssets: staged?.assets.size || 0,
    }),
    destroy() {
      disposed = true;
      close();
    },
  };
}
