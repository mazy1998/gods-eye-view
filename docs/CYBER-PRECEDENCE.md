# Cyber precedence checks

New surface palettes must not override Cyber's state colours. Keep layout rules
unscoped, and wrap palette overrides in
`:where(:root:not([data-ui-theme='cyber'])) …`. Every selector in a comma-separated
rule needs the condition. `tokens.test.mjs` checks every `PORTED` stylesheet for
colour-bearing state rules, including custom-property assignments and
border/outline shorthands. Every alternative in a leading `:where()`/`:is()`
must exclude Cyber. Flat rules in nested media/supports queries work; qualified
palette nesting is rejected and must be flattened so inherited state cannot
escape the guard. States include hover/active/focus/checked, `.active`,
`.is-active`, `.selected`, `.current`, `.focused`, `.pinned`, and the ARIA
pressed/checked/selected/current/expanded attributes. Its only exact static
exceptions are the new switch's own track/thumb, which
have no legacy Cyber state rules and need their on/off indication, and the new
destination rail's hover, current and focus states, which have no legacy
control or Cyber rule (the browser audit pins their exact Cyber palette).

Together with S6a's Cyber token block, the rule is: legacy Cyber owns the
controls and states it styles; semantic tokens fill only the remaining new
controls and surfaces. New structural borders use the Cyber glass-border token,
not inherited text ink. Do not use the token block to override a legacy state.

Run the browser audit before handing off a port:

```sh
mise exec node@24.14.0 -- node scripts/qa-cyber-precedence.mjs
mise exec node@24.14.0 -- node scripts/qa-cyber-precedence.mjs --stylesheets primitives,location-views
mise exec node@24.14.0 -- node scripts/qa-cyber-precedence.mjs --fixture /tmp/my-port.json
```

No server or build is needed. Chromium loads the actual first-level `style.css`
imports, blocks all network requests and page scripts, disables transitions and
animations, and forces CSS states through DevTools. It compares each control with
its ported stylesheet enabled/disabled and with the same control outside its
surface classes. Rest, hover, pointer/class active, focus and applicable pressed,
checked and selected states are measured under Cyber with all three appearances.
It compares each effective border side and outline as `width style colour`, or
`none` when zero-width, none or hidden. Thus equal computed colours cannot hide a
newly visible line. It reports every paint difference, including allowed ones with their
reasons. It does not prove provider behaviour or the mounted app's layout.

Default coverage is every `PORTED` sheet except `tokens.css`, which defines the
palette rather than interactive variants. A missing fixture fails rather than
silently omitting the new sheet. The default JSON output is
`qa-artifacts/cyber-precedence/report.json`; `--out`, `--repo` and read-only
`--revision <git-ref>` are available. Exit codes: 0 pass, 1 palette mismatches,
2 invalid inputs or infrastructure failure. CLI entry works through symlinked
paths (including macOS `/tmp`); an audit run requires a matching written JSON
artifact before it can return pass or palette-failure status.

## Adding a fixture

Add a built-in sample in `scripts/qa-cyber-precedence-fixtures.mjs`, or pass a JSON
object (or array of objects) with this shape:

```json
{
  "sheet": "my-port",
  "html": "<section class='my-port gev-surface'><button class='chip' data-audit='choice' data-state-active data-state-pressed>Choice</button></section>",
  "outsideClasses": ["gev-surface", "my-port"],
  "exceptions": []
}
```

Use the real classes, IDs and ancestor contexts. Give every interactive variant a
unique `data-audit` name. `data-state-active` adds `.active` for the active sample;
`data-state-pressed`, `data-state-checked` and `data-state-selected` opt into those
ARIA states. A nested `data-probe="track"` adds a `choice/track` colour sample.
`outsideClasses` lists only the new adoption classes (default: `gev-surface`);
legacy context IDs/classes remain. Duplicate IDs between inside/outside twins
are intentional in this isolated CSS fixture.

Removing a new control's defining sheet can expose browser defaults. An explicit
exception is allowed for that case, never as a blanket file/component bypass:

```json
{
  "variant": "new-control",
  "state": "rest",
  "comparison": "sheet",
  "properties": ["backgroundColor"],
  "reason": "This new control has no legacy resting background definition."
}
```

Every field is exact; no wildcards. Exceptions must have a non-empty reason and
name an existing fixture variant. `comparison` is `sheet` or `surface`; list only
the changed computed properties. Built-in exceptions cover the intrinsic new
primitive definitions and switch track/thumb. They never exempt a button's hover
background. New structural borders have exact-value exceptions, including where
removing adoption classes removes the structure itself. These add an `expected`
object with one complete painted value per listed property (for example
`"borderTop": "1px solid rgba(206, 222, 226, 0.28)"`); a different colour, width
or style fails. New container backgrounds/elevation have separate reasoned
exceptions because there is no legacy container counterpart. The new Layers disclosure also pins its explicit resting Cyber glyph palette
when removing its defining ancestor exposes browser defaults; its hover palette
still compares without an exception. Layers row/footer/import separators have
dedicated probes with exact glass edges. Other interactive foreground/background
surface differences remain strict, and the original chip hover bug still fails
both the reusable audit and the static guard.
