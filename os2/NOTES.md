# os2/ — internal notes

The OQ!2 theme is a host desktop, not a recolored Windows 3.1 page. The outer
shell is Workplace Shell/Presentation Manager-inspired; the Win-OQ!2 guest
deliberately reuses `win31/index.html`, and the DOS guest deliberately reuses
`dos/index.html` so guest updates are reflected here automatically.

The current scaffold uses iframe session boundaries. Replace those boundaries
with shared guest modules only if embedding requires tighter routing or focus
integration; do not copy either guest's application logic into this theme.

- **Word Deconstructor** is a Workplace Shell object / PM window that iframes `win31/index.html?screen=decon`, mirroring how OQ!2 Dictionary iframes `?screen=oq`. Desktop + System folder icons open `#decon-window`.

- **OQ!/DECON hosting:** guest iframes still point at `win31/index.html?screen=oq` / `?screen=decon`. win31 now opens one MDI frame and focuses the matching child — OS/2 can keep separate PM windows per guest URL.

- **Hide ≠ Close:** title-bar Hide (`.minimize`) iconifies into `#minimized-tray` (restore by clicking the mini object). Close / Object → Close hides the window with no tray icon. Do not collapse Hide into Close again.

- **Leave-to-hub:** desktop **Shut down** object and Object → **Shut down…** both navigate to `../` (same pattern as Redmond Shut Down / mac1984 Special → Shut Down).

- **Caption gadgets** are CSS PM-like Hide/Close marks — no Win9x `_` / `×` text glyphs, no trademarked Warp artwork.

- **View menu** toggles Icon vs Details on `#system-window .folder-view`. Help opens a short alert.
