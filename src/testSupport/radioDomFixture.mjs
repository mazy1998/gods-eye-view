import { container } from './componentDom.mjs';
import { readFileSync } from 'node:fs';
import { expandApplicationHtml } from '../../build/application-html.js';
const { mountRadioView } = await import('../ui/radioView.js');
const { mountView } = await import('../ui/mountView.js');
const { default: LocalSdrView } = await import('../ui/LocalSdrView.vue');
const { localSdrCardView } = await import('../ui/localSdrPresentation.js');
const { readShellElements } = await import('../ui/shellElements.js');

/** Real native controls and Vue content, with no receiver/device/network work. */
export function radioDomFixture({ sdr = false } = {}) {
  container.innerHTML = expandApplicationHtml(
    readFileSync(new URL('../../index.html', import.meta.url), 'utf8'),
  );
  const view = mountRadioView(document);
  const local = sdr
    ? mountView(LocalSdrView, {
        parent: document.getElementById('sdr-radio-card'),
        props: {
          view: localSdrCardView({
            webUsbSupported: true,
            status: 'idle',
            mode: 'fm',
            message: 'Connect an RTL-SDR to begin.',
            volume: 0.8,
            frequencyHz: 98_500_000,
          }),
          drafts: { frequency: '98.5', gain: 'auto', volume: '80' },
        },
      })
    : null;
  return {
    view,
    elements: readShellElements(),
    container,
    dispose() {
      local?.dispose();
      view?.dispose();
    },
  };
}
