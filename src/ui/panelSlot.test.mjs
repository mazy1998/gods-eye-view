import test from 'node:test';
import assert from 'node:assert/strict';
import '../testSupport/componentDom.mjs';

const { createStateChannel } = await import('../app/stateChannel.js');
const { createSelectionSlot } = await import('./selectionSlot.js');
const { connectPanelSlot, SLOT_PANELS } = await import('./panelSlot.js');

const ORDER = ['data-panel', 'cctv-panel', 'street-level-panel'];

/** Inspect's Cameras view and a PanelChrome-shaped channel over its panels. */
function fixture({
  expanded = [],
  active = true,
  presenting = () => false,
} = {}) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<section id="context-cameras-view">
       <div id="cctv-panel" data-panel-id="cctv-panel" class="panel-collapsible collapsed">
         <div class="panel-header"><button class="panel-collapse-btn"></button></div>
       </div>
       <div id="street-level-panel" data-panel-id="street-level-panel" class="panel-collapsible collapsed">
         <div class="panel-header"><button id="sl-status">OFF</button><button class="panel-collapse-btn"></button></div>
       </div>
     </section>
     <div id="data-panel" data-panel-id="data-panel" class="panel-collapsible collapsed"></div>
     <div id="recent-imagery-panel" data-panel-id="recent-imagery-panel" class="panel-collapsible collapsed" hidden></div>
     <section id="context-home">
       <section id="radio-panel" data-panel-id="radio-panel" class="panel-collapsible collapsed"><button id="radio-play">Play</button></section>
     </section>`,
  );
  for (const id of expanded)
    document.getElementById(id).classList.remove('collapsed');
  let restoring = false;
  const panelChannel = createStateChannel(() => {
    const panels = {};
    for (const node of document.querySelectorAll('[data-panel-id]'))
      panels[node.id] = {
        collapsed: node.classList.contains('collapsed'),
        autoCollapsed: false,
      };
    return { panels, restoring };
  });
  const calls = [];
  const setPanelCollapsed = (id, collapsed, options = {}) => {
    calls.push([id, collapsed, options]);
    document.getElementById(id).classList.toggle('collapsed', collapsed);
    panelChannel.publish({
      type: 'panel-changed',
      panelId: id,
      ...(options.presentation && { presentation: true }),
    });
    if (options.explicit && !collapsed)
      panelChannel.publish({ type: 'panel-revealed', panelId: id });
  };
  const slot = createSelectionSlot({ document, active });
  document.body.append(slot.body, slot.actions);
  const returned = [];
  const disconnect = connectPanelSlot({
    document,
    slot,
    panelChannel,
    setPanelCollapsed,
    restoreOrder: ORDER,
    translate: (key) => `t:${key}`,
    isPhonePresenting: presenting,
    returnHome: (id, panel) => {
      returned.push(id);
      if (!panel.isConnected || slot.body.contains(panel))
        $('context-home').append(panel);
    },
  });
  const restore = (open) => {
    restoring = true;
    for (const id of ORDER) setPanelCollapsed(id, !open.includes(id), {});
    restoring = false;
    panelChannel.publish({ type: 'panels-restored', panelIds: ORDER });
  };
  const cleanup = () => {
    disconnect();
    slot.destroy();
    document.body.replaceChildren();
  };
  return {
    slot,
    panelChannel,
    setPanelCollapsed,
    calls,
    restore,
    returned,
    cleanup,
  };
}

const $ = (id) => document.getElementById(id);
const inSlot = (slot, id) => slot.body.contains($(id));
const home = () => $('context-cameras-view');

test('an expanded camera panel moves into the slot with its id and header', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  const panel = $('cctv-panel');
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.equal(slot.current(), 'cctv-panel');
  assert.ok(inSlot(slot, 'cctv-panel'));
  assert.equal($('cctv-panel'), panel, 'moved, not cloned');
  assert.deepEqual(slot.channel.getSnapshot().item, {
    id: 'cctv-panel',
    title: 't:CCTV',
    icon: 'camera_alt',
  });
});

test('Street Level replaces CCTV in place, and CCTV collapses at home', (t) => {
  const { slot, setPanelCollapsed, calls, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  setPanelCollapsed('street-level-panel', false, {});
  assert.equal(slot.current(), 'street-level-panel');
  assert.ok(inSlot(slot, 'street-level-panel'));
  assert.equal($('cctv-panel').parentElement, home());
  assert.ok($('cctv-panel').classList.contains('collapsed'));
  assert.deepEqual(calls.at(-1), ['cctv-panel', true, { explicit: true }]);
  // Street Level's switch rides in the slot header while it is there.
  assert.equal($('sl-status').parentElement, slot.actions);
});

test('close collapses the panel as its own control does and puts it home', (t) => {
  const { slot, setPanelCollapsed, calls, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('street-level-panel', false, { explicit: true });
  slot.close();
  assert.deepEqual(calls.at(-1), [
    'street-level-panel',
    true,
    { explicit: true },
  ]);
  assert.equal(slot.current(), null);
  assert.equal($('street-level-panel').parentElement, home());
  assert.equal(
    $('sl-status').parentElement,
    $('street-level-panel').querySelector('.panel-header'),
  );
  assert.equal(
    $('sl-status').nextElementSibling,
    $('street-level-panel').querySelector('.panel-collapse-btn'),
    'in its own place',
  );
});

test('a collapse from anywhere takes the viewer out of the slot', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  setPanelCollapsed('cctv-panel', true, { presentation: true });
  assert.equal(slot.current(), null);
  assert.equal($('cctv-panel').parentElement, home());
});

test('another item taking the slot collapses the camera', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.show({ id: 'aircraft', mount: () => () => {} });
  assert.ok($('cctv-panel').classList.contains('collapsed'));
  assert.equal($('cctv-panel').parentElement, home());
  assert.equal(slot.current(), 'aircraft', 'the collapse leaves it alone');
});

test('presentation expansions (a phone sheet borrowing) do not show a camera', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { presentation: true });
  assert.equal(slot.current(), null);
});

test('an explicit reveal of an expanded camera shows it again', (t) => {
  const { slot, setPanelCollapsed, panelChannel, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.show({ id: 'aircraft', mount: () => () => {} });
  setPanelCollapsed('cctv-panel', false, {});
  assert.equal(slot.current(), 'cctv-panel');
  panelChannel.publish({ type: 'panel-revealed', panelId: 'data-panel' });
  assert.equal(slot.current(), 'cctv-panel', 'other reveals change nothing');
});

test('a stored expanded camera shows at startup', (t) => {
  const { slot, cleanup } = fixture({ expanded: ['street-level-panel'] });
  t.after(cleanup);
  assert.equal(slot.current(), 'street-level-panel');
  assert.ok(inSlot(slot, 'street-level-panel'));
});

test('a restore shows its first expanded camera and collapses no other', (t) => {
  const { slot, restore, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('street-level-panel', false, { explicit: true });
  restore(['cctv-panel', 'street-level-panel']);
  assert.equal(slot.current(), 'cctv-panel', 'share-restore order');
  assert.equal(
    $('street-level-panel').classList.contains('collapsed'),
    false,
    'the restored state stands',
  );
  restore([]);
  assert.equal(slot.current(), null);
});

test('resting puts the panel home expanded; coming back shows it again', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.setActive(false);
  assert.equal($('cctv-panel').parentElement, home());
  assert.equal($('cctv-panel').classList.contains('collapsed'), false);
  slot.setActive(true);
  assert.ok(inSlot(slot, 'cctv-panel'));
});

test('a camera expanded on the phone shows in the slot back at desktop width', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture({ active: false });
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.equal($('cctv-panel').parentElement, home(), 'the sheet has it');
  slot.setActive(true);
  assert.ok(inSlot(slot, 'cctv-panel'));
});

test('the phone sheets present the panels as they like while the slot rests', (t) => {
  const { slot, setPanelCollapsed, calls, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.setActive(false);
  const before = calls.length;
  // The phone layout collapses what it does not show, opens both viewers in
  // the Inspect sheet, and gives the panels back at desktop width.
  setPanelCollapsed('cctv-panel', true, {});
  setPanelCollapsed('cctv-panel', false, {});
  setPanelCollapsed('street-level-panel', false, {});
  setPanelCollapsed('street-level-panel', true, {});
  assert.equal(calls.length, before + 4, 'the slot collapsed nothing');
  assert.equal(slot.current(), 'cctv-panel');
  slot.setActive(true);
  assert.equal(slot.current(), 'cctv-panel');
  assert.ok(inSlot(slot, 'cctv-panel'));
});

test('the phone layout collapsing panels before the slot rests changes nothing', (t) => {
  let presenting = false;
  const { slot, setPanelCollapsed, cleanup } = fixture({
    presenting: () => presenting,
  });
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  presenting = true;
  setPanelCollapsed('cctv-panel', true, {});
  presenting = false;
  assert.equal(slot.current(), 'cctv-panel');
});

test('back at desktop width the slot follows what the panels show', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.setActive(false);
  setPanelCollapsed('cctv-panel', true, { explicit: true });
  setPanelCollapsed('street-level-panel', false, { explicit: true });
  slot.setActive(true);
  assert.equal(slot.current(), 'street-level-panel');
  assert.ok(inSlot(slot, 'street-level-panel'));
  assert.equal($('cctv-panel').parentElement, home());
});

test('an item shown while the slot rests collapses no camera', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  slot.setActive(false);
  slot.show({ id: 'aircraft', mount: () => () => {} });
  assert.equal($('cctv-panel').classList.contains('collapsed'), false);
});

test('the slot names a translated title and a subset glyph for each panel', () => {
  assert.deepEqual(Object.keys(SLOT_PANELS), [
    'cctv-panel',
    'street-level-panel',
    'recent-imagery-panel',
    'radio-panel',
  ]);
  for (const { title, icon } of Object.values(SLOT_PANELS)) {
    assert.equal(typeof title, 'string');
    assert.match(icon, /^[a-z_]+$/);
  }
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Recent imagery shows while its layer shows it, and leaves when hidden', async (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  const panel = $('recent-imagery-panel');
  setPanelCollapsed('recent-imagery-panel', false, {});
  assert.equal(slot.current(), null, 'hidden while the layer is off');
  panel.hidden = false;
  await settle();
  assert.equal(slot.current(), 'recent-imagery-panel');
  assert.ok(inSlot(slot, 'recent-imagery-panel'));
  panel.hidden = true;
  await settle();
  assert.equal(slot.current(), null);
  assert.ok(!inSlot(slot, 'recent-imagery-panel'));
  assert.equal(panel.classList.contains('collapsed'), false, 'kept as it was');
});

test('Radio replaced or closed collapses and goes back through its placement', (t) => {
  const { slot, setPanelCollapsed, calls, returned, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('radio-panel', false, { explicit: true });
  assert.equal(slot.current(), 'radio-panel');
  assert.ok(inSlot(slot, 'radio-panel'));
  setPanelCollapsed('cctv-panel', false, { explicit: true });
  assert.deepEqual(calls.at(-1), ['radio-panel', true, { explicit: true }]);
  assert.deepEqual(returned, ['radio-panel']);
  assert.equal($('radio-panel').parentElement, $('context-home'));
  // Details expands it again, into the slot.
  setPanelCollapsed('radio-panel', false, { explicit: true });
  assert.equal(slot.current(), 'radio-panel');
  slot.close();
  assert.deepEqual(returned, ['radio-panel', 'radio-panel']);
  assert.equal($('radio-panel').parentElement, $('context-home'));
  assert.ok($('radio-panel').classList.contains('collapsed'));
});

test('Radio whose old spot has gone still leaves the slot', (t) => {
  const { slot, setPanelCollapsed, cleanup } = fixture();
  t.after(cleanup);
  const list = document.createElement('div');
  document.body.append(list);
  list.append($('radio-panel'));
  setPanelCollapsed('radio-panel', false, { explicit: true });
  list.remove();
  slot.close();
  assert.equal($('radio-panel').parentElement, $('context-home'));
});

test('Radio a phone sheet took is left where it is', (t) => {
  const { slot, setPanelCollapsed, returned, cleanup } = fixture();
  t.after(cleanup);
  setPanelCollapsed('radio-panel', false, { explicit: true });
  const sheet = document.createElement('div');
  document.body.append(sheet);
  sheet.append($('radio-panel'));
  slot.setActive(false);
  assert.equal($('radio-panel').parentElement, sheet);
  assert.deepEqual(returned, ['radio-panel']);
});
