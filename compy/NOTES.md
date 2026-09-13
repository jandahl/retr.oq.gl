# compy/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/`/`compy/`.
This is a **cartoon** beige CRT in the **console** family, not `dos/`'s
COMMAND.COM and not a photoreal VGA: one tube, one `handleInput()`, screens
swap via `hidden`. The on-screen keyboard is the pad. Contrast *wheels*
live on the bottom of the chassis (outside the framebuffer).

- Hub name is **Beige 386**. The directory is `compy/` because that is
  the machine nickname; keep vendor names, wrestler characters, and
  cartoon proper names **off the glass**. Original art, no trademarks.
- Font is C64 Pro Mono from `vendor/c64/fonts/` (the cartoon tube used
  that face, not IBM EGA). White/blue monochrome phosphor.
- Contrast: 18 steps (0–17), `--compy-tube-brightness` plus a
  `--compy-blue-wash` that peaks mid-travel (black → blue → black).
  Wheels are `[data-input=contrast-down|contrast-up]`; `[` / `]` on the
  keyboard too.
- Chassis skins, undocumented, same pattern as `snes/` `html.is-ntsc`:
  click the chin badge (`#compy-brand`) to cycle **386** (default beige)
  → **400** (`html.is-tandy`, green phosphor) → **486** (`html.is-lappy`,
  clamshell). On-glass labels stay `BEIGE 386` / `400` / `486`. Persisted
  in `localStorage` (`compy-chassis`). Not extra hub tiles, not games.
- No quit-to-hub UI on the chassis — console family, see `nes/NOTES.md`.
  `EXIT.COM` on the DIR listing is the title-menu option (`../`).
- Konami Code egg lives here — undocumented beyond this pointer.
- In-CRT attract (45s idle, starfield on `#attract-canvas` inside
  `#compy-tv` only — the keyboard stays). Any `handleInput` / key
  dismisses. Pauses on `document.hidden`. `prefers-reduced-motion`
  freezes the stars. Silent.
- `tools/check_palette.py` FAMILY covers `--compy-*` (tube, beige
  plastic, and the green/lappy pens declared on `:root`).
- `tests/test_compy.py` should run in CI when this theme changes — the
  bot cannot push `.github/workflows/theme-tests.yml` (no `workflow`
  scope). See issue #193.

- **DECON label:** menu / heading / about copy use **WORD DECONSTRUCTOR**.
  Ids stay `menu-decon` / `screen=decon`.
