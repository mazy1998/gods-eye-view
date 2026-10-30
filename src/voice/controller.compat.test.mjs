import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const { GevRealtimeController } =
  await import('gods-eye-view/voice/controller');

test('published realtime controller paints supplied native handles and releases its adapter', () => {
  container.innerHTML =
    '<section><button></button><span class="status"></span><span class="detail"></span><span class="error"></span></section>';
  const root = container.querySelector('section');
  let disposed = 0;
  const ui = {
    root,
    button: root.querySelector('button'),
    status: root.querySelector('.status'),
    detail: root.querySelector('.detail'),
    errorDetail: root.querySelector('.error'),
    dispose: () => disposed++,
  };
  const controller = new GevRealtimeController({
    runner: async () => ({}),
    ui,
    backend: {},
    debugSink: null,
  });
  controller.setStatus('connecting', 'Opening local session');
  assert.equal(root.dataset.status, 'connecting');
  assert.equal(ui.detail.textContent, 'Opening local session');
  assert.notEqual(ui.status.textContent, '');
  controller.setStatus('error', 'Unavailable');
  assert.equal(root.dataset.status, 'error');
  assert.equal(ui.errorDetail.textContent, 'Unavailable');
  controller.stop({ removeUi: true });
  assert.equal(root.isConnected, false);
  assert.equal(disposed, 1);
  const detail = ui.detail.textContent;
  controller.setStatus('connecting', 'Late');
  assert.equal(ui.detail.textContent, detail);
});
