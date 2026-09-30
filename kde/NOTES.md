# kde/ — internal notes

See root `CLAUDE.md` → Theme invariants → `kde/`. Own WM (Plastik +
Kicker). Compiz lives in `compositor.js`: spring-mesh on `#compositor` for
a fine pointer, CSS-transform fallback for coarse/iOS/reduced-motion (
`html2canvas` blanks in that fallback path — don't rely on it there).
DejaVu Sans from `vendor/kde/fonts/`. No KDE "K" logo anywhere (trademark).

- Kicker clock (`#kicker-clock`) uses `toLocaleTimeString` with an
  explicit `hour12` now, derived from
  `Intl.DateTimeFormat().resolvedOptions().hour12` and defaulting to
  24-hour — leaving `hour12` unset previously silently fell back to the
  locale default (12-hour for en-US) regardless of the visitor's actual OS
  setting. Don't drop the explicit option back out.
- Bare-desktop (`#desktop`) right-click opens `#desktop-context-menu`:
  **Refresh Desktop** (icon flash) and **Show Desktop Icons** (persisted
  under `retr-oq:kde-desktop-icons`). Native browser menu is suppressed on
  bare desktop.
- Compiz rain and the desktop cube are real, discoverable features (not
  eggs) — `#pager-cube` etc.

- **DECON label:** user-visible name is **Word Deconstructor** (desktop icon, titlebar, K-menu, panel tooltip/aria). Ids stay `win-decon` / `screen=decon`; Konsole still accepts the `decon` command.
