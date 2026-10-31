/** Own scene-panel intent and presentation; Director remains the project owner. */
import { t, msg } from '../i18n/index.js';
import { mountView } from './mountView.js';
import StoriesPanelView from './StoriesPanelView.vue';
import ScenePlaybackView from './ScenePlaybackView.vue';
import {
  sceneElements,
  renderSceneOptions,
  renderSceneShots,
  presentSceneSelection,
  presentSceneButtons,
  presentSceneProgress,
  presentSceneRuntime,
} from './scenePresentation.js';

const LIBRARY_CHANGES = new Set([
  'scene-options-changed',
  'scene-created',
  'scene-deleted',
  'project-imported',
  'shots-changed',
  'shot-captured',
  'shot-updated',
  'shot-renamed',
  'shot-deleted',
  'selection-changed',
]);
const SHOT_CHANGES = new Set([
  'scene-created',
  'scene-deleted',
  'project-imported',
  'shots-changed',
  'shot-captured',
  'shot-updated',
  'shot-renamed',
  'shot-deleted',
]);

/**
 * Which authoring actions would do something: DELETE and CAPTURE SHOT need a
 * scene, UPDATE SHOT a selected shot, and PLAY and NEXT a shot anywhere in
 * the project, since both run on into the following scenes.
 */
export function sceneActionAvailability(library) {
  const scenes = library?.scenes ?? [];
  const scene = scenes.find((item) => item.id === library?.selectedSceneId);
  return {
    hasScene: !!scene,
    playableShots: scenes.reduce(
      (total, item) => total + (item.shots?.length ?? 0),
      0,
    ),
    hasSelectedShot: (scene?.shots ?? []).some(
      (shot) => shot.id === library?.selectedShotId,
    ),
  };
}

