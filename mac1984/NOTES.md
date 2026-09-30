# mac1984/ — internal notes

See root `CLAUDE.md` → Theme invariants → `mac1984/` (System 1.0 look via
vendored `system.css`, own WM — don't share with `mac8/` or Redmond).

- No `#desktop` element like the other own-WM themes (`mac8/`, `next/`,
  `kde/`) — the whole `<body>` is the desktop. Right-click capture is on
  `document.body`, with an escape hatch for `.window-pane` content so
  scrollable window bodies keep their native menu.
- Menu bar items are almost all placeholders (`href="#"`, real
  `preventDefault()` + `closeMenu()` only) — see the comment above the
  link-click loop in `app.js`. Wired Special items: **Shut Down**
  (`#mac1984-shutdown` → `../`) and **Restart** (`#mac1984-restart` →
  `location.reload()` so the boot sequence runs again). Any other menu
  item you wire up for real should follow the same pattern (give it an
  id, special-case it in that loop) rather than genericizing the
  placeholder handler.
- Windows (`.desktop-window`) use `.title-bar`/`.inactive-title-bar` class
  swapping as the entire activation mechanism — there's no separate
  "active window" state to keep in sync elsewhere.

- **Word Parts** is the real DECON window behind the desktop icon (shared `decon-app.js` + `OqRouter` `?screen=decon`). Visible name is **Word Parts** (pairs with Word Builder; short for a 1-bit icon) — **not** “Deconstructor”, which is not a valid 1984 Mac app label. Ids stay `win-decon` / `screen=decon` / `#deconstructor-icon`.
