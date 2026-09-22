# win95/ — internal notes

This is a Windows 95 scaffold derived from the Win98 shell. The default
desktop remains ordinary Windows 95; the optional Welcome Desk opens an
original sled-dog guide with a small animated CSS prototype. Replace the
prototype with an original sprite sheet when the art pass begins; do not copy
Microsoft BOB artwork or animation frames.

See root `CLAUDE.md` → Theme invariants → `win95/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. 98.css dist build vendored,
not the SCSS source. Greenlandic flag, not a Windows logo.

- **Shut Down**: Start menu → Shut Down opens `#shutdown-overlay`; its OK
  button navigates to `../`. This is the reference implementation the
  other Redmond themes' Shut Down and `mac1984`'s Shut Down menu item both
  copy the comment/pattern from — keep them in sync if this one changes.
- **Desktop right-click menu**: the *only* deliberately hidden feature in
  this theme — right-clicking bare desktop (not an icon) opens a real
  context menu whose Properties item is the sole path to the color-scheme
  picker (`app.js` ~line 118 onward, `#desktop-context-menu`). The native
  browser context menu itself is now suppressed for every Redmond theme
  by `initWindowManager()` in `shared/redmond/window-manager.js`; this
  theme's own listener runs alongside that and additionally opens the
  real menu.
- Taskbar clock (`#taskbar-clock`) now respects
  `Intl.DateTimeFormat().resolvedOptions().hour12` and falls back to
  24-hour when the browser doesn't expose a preference — don't reintroduce
  a hardcoded 12-hour AM/PM format.
- Hot Dog Stand scheme is a real, selectable Display Properties option,
  not an egg.
- Screen saver idle (45s) is Aquarium (`vendor/screensavers/aquarium/`, MIT,
  original Plus!-style remake). Start → Screen Savers flyout lists Aquarium,
  3D Pipes, 3D Maze, Backrooms (same host injects the flyout on xp/win7).

- **OQ!/DECON chrome:** one main window + **98.css property-sheet tabs**
  (`menu[role=tablist]` overlapping raised tabs on a `.window[role=tabpanel]`
  client — Dictionary ↔ Word Deconstructor). One desktop icon, one Start
  menu entry (`OQ!`), one taskbar button. Deep link `?screen=decon` opens
  the same shell focused on the Deconstructor tab. Title bar stays **OQ!**.
  Internal id `win-decon` / `screen=decon` may remain for the router; there
  is no second desktop/Start target.

- **DECON label:** user-visible name is **Word Deconstructor** (tab label
  inside the OQ! shell). Ids stay `win-decon` / `screen=decon`.
