/** Native view for injected controls that supply existing card markup.
 * The default Vue control supplies connectCard and never enters this path.
 * Keep provider content literal and the host-owned interactive nodes intact.
 */
const ELEMENT_IDS = Object.freeze({
  card: 'gev-voice-card',
  phase: 'gev-voice-card-phase',
  dismiss: 'gev-voice-card-dismiss',
  user: 'gev-voice-card-user',
  userText: 'gev-voice-card-user-text',
  userWho: 'gev-voice-card-user-who',
  pointer: 'gev-voice-card-pointer',
  pointerKind: 'gev-voice-card-pointer-kind',
  pointerText: 'gev-voice-card-pointer-text',
  assistant: 'gev-voice-card-assistant',
  assistantText: 'gev-voice-card-assistant-text',
  plan: 'gev-voice-card-plan',
  result: 'gev-voice-card-result',
  resultTitle: 'gev-voice-card-result-title',
  chips: 'gev-voice-card-chips',
  lines: 'gev-voice-card-lines',
  referents: 'gev-voice-card-referents',
  notes: 'gev-voice-card-notes',
  noteList: 'gev-voice-card-note-list',
  live: 'gev-voice-card-live',
});

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function setHidden(element, hidden) {
  if (element && element.hidden !== hidden) element.hidden = hidden;
}

function fillList(list, items, render) {
  if (!list) return;
  const doc = list.ownerDocument;
  list.replaceChildren(
    ...items.map((item) => {
      const node = doc.createElement('li');
      render(node, item, doc);
      return node;
    }),
  );
}

export function connectCompatibleCard(root, channel) {
  const el = Object.fromEntries(
    Object.entries(ELEMENT_IDS).map(([key, id]) => [
      key,
      root?.querySelector?.(`#${id}`) || null,
    ]),
  );
  return channel.subscribe(({ state: view }) => {
    setHidden(el.card, !view.visible);
    el.card.dataset.busy = String(view.busy);
    setText(el.phase, view.phase);
    setHidden(el.user, !view.user.visible);
    setText(el.userText, view.user.text);
    setText(el.userWho, view.user.label);
    setHidden(el.pointer, !view.pointer.visible);
    setText(el.pointerKind, view.pointer.kind);
    setText(el.pointerText, view.pointer.text);
    setHidden(el.assistant, !view.assistant.visible);
    setText(el.assistantText, view.assistant.text);
    setHidden(el.plan, view.steps.length === 0);
    fillList(el.plan, view.steps, (node, step, doc) => {
      node.className = 'gev-voice-card-step';
      node.dataset.status = step.status;
      const label = doc.createElement('span');
      label.className = 'gev-voice-card-step-label';
      label.textContent = step.label;
      const status = doc.createElement('span');
      status.className = 'gev-voice-card-sr';
      status.textContent = step.statusText ? `, ${step.statusText}` : '';
      node.append(label, status);
      if (step.detail) {
        const detail = doc.createElement('span');
        detail.className = 'gev-voice-card-step-detail';
        detail.textContent = step.detail;
        node.append(detail);
      }
    });
    setHidden(el.result, !view.result.visible);
    setText(el.resultTitle, view.result.title);
    setHidden(el.chips, view.result.chips.length === 0);
    if (el.chips) {
      const doc = el.chips.ownerDocument;
      el.chips.replaceChildren(
        ...view.result.chips.map((text) => {
          const chip = doc.createElement('span');
          chip.className = 'gev-voice-card-chip';
          chip.dataset.tone = text;
          chip.textContent = text;
          return chip;
        }),
      );
    }
    fillList(el.lines, view.result.lines, (node, line) => {
      node.textContent = line;
    });
    setHidden(el.referents, view.result.referents.length === 0);
    fillList(el.referents, view.result.referents, (node, ref) => {
      node.value = ref.n;
      node.textContent = ref.label;
    });
    setHidden(el.notes, view.result.notes.length === 0);
    if (el.notes) el.notes.open = view.notesOpen;
    fillList(el.noteList, view.result.notes, (node, note) => {
      node.textContent = note;
    });
    setText(el.live, view.announce);
  });
}
