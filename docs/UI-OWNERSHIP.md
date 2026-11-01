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
| appearance `channel` (`appearance.js`) | `{appearance, cyber}` | `set()` with a new value, and Cyber turning on or off; the entry module applies the stored value to the root before the shell renders, outside share links, scenes and visual settings |
| status readout `channel` (`statusReadout.js`) | `{coordinates, utc}` | its sampler, only when the camera's formatted position or the UTC minute changes |
| Contacts panel channel (`layers/awareness`, `subscribePanelView`) | `{kind, revision, …}`: standby, or the subject, its caption window, navigation and cohort rows | the panel funnels (`renderResults`, `hidePanel`, `clearPanel`), only when the content signature changes |
| Missions channel (`layers/launches`, `subscribeMissionPanelView`) | `{roster, detail, replay}` | roster refreshes, mission panel renders, replay control changes, and telemetry only when its readout changes |

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
so navigation, lookup and the phone sheet all receive the same input. While the
shell is in use, the header holds `styleManager._locationViews.search.element`
and `.results.element` (see Shell chrome), with no remount or second input. If a host
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

The Import view also owns `#tools-scene-import`, borrowed after the cards as a
footer on desktop and phone. Its original scene-import button and handler stay
live during borrowing and are removed on teardown.

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

Inspect's shown tab belongs to `ContextControls`, separately from its Context
mode and restore snapshot. Cameras hides the mode views without staging layers,
changing detection or releasing the Context session. A mode tab keeps its existing
enter/exit operation. The drawer's reveal callback selects the matching tab before
scrolling; panel share restore follows the same path. CCTV and Street Level keep
their panel ids and collapse preferences inside `context-cameras-view`; desktop
and phone hosts borrow the same nodes and restore their borrowed state.

`CctvControls` mounts `CctvPanelView` in the existing `cctv-controls-body`; `StreetLevelControls` mounts `StreetLevelPanelView` in `sl-body`. Their single layer subscriptions and operations remain the owners. The shell keeps panel chrome, collapse/layout and the grid-loading chip. Controls collect their own child nodes after synchronous mount; the shell does not cache those children.

Camera calibration text, captured base pose/camera identity, search filter, advanced disclosure and typed summary belong to CctvControls. Native number inputs report intent; a detached editor cannot finish another draft. The two provenance badges render owner-supplied labels and machine states. The existing frame preloader and shared video surface retain stable media nodes, request tokens, retained-frame behavior and decoder ownership; Vue never writes their media state or recreates a decoder.

Street Level's Since index/focus/preview belong to StreetLevelControls; filter/provider selection and imagery state stay with the layer. The viewer owner retains the stable `sl-viewer` child host across prop updates. Closing an image first returns focus to the header status control and exits expansion, then synchronous view paint hides the wrap. Fullscreen/popover, persisted fit/fill, observer-driven resizing and panel-hiding modes retain their existing lifetime. Destruction releases listeners/subscriptions, detaches the media host and disposes each view before late work can paint.

## Contacts and Space missions content

The Contacts layer publishes what `#military-awareness-panel` shows; `mountContactsPanel` mounts `ContactsPanelView` into it and reports navigation and target choices back as user operations. A new revision means new content and closes any open Named areas list, as replacing the markup did. The layer captures keyboard focus by control identity before it publishes and restores it after the synchronous paint, continuing to the note when that control left. The selected contact's name and source close the panel; Cockpit entry, the nearby-site search and TR-3B reclassification follow in the template, in that order, with their existing owners.

The Space Missions layer publishes the roster, the selected mission and its replay controls. `mountMissionPanels` mounts `MissionRosterView` into `#space-mission-roster` and `MissionDetailView` as `#space-mission-panel` after it. The layer keeps selection, replay, telemetry cadence and pointer/keyboard preview ownership; the views report row pointer, focus and blur, and the speed input reports its native value. Each roster refresh renders new rows, so focus returns to the same mission by launch id, or past the list when it left. Both views render names and mission text as text.

### First run and feedback

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
accepts `controls`, `summary`, `expanded`, and chip/list-item ID callbacks. The
Layers route-planning link opens the portable Tools card.
Tools borrows the same `#directions-controls-body` root through drawer element
hosting. LayerPanel follows the active drawer or phone channel: the route link opens
Tools without a PanelChrome/share-panel change. The hosted Layers panel hides the section at home.
The Tools card names Directions and projects the same enabled, busy and blocked
state into its switch, which calls the existing LayerPanel toggle action.
Opening details focuses the borrowed section after synchronous drawer painting.
LayerPanel re-reads each current descriptor and dispatches existing owner params
with user origin. The view adds no request, pointer owner, application state,
clock or listener to the layer. It scrolls current steps after Vue's paint and
cancels pending scroll/action callbacks on disposal. Existing chip/list hooks
and their explicit hidden state remain on the native nodes. The view removes its
borrowed root on unmount; the drawer discards that root's obsolete placeholder
instead of reconnecting a disposed view.

