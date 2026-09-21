# Retro experience improvement roadmap

This project intentionally has no bundler and keeps each desktop theme
independent. Improvements must therefore preserve static hosting, theme
boundaries, era-specific input behavior, and the existing shared-script load
order.

## Completed foundation

- `shared/redmond/screensaver-catalog.js` is the metadata source for all 30
  vendored saver pages.
- KDE, Aqua, and Windows 3.1 saver menus consume the shared catalog while
  retaining their established historical ordering and labels.
- The screen saver host lazy-loads its iframe, exposes `aria-busy`, and has a
  `destroy()` lifecycle method.
- Shared Node invariants verify saver coverage, local assets, no CDN scripts,
  and era-specific mappings.

## Streamlining

1. Extract the repeated clock, boot overlay, viewport, and dictionary-shell
   setup from the Redmond themes into a small `shared/theme-runtime.js`.
2. Keep console themes separate, but share only their truly common input and
   mobile viewport primitives.
3. Add a static check that every changed shared script has a cache-busted
   reference in each consuming HTML page.
4. Use catalog metadata for all saver menus, including Win98, XP, and Win7,
   with explicit `default` fields rather than implicit branch order.

## Optimization

1. Add a shared visibility-aware animation scheduler for canvas demos and
   attract modes. It should pause on hidden pages and honor reduced motion.
2. Lazy-load optional 3D assets such as `assets/console-ring/models/` only
   after the corresponding hub view opens.
3. Add image/font preload hints only to the active theme; avoid making every
   theme pay for another theme's assets.
4. Add lightweight performance assertions for initial DOM readiness, console
   errors, and saver teardown.

## Graphical fidelity

1. Add screenshot baselines for DOS, Mac OS 8, Windows 98, Aqua, KDE, and one
   console theme.
2. Refine typography and metrics per era before adding more decoration.
3. Add optional, theme-scoped display treatments: CRT scanlines for DOS/C64,
   LCD ghosting for handhelds, and restrained phosphor persistence for early
   Mac/NeXT displays.
4. Prefer pixel-authentic icons in pre-1990 themes and keep modern SVG gloss
   limited to systems that plausibly used rendered icons.

## Period-correct screen savers

The catalog already contains the complete set. Further work should improve
presentation rather than add speculative savers:

- Win3.1: accessory icons and saver descriptions.
- Win98/XP: settings panels with preview, idle delay, and era-appropriate
  defaults.
- Aqua: Screen Effects selection UI with preview and current-saver state.
- KDE: metadata-backed descriptions and preview state shared with the full
  screen saver host.

## Verification

Run `node --test tests/shared/*.mjs` for fast shared validation. Browser tests
remain the final gate for iframe sizing, pointer dismissal, and real WebGL;
they require a Chromium environment that can launch under the host sandbox.
