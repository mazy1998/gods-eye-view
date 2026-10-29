import { createStateChannel } from '../app/stateChannel.js';
import {
  initialVoiceCardState,
  reduceVoiceCard,
  voiceCardView,
} from './voiceCardPresentation.js';

/** Hide an idle card this long after its last update. */
const VOICE_CARD_IDLE_MS = 14000;

const ELEMENT_IDS = Object.freeze({
  card: 'gev-voice-card',
  dismiss: 'gev-voice-card-dismiss',
  notes: 'gev-voice-card-notes',
});

/**
 * Voice card controls, nested in the voice control's markup (`control.js`)
 * beside its help and error trays, so Clean-UI and recording mode hide it with
 * the control. Receives provider-neutral session events through `handle` and
 * annotation outline outcomes through `outline`; owns its folded state,
 * disclosure, listeners and idle timer. The Vue view renders literal text. Captions update silently;
 * the polite live region carries final replies and result titles only.
 */
export class VoiceCardControls {
  /**
   * @param {object} options
   * @param {HTMLElement} options.root Voice control root containing the card.
   * @param {(channel: object) => Function} [options.connectView] Synchronous view connection supplied by createVoiceControl.
   * @param {number} [options.idleMs]
   * @param {Function} [options.setTimer]
   * @param {Function} [options.clearTimer]
   */
  constructor({
    root,
    idleMs = VOICE_CARD_IDLE_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
    onRender,
    connectView,
  }) {
    Object.assign(this, { idleMs, setTimer, clearTimer, onRender });
    this.elements = Object.fromEntries(
      Object.entries(ELEMENT_IDS).map(([key, id]) => [
        key,
        root?.querySelector?.(`#${id}`) || null,
      ]),
    );
    this.state = initialVoiceCardState();
    this.notesOpen = Boolean(this.elements.notes?.open);
    this.channel = createStateChannel(() => ({
      ...this.snapshot(),
      notesOpen: this.notesOpen,
    }));
    this.enabled = true;
    this.presented = true;
    this.announcementRevision = 0;
    this.consumedPresentationAnnouncement = -1;
    this.hideTimer = null;
    this.destroyed = false;
    this.listeners = new AbortController();
    if (!this.elements.card) return;
    this.disconnectView = connectView?.(this.channel);
    this.elements.dismiss?.addEventListener(
      'click',
      () => this.handle({ type: 'dismiss' }),
      { signal: this.listeners.signal },
    );
    this.elements.notes?.querySelector?.('summary')?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        this.setNotesOpen(!this.notesOpen);
      },
      { signal: this.listeners.signal },
    );
    this.elements.notes?.addEventListener(
      'toggle',
      () => {
        this.setNotesOpen(this.elements.notes.open);
      },
      { signal: this.listeners.signal },
    );
    this.render();
  }

  /** The disclosure choice persists across replies and presentation changes. */
  setNotesOpen(open) {
    if (this.destroyed || this.notesOpen === Boolean(open)) return;
    this.notesOpen = Boolean(open);
    this.render();
  }

  /** Apply one session event (or `outline`/`dismiss`). */
  handle(event) {
    if (this.destroyed || !this.elements.card) return;
    const next = reduceVoiceCard(this.state, event);
    if (next === this.state) return;
    if (
      next.announce !== this.state.announce ||
      (next.announce &&
        ((event.type === 'transcript' &&
          event.role === 'assistant' &&
          event.final) ||
          (event.type === 'action-result' &&
            next.result !== this.state.result) ||
          (event.type === 'pointer' &&
            next.pointer &&
            next.pointer !== this.state.pointer)))
    )
      this.announcementRevision++;
    this.state = next;
    this.render();
    if (this.state.visible) this.scheduleIdle();
    else this.cancelIdle();
  }

  /** A local submission allows future output after dismissal; keep its content. */
  rearm() {
    if (this.destroyed || !this.elements.card) return;
    this.state = { ...this.state, dismissed: false };
  }

  /** An annotation outline resolved or failed after its tool result. */
  outline(event) {
    this.handle({ type: 'outline', id: event?.id, status: event?.status });
  }

  /** Change presentation only; session events and the idle deadline continue. */
  setEnabled(enabled) {
    if (this.destroyed || !this.elements.card) return;
    this.enabled = Boolean(enabled);
    this.render();
  }

  /** View selection changes presentation without changing the saved preference. */
  setPresented(presented) {
    if (this.destroyed || !this.elements.card || this.presented === presented)
      return;
    if (!presented)
      this.consumedPresentationAnnouncement = this.announcementRevision;
    this.presented = presented;
    this.render();
  }

  scheduleIdle() {
    this.cancelIdle();
    this.hideTimer = this.setTimer(() => {
      this.hideTimer = null;
      if (this.destroyed) return;
      // Keep the card while the pointer or focus is inside it.
      if (this.elements.card.matches?.(':hover, :focus-within')) {
        this.scheduleIdle();
        return;
      }
      this.handle({ type: 'idle' });
    }, this.idleMs);
  }

  cancelIdle() {
    if (this.hideTimer === null) return;
    this.clearTimer(this.hideTimer);
    this.hideTimer = null;
  }

  render() {
    this.channel.publish({ type: 'card-changed' });
    this.onRender?.();
  }

  /** Test/diagnostic view of what the card shows. */
  snapshot() {
    const view = voiceCardView(this.state);
    return this.enabled && this.presented
      ? {
          ...view,
          announce:
            this.consumedPresentationAnnouncement === this.announcementRevision
              ? ''
              : view.announce,
        }
      : { ...view, visible: false, announce: '' };
  }

  /** Idempotent: removes listeners and the idle timer; markup stays owned by the control. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelIdle();
    this.listeners.abort();
    this.disconnectView?.();
    this.channel.destroy();
  }
}