## Shell chrome

`shellChrome.js` places today's chrome in the shell's header, map controls and
status bar (`ShellHeader.vue`, `ShellMapControls.vue`, `ShellStatusBar.vue`)
while the drawer's channel says the shell is `active`, and returns every node
to a placeholder at its home while it rests (phones, Cockpit). Nodes move with
their ids, listeners and owners; nothing is cloned or re-mounted:

| Node | Shell place |
| --- | --- |
| `#title-bar` | header wordmark |
| The location views' SearchField and SearchResults roots | header search |
| `#location-bar` (pin, POIs, city pills, mini status) | header places disclosure; on desktop the dock has no Location tray |
| `#top-center-actions` (Clear selected layers, Share view) | header actions |
| `#north-up-view`, `#tilt-map-view`, `#reset-globe-view` | map controls (the design's zoom buttons are not added) |
| `#cesium-credits` | status bar |

Code that reads these nodes' placement must not assume home: the tray opens
for search only where the field is in it, the tray's Escape leaves the header
field alone, and the voice dock reorders `#location-bar` only while it is in
the dock. Tools hosts `#geo-import-group` and `#draw-group` through the
drawer's `elements`.


## Settings sections

`SettingsView.vue` presents Providers, Voice and Language & help through the
navigation-only `settingsSurface` adapter. The provider initializer connects
asynchronously; unsupported hosts show the local-configuration guidance.
`keySetup.host()` leases the existing form and description into the destination,
then restores their homes and dialog semantics when it leaves. The original
password inputs stay native and uncontrolled across tabs, folding, borrowing and
return. Keys never enter the navigation channel. Provider status, managed-key
rules, OAuth, saving, cancellation and clearing after a successful save remain
with keySetup. Its embedded lease disables its dialog keyboard trap; the drawer
owns Escape and focus return. It never clones fields or adds a save operation.

The first three provider cards are Cesium ion, Google Maps and OpenAI. Additional
cards stay mounted behind a disclosure. The provider links follow their fields
in keyboard order. Voice invokes the existing settings action without starting
a session. Language & help borrows the existing picker, closing its menu through
its owner before returning it, and uses the existing appearance owner.

## Phone destinations

`mobileShell.js` owns the current phone sheet, More destination, borrowed panel
preferences and restoration. `PhoneShellView.vue` paints the four tabs and one
sheet through `phoneChrome.js`; the body attribute projects owner state. The
adapter moves the existing destination nodes to its empty native host with
comment homes, restoring them before desktop chrome resumes or views unmount.
The empty `mobile-sheet-panel-actions` slot carries the retained panel collapse
buttons outside Cyber. The adapter returns those same buttons home on close,
theme or host changes and disposal; PanelChrome keeps their listeners and state.
Search, media, appearance, import/draw and panel owners retain their original
controls and operations. Explicit panel reveals select the matching sheet; only
a manual Inspect tab entry performs the tracked-aircraft Contacts transition.
Settings reuses `SettingsView` and the shared provider and language leases,
releasing them before desktop chrome resumes. Panel-history restores replace
the borrowed preferences and reveal their first expanded destination.
Directions follows the active desktop or phone navigation channel. Its Layers
link launches the one Tools view, whose layer switch and route actions remain
owned by LayerPanel and the Directions layer. Playback preview keeps the More
route to Stories available even while recording hides the rest of the chrome.

## Published embedding hosts

The published UI entries also accept native host elements without the application shell. Their compatibility painters read the same controller or layer projection and send intent through its existing operations; they do not own a second copy of playback, selection, calibration, query or project state. Generated parameter rows keep the caller's uniform read/write callbacks. Native listeners, subscriptions and timers are released by the public controller's existing disposal method.

Contacts and Missions use a rendering lease when the shell mounts their Vue views. Claiming it removes the native fallback; releasing it restores native presentation without publishing a state change. The Cockpit coordinator supplies `externalViews: true` while it hosts the controller's projected views; direct `CockpitViewController` construction binds and paints existing native markup by default. The published stylesheet conceals the old panel rails only in a document containing the application rail.

## Selected aircraft

`AircraftCard.vue` renders the existing tracked Flights/Military descriptor or the selected Local ADS-B receiver record in the shared selection slot. `aircraftSlot.js` adapts explicit selection events and feed-driven tracked-readout presentation notifications, with a five-second age clock only while mounted. It adds no frame listener, roster, data lookup or layer intent. Programmatic tracking never claims the slot; explicit selections and share/reload restores can. Measurements use the shared localized unit labels. A newer camera item withdraws the card until a fresh aircraft selection; close calls the existing identity-guarded stop-tracking or receiver deselection operation. The world readout is unchanged.
