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

## Location views

`NavigationController.locationField` owns the unfinished query, expansion, busy
state and announced error. Input and submit events commit their native value to
that owner; submit then calls `LocationSearch.run()`. Typing never starts a lookup.
`LocationSearch` still owns cancellation, request identity and provider outcomes;
`LocationNavigation` still owns selection, orbit and camera handoff.

`locationViews/SearchField.vue` and `SearchResults.vue` are independent,
stateless mounts. The shell mounts them before collecting element references,
so navigation, lookup and the phone sheet all receive the same input. The header
can move `styleManager._locationViews.search.element` and `.results.element`
to separate containers without remounting or adding another input. If a host
replaces the mounts instead, it must also rebind the owners' input references
and dispose the old mounts; do not leave a hidden legacy copy.

`LocationControls` connects owner snapshots and actions to the views with
synchronous `mountView.update()` calls. City/POI highlighting, field updates,
error announcements and mini-status remain readable in the same turn. It owns
the pill mounts, document shortcuts and pending expansion frame; destroying it
revokes callbacks and removes those mounts. The shell owns and disposes the
search, results, mini-status and pin mounts before destroying the owners.
The result's Fly to action reruns the existing lookup with its retained query;
it does not bypass authority checks or navigate to raw provider data.

## Import and Draw views

The existing `#geo-import-group` and `#draw-group` containers can move intact
into Tools. Their owners mount and dispose the views, so moving a container
does not recreate a file list, annotation engine, pointer lease or drop listener.

The session import channel now publishes `{files, hint}`. Each file includes
its existing identity/count/visibility fields plus the owner's fixed `color`
and `ownStyles` flag. The rows render that snapshot; show/hide, fly-to and remove
still call the import handle's operations. Format names are standard identifiers.
The scene shortcut activates the existing scene-import control and its file flow.
File bytes remain in the existing session-only loader; there is no new upload.

Draw owns label, colour, shape, activity and hint in its `channel`. `setLabel`,
`setColor` and `setShape` change that state. Map clicks, Enter/double-click,
Backspace undo, Escape and Clear board still use the same drawing session,
pointer claim and annotation engine. A view never constructs map geometry.
Both views paint channel updates synchronously through `mountView.update()`,
so import focus restoration and drawing-control reads need no deferred DOM wait.
