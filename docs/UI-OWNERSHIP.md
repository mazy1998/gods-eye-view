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

The Layers footer reads `ContextControls.clearChannel` (`{busy}`), published
synchronously at the existing clear transaction's `setClearBusy()` boundaries.
Toolbar, footer and voice still use that owner's single clear promise. Busy
presentation stays focusable; no view starts its own clear transaction or loop.

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

## Observed timeline drafts

`createRailTimelineState` owns the observed-history slider draft, the tick mapping
held during a drag, and its existing 150 ms commit timer. Its channel publishes
plain, frozen presentation state. Native and Vue timeline views read that state;
only input/change events pass a native value into the owner. Blur, cancellation,
transport actions and destruction use owner state without reading a slider.

`createWeatherPanel` remains the single Environment readout owner/factory inside
`weather-panel-body`. It maps existing layer descriptors and the shared observed
clock into synchronous Vue props. Forecast and advisory content stays separate
from the observed timeline. Its range drafts are presentation state keyed by card
and setting; existing layer owners still own model, units, field and opacity.
Changed bounds, disabled controls, removed cards and disposal invalidate drafts.
The factory keeps collapse preferences, open-card choice, scroll placement and
its existing subscriptions; the views only paint and dispatch those operations.

## Recent imagery view

The existing imagery layer owns AOI, sources, candidates, preview, A/B pins,
mode, opacity, divider position and map-stack restoration. `recentImagery.js`
retains keyboard/pointer routing, scroll measurements, disclosure and export
progress. `RecentImageryView.vue` renders the layer snapshot plus that local
presentation state; `recentImageryPresentation.js` only formats it.

The readout remains mounted in `#recent-imagery-panel-body` through the existing
factory and disposal path. Synchronous `mountView.update()` keeps focus and
visible-card measurements in the same turn. The shared `imagerySplit` still
owns the map-wide divider outside the panel; the view does not create another
imagery layer, thumbnail loader, map lease or download service.

## Cameras and Street Level content

`CctvControls` mounts `CctvPanelView` in the existing `cctv-controls-body`; `StreetLevelControls` mounts `StreetLevelPanelView` in `sl-body`. Their single layer subscriptions and operations remain the owners. The shell keeps panel chrome, collapse/layout and the grid-loading chip. Controls collect their own child nodes after synchronous mount; the shell does not cache those children.

Camera calibration text, captured base pose/camera identity, search filter, advanced disclosure and typed summary belong to CctvControls. Native number inputs report intent; a detached editor cannot finish another draft. The two provenance badges render owner-supplied labels and machine states. The existing frame preloader and shared video surface retain stable media nodes, request tokens, retained-frame behavior and decoder ownership; Vue never writes their media state or recreates a decoder.

Street Level's Since index/focus/preview belong to StreetLevelControls; filter/provider selection and imagery state stay with the layer. The viewer owner retains the stable `sl-viewer` child host across prop updates. Closing an image first returns focus to the header status control and exits expansion, then synchronous view paint hides the wrap. Fullscreen/popover, persisted fit/fill, observer-driven resizing and panel-hiding modes retain their existing lifetime. Destruction releases listeners/subscriptions, detaches the media host and disposes each view before late work can paint.

### First run and feedback (S22)

`firstRunExperience` retains show policy, missions, suppression/session writes,
keyboard arbitration, busy/sticky status and teardown. `FirstRunContent.vue`
only paints its props in the existing launcher. Owner updates are synchronous,
so focus and scroll measurements see the updated nodes before returning.
`ShellFeedback` retains notice arbitration, delayed reveal/dwell, traffic polling
and toast timers. `FeedbackContent.vue` owns the split-flap spans and releases
the animation on unmount; `LiteralText.vue` never interprets messages as HTML.
`startupFeedback` holds the startup message/error and accepts the existing
scene/controls write-only `textContent` input as an owner setter, not a DOM node.

Cesium still owns its required credit list, provider markup, links and lightbox
show/hide. `CreditsHost.vue` supplies only its existing container, and
`creditText` mounts our two localized control labels without replacing controls
or their listeners. No provider HTML is copied or reinterpreted. The existing
credit keyboard adapter still owns activation and focus restoration.

Cesium replaces its lightbox `className` for mobile/desktop layout. Our credit
appearance uses `data-gev-credit-surface`, which survives that operation; it
never observes or rewrites Cesium's class list. The startup cover is already a
surface and gets no nested card. Fatal startup text uses `--gev-error-text`:
appearance danger text normally, the unchanged legacy `#ff4444` under Cyber.

## Stories and authoring drafts

SceneControls owns Browse/Create, inline rename drafts and the panel/runtime views.
Director still owns the project, selection, playback clock and cancellation.
Progress/status notifications preserve the recipe and shot nodes; a changed shot
list releases its old row callbacks. The existing runtime overlay keeps Stop
reachable independently of the panel. Teardown removes both views and Escape.

The sharing owner retains staged imports, details and selected-file drafts.
Native input events update drafts; every commit also adopts the current native
values so programmatic edits without input events keep working. Vue paints plain
text and native file controls. Preview, expected-project validation, explicit
asset selection, abort signals and session-only bundle bytes stay with sharing.

## Voice reply card

`VoiceCardControls` owns the provider-neutral reducer, presentation gates,
announcement consumption, Notes & Sources disclosure and idle timer. Its own
state channel publishes immutable presentation snapshots. `createVoiceControl`
connects that channel to `VoiceCardView` through synchronous `mountView.update`;
the dock channel never copies transcript or result state. The card section,
dismiss control, live region and details node retain identity across updates.
The owner keeps native dismiss/disclosure listeners and the idle interaction
check; Vue alone paints the card. Session cleanup disconnects the card channel
before the parent dock is disposed. No provider text becomes HTML or links.

Injected voice controls without `connectCard` use the isolated native
`cardCompat` subscriber over their existing markup. The same card owner supplies
its snapshot and disposes the subscription; the default Vue control never uses
that painter. Provider strings remain text and interactive host nodes stay intact.

## Directions content

The Directions layer already owns mode, A/B placement, routing, selected steps
and cinematic flight. No DOM draft extraction is needed. Its existing descriptor
and row notification feed the single LayerPanel subscription. `DirectionsView`
accepts `controls`, `summary`, `expanded`, and chip/list-item ID callbacks; it can
be mounted independently through `mountView` when Tools hosts it. The Transport
row currently supplies those props and keeps the shared layer visibility switch.
LayerPanel re-reads each current descriptor and dispatches existing owner params
with user origin. The view adds no request, pointer owner, application state,
clock or listener to the layer. It scrolls current steps after Vue's paint and
cancels pending scroll/action callbacks on disposal. Existing chip/list hooks
and their explicit hidden state remain on the native nodes.
