# CLAUDE.md

How to work in this repo. README.md is the catalogue. This file is the
constraints that are easy to violate if you only read the code.

## Rules

- **Static HTML, no bundler** inside a theme. Vendor dist CSS + fonts +
  a LICENSE. Hosted on `http(s)` (GitHub Pages), not `file://`.
- **Cache-bust `?v=N`** independently for every file you change
  (`style.css`, `app.js`, `compositor.js`, …). Stale JS next to fresh
  HTML is a real shipped bug.
- **Load order is the dependency graph.** Classic scripts share
  `window.OqDictSource` / `OqHyphenation` / `OqRouter` / `OqCompiz`.
  ES modules are fine when there's a reason.
- **`OqRouter.navigate()` owns OQ!/DECON.** Don't call open/close from a
  new UI trigger — the URL and the UI will disagree.
- **Arrow cursor** on chrome, icons, menus, buttons, and `a` / `a:link`.
  Compass cursors on resize handles. Not `pointer`. Not period `.cur`
  files.
- **Touch:** inputs ≥ 16px (iOS zoom). `html, body { position: fixed }` —
  `overflow: hidden` alone does not stop iOS from scrolling the document
  to a focused field.
- **Pointers:** listen for move/up on `window`. Start a drag (or Compiz
  grab) only after the pointer has actually moved. Don't `await` a
  snapshot on the pointer path.
- **`zoom: 2` themes (mac1984/, mac8/, win31/'s `@media (min-width: 700px)`
  block):** `event.clientX/Y` and `getBoundingClientRect()` both already
  report post-zoom (rendered) px, but a CSS length you assign via
  `el.style.left/top` is a *pre*-zoom value that the browser multiplies
  by `zoom` again on render — set one straight from the other and the
  element lands roughly twice as far out as the click (a menu positioned
  at `event.clientX` on a `zoom: 2` desktop opened off-screen this way).
  Divide by `parseFloat(getComputedStyle(document.documentElement).zoom)
  || 1` before assigning; see mac8/app.js's zoom-box handler or its
  desktop-context-menu handler for the pattern. Only applies to lengths
  computed in JS from rect/event values — plain CSS px in a stylesheet
  is already pre-zoom and needs no adjustment.
- **Original art.** No trademarked logos. Easter eggs stay undocumented.
- **Git:** new branch from current `origin/master`. Don't stack on a
  just-merged branch. "Rebase" after a merge means that. Confirm with
  `git log origin/master..origin/<branch>`.

If you're in the App Builder workspace, the git repo is this tree and
the live preview serves a **copy** at `/workspace/public/`. Edit here,
then copy the theme across. Hub tiles live in two places: `index.html`
(GH Pages) and the Vite hub under `/workspace/src/` — touch both.

## Families

Don't mix window managers across families.

| Family | Dirs | WM |
| --- | --- | --- |
| Redmond | `win31/` `win98/` `xp/` `win7/` | `shared/redmond/window-manager.js` |
| Mac-lineage (classic) | `mac1984/` `mac8/` `amiga/` | each theme's own `app.js` — do not share |
| OS X | `aqua/` (+ future Tiger/Leopard) | `shared/osx/` — not classic Mac, not Redmond |
| Own WM | `next/` `kde/` `beos/` | each theme's own `app.js` — not Redmond |
| Text mode | `dos/` `c64/` | no overlapping windows; full-screen takeovers |
| Console | `nes/` `gb/` `snes/` `gg/` `compy/` | one screen, one `handleInput()` |
| OS/2 host | `os2/` | Workplace Shell host; Win-OS/2 and DOS guests reuse their source themes |

## `shared/`

- `dict-source.js` — Chicago fetch/cache/filter (CC-BY-SA 4.0). No local
  sort; upstream Kalaallisut collation is the order (`aa` after `a` is
  not a bug).
- `katersat-source.js` / `dict-merge.js` — Option C merge (Chicago
  primary + katersat enrichment). Runtime HTTP only; **do not vendor**
  GPL katersat JSON. See `shared/SOURCES.md`.
- `hyphenation.js` — MPL-2.0 *code* (the linguistic rules are not).
  Don't blur that in the file header.
- `router.js` — query-string router. Static hosting has no path
  rewrites, so `?screen=oq&filter=` not `/oq/`.
