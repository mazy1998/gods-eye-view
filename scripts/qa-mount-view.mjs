#!/usr/bin/env node
/** mountView acceptance on dev: lifecycle, placement, keyed remount and disposal in a real DOM. */
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
// Keyless dev logs WebGL and 3D Tiles warnings; only errors and Vue's own
// warnings concern the views.
page.on('console', (message) => {
  if (message.type() === 'error' || message.text().includes('[Vue warn]'))
    errors.push(message.text());
});
let checks = 0;
let failures = 0;
const check = (name, passed, detail) => {
  checks++;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  if (!passed) {
    failures++;
    console.log(JSON.stringify(detail));
  }
};
try {
  await page.goto(
    `${process.env.QA_BASE_URL || 'http://127.0.0.1:4189'}/?welcome=0`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForFunction(
    () =>
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 60000 },
  );
  const result = await page.evaluate(async () => {
    const { mountView } = await import('/src/ui/mountView.js');
    const { default: Probe } = await import('/src/testSupport/MountProbe.vue');
    const host = document.body.appendChild(document.createElement('div'));
    host.id = 'mount-view-host';
    const first = host.appendChild(document.createElement('em'));
    const last = host.appendChild(document.createElement('strong'));
    const order = () => [...host.children].map((node) => node.tagName);
    const reports = [];
    let onReport = (report) => reports.push(report);
    const view = mountView(Probe, {
      parent: host,
      before: last,
      props: { label: 'Mounted', onReport: (report) => onReport(report) },
    });
    const out = { mounted: reports[0], placed: order() };
    out.parentAttributes = [...host.attributes].map((a) => a.name);
    const original = view.element;
    view.update({ label: 'Changed' });
    out.sync = {
      label: view.element.getAttribute('aria-label'),
      sameNode: view.element === original,
    };
    try {
      view.update({ key: 'remount', label: 'Remount' });
      out.keyed = {
        report: reports.at(-1),
        placed: order(),
        replaced: view.element !== original && !original.isConnected,
        connected: view.element.isConnected,
      };
    } catch (error) {
      out.keyed = { error: error.message };
    }
    // A hook that updates during a paint: the newer props must win.
    onReport = (report) => {
      reports.push(report);
      if (report.label === 'Again') view.update({ label: 'Latest' });
    };
    view.update({ key: 'again', label: 'Again' });
    out.reentrant = {
      label: view.element.getAttribute('aria-label'),
      placed: order(),
    };
    view.dispose();
    view.dispose();
    view.update({ label: 'Late' });
    out.disposed = { placed: order(), element: view.element };
    // A hook that disposes during a paint removes the view once it returns.
    const inner = mountView(Probe, {
      parent: host,
      props: { label: 'Inner', onReport: () => {} },
    });
    out.appended = order();
    inner.update({
      key: 'gone',
      onReport: () => inner.dispose(),
    });
    out.innerDisposed = { placed: order(), element: inner.element };
    out.first = host.firstChild === first;
    host.remove();
    return out;
  });
  check(
    'mounted hooks run attached: connected, focused and measured in the real parent',
    result.mounted?.connected &&
      result.mounted.focused &&
      result.mounted.width > 0 &&
      result.mounted.parentId === 'mount-view-host',
    result.mounted,
  );
  check(
    'nodes go before the given sibling and the parent gains no attributes',
    result.placed.join() === 'EM,INPUT,STRONG' &&
      result.parentAttributes.join() === 'id',
    result,
  );
  check(
    'update patches synchronously and keeps the node',
    result.sync.label === 'Changed' && result.sync.sameNode,
    result.sync,
  );
  check(
    'a changed key remounts in place, attached',
    !result.keyed.error &&
      result.keyed.report?.connected &&
      result.keyed.report.focused &&
      result.keyed.placed.join() === 'EM,INPUT,STRONG' &&
      result.keyed.replaced &&
      result.keyed.connected,
    result.keyed,
  );
  check(
    'an update made during a paint wins over the props being painted',
    result.reentrant.label === 'Latest' &&
      result.reentrant.placed.join() === 'EM,INPUT,STRONG',
    result.reentrant,
  );
  check(
    'dispose is idempotent and later updates do nothing',
    result.disposed.placed.join() === 'EM,STRONG' &&
      result.disposed.element === null,
    result.disposed,
  );
  check(
    'without a sibling the view is appended, and disposing during a paint removes it',
    result.appended.join() === 'EM,STRONG,INPUT' &&
      result.innerDisposed.placed.join() === 'EM,STRONG' &&
      result.innerDisposed.element === null &&
      result.first,
    result,
  );
  check('no browser errors or Vue warnings', errors.length === 0, errors);
} finally {
  await browser.close();
}
console.log(`${checks} checks; ${failures} failures`);
process.exitCode = failures ? 1 : 0;
