# compy/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/`/`compy/`.
This is a beige VGA CRT in the **console** family, not `dos/`'s COMMAND.COM
and not a Redmond desktop: one tube, one `handleInput()`, screens swap via
`hidden`. The on-screen keyboard is the pad. Contrast knobs live on the
monitor chin (outside the framebuffer).

- Hub name is **Beige 386**. The directory is `compy/` because that is
  the machine nickname; keep "Compy Inc.", wrestler characters, and
  cartoon proper names **off the glass**. Original art, no trademarks.
- Font is IBM EGA 8×8 from `vendor/dos/fonts/` (BOOTSTRA.386 / Apache-2.0),
  `@font-face`d here rather than pulling BOOTSTRA's CSS kit.
- No quit-to-hub UI on the chassis — console family, see `nes/NOTES.md`.
  `EXIT.COM` on the DIR listing is the title-menu option (`../`).
- Konami Code egg lives here — undocumented beyond this pointer.
- In-CRT attract (45s idle, CGA starfield on `#attract-canvas` inside
  `#compy-tv` only — the keyboard stays). Any `handleInput` / key
  dismisses. Pauses on `document.hidden`. `prefers-reduced-motion`
  freezes the stars. Silent.
- Contrast: 18 steps (0–17), `--compy-tube-brightness` on `:root`.
  Knobs are `[data-input=contrast-down|contrast-up]`; `[` / `]` on the
  keyboard too. Not a second GUI.
- `tools/check_palette.py` FAMILY covers `--compy-*` (tube **and** beige
  plastic). VGA is dense enough that GAMUT does not run.
- `tests/test_compy.py` should run in CI when this theme changes — the
  bot cannot push `.github/workflows/theme-tests.yml` (no `workflow`
  scope). Paste a `compy:` paths-filter next to `snes:` on master.

- **DECON label:** menu / heading / about copy use **WORD DECONSTRUCTOR**.
  Ids stay `menu-decon` / `screen=decon`.
