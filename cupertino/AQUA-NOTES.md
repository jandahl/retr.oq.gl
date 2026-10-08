# cupertino/ — Aqua-era internal notes

Early OS X **Aqua** (roughly 10.0–10.4 / 2001). Shell behavior lives in
`shared/osx/`; this directory is mostly skin + thin wiring.

See root `CLAUDE.md` → Families → OS X (`shared/osx/`).

## Historical directory name

The compatibility URL `/aqua/` remains available, but the canonical family
directory is now `cupertino/`. Year on the hub is **2001** (Cheetah / early
Aqua).

## Vendor CSS search (2026-09)

Looked for a 98.css-style static Aqua kit (permissive license, ready
dist CSS, no SCSS-only, period-correct early Aqua, original art):

| Candidate | License | Verdict |
| --- | --- | --- |
| [willmeyers/aqua-ui](https://github.com/willmeyers/aqua-ui) (`website/aqua.css`) | MIT (code) | **Rejected for this repo.** Dist embeds Lucida Grande from “the original suitcase” and many PNG data-URIs the project itself notes are derived from Apple artwork. Conflicts with retr-oq’s original-art / no-trademark bar. |
| [thatdhruv/aqua2](https://github.com/thatdhruv/aqua2) | MIT | Controls-only; CSS injected via a single JS file — not a static vendor dist. Modern reimagining, not 2001 chrome. |
| [febLey/aqua.css](https://github.com/febLey/aqua.css) | WTFPL | Joke stylesheet (`color: aqua !important` everywhere) — not OS X chrome. |
| [codedgar/Puppertino](https://github.com/codedgar/Puppertino) | MIT | Modern macOS HIG — wrong era. |
| NovusGFX `styles/04-aqua-osx` | MIT (already used for BeOS tab slant) | Partial tokens only — not a full window/menubar/Dock kit. |

**Result:** hand-rolled `aqua/style.css` + original SVG icons. Behavior
still shared via `shared/osx/`. Font: TeX Gyre Heros from
`vendor/next/` (same Lucida/Helvetica stand-in `next/` and `beos/` use).

## Shared vs skin

| Shared (`shared/osx/`) | Theme (`aqua/`) |
| --- | --- |
| WM: drag, growbox, focus, open/close/min/zoom | Jelly traffic lights, pinstripe, window chrome CSS |
| Menu bar open/hover/close | Menu labels, Apple-menu substitute mark |
| Dock launch + running/bounce classes | Dock glass art, icons, magnification CSS |
| Menu clock (HH:MM helper) | Weekday+time override in `app.js` |

## Follow-up polish (this branch)

- **No power button.** Boot is passive auto-boot like `mac1984/` (and
  now `mac8/`). Sequence shows immediately; optional startup chime on
  first pointer/key so AudioContext can unlock under autoplay policy.
- **Desktop zoom `1.5`** at `min-width: 700px` (same gate as mac1984 /
  mac8). Chose **1.5 over 2**: Aqua jelly + Dock glass already read
  large; 2 felt oversized next to the menubar. WM already divides by
  `OqOsx.getZoomFactor`; Dock magnify lift does too. Genie minimize uses
  %-based `transform-origin` (zoom-safe).
- **Wallpaper:** original soft aqua blue / swirl wash on `#shell` (CSS
  gradients only — not Apple trademark art). Desktop icon labels are
  white + dark shadow for contrast.
- **Independent close:** closing OQ! closes only OQ!; closing Word
  Deconstructor closes only that window. `routeClose` updates the query
  for the closed screen (switch to the other if still open, else clear
  relevant params) and returns false so the WM closes just that window.
  Router `onChange` with `screen: null` no longer force-closes either.
  Opening either still uses `OqRouter.navigate`.
- **Minimize:** authentic **Aqua genie** suck into a **minimized Dock
  tile** (funnel `clip-path` + multi-step scale via WAAPI, ~560ms), not
  KDE lamp / plain scale-to-point. Tile is inserted first (Dock grows)
  so the suck target is real. `prefers-reduced-motion` → instant hide +
  tile. Still uses WM `onMinimizeAnimating(win, finish)`.
- **Minimized Dock tiles:** period OS X places minimized windows as
  extra Dock icons (right side before Trash, with a separator). Click
  the tile to restore and remove it; the app’s normal Dock icon still
  focuses/restores. Closed (not minimized) → no tile. Magnify includes
  dynamic tiles.
- **Rename:** user-visible “DECON” → **Word Deconstructor** (window title,
  desktop/Finder/Dock labels, Go menu). Same long name is now the default on
  most desktop/handheld themes; element ids / `screen=decon` / `win-decon`
  stay shared. (mac8 uses “Deconstructor”; snes “Super Word Deconstructor”;
  mac1984 “Word Parts”; dos/c64 keep DECON[.EXE].)
- **Finder / Trash:** Macintosh HD is an icon-view Finder chrome with
  openable items (OQ!, Word Deconstructor, About, Trash); Trash shows an
  empty-state message (KDE-style substance, Aqua skin).
- **Icons:** redesigned desktop + Dock SVGs — gloss, rounded forms,
  depth — still original (no Apple logo / Happy Mac face clones).


## Period-correctness pass (`polish/aqua-more-correct`)

Authenticity choices for early Aqua (~10.0–10.3 / 2001–2003), theme-local:

- **3D Dock shelf vs Leopard flat glass.** Cheetah/Puma Dock was a
  perspective trapezoid shelf with icons sitting *on* it and a soft
  reflection hint — not the frosted rounded strip of later OS X. Magnify
  + running dots kept; art remains original SVG.
- **Double-click to open desktop icons.** Classic Mac/Aqua: single-click
  selects (white label on blue), double-click opens. `(pointer: coarse)`
  / touch keeps single-click open. Empty desktop click clears selection.
- **Menu clock format.** Early menu clocks often showed weekday + time
  (e.g. `Tue 7:14 PM`) via `toLocaleString` / browser locale. Shared
  `OqOsx.initMenuClock` stays HH:MM for other skins; aqua overrides in
  `app.js` only.
- **Aqua jelly scrollbars.** WebKit `::-webkit-scrollbar*` styled in
  blue/gray jelly language for `.osx-body`, `.aqua-panel`, Finder views.
  Unsupported engines keep native scrollbars (graceful).
- **Jelly controls.** Pill/oval primary blue + gloss; secondary gray
  jelly; text fields with soft inset + glowing blue Aqua focus ring on
  `:focus-visible`; slightly period checkboxes.
- **Menubar pinstripes + menu chrome.** Fine horizontal stripe texture on
  the translucent menubar; dropdowns get a light stripe wash / soft
  shadow; blue selection kept. Visual ⌘ shortcut hints on a few items
  (Close Window, Shut Down, …) — chrome only except existing handlers.
- **Finder toolbar.** Macintosh HD gets Back (inert/disabled), icon/list
  view toggles, and a location label. List view is a simple Name/Kind
  alternate. Trash keeps empty-state with matching toolbar chrome.

## Gotchas

- **No Apple mark.** Leftmost menu uses an original abstract “system”
  glyph (concentric arcs), not an apple silhouette.
- **Traffic lights** stay on the left (close / minimize / zoom). Inactive
  windows mute them via `.inactive` — early Aqua grayed the jewels.
  Active titlebar hover reveals × − + via CSS `::before` (no glyph art
  assets).
- **Dock magnify** is theme JS in `app.js` (pointer-distance cosine
  falloff on `#dock`). Shared `OqOsx.initDock` stays launch/running/
  bounce only. `prefers-reduced-motion` skips continuous magnify and
  keeps a mild CSS hover (or none).
- **Shut Down sheet** (`#shutdown-overlay .osx-sheet`) hangs under the
  menu bar (top-aligned overlay + flat-top dialog), not a centered
  modal.
- **Minimize** hides the window (`.minimized`), leaves a running dot on
  the app Dock item, **and** inserts a minimized-window tile before
  Trash. Click the tile (or the app icon) to restore. Not a Redmond
  taskbar button.
- **Zoom** toggles the prior rect (Finder-style), not a permanent
  maximize — same idea as mac8’s zoom box, implemented in
  `OqOsx.initWindowManager`.
- **Resize** is growbox-only in this skin (`resizeMode: "growbox"`).
  Later OS X skins can pass `"edges"` or `"both"`.
- **OQ! / Word Deconstructor** open through `window.OqRouter.navigate`
  (`routeOpen`). Close is independent: `routeClose` only adjusts the
  query for the closed screen; each window closes on its own.
- **Cache-bust** `?v=N` on every local file you change.
- Touch: inputs ≥ 16px; `html, body { position: fixed }` to stop iOS
  document scroll on focus.
- **CSS `zoom`:** `clientX` / `getBoundingClientRect` are post-zoom;
  assigning `style.left/top` (or transform lifts meant as CSS lengths)
  needs `/ getZoomFactor()` — see CLAUDE.md.

## What Tiger / Leopard should override

- Unified toolbar / metal window variants (CSS only)
- Reflective Dock, Stacks, Spaces (theme JS + CSS; keep calling
  `OqOsx.initDock`)
- Graphite appearance (swap CSS variables)
- Keep `shared/osx/` APIs stable — do not fork the WM for chrome alone.

## Remaining gaps pass (`polish/aqua-remaining-gaps`)

Fixes vs Jan’s critique, on top of #168–#171:

1. **Menubar idle hover.** Top-level items no longer paint accent on bare
   `:hover`. Accent only for `.menu-open`. `shared/osx/menubar.js` adds
   `.is-tracking` on the menubar while a menu is open (hover-switch).
2. **Desktop pinstripes.** Unmistakable vertical early-Aqua stripes on
   `#shell`, combined with the soft blue wash (original CSS only).
3. **App-aware menubar.** App menu title tracks focus: **OQ!** /
   **Word Deconstructor** / **Finder** (Finder windows + bare desktop).
   About item text matches. Empty Trash enabled only for Finder.
   Wired via WM `onFocus` + open/close/minimize/restore + desktop click.
4. **Dock hover labels.** Normal Dock icons show a `.dock-caption` name
   tag on hover (same language as minimized `.dock-min-caption`), driven
   by `aria-label` / `data-dock-label`.
5. **Context menus.** Browser `contextmenu` suppressed on desktop,
   windows, Dock, menubar. Bare desktop shows a small Aqua menu (New
   Finder Window → HD, Get Info → About, Change Desktop Background /
   Show View Options stubs). Pattern borrowed from mac8/app.js.
6. **CI.** `tests/test_aqua.py` regressions added. The
   `.github/workflows/theme-tests.yml` `aqua:` path filter is prepared
   in the PR description (OAuth token lacks `workflow` scope to push
   workflow files from this agent — paste/apply once with a
   workflow-scoped token).
7. **About This Computer.** KDE-quality copy: period Aqua description,
   `shared/osx`, original-art disclaimer, Leave → hub + Shut Down.
8. **Trash.** Dropped “The Trash is empty.” smug line. Friendlier empty
   copy + crumpled-note easter egg; Empty Trash confirm from Finder menu.
9. **Boot splash.** Removed the ~1.2s overlay entirely — desktop appears
   immediately (optional startup chime still unlocks on first input).


## Aqua parity shell (`polish/aqua-parity-shell`)

Parity shell features (Screen Effects / ⌘-Tab / Clean Up, then chrome batch):

1. **CI** — `tests/test_aqua.py` is covered by a `theme-tests.yml` `aqua:` path
   filter (`aqua/**`, `shared/osx/**`, test harness files). If the agent OAuth
   token lacks `workflow` scope, the YAML may need to be pasted manually (see PR).
2. **Screen Effects** — idle host via `shared/redmond/screensaver.js` (loaded by
   `shared/router.js` for `/aqua/`). Abstract GL savers from `vendor/screensavers/`:
   **Flux**, **Field Lines**, **Solar Winds** (no Apple Flurry clones). Idle ~75s;
   `prefers-reduced-motion: reduce` disables idle (menu preview still works).
   System menu + desktop context **Screen Effects…**; thin Preview items for each
   saver. Dismiss on pointer/key via the shared overlay host. Test hook:
   `window.__aquaScreenEffects.setIdleMs(ms)`.
3. **⌘-Tab app switcher** — hold Meta+Tab (Ctrl+Tab on non-Mac) to cycle
   open/non-closed windows (else Dock-worthy apps). Center HUD strip of icons;
   release modifier to activate; Esc cancels. `preventDefault` while handling /
   switcher active so the theme owns the chord.
4. **Desktop Clean Up / Hide Icons** — context menu **Clean Up Desktop** snaps
   icons back into the tidy right-side column (canonical order); **Show Desktop
   Icons** toggles visibility and persists with `localStorage` key
   `retr-oq:aqua-desktop-icons` (mac8 parity).

Cache-bust: `style.css?v=12`, `eras.css?v=7`, `app.js?v=11`, `timemachine.js?v=7`, `router.js?v=17` (loads screensaver `?v=30`).

## Aqua parity chrome (same branch)

Continues on `polish/aqua-parity-shell` (PR #176) — no Exposé / Spotlight / Stacks / Spaces.

1. **Desktop icon drag-reposition** — fine pointer: drag icons; positions persist in
   `localStorage` `retr-oq:aqua-desktop-icon-pos`. **Clean Up Desktop** clears free
   layout + storage and snaps the tidy right-side column (existing hide-icons toggle
   unchanged). Coarse pointer keeps tap-to-open (no drag).
2. **Force Quit** — System menu **Force Quit…** + ⌥⌘⎋ (Alt+Meta+Escape; Alt+Ctrl+Escape
   too). Sheet lists open windows; Force Quit closes the selection; Cancel dismisses.
3. **Get Info** — File menu, desktop/icon context menus open a real sheet (name / kind /
   version blurb) for Macintosh HD, OQ!, Word Deconstructor, Trash, Applications, About,
   or Desktop — not the About stub.
4. **Applications** — first-class `win-apps` Finder window (OQ! + Word Deconstructor +
   About), openable from Macintosh HD, Dock, and Go menu.
5. **Graphite appearance** — System Preferences sheet toggles Blue / Graphite CSS
   variables on `html[data-appearance]`; persists `retr-oq:aqua-appearance`.
6. **Edge resize** — `resizeMode: "both"`; `.osx-resize` edge handles on aqua windows
   alongside the growbox.
7. **CI** — do not push workflow files from this agent. Paste the `aqua:` path filter
   into `.github/workflows/theme-tests.yml` (see PR #176 description / former #177).

## Time Machine era switcher (same branch)

Browse **OS X eras** (visual skins), not file versions. Same DOM + `shared/osx/`
shell; eras override CSS variables + chrome via `html[data-osx-era]`.

Arc runs skeuomorphism → flat translucency → **Glassholism** (original liquid-glass
homage). Prefer strong milestones over every point release (no Snow Leopard bridge).

| Era id | Year | Look |
| --- | --- | --- |
| `aqua` (default) | 2001 | Classic jelly stripes, candy/gel traffic, soft pinstripe titlebar, roundish window, 3D shelf Dock |
| `tiger` | 2005 | Subtle Aurora desktop nod, **unified muted blue-grey metal** titlebars (no jelly / no green chrome), flatter traffic, mid-2000s Dock |
| `leopard` | 2007 | Translucent grey menubar, **cool grey / graphite** titlebars + grey-glass traffic, tighter radius, reflective Dock / stack-ish hint |
| `lion` | 2011 | Peak **skeuomorphism**: linen weave desktop, padded/stitched title cues, leather-ish Dock, chunkier glossy scrollers — original patterns, not Apple art |
| `yosemite` | 2014 | Post-skeuomorph **translucent flat**: vibrancy-ish blur menubar, flatter windows, thinner titlebars, frosted strip Dock (no perspective shelf) |
| `bigsur` | 2020 | Modern macOS: larger radius, denser blur, traffic spacing tweaks, fuller frosted Dock, soft abstract sky wash (not Big Sur wallpaper assets) |
| `glass` | 2026 | **Glassholism**: maximal glassmorphism — heavy backdrop-filter, specular panel sheen, ultra-frost menubar/Dock/windows, luminous cyan accents, dreamy bloom desktop |

**Entry:** System menu **Time Machine…**, Dock orb, shortcut **⌥⌘T** (Alt+Meta/Ctrl+T).

**UX:** Full-screen original **galaxy** canvas (colorful nebula pinks /
purples / teals / gold + soft bloom; lazy depth drift over many seconds /
subtle rotation — not Apple’s TM galaxy rip or trademarks) + shelf. Seven era
cards (per-era TM accent colors) + scrubber / arrows; live skin preview while
browsing. Compact **OQ! window chrome preview** (`#tm-oq-preview`, fixed size,
readable labels + traffic lights + fake toolbar/list) reskins *materials* with
the selected era via `html[data-osx-era]` / era CSS variables so theme changes
are obvious before Restore without resizing the mini window. **Restore** /
Enter applies; Esc cancels. Apply transition: galaxy dissolve + shell
scale/blur (~700ms). `prefers-reduced-motion: reduce` → instant Restore class
swap; galaxy loop pauses when overlay is hidden and runs nearly static under
reduced motion.

**Persist:** `localStorage` `retr-oq:aqua-osx-era`. Inline boot script in
`index.html` accepts all seven ids and sets `data-osx-era` before paint.

**Graphite:** Composes fully on **Aqua / Tiger / Leopard / Lion**
(`html[data-osx-era][data-appearance="graphite"]` in `eras.css` / `style.css`).
On **Yosemite / Big Sur / Glassholism**, Graphite is effectively a **no-op**
(or tiny accent nudge only) — those skins are already muted greys / light glass,
and a full graphite wash fights the flat/glass language. Toggle still persists;
it just does not visually dominate. Documented here so Sys Prefs is not “broken.”

**Performance:** `@media (pointer: coarse), (max-width: 700px)` dials back
`backdrop-filter` blur on Yosemite / Big Sur / Glassholism.

**Files:** `aqua/eras.css`, `aqua/timemachine.js`, overlay markup in
`aqua/index.html` (`#tm-galaxy` canvas, `#tm-oq-preview`). Hook:
`window.__aquaTimeMachine`.

**Out of scope (still):** real Exposé / Spotlight / Spaces / Stacks apps;
Apple logos / trademarked TM galaxy / copied Big Sur wallpapers.

## Time Machine galaxy + OQ! preview

Branch `polish/aqua-tm-galaxy-preview` (post-#176).

1. **Galaxy** — `#tm-galaxy` canvas inside `.tm-starfield`: original abstract
   colorful nebula (pinks / purples / teals / gold dust + soft bloom) with a
   **calm** star-tunnel crawl (no rotation; radial speed ≈0.0012; dust slower;
   no streaks). Animation starts when TM opens and stops when the overlay
   hides. `prefers-reduced-motion` is fully static.
2. **OQ! preview** — `#tm-oq-preview` miniature `.osx-window` with traffic
   lights, readable title **OQ!**, search placeholder “Type to search…”,
   dictionary-backed Kalaallisut lexeme/gloss sample rows, and a status line. Scrubbing eras
   calls `applyEra` → `html[data-osx-era]`, so the preview inherits era
   *materials* (colors / textures / radius / titlebar wash) as the desktop
   before Restore.
3. **Fixed preview metrics (critique fix)** — `#tm-oq-preview` locks
   width/height, titlebar height, traffic-light size, and body font sizes with
   selectors that beat `html[data-osx-era="…"] .osx-*` layout tweaks. Eras must
   not change overall mini-window dimensions or font-size blowouts in TM;
   glass specular `::before` is suppressed on the preview.
4. **Calm crawl (dizzy fix)** — `rotSpeed=0`, star speed ≈0.0012 / reduced-motion 0, dust slower, streaks removed.
5. **Early-era chrome delta (critique fix)** — Aqua / Tiger / Leopard titlebars,
   borders, traffic, and light body chrome now diverge for real (jelly stripes +
   candy gels vs brushed metal vs dark glossy + grey-glass). Preview geometry
   stays locked.
6. **Active preview traffic** — `#tm-oq-preview` carries `is-focused`, is
   excluded from the WM (no `.inactive`, cleared on TM open). Preview traffic
   buttons have **no `disabled` attribute** (WebKit UA greying won over author
   CSS); non-interactive via `pointer-events: none` + `tabindex="-1"` +
   `aria-hidden`. End-of-file `html[data-osx-era] #tm-oq-preview` jewel rules
   use `!important` + `appearance: none` and always paint × − + on `::before`.
7. **Titlebar single layer** — Live `.osx-title` pills removed (base + Leopard).
   Yosemite / Big Sur / Glass titlebars stay one fill with no titlebar
   `backdrop-filter`; glass window `::before` starts below the titlebar.
   Preview titlebar uses one opaque era-specific `background` only, kills
   `::before`/`::after`, and `#tm-oq-preview .osx-title { background: none }`.
   Cache-bust `style.css?v=12`, `eras.css?v=7`, `app.js?v=12`,
   `timemachine.js?v=9`, plus `dict-source.js?v=2` / `katersat-source.js?v=1` / `dict-merge.js?v=1`.
8. **OQ! preview lexemes from real dict** — on first TM open, `timemachine.js`
   calls `window.OqDictSource.loadDictEntries()` and fills `#tm-oq-preview`
   tbody with 4 short (3–14 char) `{lexeme,gloss_en}` rows via `textContent`
   (no fake oqaatsit/sila/nuna/imiq placeholders). Status shows `4 of {N} ·
   dictionary sample`; load failure clears rows and shows a one-line error.

## Era palette sources

Period-accurate chrome for Aqua / Tiger / Leopard (prefer historical UI materials over
“make eras obviously different”). No Apple assets — public approximations only.

| Era | Intent | Widely cited / community hex family | Our stops |
| --- | --- | --- | --- |
| **Aqua** (~10.0–10.3) | Horizontal candy **pinstripe** titlebar in light→mid **aqua blue** (not green). Window body light grey-blue. Desktop soft aqua swirl wash. | Common recreations cluster around `#E3EEFA` / `#AFC8E8` / `#7FA4D4` for active striped bars; body `#E8EEF5`–`#F0F0F0`. See Wikipedia [Aqua (user interface)](https://en.wikipedia.org/wiki/Aqua_(user_interface)) (blue/white/gray principal colors; early pin-striped chrome) and open CSS kits that approximate the same band without shipping Apple art. | Title `#e3eefa → #afc8e8 → #7fa4d4 → #5f8cc4`; body `#eef2f7`; desktop remains soft aqua blue (`style.css` `#shell`). |
| **Tiger** (~10.4) | Move off candy stripes to **unified muted blue-grey metal** (brushed, flatter). Spotlight **green is accent only**, not titlebar wash. Desktop may nod Aurora (blue-green sky) subtly. | Wikipedia notes Tiger’s unified titlebar scheme and removal of menubar pinstripes in favor of a glossy white look; brushed-metal windows were still metal/grey, not green. Community metal greys often sit near `#d0d0d0`–`#6e6e6e` with a cool cast. | Title `#e0e6ea → #c4ccd4 → #8a949e → #6a747e`; accent `#3d8f6a`; desktop `#5a98a8 → #1e4870` with soft cyan wisps (not jungle teal titlebars). |
| **Leopard** (~10.5) | **Grey** translucent menubar; window titlebars **cool grey / graphite-adjacent** with soft top highlight — much less aqua blue. Light title text on darker grey bars. No purple/random hues. | Wikipedia: Aqua + brushed-metal windows converge on the same metal-like **gray** look; menubar becomes grey/semi-transparent; Dock reflective glass. Contemporary write-ups (e.g. AppleInsider on Leopard’s unified grey gradient replacing metal holdouts) match cool greys, not blue candy. | Title `#c4c8cc → #90969c → #5a6066 → #3a4046`; menubar dark cool grey; desktop cool night blues only (purple swirl removed). |

`#tm-oq-preview` per-era titlebar fills at the bottom of `eras.css` use one opaque gradient each matching these stops (geometry locks / candy preview traffic unchanged).

Later eras (Lion → Glass) left alone unless clearly wrong — Lion warm linen/pewter, Yosemite/Big Sur flat light greys, Glass frost.

## TM preview sample lexemes

Preferred demo rows for the Time Machine mini OQ! window (wired via
`shared/dict-merge.js` Option C — Chicago primary + katersat enrichment):

- `kujannippoq`
- `qulluk`
- `usuk`
- `aalajavoq`

`timemachine.js` prefers these four when present in the **merged** set
(empty `gloss_en` is allowed — e.g. `aalajavoq`). If they are missing
(Chicago-only fallback / mock), it falls back to short Chicago samples
(3–14 chars, non-empty gloss).

Merge is **project-wide**: every theme’s OQ! calls
`OqDictSource.loadDictEntries()` which goes through
`shared/katersat-source.js` + `shared/dict-merge.js`. Katersat JSON is
**not** vendored (GPL); runtime HTTP + `applyDictAttribution()` — see
`shared/SOURCES.md`.
