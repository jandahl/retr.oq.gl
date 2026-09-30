# c64/ — internal notes

See root `CLAUDE.md` → Theme invariants → `c64/` for the baseline
(single-tasking like `dos/`, real two-step `LOAD"NAME",8` then `RUN`,
hand-drawn chrome, C64 Pro Mono).

- BASIC-style command line: `runCommand(line)` in `app.js` (~line 965).
  `LOAD"$",8` / `LIST` prints the fake directory; `LOAD"NAME",8[,1]` sets
  `loadedProgram`; a bare `RUN` starts it via `runProgram()`.
- `SYS 64738` (also accepts `SYS64738`) quits to the hub
  (`window.location.href = "../"`). This is the real, well-known C64
  machine-code jump to the KERNAL reset vector — an authentic "reboot"
  command, not an invented one, so it's intentionally undocumented in any
  on-screen help the same way a real C64 never advertised it either.
- `MORPH` is the built-in minigame, `KALQ` is Klax-alike — both loaded and
  run the same LOAD/RUN way as `DICT`.
- RUN/STOP is the in-app "abort" key for whatever's currently running
  (dict/decon/morph/kalq), separate from `SYS 64738` which quits the whole
  emulator.

- **DECON** is a real `LOAD"DECON",8` / `RUN` program (DIR listing + full-screen app), same single-tasking takeover as `DICT`. Period 16-char disk naming keeps the label **DECON**. Wired through `shared/decon-app.js` + `OqRouter` (`?screen=decon`). RUN/STOP aborts DECON like the other apps.

- DIR listing rows are single inline `<button class="c64-link">` / `<span class="c64-dim">` elements holding the full padded line (`blocks + "NAME" + type`). Avoid `display:grid` (or any block layout) on those rows: `#c64-output` is `white-space: pre`, so a block box plus the newline between entries doubles line spacing. Leading block counts share one column across linked and dim rows.

- **Looks (fix/c64-looks):** Pepto VIC-II 16-color table for border
  (53280 / light blue `#6c5eb5`) vs screen (53281 / blue `#352879`).
  Square PETSCII cells (`line-height: 1`), crisp pixel font smoothing,
  0.8s block caret, uppercase display via `petsciiSafe()`, and an 8px
  stepped font under 720px so all 40 columns fit on a phone. No CRT
  scanlines (those live on `compy/`, not here).
