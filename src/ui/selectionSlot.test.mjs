import test from 'node:test';
import assert from 'node:assert/strict';
import '../testSupport/componentDom.mjs';

const { createSelectionSlot } = await import('./selectionSlot.js');

/** An item that records what the slot asked of it. */
function item(id, log, { onClose } = {}) {
  return {
    id,
    title: id.toUpperCase(),
    icon: 'videocam',
    mount({ body }) {
      log.push(`mount ${id}`);
      const node = document.createElement('p');
      node.id = `content-${id}`;
      body.append(node);
      return () => {
        log.push(`unmount ${id}`);
        node.remove();
      };
    },
    close() {
      log.push(`close ${id}`);
      onClose?.();
    },
    replaced() {
      log.push(`replaced ${id}`);
    },
  };
}

function setup(options) {
  const slot = createSelectionSlot({ document, ...options });
  document.body.append(slot.body, slot.actions);
  const changes = [];
  slot.channel.subscribe(({ state, change }) =>
    changes.push({
      item: state.item?.id ?? null,
      active: state.active,
      change,
    }),
  );
  return { slot, changes };
}

test('showing an item mounts it and publishes its title and icon', (t) => {
  const { slot } = setup();
  t.after(() => slot.destroy());
  const log = [];
  assert.equal(slot.show(item('cctv', log)), true);
  assert.deepEqual(log, ['mount cctv']);
  assert.ok(slot.body.querySelector('#content-cctv'));
  assert.equal(slot.current(), 'cctv');
  assert.deepEqual(slot.channel.getSnapshot(), {
    active: true,
    item: { id: 'cctv', title: 'CCTV', icon: 'videocam' },
  });
});

test('a newer item replaces the current one: unmount, mount, publish, then replaced', (t) => {
  const { slot, changes } = setup();
  t.after(() => slot.destroy());
  const log = [];
  slot.show(item('cctv', log));
  const seen = [];
  slot.channel.subscribe(
    ({ state, change }) => {
      if (change?.type === 'shown') seen.push([state.item.id, [...log]]);
    },
    { emitCurrent: false },
  );
  slot.show(item('street', log));
  assert.deepEqual(log, [
    'mount cctv',
    'unmount cctv',
    'mount street',
    'replaced cctv',
  ]);
  assert.deepEqual(seen, [
    ['street', ['mount cctv', 'unmount cctv', 'mount street']],
  ]);
  assert.equal(slot.current(), 'street');
  assert.equal(changes.at(-1).item, 'street');
});

test('showing the current id again refreshes its title without remounting', (t) => {
  const { slot } = setup();
  t.after(() => slot.destroy());
  const log = [];
  slot.show(item('cctv', log));
  slot.show({ ...item('cctv', log), title: 'Camera 2' });
  assert.deepEqual(log, ['mount cctv']);
  assert.equal(slot.channel.getSnapshot().item.title, 'Camera 2');
});

test('an owner hides only its own item', (t) => {
  const { slot } = setup();
  t.after(() => slot.destroy());
  const log = [];
  slot.show(item('cctv', log));
  slot.hide('street');
  assert.equal(slot.current(), 'cctv');
  slot.hide('cctv');
  assert.equal(slot.current(), null);
  assert.deepEqual(log, ['mount cctv', 'unmount cctv']);
  assert.equal(slot.body.children.length, 0);
});

test('close runs the item close path and always empties the slot', (t) => {
  const { slot } = setup();
  t.after(() => slot.destroy());
  const log = [];
  // An item whose close path does not withdraw it.
  slot.show(item('aircraft', log));
  slot.close();
  assert.deepEqual(log, [
    'mount aircraft',
    'close aircraft',
    'unmount aircraft',
  ]);
  assert.equal(slot.current(), null);
  // An item whose close path hides it itself.
  log.length = 0;
  slot.show(item('cctv', log, { onClose: () => slot.hide('cctv') }));
  slot.close();
  assert.deepEqual(log, ['mount cctv', 'close cctv', 'unmount cctv']);
  assert.equal(slot.current(), null);
  slot.close();
  assert.deepEqual(log, ['mount cctv', 'close cctv', 'unmount cctv']);
});

test('resting unmounts but keeps the item; coming back mounts it again', (t) => {
  const { slot, changes } = setup();
  t.after(() => slot.destroy());
  const log = [];
  slot.show(item('cctv', log));
  slot.setActive(false);
  assert.deepEqual(log, ['mount cctv', 'unmount cctv']);
  assert.equal(slot.current(), 'cctv');
  assert.equal(changes.at(-1).active, false);
  slot.setActive(true);
  assert.deepEqual(log, ['mount cctv', 'unmount cctv', 'mount cctv']);
  assert.equal(changes.at(-1).active, true);
});

