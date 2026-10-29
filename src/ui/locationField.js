import { createStateChannel } from '../app/stateChannel.js';

/** The unfinished query belongs to navigation, independent of its input node. */
export class LocationField {
  constructor(input) {
    this.input = input;
    this.state = {
      query: input?.value || '',
      expanded: !!input?.classList.contains('expanded'),
      busy: false,
      error: '',
    };
    this.channel = createStateChannel(() => this.state);
    this.disposed = false;
  }
  getState() {
    return this.channel.getSnapshot();
  }
  subscribe(listener, options) {
    return this.channel.subscribe(listener, options);
  }
  set(patch) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.channel.publish();
  }
  edit(query) {
    this.set({ query });
  }
  toggle() {
    if (this.disposed) return;
    this.set({ expanded: !this.state.expanded });
    if (this.state.expanded) this.input?.focus();
  }
  close() {
    if (this.disposed) return;
    this.set({ query: '', expanded: false, error: '' });
    this.input?.blur();
  }
  destroy() {
    this.disposed = true;
    this.channel.getSnapshot();
    this.channel.destroy();
  }
}
