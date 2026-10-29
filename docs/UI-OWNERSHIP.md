# Application UI ownership

`src/ui/applicationShell.js` constructs controls, connects their explicit inputs
and coordinates shutdown. `shellFacade.js` preserves the methods used by layers,
scene playback and voice. It delegates; new behavior belongs with its owner.

| Owner | Responsibility |
| --- | --- |
| `navigationController.js` | Navigation generation, tracking release and camera authority |
| `locationNavigation.js` | Destination lookup/selection, orbit, world jumps and globe-reset completion |
| `cockpitCoordinator.js` | Cockpit entry/rollback, readouts and the single Display portal |
| `visualSettings.js` | Effects, detection overrides, visual restoration and render-loop lifetime |
| `panelChrome.js` | Disclosure, docking, layout and Cockpit panel restoration |
| `aircraftDisplay.js` | Shared commercial/military 3D display preferences and controls |
| `layerBindings.js` | Data-manager attachment, selected-tracker adoption and camera-entry listeners |
| `displayBindings.js` | Keyboard/display subscriptions and frame-rate monitor lifetime |
| `shareRestoration.js` | Initial share/layer restoration and cancellation |
| `shellFeedback.js` | Loading feedback, notices and toast lifetime |

Owners receive named services, elements, operations and readers. They do not
receive the application shell itself. Readers resolve a replaceable collaborator
at use time; operations cross an ownership boundary without copying its state.
The facade exposes existing properties as delegates rather than duplicate state.

Views read owners through state channels (`src/app/stateChannel.js`), never
through a copy of their state:

| Channel | Snapshot | Published from |
| --- | --- | --- |
| `VisualSettings.channel` | `getVisualState()` | the shell's share sync, which every visual change ends in (restores sync once, at their end), and start-up defaults |
| `PanelChrome.channel` | `{panels: {[id]: {collapsed, autoCollapsed, pinned}}}` | the collapse-button sync that ends every collapse, layout and position change, and pin changes |
| `LayerBindings.channel` | `{layers: manager.getAll()}` of the attached manager, as plain data | the manager's `subscribe()` and `subscribeActivity()`, and manager replacement |
| session import `channel` (`geoFileImport.js`) | `{files: list()}` | every change to the import list |

A view calls `useOwnerState(channel)` (`ownerState.js`) for a read-only ref of
the frozen snapshot and calls the owner's operations to change anything.

Shutdown has two phases. First revoke input, deferred navigation, camera-entry
listeners, lookups, timers and rendering work. The shell disposes the views it
mounted (`_mountView`) before anything else, so no later publication reaches
them; each owner destroys its channel in its own teardown. Then await Context restoration,
release sensor overrides while the manager is still attached, detach layer
services and destroy scene resources. Late callbacks cannot acquire the camera.
Manager replacement also releases subscriptions and the previous Directions
module even if the replacement does not provide a Directions layer.

Source-contract tests follow both sides of delegated wiring. Lifecycle tests
exercise pending reset cancellation, stale camera callbacks, replacement and
idempotent teardown. Browser acceptance covers the composed application, including
share restoration, scene commands, navigation, Cockpit, display and voice.
