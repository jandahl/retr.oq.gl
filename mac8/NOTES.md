# mac8/ — internal notes

See root `CLAUDE.md` → Theme invariants → `mac1984/`/`mac8/`. Own WM, not
shared with `mac1984/` or Redmond, built on vendored `classic.css`. Growbox
resize only (no edge-resize); zoom toggles the prior rect, it isn't a real
maximize.

- Menu-bar clock (`#menu-clock`) respects the browser's 24-hour
  preference — same detection pattern as `win98/`'s taskbar clock, see
  `win98/NOTES.md`.
- Bare-desktop (`#desktop`) right-click / Control-click opens
  `#desktop-context-menu`: **Clean Up Desktop** (clears icon selection) and
  **Show Desktop Icons** (toggles `.icons-hidden`, persisted under
  `retr-oq:mac8-desktop-icons`). Native browser menu is suppressed on bare
  desktop.
- Analog Clock app (`#win-clock`, `drawClock()`) is a separate thing from
  the menu-bar digital clock above — it draws hour/minute hands via
  `now.getHours() % 12`, which is correct as-is (an analog face has no
  12/24-hour text mode to respect).
- Undocumented teddy-bear About credits live here.

- **Boot** is passive auto-boot (no `#power-btn`). The smiling-Mac sequence
  shows immediately; an optional startup chime plays on the first
  pointer/key gesture so AudioContext can unlock under autoplay policy.


- **DECON label:** user-visible name is **Deconstructor** (desktop icon + titlebar) — not “Word Deconstructor”. Ids stay `win-decon` / `screen=decon`.

- **Special → Restart** (`#menu-restart`) reloads the theme; Shut Down still goes through `#shutdown-overlay` → `../`.