- `redmond/window-manager.js` — drag/resize/focus/min/max/close/taskbar
  for the Redmond family only.
- `osx/` — OS X family shell (WM, menu bar, Dock helpers) for `aqua/`
  and later OS X skins. Not for `mac1984/`/`mac8`.
- `decon-app.js` — DECON UI, reused as-is.
- `art/fox/` — MORPH! mascot source (first-gen illustrations, 128px
  hires frames). Theme-sized sprites stay in the theme dir (`gb/sprites/`
  is 16×16 DMG). SNES / NES / GG can retarget these; don't copy the GB
  sheet.

## Theme invariants

Only what the code won't tell you. Cache-bust and router apply everywhere.

**`dos/`** — Single-tasking: `#dos-dir` and `#dict-app` swap via
`hidden`. Movement snaps to character cells. `visualViewport` height
*and* `offsetTop` go into `--app-height` / `--app-top`;
`KEYBOARD_THRESHOLD_PX` (150) ignores the mobile Chrome address bar.
Don't call `launchDict()` / `exitDict()` except from the router
listener. Commands: `DICT`, `DIR`, `CLS`, `VER`, `DOSKEY`, `FORMAT`,
plus undocumented `DOOM`. `BUILD`/`DECON` in `DIR` are placeholders.

**`c64/`** — Same single-tasking as `dos/`. Real two-step
`LOAD"NAME",8` then `RUN`. Hand-drawn chrome; C64 Pro Mono at
`vendor/c64/fonts/`.

**`nes/` / `gb/` / `snes/` / `gg/` / `compy/`** — Console, not a desktop: no floating windows.
Keyboard and on-screen pad both call `handleInput()`. 16px inputs;
`html.is-keyboard` hides the pad. NES audio is Web Audio pulse/triangle/
noise — no samples, no Nintendo tunes. SNES is sampled + echo, still
original. Don't `setMusic(null)` just because the screen isn't the title. GB and Game Gear reuse Press Start 2P from
`vendor/nes/fonts/`; GB's pad stays on the brick. Game Gear is a pocket
Master System, not a color DMG: landscape slab, D-pad left of the LCD,
1/2 right, Start under the glass, no Select (Tab still cycles). VDP chrome
is navy/cyan/magenta/gold (32 from 4096) on 160×144 cells — washed teal as
an LCD filter, not the UI. SNES is PAL Super Nintendo (no NES.css): gray
dogbone, rainbow Y/X/B/A, not the NA purple toaster. Title wordmark is
Super (TeX Gyre Heros italic) + OQ! (Press Start 2P). Audio is sampled +
echo at a high clip, not NES pulse. X=A, Y=B, L=Select, R=Start.
`compy/` is a cartoon beige CRT in this family, not `dos/`: DIR listing is
the SELECT menu, C64 Pro Mono from `vendor/c64/fonts/`, white/blue tube,
contrast wheels on the bottom (outside the framebuffer), PC-speaker squares.
Hub name Beige 386; no cartoon character marks on the glass. Undocumented
chassis skins (click the chin badge): 400 green phosphor (`html.is-tandy`),
486 clamshell (`html.is-lappy`) — same idea as SNES `html.is-ntsc`.

**`amiga/`** — Chrome is four Kickstart 1.3 pens (`#0055AA` white black
`#FF8800`). Art (backdrop, icons, About, copper, Boing) is 12-bit OCS.
A fifth chrome color, or flattening the painting to four pens, is a
bug. Own WM (depth gadget = to-back). TopazPlus a500, not system mono.

**`next/`** — Chrome is four MegaPixel grays. Key title black, inactive
dark gray; miniaturize left, close right, resize bar along the bottom.
Icons stay anti-aliased (`image-rendering: pixelated` is a bug).
Vertical menu + right dock; miniaturize leaves a miniwindow, not a
taskbar pill. Own WM. TeX Gyre Heros, not Helvetica. Menu items are
`<a href="#">` — set `a:link { cursor: default }`.

