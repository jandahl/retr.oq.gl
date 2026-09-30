# win7/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win98/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. 7.css ships no fonts (don't go
looking for a `vendor/win7/fonts/`). Minimize/restore animation style is
explicitly "genie" here (scale+fade toward the taskbar button) — see the
`animation` option passed to `initWindowManager()` — unlike the rest of
the lineage's default "outline" style.

- Taskbar clock (`#taskbar-clock`) respects the browser's 24-hour
  preference the same way `win98/`'s does — see `win98/NOTES.md`.
- Bare-desktop right-click opens `#desktop-context-menu`: **Refresh**
  (icon flash) and **Show desktop icons** (checkbox, persisted under
  `retr-oq:win7-desktop-icons`). No Properties / Display Properties panel
  yet (unlike `win98/` / `win95/`).
- Shut Down → `../`, same reference pattern as `win98/`.
- 3D Pipes remake (`vendor/screensavers/pipes/`, MIT) on idle (45s) and Start → 3D Pipes.

- **OQ!/DECON chrome:** one main window + **7.css Aero Tab control**
  (`menu[role=tablist] > button` + `[role=tabpanel]`). One desktop icon,
  one Start menu entry (`OQ!`), one taskbar button. `?screen=decon` focuses
  the Deconstructor tab. Title bar stays **OQ!**. No second desktop/Start
  target; ids `win-decon` / `screen=decon` remain for the router.

- **DECON label:** user-visible name is **Word Deconstructor** (tab label
  inside the OQ! shell). Ids stay `win-decon` / `screen=decon`.
