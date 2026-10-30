import { createStateChannel } from '../../app/stateChannel.js';

/** Destination navigation and a lease on the existing provider form. */
export function createSettingsSurface({
  open,
  close,
  openVoice,
  closeLanguage,
  canOpenVoice = () => typeof openVoice === 'function',
} = {}) {
  let disposed = false;
  let provider = null;
  let host = null;
  let descriptionHost = null;
  let release = null;
  const state = {
    section: 'providers',
    providersReady: false,
    providersAvailable: false,
    providersEmbedded: false,
  };
  const channel = createStateChannel(() => ({
    ...state,
    voiceAvailable: Boolean(canOpenVoice()),
  }));
  const publish = () => !disposed && channel.publish();
  const select = (section) => {
    if (disposed || !['providers', 'voice', 'language'].includes(section))
      return;
    if (state.section === section) return;
    state.section = section;
    publish();
  };
  const attach = () => {
    release?.();
    release = null;
    if (host && typeof provider?.host === 'function') {
      release = provider.host(host, {
        descriptionHost,
        onOpen: () => {
          if (disposed) return;
          select('providers');
          open?.();
        },
        onClose: () => !disposed && close?.(),
      });
    }
  };
  return {
    channel,
    select,
    openVoice: () => !disposed && canOpenVoice() && openVoice?.(),
    closeLanguage: () => !disposed && closeLanguage?.(),
    openProviders: () => !disposed && provider?.open?.(),
    connect(control) {
      if (disposed) return;
      release?.();
      release = null;
      provider = control;
      state.providersReady = true;
      state.providersAvailable = Boolean(control);
      state.providersEmbedded = typeof control?.host === 'function';
      attach();
      publish();
    },
    hostProviders(element, description) {
      if (disposed) return () => {};
      host = element;
      descriptionHost = description;
      attach();
      return () => {
        if (host !== element) return;
        release?.();
        release = null;
        host = null;
        descriptionHost = null;
      };
    },
    destroy() {
      if (disposed) return;
      release?.();
      release = null;
      host = null;
      descriptionHost = null;
      provider = null;
      disposed = true;
      channel.destroy();
    },
  };
}
