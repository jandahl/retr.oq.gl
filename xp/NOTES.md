# xp/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win98/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. XP.css dist build vendored.

- Taskbar clock (`#taskbar-clock`) respects the browser's 24-hour
  preference the same way `win98/`'s does — see `win98/NOTES.md` for the
  detection detail, don't hardcode 12-hour AM/PM here again.
- Bare-desktop right-click opens `#desktop-context-menu` layered on the
  shared WM suppress: **Refresh** (icon flash) and **Show desktop icons**
  (persisted under `retr-oq:xp-desktop-icons`). No Properties / Display
  Properties panel yet (unlike `win98/` / `win95/`).
- Shut Down → `../`, same reference pattern as `win98/`.
- 3D Pipes remake (`vendor/screensavers/pipes/`, MIT) on idle (45s) and Start → Screen Savers → 3D Pipes.
- Backrooms II (`vendor/screensavers/backrooms-ii/`) on Start → Screen Savers. Original OpenGL showroom drift; not maze-backrooms.

- **OQ!/DECON chrome:** one main window + **XP.css Luna Tab control**
  (`menu[role=tablist] > button` + `[role=tabpanel]`). One desktop icon,
  one Start menu entry (`OQ!`), one taskbar button. `?screen=decon` focuses
  the Deconstructor tab. Title bar stays **OQ!**. No second desktop/Start
  target; ids `win-decon` / `screen=decon` remain for the router.

- **DECON label:** user-visible name is **Word Deconstructor** (tab label
  inside the OQ! shell). Ids stay `win-decon` / `screen=decon`.

- **Maximize / Restore:** shared WM toggles `.maximized` and sets the
  caption button `aria-label` to `Restore` (XP.css Luna overlapping
  squares) or `Maximize`. Maximized windows drop Luna’s blue inset frame,
  top corner radii, and padding so the client is flush with the work
  area; restore brings the frame back.
