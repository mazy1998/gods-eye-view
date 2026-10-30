# Cyber geometry audit

Run the geometry audit alongside the palette audit before changing a ported
panel's layout:

```sh
node scripts/qa-cyber-geometry.mjs --out qa-artifacts/cyber-geometry/report.json
node scripts/qa-cyber-geometry.mjs --revision HEAD --out /tmp/geometry.json
```

The default compares working-tree styles against the original Cyber styles at
`f2c6ff08`. `--revision` reads another commit without checking it out; `--baseline`
selects a different reference. `--repo` chooses the repository. An output artifact
is required. Exit codes are 0 for pass, 1 for geometry differences, and 2 for
invalid inputs or infrastructure errors. Entry through a symlink is supported.

No server, build, providers, credentials or app scripts are needed. Chromium loads
all first-level `style.css` imports at both revisions against the same hosted
contract fixtures, built from the selected revision’s panel templates. The
real panel root classes, header ancestry, Tools body wrapper and card order are
retained. Layers mounts its own browser section inside the list; the icon finder
profile uses the wrapper present in that revision’s view. Network requests, transitions and animations are disabled.
A fixed viewport, deterministic text and local fallback fonts remove feed and
remote-font timing. The fixtures cover the Layers frame and finder, Stories
frame and transport controls, Import/Draw cards and inputs, and the voice frame,
status, microphone and orbit. Each measured node has a unique `data-geometry`.

The shell visibility fixture retains the real style-readout and corner-row
templates, with the rail visible and the HUD off. It compares presence and
display mode for the readout, language chip and rail circle; shell frame
dimensions still need mounted-app checks. A local display rule models the icon
font without a network request. The circle's visible block-to-flex change has
an exact centring exception; hiding the readout or language chip always fails.

The report retains both snapshots, mismatches and allowed differences. It checks
visibility, display/position modes, backdrop blur, border widths, radius, padding,
box dimensions and offsets relative to the parent. Header/title/divider and
collapse boxes are included. Numeric geometry allows 1 CSS pixel of rounding by
default; `--tolerance` accepts 0–2 pixels. Visibility (including hidden visibility and zero opacity) and string properties
always compare exactly.

The fixture's host normalizes placement because the original app has no drawer;
it does not normalize the panel's inner frame or header. This is a CSS contract
audit, not a mounted-app or viewport-responsive interaction test. Continue to run
feature browser harnesses and hosted-panel checks for actual content, scrolling,
sibling-panel pressure, focus and phone behavior. Representative control content still needs updating when its view changes;
the template-derived host ancestry alone does not prove full mounted-view parity.
A structural unit test covers the measured ancestor chains. For an original-
revision self-comparison, current fixture templates provide context for both
identical stylesheets because the original revision predates the Vue views.

Existing port differences are explicit tuples in
`qa-cyber-geometry-fixtures.mjs`: fixture, node, property, original value and
expected value, each with a reason. Numeric values use the same rounding tolerance.
They pin the added finder, existing scene surface insets and padded tool cards.
Finder exceptions are separated by the actual plain/icon-wrapper structure; a
value accepted in one profile cannot exempt a change in the other.
They do not exempt the Layers/Stories frame padding, title visibility or collapse
control geometry. No wildcard exemption exists. New exceptions require an
intentional layout reason and exact expected values; do not copy an unexplained
failure into the allowlist. A mismatch at a different node, property or value
still fails. Visible display-mode changes, such as block to grid, can have exact
reasoned exceptions. Changes to or from `display: none`, or to visibility/opacity
hiding, cannot be exempted; validation and matching both enforce this boundary.

Stories uses its shared art-card, playlist-summary and transport order. The
fixture fills the library with six cards to exercise its height cap. Exact
structure differences reference the same reason manifest as the palette audit;
frame padding, header/title/divider and collapse geometry remain strict. Offline
icon ligatures are normalized within Stories to avoid text wrapping when remote
fonts are blocked; both compared snapshots use the same normalization.

The fixtures intentionally keep stable representative content so frame changes
are easy to diagnose. A frame's natural height can differ when newly added
controls consume space; such content-height exceptions are exact, while padding,
header visibility and control placement remain separately checked.

Map & Look renders inside the real Display panel. Its tabs, seven style tiles,
five map-source tiles, image adjustments and footer are exact structure
differences that reference `qa-cyber-map-look-structure.json`, the palette
audit's reason manifest. The Display frame's header, title, divider and collapse
geometry remain strict.

Inspect has no geometry fixture because its restyle leaves Cyber's frame,
header, divider and control geometry alone: every drawer layout rule in
`inspect.css` excludes Cyber. The structural changes Cyber shares with the
other appearances (content order, labels, the selected contact) are listed with
their reasons in `qa-cyber-inspect-structure.json`, which the palette audit's
Inspect fixture carries.

Cockpit has no geometry fixture either: `cockpit-views.css` sets only colours
and panel material, outside Cyber, and Cockpit's layout stays in
`cockpit.css` for every theme.

Tools fixtures follow the destination element list: the shell hosts Import and
Draw as direct children of the legacy host, outside the hidden Map panel.
Historical revisions without that placement retain a separate home-layout
profile. Their numeric expectations cannot exempt changes in the drawer profile.
The ancestry test checks both the direct-child chain and destination order.

Settings derives its hosted form and provider headers from the application
templates, at the drawer's 356px form width. This profile compares frame insets,
borders and visibility, then explicitly checks 8px status pills, the existing
11.2px provider names and single-line header text. Added metadata changes natural
content height, so this profile does not compare that height to the old dialog.
The fixture's `expectedGeometry` checks supplement the baseline comparison:
new controls must not silently fall back to the same unstyled body font in both
snapshots. These checks have no exception path and leave the other profiles'
geometry comparisons unchanged.