export class SceneControls {
  constructor({ read, actions, subscribe, elements = sceneElements() }) {
    this.read = read;
    this.actions = actions;
    this.elements = elements;
    this.destroyed = false;
    this.actionGeneration = 0;
    this.playbackKeyRemover = null;
    this.nativeRemovers = [];
    this.nativeRows = [];
    this.renameDraft = null;
    this.tab = 'browse';
    this.listRevision = 0;
    this.library = read();
    this.presentation = {
      running: this.library.running,
      hasRun: this.library.hasRun,
      progress: 0,
      status: t('Ready'),
      runtime: '',
    };
    this.viewActions = {
      setTab: (tab) => this.setTab(tab),
      selectScene: (id) => this.run('selectScene', id),
      selectShot: (id) => this.run('selectShot', id),
      beginRename: (...args) => this.beginRename(...args),
      createScene: () => {
        this.setTab('create');
        this.createScene();
      },
      deleteScene: () => this.deleteSelectedScene(),
      capture: () => this.run('capture'),
      update: () => this.run('update'),
      edit: () => this.run('edit'),
      share: () => this.run('share'),
      load: (...args) => this.run('load', ...args),
      deleteShot: (...args) => this.deleteShot(...args),
      start: () => this.run('start', this.read().selectedSceneId),
      stop: () => this.run('stop', msg('Stopped')),
      next: () => this.run('next'),
      export: () => this.run('export'),
      download: () => this.run('download'),
      import: () => this.elements.file?.click(),
      importFile: async (node) => {
        const file = node.files?.[0];
        if (!file) return;
        await this.run(
          this.actions.reviewImport ? 'reviewImport' : 'import',
          file,
        );
        if (!this.destroyed) node.value = '';
      },
    };
    if (!elements.body) {
      this.native = true;
      if (!elements.select) return;
      // The radio's PLAY means "listen"; this one plays the scene.
      const playLabel = t('PLAY', { context: 'scene' });
      if (elements.start) elements.start.textContent = playLabel;
      this._bindNativeControls();
      if (subscribe)
        this.unsubscribe = subscribe((notification) =>
          this.present(notification),
        );
      else {
        this.renderSceneSelect();
        this.renderShotList();
        this._paint();
      }
      return;
    }
    this.view = mountView(StoriesPanelView, {
      parent: elements.body,
      props: this._viewProps(),
    });
    Object.assign(elements, sceneElements(elements.body.ownerDocument));
    elements.runtime?.classList.add('stories-playback');
    if (elements.runtime)
      this.runtimeView = mountView(ScenePlaybackView, {
        parent: elements.runtime,
        props: {
          runtime: this.presentation.runtime,
          running: this.presentation.running,
          stop: this.viewActions.stop,
        },
      });
    if (subscribe)
      this.unsubscribe = subscribe((notification) =>
        this.present(notification),
      );
    else this.setButtons(this.presentation.running);
  }
  _viewProps() {
    return {
      library: this.library,
      presentation: { ...this.presentation },
      available: sceneActionAvailability(this.library),
      tab: this.tab,
      draft: this._shownDraft(),
      actions: this.viewActions,
      listRevision: this.listRevision,
    };
  }
  /**
   * The rename draft as the view sees it: a new copy only when the draft or
   * its value changes, so progress and status repaints leave the row, and
   * whatever its field natively holds, alone.
   */
  _shownDraft() {
    const draft = this.renameDraft;
    const shown = this._renameShown;
    if (!draft) this._renameShown = null;
    else if (shown?.draft !== draft || shown.view.value !== draft.value)
      this._renameShown = { draft, view: { ...draft } };
    return this._renameShown?.view ?? null;
  }
  _paint() {
    if (this.destroyed) return;
    if (this.native) {
      presentSceneSelection(this.elements.shots, this.library.selectedShotId);
      presentSceneButtons(
        this.elements,
        this.presentation.running,
        this.presentation.hasRun,
        sceneActionAvailability(this.library),
      );
      presentSceneProgress(this.elements.progress, this.presentation.progress);
      if (this.elements.status)
        this.elements.status.textContent = this.presentation.status;
      presentSceneRuntime(this.elements.runtime, this.presentation.runtime);
    }
    this.view?.update(this._viewProps());
    this.runtimeView?.update({
      runtime: this.presentation.runtime,
      running: this.presentation.running,
    });
    this.elements.panel?.classList.toggle('running', this.presentation.running);
    this.elements.panel?.classList.toggle(
      'has-shots',
      !!this.library.scenes?.find(
        (scene) => scene.id === this.library.selectedSceneId,
      )?.shots?.length,
    );
    if (!this.native)
      this.elements.runtime?.classList.toggle(
        'active',
        !!this.presentation.runtime || this.presentation.running,
      );
  }
  present({ state, change, initial }) {
    if (this.destroyed) return;
    const type = change?.type;
    if (initial || LIBRARY_CHANGES.has(type)) this.library = this.read();
    if (initial || SHOT_CHANGES.has(type)) {
      this.renameDraft = null;
      this.listRevision++;
    }
    if (
      initial ||
      type === 'buttons-changed' ||
      (type === 'run-event' && change.event === 'shot_start')
    ) {
      this.presentation.running = state.running;
      this.presentation.hasRun = state.hasRun;
    }
    for (const [typeName, key] of [
      ['progress-changed', 'progress'],
      ['status-changed', 'status'],
      ['runtime-changed', 'runtime'],
    ])
      if (initial || type === typeName) this.presentation[key] = state[key];
    if (type === 'project-exported' || type === 'shot-loaded')
      this.presentation.status = state.status;
    if (initial || type === 'playback-presentation')
      this.setPlaybackActive(state.playbackActive);
    if (initial || type === 'playback-keyboard')
      this.setPlaybackKeyboardEnabled(state.keyboardEnabled);
    if (this.native) {
      if (
        initial ||
        [
          'scene-options-changed',
          'scene-created',
          'scene-deleted',
          'project-imported',
        ].includes(type)
      )
        this.renderSceneSelect();
      if (initial || SHOT_CHANGES.has(type)) this.renderShotList();
    }
    this._paint();
  }
  run(action, ...args) {
    if (this.destroyed) return;
    const generation = ++this.actionGeneration;
    const failed = () => {
      if (!this.destroyed && generation === this.actionGeneration)
        this.updateStatus(t('Scene action failed'));
    };
    try {
      const result = this.actions[action](...args);
      return result?.then ? Promise.resolve(result).catch(failed) : result;
    } catch {
      failed();
    }
  }
  listen(target, type, callback, removers = this.nativeRemovers) {
    if (!target) return;
    const listener = (event) => {
      if (!this.destroyed) callback(event);
    };
    target.addEventListener(type, listener);
    removers.push(() => target.removeEventListener(type, listener));
  }
  _bindNativeControls() {
    const elements = this.elements;
    this.listen(elements.select, 'change', () =>
      this.run('selectScene', elements.select.value),
    );
    for (const name of ['capture', 'update', 'next', 'export', 'download'])
      this.listen(elements[name], 'click', () => this.run(name));
    this.listen(elements.new, 'click', () => this.createScene());
    this.listen(elements.delete, 'click', () => this.deleteSelectedScene());
    this.listen(elements.start, 'click', () =>
      this.run('start', this.read().selectedSceneId),
    );
    this.listen(elements.stop, 'click', () => this.run('stop', msg('Stopped')));
    this.listen(elements.import, 'click', () => elements.file?.click());
    this.listen(elements.file, 'change', () =>
      this.viewActions.importFile(elements.file),
    );
  }
  renderSceneSelect() {
    if (this.destroyed) return;
    this.library = this.read();
    if (this.native) renderSceneOptions(this.elements.select, this.library);
    else this._paint();
  }
  renderShotList() {
    if (this.destroyed) return;
    this.library = this.read();
    if (!this.native) {
      this.listRevision++;
      this._paint();
      return;
    }
    for (const remove of this.nativeRows.splice(0)) remove();
    renderSceneShots(this.elements.shots, this.library, {
      listen: (node, type, fn) => this.listen(node, type, fn, this.nativeRows),
      select: (id) => {
        this.run('selectShot', id);
        if (this.destroyed) return;
        presentSceneSelection(this.elements.shots, this.read().selectedShotId);
        this.setButtons(this.read().running);
      },
      rename: (...args) => this.run('renameShot', ...args),
      load: (...args) => this.run('load', ...args),
      remove: (...args) => this.deleteShot(...args),
    });
  }
  setProgress(progress) {
    if (!this.destroyed) {
      this.presentation.progress = progress;
      this._paint();
    }
  }
  updateRuntime(runtime) {
    if (!this.destroyed) {
      this.presentation.runtime = runtime;
      this._paint();
    }
  }
  setTab(tab) {
    if (this.destroyed || !['browse', 'create'].includes(tab)) return;
    this.tab = tab;
    this._paint();
  }
  beginRename(sceneId, shotId, title, label) {
    if (this.destroyed || this.renameDraft) return;
    const draft = { sceneId, shotId, title, value: title };
    draft.input = (value) => {
      if (this.renameDraft === draft) {
        draft.value = value;
        this._paint();
      }
    };
    draft.finish = (save, value) => {
      if (this.destroyed || this.renameDraft !== draft) return;
      draft.value = value;
      this.renameDraft = null;
      const next = draft.value.trim();
      if (save && next && next !== title)
        this.run('renameShot', sceneId, shotId, next);
      this._paint();
    };
    draft.inputEvent = (event) => draft.input(event.target.value);
    draft.blur = (event) => draft.finish(true, event.target.value);
    draft.key = (event) => {
      event.stopPropagation();
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        draft.finish(event.key === 'Enter', event.target.value);
      }
    };
    this.renameDraft = draft;
    this._paint();
    // The synchronous paint creates the editor before focus/select.
    const input = label.querySelector('input');
    input?.focus();
    input?.select();
  }
  createScene() {
    if (this.destroyed) return;
    const name = window.prompt(
      t('New scene name'),
      t('Scene {n}', { n: this.read().scenes.length + 1 }),
    );
    if (name) this.run('create', name);
  }
  deleteSelectedScene() {
    if (this.destroyed) return;
    const state = this.read(),
      scene = state.scenes.find((item) => item.id === state.selectedSceneId);
    if (
      scene &&
      window.confirm(
        t('Delete scene "{scene}" and all shots?', { scene: scene.title }),
      )
    )
      this.run('deleteScene');
  }
  deleteShot(sceneId, shotId) {
    if (this.destroyed) return;
    const scene = this.read().scenes.find((item) => item.id === sceneId),
      shot = scene?.shots.find((item) => item.id === shotId);
    if (
      shot &&
      window.confirm(
        t('Delete shot "{shot}"?', { shot: shot.displayTitle || shot.title }),
      )
    )
      this.run('deleteShot', sceneId, shotId);
  }
  setButtons(running) {
    if (this.destroyed) return;
    // Idle availability depends on the scenes and selection, read afresh.
    this.library = this.read();
    this.presentation.running = running;
    this.presentation.hasRun = this.library.hasRun;
    this._paint();
  }
  updateStatus(status) {
    if (!this.destroyed) {
      this.presentation.status = status;
      this._paint();
    }
  }
  setPlaybackActive(active) {
    if (this.destroyed && active) return;
    document.body.classList.toggle('scene-playback-mode', active);
  }
  setPlaybackKeyboardEnabled(enabled) {
    if (!enabled) {
      this.playbackKeyRemover?.();
      this.playbackKeyRemover = null;
    } else if (!this.destroyed && !this.playbackKeyRemover) {
      const onKeyDown = (event) => {
        if (!this.destroyed && event.key === 'Escape' && this.read().running)
          this.run('stop', msg('Stopped (Esc)'));
      };
      document.addEventListener('keydown', onKeyDown);
      this.playbackKeyRemover = () =>
        document.removeEventListener('keydown', onKeyDown);
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.renameDraft = null;
    this.actionGeneration++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.setPlaybackKeyboardEnabled(false);
    for (const remove of [
      ...this.nativeRemovers.splice(0),
      ...this.nativeRows.splice(0),
    ])
      remove();
    if (this.native) {
      this.elements.shots?.replaceChildren();
      presentSceneRuntime(this.elements.runtime, '');
    }
    this.view?.dispose();
    this.runtimeView?.dispose();
    this.elements.runtime?.classList.remove('active', 'stories-playback');
    this.elements.panel?.classList.remove('has-shots');
    this.setPlaybackActive(false);
  }
}
