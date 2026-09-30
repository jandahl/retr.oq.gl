# next/ — internal notes

See root `CLAUDE.md` → Theme invariants → `next/`. Own WM (`app.js`, not
Redmond). Chrome is four MegaPixel grays; icons stay anti-aliased
(`image-rendering: pixelated` on them is a bug, not a style choice).
Vertical menu + right dock; miniaturize leaves a miniwindow, not a
taskbar pill. Menu items are `<a href="#">` with `a:link { cursor:
default }` set deliberately.

- Dock clock (`#dock-clock`) respects the browser's 24-hour preference —
  same detection pattern as `win98/`'s taskbar clock, see
  `win98/NOTES.md`.
- Bare-desktop (`#desktop`) right-click opens `#desktop-context-menu`:
  **Clean Up** (clears icon selection) and **Show Icons** (checkbox,
  persisted under `retr-oq:next-desktop-icons`). Native browser menu is
  suppressed on bare desktop.
- Kernel panic is an undocumented egg — don't reveal the trigger in
  comments or docs.
- Font is TeX Gyre Heros, not real Helvetica (licensing).

- **DECON label:** user-visible name is **Word Deconstructor** (menu, dock `title`, window title). Ids stay `win-decon` / `screen=decon`.