test('items shown or hidden while resting take effect on return', (t) => {
  const { slot } = setup({ active: false });
  t.after(() => slot.destroy());
  const log = [];
  slot.show(item('cctv', log));
  slot.show(item('street', log));
  assert.deepEqual(log, ['replaced cctv'], 'nothing mounts while resting');
  slot.setActive(true);
  assert.deepEqual(log, ['replaced cctv', 'mount street']);
  slot.setActive(false);
  slot.hide('street');
  slot.setActive(true);
  assert.deepEqual(log, ['replaced cctv', 'mount street', 'unmount street']);
  assert.equal(slot.current(), null);
});

test('closing from inside the slot returns focus to what had it when shown', (t) => {
  const { slot } = setup();
  t.after(() => slot.destroy());
  const opener = document.createElement('button');
  document.body.append(opener);
  t.after(() => opener.remove());
  opener.focus();
  slot.show({
    id: 'cctv',
    mount({ body }) {
      const button = document.createElement('button');
      body.append(button);
      return () => button.remove();
    },
  });
  slot.body.querySelector('button').focus();
  slot.close();
  assert.equal(document.activeElement, opener);
});

test('destroy unmounts the current item and stops publishing', (t) => {
  const { slot } = setup();
  const log = [];
  slot.show(item('cctv', log));
  slot.destroy();
  assert.deepEqual(log, ['mount cctv', 'unmount cctv']);
  assert.equal(slot.show(item('street', log)), false);
  assert.equal(slot.body.isConnected, false);
});

/** The view's frame: its close button, then the slot's actions and body. */
function framed(slot) {
  const frame = document.createElement('section');
  frame.className = 'gev-slot';
  const close = document.createElement('button');
  close.className = 'gev-slot-close';
  frame.append(slot.actions, close, slot.body);
  document.body.append(frame);
  return { frame, close };
}

test('a focused disclosure the slot borrows and hides hands focus to the slot', (t) => {
  const { slot } = setup();
  const { frame, close } = framed(slot);
  t.after(() => {
    slot.destroy();
    frame.remove();
  });
  // A panel at home whose header disclosure opened it.
  const panel = document.createElement('div');
  panel.innerHTML =
    '<div class="panel-header"><button id="disclosure">+</button></div><p>viewer</p>';
  document.body.append(panel);
  t.after(() => panel.remove());
  const disclosure = panel.querySelector('#disclosure');
  disclosure.focus();
  slot.show({
    id: 'cctv',
    mount({ body }) {
      const home = document.createComment('home');
      panel.before(home);
      body.append(panel);
      // The slot's own header names the item: the panel's is hidden there.
      panel.querySelector('.panel-header').hidden = true;
      return () => {
        panel.querySelector('.panel-header').hidden = false;
        home.replaceWith(panel);
      };
    },
  });
  assert.equal(document.activeElement, close, 'focus moved into the slot');
  slot.close();
  assert.equal(document.activeElement, disclosure, 'and back to the opener');
});

test('a replacement made from inside the slot keeps the first opener', (t) => {
  const { slot } = setup();
  const { frame, close } = framed(slot);
  t.after(() => {
    slot.destroy();
    frame.remove();
  });
  const opener = document.createElement('button');
  document.body.append(opener);
  t.after(() => opener.remove());
  const field = (id) => ({
    id,
    mount({ body }) {
      const input = document.createElement('input');
      input.id = `field-${id}`;
      body.append(input);
      return () => input.remove();
    },
  });
  opener.focus();
  slot.show(field('cctv'));
  slot.body.querySelector('#field-cctv').focus();
  slot.show(field('street'));
  assert.ok(
    frame.contains(document.activeElement),
    `focus stays in the slot, not on ${document.activeElement?.tagName}`,
  );
  assert.equal(document.activeElement, close);
  slot.close();
  assert.equal(document.activeElement, opener);
});

test('an item shown while focus is elsewhere leaves focus there', (t) => {
  const { slot } = setup();
  const { frame } = framed(slot);
  t.after(() => {
    slot.destroy();
    frame.remove();
  });
  const other = document.createElement('button');
  document.body.append(other);
  t.after(() => other.remove());
  other.focus();
  slot.show(item('cctv', []));
  assert.equal(document.activeElement, other);
});