**`beos/`** — Own WM. Yellow title *tab* (not a full-width bar), Deskbar
in the upper right. Close is a square with a hollow circle on the left
of the tab; zoom is the square-in-a-square on the right; double-click
the tab to hide (no minimize gadget). Shift-drag slides the tab along
its window. Font is TeX Gyre Heros from `vendor/next/fonts/`, not Swiss
721. No Be logo, no Haiku leaf. Tab slant adapted from NovusGFX (MIT)
— see `vendor/beos/`. Palette is R5: desktop `#336698`, tab `#FFC000`,
chrome `#D8D8D8`. Hide is UI state (like NeXT miniaturize); closing
OQ!/DECON still goes through the router. Four workspaces (Alt+1..4);
Twitcher is Control-Tab; Team Monitor is Control-Alt-Delete. Kernel
debugger is an undocumented egg.

**`win31/`** — Redmond WM, 3.1 chrome: Program Manager is the shell
(closing it is Exit Windows → `../`). No Start, no taskbar — minimize
is an icon on the teal desktop. No X; close lives in the Control-menu
(double-click the box). Don't add a title-bar close "for touch." Font
reused from `vendor/win98/fonts/`.

**`win98/` `xp/` `win7/`** — Redmond WM. 98.css / XP.css / 7.css dist
builds under `vendor/`. Don't vendor the SCSS sources (they need a
build). Greenlandic flag, not a Windows logo. 7.css ships no fonts.

**`mac1984/` `mac8/`** — Own WM each; don't share with each other,
Redmond, or `shared/osx/`. Growbox only, not edge-resize. mac8 zoom
toggles the prior rect, it isn't maximize.

**`aqua/`** — Early OS X Aqua (~2001). Uses `shared/osx/` (menu bar,
Dock, traffic lights, zoom-toggles-prior-rect). Hand-rolled chrome;
no Apple marks. TeX Gyre Heros from `vendor/next/`. See `aqua/NOTES.md`
for the vendor CSS search (aqua-ui rejected: Apple-derived font/sprites).

**`kde/`** — Own WM (Plastik + Kicker). Compiz is `compositor.js`:
spring-mesh on `#compositor` for a fine pointer, CSS transforms on the
live window for coarse / iOS / reduced-motion (`html2canvas` blanks
there). Hide N/NE/NW resize handles on `pointer: coarse`. DejaVu Sans
at `vendor/kde/fonts/`. No KDE K.

## Git

Always restart from current `master` after a merge. A PR merged into a
feature branch that was itself already merged does not land on
`master` — CLS once vanished from production that way. If you stack on
an open PR, say so in the description and check both actually reached
`master`.

## Tests

`tests/test_win98.py`, `test_nes.py`, `test_gb.py`, `test_snes.py`,
`test_gg.py`, `test_redmond_run.py`, `test_screensavers.py` run in GitHub
Actions when those themes (or the shared screensaver host) change.
`tests/shared/*.mjs` always runs (Node, no browser).

```bash
pip install -r tests/requirements.txt
python3 -m pytest tests/ -v
```

Reuse `tests/conftest.py` fixtures if you add a suite. Other themes:
ad hoc Playwright against a local `http.server`. Simulate a mobile
keyboard by stubbing `visualViewport.height` / `offsetTop` and firing
`resize` — you cannot drive a real IME from CI.

`tools/check_palette.py` (CI: `.github/workflows/palette.yml`) covers
`nes/` `gb/` `gg/` `snes/` `c64/` `compy/` — the themes that declare a canon
palette as `--<theme>-*` CSS custom properties. Two different checks,
because "the palette" means two different sizes: the *possible* gamut
(everything the hardware could produce -- C64: exactly 16 colors; DMG
Game Boy: 4 greens; NES: a 64-entry PPU master palette; SNES/Game Gear:
dense enough that ~any color is reachable) versus the *current* palette
(the handful that theme actually declared). FAMILY checks every hex
literal against that theme's own current palette by RGB distance, plus
a grandfather baseline (`tools/palette-baseline.json`) for pre-existing
shades — not exact-match, so gradients/bevels pass and a genuinely
foreign hue doesn't. GAMUT is a tighter, harder check against the real
fixed hardware colors, and only runs where the hardware really was that
fixed: c64 (the whole theme -- a real C64's screen, border included,
had no other colors available) and gb (just the four DMG screen vars --
the rest of that theme is plastic shell, not gamut-limited). Regenerate
the family baseline with `--write-baseline` only for a real, reviewed
palette addition; a gamut failure means fix the color, not the check.
