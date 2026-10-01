# win31/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win31/`. Redmond WM shared with
`win98/`/`xp/`/`win7/` via `shared/redmond/window-manager.js` — Program
Manager is the shell here, closing it is Exit Windows (→ `../`). No Start
menu, no taskbar, no title-bar close button — minimize is an icon on the
teal desktop, close lives only in the Control-menu (double-click the box).

- Desktop right-click is suppressed for the bare desktop background by
  `initWindowManager()` itself (`shared/redmond/window-manager.js`), same
  as every other Redmond theme — no theme-specific code needed for that
  here.
- Font is reused from `vendor/win98/fonts/`, not its own vendor dir.
- Solitaire is a joke entry (not a real game) and there are hidden
  credits — undocumented beyond this pointer.
- Don't add a title-bar close "for touch" — see `CLAUDE.md`, this is a
  deliberate period-accurate omission, not a bug.
- Idle screen saver stays Flying Windows (`vendor/screensavers/flying-windows/`, MIT; Greenland flag, not a Windows logo), 45s. Accessories also has Mystify, Starfield, Marquee (`oq!` in Times New Roman fuchsia), Beziers (Win 3.1-style canvas remakes) and Flying Toasters (gag geometry, not After Dark art).

- **OQ!/DECON chrome:** one **MDI** frame (`#win-oq`, title OQ!). Dictionary and Word Deconstructor are MDI children (`#mdi-oq` / `#mdi-decon`) inside the client area — not two unrelated Program Manager apps. Window menu Cascade/Tile arranges children. Program Manager: **one** OQ! icon only (opens `#win-oq`; both children available inside). Deep link `?screen=oq` / `?screen=decon` focuses the matching child. Ids `screen=decon` unchanged for OS/2 guest iframes.

- **DECON label:** user-visible name is **Word Deconstructor** (MDI child title + Window menu; not a second ProgMan icon). Ids stay `win-decon` / `screen=decon`. Also the guest iframe target for OQ!2’s Word Deconstructor.

- **Chrome metrics (fine pointer):** `SM_CYCAPTION` / `SM_CYMENU` ≈ **18px**. Caption buttons are 16×14 with ~2px vertical inset in the title bar. Menu-bar labels use `box-sizing: border-box` + fixed `height: 18px` (not only `min-height`) so padding + font line-box cannot grow the strip past the caption; `.menubar` has no bottom margin — the menu sits flush under the caption. Touch enlargements stay behind `@media (pointer: coarse)` only.

- **Control-menu box:** gray **face** field forced as literal `#c0c0c0` (+ `background-color`, `appearance: none`) so UA button styles / stale CDN CSS cannot leave a white field; **1px black** outline (no `box-shadow` bevel — min/max keep `--bevel-out`). Centered **white** horizontal dash with black outline (`#ffffff` / `#000000`). **Larger** on top-level `.win-sysmenu` (16×14 with the 18px caption); **smaller** on shorter MDI child captions (`.mdi-child .title-bar` / `.mdi-title-bar` ≈ 15px; `.mdi-child .mdi-sysmenu` / `.mdi-sysmenu` / `.mdi-child .win-sysmenu` 10×10; MDI min/max 12×11).

- **Maximize / Restore:** era-correct — maximize is the up-triangle;
  when `.maximized`, the caption button becomes overlapping squares
  (restore) via CSS, and the shared WM sets `aria-label="Restore"`.
  Maximized top-level windows strip outer bevel/border/padding so the
  client is flush with the teal desktop. MDI children use the same
  restore glyph under `.mdi-maximized`.
