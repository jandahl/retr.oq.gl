(() => {
  "use strict";

  // Thin Aqua adapter over shared/osx/. Theme-specific: boot chime,
  // OQ!/Word Deconstructor rendering, shutdown dialog, icon selection,
  // Aqua genie minimize + minimized Dock tiles. Window chrome / menu bar /
  // Dock launch helpers come from OqOsx.*.

  // loadDictEntries is the project-wide choke point (Chicago + katersat merge).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION, wasKatersatLoaded } =
    window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  // ---------- Boot ----------
  // No boot overlay / power button — desktop is immediate. Optional chime
  // on first pointer/key unlocks AudioContext under autoplay policy.
  function playStartup() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      // Soft two-tone nod to early Aqua startup — original, not a sample.
      const notes = [
        { freq: 392.0, start: 0, dur: 0.35 },
        { freq: 523.25, start: 0.22, dur: 0.55 },
        { freq: 659.25, start: 0.4, dur: 0.7 },
      ];
      for (const { freq, start, dur } of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      }
    } catch {
      /* Web Audio blocked — boot silently */
    }
  }

  {
    const unlockChime = () => {
      playStartup();
      window.removeEventListener("pointerdown", unlockChime, true);
      window.removeEventListener("keydown", unlockChime, true);
    };
    window.addEventListener("pointerdown", unlockChime, { once: true, capture: true });
    window.addEventListener("keydown", unlockChime, { once: true, capture: true });
  }

  // ---------- Shell ----------
  const desktop = document.getElementById("desktop");
  const menuBar = document.getElementById("menu-bar");
  const windows = Array.from(
    document.querySelectorAll(".osx-window:not(.osx-dialog):not(.tm-oq-preview)"),
  );
  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");
  /** @type {HTMLElement | null} */
  let focusedWin = null;

  function isLive(win) {
    return win && !win.classList.contains("closed") && !win.classList.contains("minimized");
  }

  let dockApi;
  const dockEl = document.getElementById("dock");
  const dockMinimized = document.getElementById("dock-minimized");
  const dockMinSep = document.getElementById("dock-min-sep");
  /** @type {Map<string, HTMLElement>} */
  const minimizedTiles = new Map();

  function syncDockRunning() {
    // Running = not closed (minimized windows still show a Dock indicator).
    for (const win of windows) {
      dockApi.setRunning(win.id, !win.classList.contains("closed"));
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function windowTitle(win) {
    const title = win.querySelector(".osx-title");
    return (title && title.textContent.trim()) || win.id;
  }

  function syncMinimizedSeparator() {
    if (!dockMinSep) return;
    const has = minimizedTiles.size > 0;
    dockMinSep.hidden = !has;
    dockMinSep.setAttribute("aria-hidden", has ? "false" : "true");
  }

  function removeMinimizedDockTile(winId) {
    const tile = minimizedTiles.get(winId);
    if (!tile) return;
    tile.remove();
    minimizedTiles.delete(winId);
    syncMinimizedSeparator();
  }

  function ensureMinimizedDockTile(win) {
    if (!dockMinimized) return null;
    const existing = minimizedTiles.get(win.id);
    if (existing) return existing;

    const title = windowTitle(win);
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "osx-dock-item aqua-dock-minimized";
    tile.dataset.restore = win.id;
    tile.setAttribute("aria-label", `${title} (minimized)`);

    // Mini window glyph: titled document stand-in (no live screenshot).
    const glyph = document.createElement("span");
    glyph.className = "dock-min-glyph";
    glyph.setAttribute("aria-hidden", "true");
    const appIcon = dockApi && dockApi.itemFor(win.id);
    const srcSvg = appIcon && appIcon.querySelector("svg, img, .dock-glyph");
    if (srcSvg && srcSvg.tagName === "svg") {
      glyph.appendChild(srcSvg.cloneNode(true));
    } else {
      glyph.innerHTML =
        '<svg class="dock-glyph" viewBox="0 0 48 48">' +
        '<rect x="8" y="10" width="32" height="28" rx="4" fill="#dfe6f0" stroke="#334" stroke-width="1.4"/>' +
        '<rect x="8" y="10" width="32" height="8" rx="4" fill="#8eb0e0"/>' +
        "</svg>";
    }
    const caption = document.createElement("span");
    caption.className = "dock-min-caption";
    caption.textContent = title;
    tile.append(glyph, caption);

    tile.addEventListener("click", () => {
      const target = document.getElementById(win.id);
      if (!target) return;
      wm.restoreWindow(target);
      removeMinimizedDockTile(win.id);
      syncDockRunning();
    });

    dockMinimized.appendChild(tile);
    minimizedTiles.set(win.id, tile);
    syncMinimizedSeparator();
    return tile;
  }

  // Authentic Aqua genie: funnel clip-path + multi-step scale toward the
  // minimized Dock tile (created first so the Dock grows as the suck starts).
  // %-based transform-origin stays zoom-safe with OqOsx / CSS zoom.
  const GENIE_MS = 560;

  function genieFunnelClip(ox, oy, t) {
    // t: 0 = full rect, 1 = collapsed to dock point. Trapezoid narrows toward (ox, oy).
    const topSpread = (1 - t) * 50;
    const botSpread = (1 - t) * (1 - t) * 50;
    const midY = 20 + t * (oy - 20);
    const x = Math.min(100, Math.max(0, ox));
    const y = Math.min(100, Math.max(0, oy));
    if (t >= 0.98) {
      return `polygon(${x}% ${y}%, ${x}% ${y}%, ${x}% ${y}%, ${x}% ${y}%)`;
    }
    const tl = Math.max(0, x - topSpread);
    const tr = Math.min(100, x + topSpread);
    const bl = Math.max(0, x - botSpread);
    const br = Math.min(100, x + botSpread);
    // Quad that pinches toward the dock target along the bottom edge.
    return `polygon(${tl}% 0%, ${tr}% 0%, ${br}% ${midY}%, ${x}% ${y}%, ${bl}% ${midY}%)`;
  }

  function animateGenieMinimize(win, finish) {
    if (prefersReducedMotion()) {
      ensureMinimizedDockTile(win);
      finish();
      return;
    }
    const dockItem = ensureMinimizedDockTile(win) || (dockApi && dockApi.itemFor(win.id));
    if (!dockItem) {
      finish();
      return;
    }

    // Layout flush so the new tile has a real rect for the suck target.
    void dockItem.offsetWidth;

    const winRect = win.getBoundingClientRect();
    const dockRect = dockItem.getBoundingClientRect();
    const tx = dockRect.left + dockRect.width / 2;
    const ty = dockRect.top + dockRect.height * 0.35;
    const ox = winRect.width ? ((tx - winRect.left) / winRect.width) * 100 : 50;
    const oy = winRect.height ? ((ty - winRect.top) / winRect.height) * 100 : 100;

    win.style.zIndex = String(9000);
    win.style.pointerEvents = "none";
    win.style.transition = "none";
    win.style.transform = "none";
    win.style.opacity = "1";
    win.style.transformOrigin = `${ox}% ${oy}%`;
    win.style.clipPath = genieFunnelClip(ox, oy, 0);
    win.classList.add("aqua-genie");
    void win.offsetWidth;

    const frames = [
      { offset: 0, transform: "scale(1, 1)", opacity: 1, clipPath: genieFunnelClip(ox, oy, 0) },
      {
        offset: 0.35,
        transform: "scale(0.72, 0.85)",
        opacity: 1,
        clipPath: genieFunnelClip(ox, oy, 0.35),
      },
      {
        offset: 0.7,
        transform: "scale(0.28, 0.4)",
        opacity: 0.85,
        clipPath: genieFunnelClip(ox, oy, 0.72),
      },
      {
        offset: 1,
        transform: "scale(0.06, 0.04)",
        opacity: 0,
        clipPath: genieFunnelClip(ox, oy, 1),
      },
    ];

    let done = false;
    function complete() {
      if (done) return;
      done = true;
      win.classList.remove("aqua-genie");
      win.style.clipPath = "";
      finish();
    }

    if (typeof win.animate === "function") {
      const anim = win.animate(frames, {
        duration: GENIE_MS,
        easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
        fill: "forwards",
      });
      const finishAnim = () => {
        try {
          anim.cancel();
        } catch {
          /* already finished/canceled */
        }
        complete();
      };
      anim.finished.then(finishAnim).catch(finishAnim);
      setTimeout(finishAnim, GENIE_MS + 100);
    } else {
      // Fallback: multi-step CSS transition (still funnel + scale, not lamp).
      win.style.transition =
        `transform ${GENIE_MS}ms cubic-bezier(0.45, 0.05, 0.55, 0.95), ` +
        `opacity ${GENIE_MS}ms ease-in, clip-path ${GENIE_MS}ms ease-in`;
      win.style.transform = "scale(0.06, 0.04)";
      win.style.opacity = "0";
      win.style.clipPath = genieFunnelClip(ox, oy, 1);
      setTimeout(complete, GENIE_MS + 80);
    }
  }

  const wm = window.OqOsx.initWindowManager({
    desktop,
    windows,
    minWidth: 240,
    minHeight: 140,
    resizeMode: "both",
    routeOpen(win) {
      if (win === winOq) {
        window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
        return true;
      }
      if (win === winDecon) {
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        return true;
      }
      return false;
    },
    routeClose(win) {
      // Independent close: update query for the closed screen only; WM closes
      // this window (return false). Never force-close the other dict app.
      if (win === winOq) {
        const screen = window.OqRouter.getParams().get("screen");
        if (screen === "oq") {
          if (!winDecon.classList.contains("closed")) {
            window.OqRouter.navigate({
              screen: "decon",
              filter: null,
              word: deconWord.value || null,
              order: deconRootFirst.checked ? null : "final",
            });
          } else {
            window.OqRouter.navigate({ screen: null, filter: null });
          }
        }
        return false;
      }
      if (win === winDecon) {
        const screen = window.OqRouter.getParams().get("screen");
        if (screen === "decon") {
          if (!winOq.classList.contains("closed")) {
            window.OqRouter.navigate({
              screen: "oq",
              word: null,
              order: null,
              filter: oqFilter.value || null,
            });
          } else {
            window.OqRouter.navigate({ screen: null, word: null, order: null });
          }
        }
        return false;
      }
      return false;
    },
    onOpen(win) {
      syncDockRunning();
      syncAppMenu(win);
    },
    onClose(win) {
      removeMinimizedDockTile(win.id);
      syncDockRunning();
      if (focusedWin === win) {
        const next = windows.find((w) => w !== win && isLive(w));
        syncAppMenu(next || null);
      }
    },
    onMinimize(win) {
      ensureMinimizedDockTile(win);
      syncDockRunning();
      if (focusedWin === win) {
        const next = windows.find((w) => w !== win && isLive(w));
        syncAppMenu(next || null);
      }
    },
    onMinimizeAnimating(win, finish) {
      animateGenieMinimize(win, finish);
    },
    onRestore(win) {
      removeMinimizedDockTile(win.id);
      syncDockRunning();
      syncAppMenu(win);
    },
    onFocus(win) {
      syncAppMenu(win);
    },
  });

  window.OqOsx.initMenuBar({ menuBar });

  // Early OS X menu clock often showed weekday + time (e.g. "Tue 7:14 PM").
  // Override shared initMenuClock (HH:MM only) in this theme only.
  (function initAquaMenuClock() {
    const el = document.getElementById("menu-clock");
    if (!el) return;
    function update() {
      const now = new Date();
      try {
        el.textContent = now.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, "0");
        const suffix = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        el.textContent = `${days[now.getDay()]} ${h}:${m} ${suffix}`;
      }
    }
    update();
    setInterval(update, 1000);
  })();

  dockApi = window.OqOsx.initDock({
    dock: document.getElementById("dock"),
    onLaunch(id) {
      const target = document.getElementById(id);
      if (!target) return;
      if (target.classList.contains("minimized")) {
        wm.restoreWindow(target);
        syncDockRunning();
        return;
      }
      if (!target.classList.contains("closed")) {
        wm.focus(target);
        return;
      }
      wm.openWindow(target);
      syncDockRunning();
    },
  });

  // ---------- App-aware menubar (Finder / OQ! / Word Deconstructor) ----------
  const appMenuTitle = document.getElementById("app-menu-title");
  const appMenuAboutLink = document.getElementById("app-menu-about-link");
  const menuEmptyTrash = document.getElementById("menu-empty-trash");

  function syncAppMenu(win) {
    focusedWin = win && isLive(win) ? win : null;
    let name = "Finder";
    let about = "About Finder";
    if (focusedWin === winOq) {
      name = "OQ!";
      about = "About OQ!";
    } else if (focusedWin === winDecon) {
      name = "Word Deconstructor";
      about = "About Word Deconstructor";
    } else {
      // Finder windows (HD, Trash, About) + bare desktop → Finder
      name = "Finder";
      about = "About Finder";
    }
    if (appMenuTitle) appMenuTitle.textContent = name;
    if (appMenuAboutLink) appMenuAboutLink.textContent = about;
    // Empty Trash only enabled when Finder is frontmost.
    if (menuEmptyTrash) menuEmptyTrash.classList.toggle("is-disabled", name !== "Finder");
  }

    // Classic Aqua continuous Dock magnification (theme-side; shared/osx
  // only handles launch + running/bounce). Cosine falloff by pointer
  // distance; reduced-motion falls back to a mild single-icon lift.
  // Under CSS zoom, lift is divided by OqOsx.getZoomFactor (CLAUDE.md).
  (function initDockMagnification() {
    const dock = dockEl;
    if (!dock || !dockApi) return;
    const MAX_SCALE = 1.55;
    const RANGE = 80; // post-zoom px (clientX / getBoundingClientRect agree)
    const LIFT = 14;

    function liveItems() {
      // Include dynamic minimized tiles, not only static [data-open] apps.
      return Array.from(dock.querySelectorAll(".osx-dock-item"));
    }

    function resetMagnify() {
      for (const el of liveItems()) {
        if (el.classList.contains("is-bouncing")) continue;
        el.style.transform = "";
        el.style.zIndex = "";
      }
      dock.classList.remove("is-magnifying");
    }

    function applyMagnify(clientX) {
      if (prefersReducedMotion()) return;
      const zoom = window.OqOsx.getZoomFactor ? window.OqOsx.getZoomFactor() : 1;
      dock.classList.add("is-magnifying");
      let best = null;
      let bestScale = 1;
      for (const el of liveItems()) {
        if (el.classList.contains("is-bouncing")) continue;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);
        const t = Math.max(0, 1 - dist / RANGE);
        const scale = 1 + (MAX_SCALE - 1) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        const lift = (LIFT * (scale - 1) / (MAX_SCALE - 1)) / zoom;
        el.style.transform = `translateY(${-lift}px) scale(${scale})`;
        el.style.zIndex = String(Math.round(scale * 100));
        if (scale > bestScale) {
          bestScale = scale;
          best = el;
        }
      }
      if (best) best.style.zIndex = "200";
    }

    dock.addEventListener("pointermove", (event) => {
      if (prefersReducedMotion()) return;
      applyMagnify(event.clientX);
    });
    dock.addEventListener("pointerleave", resetMagnify);
    dock.addEventListener("pointercancel", resetMagnify);
  })();

  function openFromChrome(id) {
    const target = document.getElementById(id);
    if (!target) return;
    if (target.classList.contains("minimized")) wm.restoreWindow(target);
    else wm.openWindow(target);
    syncDockRunning();
  }

  // Desktop icons: classic Mac/Aqua — single-click selects (blue label),
  // double-click opens. Coarse pointer / touch keeps single-click open.
  const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
  let selectedIcon = null;
  function selectDesktopIcon(icon) {
    if (selectedIcon) selectedIcon.classList.remove("selected");
    icon.classList.add("selected");
    selectedIcon = icon;
  }
  function clearDesktopSelection() {
    if (!selectedIcon) return;
    selectedIcon.classList.remove("selected");
    selectedIcon = null;
  }
  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      selectDesktopIcon(icon);
      if (opensOnSingleClick) openFromChrome(icon.dataset.open);
    });
    if (!opensOnSingleClick) {
      icon.addEventListener("dblclick", () => {
        selectDesktopIcon(icon);
        openFromChrome(icon.dataset.open);
      });
    }
  }
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".desktop-icon, .osx-window, .desktop-context-menu, #dock")) return;
    if (event.target === desktop || event.target.classList.contains("desktop-icons")) {
      clearDesktopSelection();
      syncAppMenu(null);
    }
  });

  // Finder icon-view / list-view items (Macintosh HD)
  for (const item of document.querySelectorAll(".finder-item[data-open], .finder-list-row[data-open]")) {
    item.addEventListener("click", () => {
      openFromChrome(item.dataset.open);
    });
  }

  // Finder toolbar view toggles (icon vs simple list)
  const winHome = document.getElementById("win-home");
  if (winHome) {
    const iconView = winHome.querySelector(".finder-icon-view");
    const listView = winHome.querySelector(".finder-list-view");
    const viewBtns = winHome.querySelectorAll("[data-finder-view]");
    for (const btn of viewBtns) {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.finderView;
        const icons = mode === "icons";
        if (iconView) iconView.hidden = !icons;
        if (listView) listView.hidden = icons;
        for (const b of viewBtns) {
          const on = b.dataset.finderView === mode;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        }
      });
    }
  }

  // Menu + desktop-context items with data-open
  for (const item of document.querySelectorAll('#menu-bar [data-open], #desktop-context-menu [data-open]')) {
    const link = item.querySelector("a");
    if (!link) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openFromChrome(item.dataset.open);
    });
  }

  // Placeholder menu links (stubs) — skip items with real handlers below.
  for (const link of document.querySelectorAll('#menu-bar [role="menu"] a, #desktop-context-menu a')) {
    if (
      link.closest(
        "[data-open], #menu-shutdown, #menu-empty-trash, #menu-screen-effects, [data-saver], #desktop-ctx-cleanup, #desktop-ctx-toggle-icons, #desktop-ctx-effects, #desktop-ctx-info, #menu-force-quit, #menu-get-info, #menu-sys-prefs, #menu-time-machine",
      )
    ) {
      continue;
    }
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  // ---------- Context menu (suppress browser; Aqua menu on bare desktop) ----------
  const desktopContextMenu = document.getElementById("desktop-context-menu");

  function closeDesktopContextMenu() {
    if (desktopContextMenu) desktopContextMenu.hidden = true;
    const iconMenu = document.getElementById("icon-context-menu");
    if (iconMenu) iconMenu.hidden = true;
  }

  function suppressBrowserMenu(event) {
    event.preventDefault();
  }

  for (const win of windows) {
    win.addEventListener("contextmenu", suppressBrowserMenu);
  }
  if (dockEl) dockEl.addEventListener("contextmenu", suppressBrowserMenu);
  if (menuBar) menuBar.addEventListener("contextmenu", suppressBrowserMenu);

  const iconContextMenu = document.getElementById("icon-context-menu");
  /** @type {HTMLElement | null} */
  let iconContextTarget = null;

  function placeContextMenu(menu, event, menuWidth, menuHeight) {
    const zoomFactor = window.OqOsx.getZoomFactor ? window.OqOsx.getZoomFactor() : 1;
    const deskRect = desktop.getBoundingClientRect();
    const left =
      Math.min(event.clientX, deskRect.right - menuWidth) / zoomFactor - deskRect.left / zoomFactor;
    const top =
      Math.min(event.clientY, deskRect.bottom - menuHeight) / zoomFactor - deskRect.top / zoomFactor;
    menu.style.left = `${Math.max(0, left)}px`;
    menu.style.top = `${Math.max(0, top)}px`;
    menu.hidden = false;
  }

  desktop.addEventListener("contextmenu", (event) => {
    const onIcon = event.target.closest(".desktop-icon");
    const onWindow = event.target.closest(".osx-window");
    const onDock = event.target.closest("#dock");
    if (onWindow || onDock) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    closeDesktopContextMenu();
    if (onIcon) {
      selectDesktopIcon(onIcon);
      iconContextTarget = onIcon;
      if (iconContextMenu) placeContextMenu(iconContextMenu, event, 160, 72);
      return;
    }
    if (event.target !== desktop && !event.target.classList.contains("desktop-icons")) {
      return;
    }
    iconContextTarget = null;
    if (!desktopContextMenu) return;
    placeContextMenu(desktopContextMenu, event, 220, 160);
  });

  document.addEventListener("pointerdown", (event) => {
    const iconMenu = document.getElementById("icon-context-menu");
    const hitDesk = desktopContextMenu && !desktopContextMenu.hidden && desktopContextMenu.contains(event.target);
    const hitIcon = iconMenu && !iconMenu.hidden && iconMenu.contains(event.target);
    if ((desktopContextMenu && !desktopContextMenu.hidden && !hitDesk && !hitIcon) ||
        (iconMenu && !iconMenu.hidden && !hitDesk && !hitIcon)) {
      closeDesktopContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && desktopContextMenu && !desktopContextMenu.hidden) {
      closeDesktopContextMenu();
    }
  });
  // ---------- Desktop Clean Up / Show·Hide Icons ----------
  const desktopIcons = document.querySelector(".desktop-icons");
  const desktopCtxCleanup = document.getElementById("desktop-ctx-cleanup");
  const desktopCtxToggleIcons = document.getElementById("desktop-ctx-toggle-icons");
  const DESKTOP_ICONS_STORAGE_KEY = "retr-oq:aqua-desktop-icons";
  const DESKTOP_ICON_POS_KEY = "retr-oq:aqua-desktop-icon-pos";
  const DESKTOP_ICON_ORDER = ["win-home", "win-oq", "win-decon", "win-about", "win-trash"];

  function getStoredIconsHidden() {
    try {
      return localStorage.getItem(DESKTOP_ICONS_STORAGE_KEY) === "hidden";
    } catch {
      return false;
    }
  }

  function applyIconsHidden(hidden) {
    if (desktopIcons) desktopIcons.classList.toggle("icons-hidden", hidden);
    if (desktopCtxToggleIcons) desktopCtxToggleIcons.classList.toggle("checked", !hidden);
    try {
      localStorage.setItem(DESKTOP_ICONS_STORAGE_KEY, hidden ? "hidden" : "shown");
    } catch {
      /* sandboxed — applies for this visit only */
    }
  }

  function cleanUpDesktop() {
    clearDesktopSelection();
    if (!desktopIcons) return;
    const byOpen = new Map();
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      byOpen.set(icon.dataset.open, icon);
      icon.style.position = "";
      icon.style.top = "";
      icon.style.left = "";
      icon.style.right = "";
      icon.style.transform = "";
      icon.classList.remove("is-dragging");
    }
    for (const id of DESKTOP_ICON_ORDER) {
      const icon = byOpen.get(id);
      if (icon) desktopIcons.appendChild(icon);
    }
    // Snap the column back to the tidy right-side layout.
    desktopIcons.classList.remove("is-free");
    desktopIcons.style.top = "";
    desktopIcons.style.right = "";
    desktopIcons.style.left = "";
    desktopIcons.style.bottom = "";
    desktopIcons.style.width = "";
    desktopIcons.style.height = "";
    desktopIcons.style.flexDirection = "";
    desktopIcons.style.alignItems = "";
    try {
      localStorage.removeItem(DESKTOP_ICON_POS_KEY);
    } catch {
      /* ignore */
    }
  }

  applyIconsHidden(getStoredIconsHidden());

  if (desktopCtxCleanup) {
    desktopCtxCleanup.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      closeDesktopContextMenu();
      cleanUpDesktop();
    });
  }
  if (desktopCtxToggleIcons) {
    desktopCtxToggleIcons.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      closeDesktopContextMenu();
      applyIconsHidden(!desktopIcons.classList.contains("icons-hidden"));
    });
  }

  if (desktopContextMenu) {
    for (const link of desktopContextMenu.querySelectorAll("a")) {
      if (link.closest("#desktop-ctx-cleanup, #desktop-ctx-toggle-icons, #desktop-ctx-effects, [data-open]")) {
        continue;
      }
      link.addEventListener("click", () => closeDesktopContextMenu());
    }
  }


  // ---------- Desktop icon drag-reposition (fine pointer only) ----------
  function loadIconPositions() {
    try {
      const raw = localStorage.getItem(DESKTOP_ICON_POS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveIconPositions(map) {
    try {
      localStorage.setItem(DESKTOP_ICON_POS_KEY, JSON.stringify(map));
    } catch {
      /* sandboxed */
    }
  }

  function ensureFreeIconLayout() {
    if (!desktopIcons || desktopIcons.classList.contains("is-free")) return;
    const zoom = window.OqOsx.getZoomFactor ? window.OqOsx.getZoomFactor() : 1;
    const deskRect = desktop.getBoundingClientRect();
    const positions = {};
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      const r = icon.getBoundingClientRect();
      const left = (r.left - deskRect.left) / zoom;
      const top = (r.top - deskRect.top) / zoom;
      positions[icon.dataset.open] = { left, top };
    }
    desktopIcons.classList.add("is-free");
    desktopIcons.style.top = "0";
    desktopIcons.style.right = "0";
    desktopIcons.style.left = "0";
    desktopIcons.style.bottom = "0";
    desktopIcons.style.width = "100%";
    desktopIcons.style.height = "100%";
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      const pos = positions[icon.dataset.open];
      if (!pos) continue;
      icon.style.position = "absolute";
      icon.style.left = `${pos.left}px`;
      icon.style.top = `${pos.top}px`;
      icon.style.right = "auto";
    }
  }

  function applyStoredIconPositions() {
    const stored = loadIconPositions();
    if (!stored || !desktopIcons) return;
    const keys = Object.keys(stored);
    if (!keys.length) return;
    desktopIcons.classList.add("is-free");
    desktopIcons.style.top = "0";
    desktopIcons.style.right = "0";
    desktopIcons.style.left = "0";
    desktopIcons.style.bottom = "0";
    desktopIcons.style.width = "100%";
    desktopIcons.style.height = "100%";
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      const pos = stored[icon.dataset.open];
      if (!pos || typeof pos.left !== "number" || typeof pos.top !== "number") continue;
      icon.style.position = "absolute";
      icon.style.left = `${pos.left}px`;
      icon.style.top = `${pos.top}px`;
      icon.style.right = "auto";
    }
  }

  function persistCurrentIconPositions() {
    if (!desktopIcons || !desktopIcons.classList.contains("is-free")) return;
    const map = {};
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      const left = parseFloat(icon.style.left);
      const top = parseFloat(icon.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        map[icon.dataset.open] = { left, top };
      }
    }
    saveIconPositions(map);
  }

  applyStoredIconPositions();

  if (!opensOnSingleClick && desktopIcons) {
    const DRAG_THRESHOLD = 5;
    for (const icon of desktopIcons.querySelectorAll(".desktop-icon")) {
      icon.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest("a")) return;
        const zoom = window.OqOsx.getZoomFactor ? window.OqOsx.getZoomFactor() : 1;
        const startX = event.clientX;
        const startY = event.clientY;
        let dragging = false;
        let originLeft = 0;
        let originTop = 0;
        const pointerId = event.pointerId;

        function onMove(ev) {
          const dx = (ev.clientX - startX) / zoom;
          const dy = (ev.clientY - startY) / zoom;
          if (!dragging) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            dragging = true;
            ensureFreeIconLayout();
            originLeft = parseFloat(icon.style.left) || 0;
            originTop = parseFloat(icon.style.top) || 0;
            icon.classList.add("is-dragging");
            try {
              icon.setPointerCapture(pointerId);
            } catch {
              /* ignore */
            }
            selectDesktopIcon(icon);
          }
          const deskW = desktop.clientWidth;
          const deskH = desktop.clientHeight;
          const iconW = icon.offsetWidth;
          const iconH = icon.offsetHeight;
          let nextL = originLeft + dx;
          let nextT = originTop + dy;
          nextL = Math.max(0, Math.min(nextL, Math.max(0, deskW - iconW)));
          nextT = Math.max(0, Math.min(nextT, Math.max(0, deskH - iconH)));
          icon.style.left = `${nextL}px`;
          icon.style.top = `${nextT}px`;
        }

        function onUp() {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          window.removeEventListener("pointercancel", onUp, true);
          if (dragging) {
            icon.classList.remove("is-dragging");
            persistCurrentIconPositions();
            // Suppress the click that would fire after a drag.
            const swallow = (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              icon.removeEventListener("click", swallow, true);
            };
            icon.addEventListener("click", swallow, true);
          }
        }

        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
        window.addEventListener("pointercancel", onUp, true);
      });
    }
  }

  // ---------- Get Info sheet ----------
  const getinfoOverlay = document.getElementById("getinfo-overlay");
  const INFO_CATALOG = {
    "win-home": {
      name: "Macintosh HD",
      kind: "Volume",
      kindDetail: "Startup Disk",
      version: "retr-oq Aqua · 2001",
      where: "Desktop",
      blurb: "The theme’s home volume — Finder chrome for launching apps and opening Trash.",
    },
    "win-oq": {
      name: "OQ!",
      kind: "Application",
      kindDetail: "Dictionary browser",
      version: "1.0 (retr-oq)",
      where: "Macintosh HD → Applications",
      blurb: "Browse the Kalaallisut dictionary with live filter. Shared merged data via OqDictSource.loadDictEntries().",
    },
    "win-decon": {
      name: "Word Deconstructor",
      kind: "Application",
      kindDetail: "Morphology explorer",
      version: "1.0 (retr-oq)",
      where: "Macintosh HD → Applications",
      blurb: "Break a Kalaallisut word into roots and affixes (OqDecon / oq-analysis).",
    },
    "win-trash": {
      name: "Trash",
      kind: "Folder",
      kindDetail: "Trash",
      version: "—",
      where: "Desktop",
      blurb: "Items you discard land here. Empty Trash clears them for good (in this skin: the crumpled note).",
    },
    "win-apps": {
      name: "Applications",
      kind: "Folder",
      kindDetail: "Applications folder",
      version: "—",
      where: "Macintosh HD",
      blurb: "OQ!, Word Deconstructor, and About — first-class Aqua Finder window.",
    },
    "win-about": {
      name: "About This Computer",
      kind: "Document",
      kindDetail: "About box",
      version: "Aqua · Cheetah / Puma era",
      where: "Macintosh HD",
      blurb: "Period Aqua description, shared/osx notes, and original-art disclaimer.",
    },
    desktop: {
      name: "Desktop",
      kind: "Folder",
      kindDetail: "Desktop",
      version: "—",
      where: "Finder",
      blurb: "Icons live here. Drag to reposition; Clean Up snaps them into a tidy column.",
    },
  };

  function showGetInfo(key) {
    const info = INFO_CATALOG[key] || INFO_CATALOG.desktop;
    const title = document.getElementById("getinfo-title");
    const nameEl = document.getElementById("getinfo-name");
    const kindEl = document.getElementById("getinfo-kind");
    const kindDetail = document.getElementById("getinfo-kind-detail");
    const versionEl = document.getElementById("getinfo-version");
    const whereEl = document.getElementById("getinfo-where");
    const blurbEl = document.getElementById("getinfo-blurb");
    const glyphEl = document.getElementById("getinfo-glyph");
    if (title) title.textContent = `Info on “${info.name}”`;
    if (nameEl) nameEl.textContent = info.name;
    if (kindEl) kindEl.textContent = info.kind;
    if (kindDetail) kindDetail.textContent = info.kindDetail;
    if (versionEl) versionEl.textContent = info.version;
    if (whereEl) whereEl.textContent = info.where;
    if (blurbEl) blurbEl.textContent = info.blurb;
    if (glyphEl) {
      glyphEl.textContent = "";
      const srcIcon =
        (key && key !== "desktop" && document.querySelector(`.desktop-icon[data-open="${key}"] .desktop-icon-glyph`)) ||
        (key === "win-apps" && document.querySelector('.osx-dock-item[data-open="win-apps"] .dock-glyph')) ||
        null;
      if (srcIcon) {
        glyphEl.appendChild(srcIcon.cloneNode(true));
      }
    }
    if (getinfoOverlay) getinfoOverlay.hidden = false;
  }

  function resolveGetInfoTarget() {
    if (selectedIcon && selectedIcon.dataset.open) return selectedIcon.dataset.open;
    if (iconContextTarget && iconContextTarget.dataset.open) return iconContextTarget.dataset.open;
    return "desktop";
  }

  function wireGetInfoTrigger(el) {
    if (!el) return;
    const link = el.matches("a") ? el : el.querySelector("a");
    if (!link) return;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeDesktopContextMenu();
      showGetInfo(resolveGetInfoTarget());
    });
  }
  wireGetInfoTrigger(document.getElementById("menu-get-info"));
  wireGetInfoTrigger(document.getElementById("desktop-ctx-info"));
  wireGetInfoTrigger(document.getElementById("icon-ctx-info"));

  const iconCtxOpen = document.getElementById("icon-ctx-open");
  if (iconCtxOpen) {
    iconCtxOpen.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      const target = iconContextTarget || selectedIcon;
      closeDesktopContextMenu();
      if (target && target.dataset.open) openFromChrome(target.dataset.open);
    });
  }

  document.getElementById("getinfo-ok")?.addEventListener("click", () => {
    if (getinfoOverlay) getinfoOverlay.hidden = true;
  });

  // ---------- Force Quit sheet (⌥⌘⎋) ----------
  const forcequitOverlay = document.getElementById("forcequit-overlay");
  const forcequitList = document.getElementById("forcequit-list");
  /** @type {string | null} */
  let forcequitSelectedId = null;

  function forceQuitableWindows() {
    // Open (incl. minimized) app/finder windows — not already closed.
    return windows.filter((w) => !w.classList.contains("closed"));
  }

  function renderForceQuitList() {
    if (!forcequitList) return;
    forcequitList.textContent = "";
    forcequitSelectedId = null;
    const open = forceQuitableWindows();
    if (!open.length) {
      const empty = document.createElement("li");
      empty.textContent = "No applications to force quit.";
      empty.className = "is-empty";
      forcequitList.appendChild(empty);
      return;
    }
    open.forEach((win, index) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.winId = win.id;
      const title = windowTitle(win);
      const min = win.classList.contains("minimized") ? " (minimized)" : "";
      li.textContent = `${title}${min}`;
      li.addEventListener("click", () => {
        for (const row of forcequitList.querySelectorAll("li")) {
          row.classList.remove("is-selected");
          row.setAttribute("aria-selected", "false");
        }
        li.classList.add("is-selected");
        li.setAttribute("aria-selected", "true");
        forcequitSelectedId = win.id;
      });
      if (index === 0) {
        li.classList.add("is-selected");
        li.setAttribute("aria-selected", "true");
        forcequitSelectedId = win.id;
      }
      forcequitList.appendChild(li);
    });
  }

  function showForceQuit() {
    renderForceQuitList();
    if (forcequitOverlay) forcequitOverlay.hidden = false;
  }

  function hideForceQuit() {
    if (forcequitOverlay) forcequitOverlay.hidden = true;
  }

  document.querySelector("#menu-force-quit a")?.addEventListener("click", (event) => {
    event.preventDefault();
    showForceQuit();
  });
  document.getElementById("forcequit-cancel")?.addEventListener("click", () => hideForceQuit());
  document.getElementById("forcequit-ok")?.addEventListener("click", () => {
    if (!forcequitSelectedId) {
      hideForceQuit();
      return;
    }
    const win = document.getElementById(forcequitSelectedId);
    hideForceQuit();
    if (!win || win.classList.contains("closed")) return;
    // Force close: bypass minimize; use WM close (routeClose for dict apps).
    if (win.classList.contains("minimized")) {
      // restore briefly so close path is consistent, then close
      wm.restoreWindow(win);
    }
    const closeBtn = win.querySelector(".osx-btn-close");
    if (closeBtn) closeBtn.click();
    else wm.closeWindow(win);
    syncDockRunning();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      // Period ⌥⌘⎋ — Alt+Meta+Escape (also Alt+Ctrl+Escape for non-Mac).
      if (event.key !== "Escape") return;
      if (!(event.altKey && (event.metaKey || event.ctrlKey))) return;
      event.preventDefault();
      showForceQuit();
    },
    true,
  );

  // ---------- Graphite appearance (System Preferences stub) ----------
  // Composes with eras: html[data-osx-era][data-appearance] (see eras.css / NOTES).
  const APPEARANCE_KEY = "retr-oq:aqua-appearance";
  const sysprefsOverlay = document.getElementById("sysprefs-overlay");
  const appearanceBlue = document.getElementById("appearance-blue");
  const appearanceGraphite = document.getElementById("appearance-graphite");

  function getStoredAppearance() {
    try {
      return localStorage.getItem(APPEARANCE_KEY) === "graphite" ? "graphite" : "blue";
    } catch {
      return "blue";
    }
  }

  function applyAppearance(mode) {
    const graphite = mode === "graphite";
    document.documentElement.dataset.appearance = graphite ? "graphite" : "blue";
    if (appearanceBlue) appearanceBlue.checked = !graphite;
    if (appearanceGraphite) appearanceGraphite.checked = graphite;
    try {
      localStorage.setItem(APPEARANCE_KEY, graphite ? "graphite" : "blue");
    } catch {
      /* ignore */
    }
  }

  applyAppearance(getStoredAppearance());

  document.querySelector("#menu-sys-prefs a")?.addEventListener("click", (event) => {
    event.preventDefault();
    applyAppearance(getStoredAppearance());
    if (sysprefsOverlay) sysprefsOverlay.hidden = false;
  });
  appearanceBlue?.addEventListener("change", () => {
    if (appearanceBlue.checked) applyAppearance("blue");
  });
  appearanceGraphite?.addEventListener("change", () => {
    if (appearanceGraphite.checked) applyAppearance("graphite");
  });
  document.getElementById("sysprefs-ok")?.addEventListener("click", () => {
    if (sysprefsOverlay) sysprefsOverlay.hidden = true;
  });

  // Esc dismisses chrome sheets (Force Quit / Get Info / Sys Prefs).
  // Time Machine Esc is handled in timemachine.js (capture) when open.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const tm = document.getElementById("tm-overlay");
    if (tm && !tm.hidden) return;
    if (forcequitOverlay && !forcequitOverlay.hidden) {
      hideForceQuit();
      return;
    }
    if (getinfoOverlay && !getinfoOverlay.hidden) {
      getinfoOverlay.hidden = true;
      return;
    }
    if (sysprefsOverlay && !sysprefsOverlay.hidden) {
      sysprefsOverlay.hidden = true;
    }
  });


  // ---------- Screen Effects (idle host from shared/redmond/screensaver.js) ----------
  const AQUA_SAVERS = window.OqScreenSaverCatalog
    ? window.OqScreenSaverCatalog.forTheme("aqua").map((entry) => entry.id)
    : ["flux", "fieldlines", "solarwinds"];

  function aquaSaverHost() {
    return window.OqScreensaver && (window.OqScreensaver.aqua || window.OqScreensaver.host);
  }

  function saverVendorSrc(id) {
    return "../vendor/screensavers/" + id + "/index.html?v=ss4";
  }

  function startScreenEffect(id) {
    const host = aquaSaverHost();
    if (!host) return false;
    if (id) host.setSrc(saverVendorSrc(id));
    else if (typeof host.setSrc === "function") {
      const pick = AQUA_SAVERS[Math.floor(Math.random() * AQUA_SAVERS.length)];
      host.setSrc(saverVendorSrc(pick));
    }
    host.start();
    return true;
  }

  function wireScreenEffectsMenu() {
    const startBtn = document.getElementById("menu-screen-effects");
    if (startBtn) {
      startBtn.querySelector("a").addEventListener("click", (event) => {
        event.preventDefault();
        startScreenEffect(null);
      });
    }
    const ctxEffects = document.getElementById("desktop-ctx-effects");
    if (ctxEffects) {
      ctxEffects.querySelector("a").addEventListener("click", (event) => {
        event.preventDefault();
        closeDesktopContextMenu();
        startScreenEffect(null);
      });
    }
    for (const item of document.querySelectorAll("#menu-bar [data-saver]")) {
      const link = item.querySelector("a");
      if (!link) continue;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        startScreenEffect(item.dataset.saver);
      });
    }
  }
  wireScreenEffectsMenu();

  // Test/debug hook: shorten idle without waiting ~75s in CI.
  window.__aquaScreenEffects = {
    start: startScreenEffect,
    setIdleMs(ms) {
      const host = aquaSaverHost();
      if (host && host.setIdleMs) host.setIdleMs(ms);
    },
    host: aquaSaverHost,
  };

  // ---------- Cmd-Tab / Ctrl-Tab application switcher ----------
  const appSwitcher = document.getElementById("app-switcher");
  const appSwitcherTrack = document.getElementById("app-switcher-track");
  const appSwitcherLabel = document.getElementById("app-switcher-label");
  let switcherActive = false;
  let switcherIndex = 0;
  /** @type {{ id: string, label: string, glyph: Node }[]} */
  let switcherItems = [];
  let switcherMod = null; // "meta" | "control"

  function switcherCandidates() {
    const order = DESKTOP_ICON_ORDER.slice();
    const open = [];
    for (const id of order) {
      const win = document.getElementById(id);
      if (win && !win.classList.contains("closed")) open.push(win);
    }
    // Prefer open/non-closed windows; if none, fall back to Dock-worthy apps.
    const list = open.length > 0 ? open : order.map((id) => document.getElementById(id)).filter(Boolean);
    return list.map((win) => {
      const dock = dockEl && dockEl.querySelector(`.osx-dock-item[data-open="${win.id}"]`);
      const label =
        (dock && (dock.getAttribute("data-dock-label") || dock.getAttribute("aria-label"))) ||
        windowTitle(win);
      const glyphSrc = dock && dock.querySelector(".dock-glyph");
      const glyph = glyphSrc ? glyphSrc.cloneNode(true) : document.createElement("span");
      return { id: win.id, label, glyph };
    });
  }

  function renderSwitcher() {
    if (!appSwitcherTrack || !appSwitcherLabel) return;
    appSwitcherTrack.textContent = "";
    switcherItems.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "app-switcher-item" + (i === switcherIndex ? " is-focused" : "");
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", i === switcherIndex ? "true" : "false");
      el.appendChild(item.glyph);
      appSwitcherTrack.appendChild(el);
    });
    const cur = switcherItems[switcherIndex];
    appSwitcherLabel.textContent = cur ? cur.label : "";
  }

  function openSwitcher(reverse) {
    switcherItems = switcherCandidates();
    if (switcherItems.length === 0) return;
    switcherActive = true;
    // Start on the next app (or previous if Shift), like early OS X.
    switcherIndex = reverse
      ? (switcherItems.length - 1) % switcherItems.length
      : switcherItems.length > 1
        ? 1 % switcherItems.length
        : 0;
    if (appSwitcher) appSwitcher.hidden = false;
    renderSwitcher();
  }

  function cycleSwitcher(reverse) {
    if (!switcherActive || switcherItems.length === 0) return;
    const n = switcherItems.length;
    switcherIndex = reverse ? (switcherIndex - 1 + n) % n : (switcherIndex + 1) % n;
    renderSwitcher();
  }

  function cancelSwitcher() {
    switcherActive = false;
    switcherMod = null;
    switcherItems = [];
    if (appSwitcher) appSwitcher.hidden = true;
    if (appSwitcherTrack) appSwitcherTrack.textContent = "";
    if (appSwitcherLabel) appSwitcherLabel.textContent = "";
  }

  function activateSwitcher() {
    if (!switcherActive) return;
    const cur = switcherItems[switcherIndex];
    cancelSwitcher();
    if (cur) openFromChrome(cur.id);
  }

  window.addEventListener(
    "keydown",
    (event) => {
      const isTab = event.key === "Tab";
      if (event.key === "Escape" && switcherActive) {
        event.preventDefault();
        cancelSwitcher();
        return;
      }
      if (!isTab) return;
      const meta = event.metaKey;
      const ctrl = event.ctrlKey && !event.metaKey;
      if (!meta && !ctrl) return;

      // Meta+Tab always owns the theme switcher. Ctrl+Tab opens/cycles too
      // (non-Mac keyboards) but we only preventDefault while we handle it —
      // once the switcher is up, both stay captured.
      event.preventDefault();
      event.stopPropagation();

      if (!switcherActive) {
        switcherMod = meta ? "meta" : "control";
        openSwitcher(event.shiftKey);
      } else {
        cycleSwitcher(event.shiftKey);
      }
    },
    true,
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (!switcherActive) return;
      if (event.key === "Meta" || event.key === "OS") {
        if (switcherMod === "meta" || switcherMod == null) activateSwitcher();
        return;
      }
      if (event.key === "Control") {
        if (switcherMod === "control" || switcherMod == null) activateSwitcher();
      }
    },
    true,
  );

  window.addEventListener("blur", () => {
    if (switcherActive) cancelSwitcher();
  });

  // Shut Down
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  function showShutdown() {
    shutdownOverlay.hidden = false;
  }
  document.querySelector("#menu-shutdown a").addEventListener("click", (event) => {
    event.preventDefault();
    showShutdown();
  });
  const aboutShutdown = document.getElementById("about-shutdown");
  if (aboutShutdown) {
    aboutShutdown.addEventListener("click", () => showShutdown());
  }
  document.getElementById("shutdown-cancel").addEventListener("click", () => {
    shutdownOverlay.hidden = true;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    window.location.href = "../";
  });

  // ---------- Empty Trash + crumpled-note easter egg ----------
  const emptyTrashOverlay = document.getElementById("empty-trash-overlay");
  const trashNoteItem = document.getElementById("trash-note-item");
  const trashEmptyCopy = document.getElementById("trash-empty-copy");
  const noteOverlay = document.getElementById("note-overlay");
  let trashHasNote = true;

  function refreshTrashCopy() {
    if (!trashEmptyCopy) return;
    if (trashHasNote) {
      trashEmptyCopy.textContent =
        "Almost empty — one crumpled note remains. Empty Trash clears it for good.";
    } else {
      trashEmptyCopy.textContent =
        "Nothing here yet. Drag something in someday — until then the wire basket waits patiently.";
    }
    if (trashNoteItem) trashNoteItem.hidden = !trashHasNote;
  }
  refreshTrashCopy();

  function showEmptyTrash() {
    if (!emptyTrashOverlay) return;
    const msg = document.getElementById("empty-trash-message");
    if (msg) {
      msg.textContent = trashHasNote
        ? "Are you sure you want to permanently remove the items in the Trash?"
        : "The Trash is already empty.";
    }
    emptyTrashOverlay.hidden = false;
  }

  const emptyTrashLink = document.querySelector("#menu-empty-trash a");
  if (emptyTrashLink) {
    emptyTrashLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (menuEmptyTrash && menuEmptyTrash.classList.contains("is-disabled")) return;
      showEmptyTrash();
    });
  }
  const emptyTrashCancel = document.getElementById("empty-trash-cancel");
  const emptyTrashOk = document.getElementById("empty-trash-ok");
  if (emptyTrashCancel) {
    emptyTrashCancel.addEventListener("click", () => {
      emptyTrashOverlay.hidden = true;
    });
  }
  if (emptyTrashOk) {
    emptyTrashOk.addEventListener("click", () => {
      trashHasNote = false;
      refreshTrashCopy();
      emptyTrashOverlay.hidden = true;
    });
  }
  if (trashNoteItem) {
    trashNoteItem.addEventListener("click", () => {
      if (noteOverlay) noteOverlay.hidden = false;
    });
  }
  const noteOk = document.getElementById("note-ok");
  if (noteOk) {
    noteOk.addEventListener("click", () => {
      if (noteOverlay) noteOverlay.hidden = true;
    });
  }

  // ---------- OQ! ----------
  const OQ_DEFAULT_ROWS = 50;
  const OQ_MAX_FILTERED_ROWS = 200;
  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  // Initial Chicago line; loadDictEntries() refreshes via applyDictAttribution().
  const oqAttributionEl = document.getElementById("oq-attribution");
  if (oqAttributionEl) oqAttributionEl.textContent = DICT_ATTRIBUTION;

  let oqEntries = null;
  let oqLoadStarted = false;
  let oqSelectedRow = null;

  oqTbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    if (oqSelectedRow) oqSelectedRow.classList.remove("highlighted");
    row.classList.add("highlighted");
    oqSelectedRow = row;
  });

  function renderOqRows(rows) {
    oqTbody.textContent = "";
    oqSelectedRow = null;
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      lexemeCell.textContent = syllabify(entry.lexeme);
      const glossCell = document.createElement("td");
      glossCell.textContent = entry.gloss_en;
      row.append(lexemeCell, glossCell);
      oqTbody.appendChild(row);
    }
  }

  function renderOqResults() {
    if (oqEntries === null) return;
    const query = oqFilter.value.trim();
    if (query === "") {
      renderOqRows(oqEntries.slice(0, OQ_DEFAULT_ROWS));
      const enrich =
        typeof wasKatersatLoaded === "function" && wasKatersatLoaded()
          ? " (Chicago + katersat)"
          : " (Chicago)";
      oqStatus.textContent = `${oqEntries.length.toLocaleString()} entries loaded${enrich} — showing first ${OQ_DEFAULT_ROWS}, type to filter.`;
      return;
    }
    const matches = filterDictEntries(oqEntries, query);
    renderOqRows(matches.slice(0, OQ_MAX_FILTERED_ROWS));
    oqStatus.textContent =
      matches.length === 0
        ? "No matches."
        : matches.length > OQ_MAX_FILTERED_ROWS
          ? `Showing first ${OQ_MAX_FILTERED_ROWS} of ${matches.length.toLocaleString()} matches.`
          : `${matches.length.toLocaleString()} match${matches.length === 1 ? "" : "es"}.`;
  }

  async function startOqLoad() {
    if (oqLoadStarted) return;
    oqLoadStarted = true;
    oqStatus.textContent = "Loading dictionary…";
    try {
      oqEntries = await loadDictEntries();
    } catch (err) {
      oqStatus.textContent = `Could not load dictionary (${err.message}). Close and reopen OQ! to retry.`;
      oqLoadStarted = false;
      return;
    }
    renderOqResults();
  }

  oqFilter.addEventListener("input", () => {
    renderOqResults();
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });

  // ---------- Word Deconstructor (router screen=decon) ----------
  const deconWord = document.getElementById("decon-word");
  const deconRootFirst = document.getElementById("decon-root-first");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");

  function renderDeconResults({ matches, dictMatch }) {
    deconResults.textContent = "";
    for (const match of matches) {
      const card = document.createElement("div");
      card.className = "decon-card";
      const header = document.createElement("div");
      const tag = document.createElement("span");
      tag.className = match.approximate ? "decon-tag decon-tag--approximate" : "decon-tag";
      tag.textContent = match.approximate ? "~ approximate" : "exact rebuild";
      const word = document.createElement("span");
      word.className = "decon-word";
      word.textContent = ` ${match.word}`;
      header.append(tag, word);
      card.appendChild(header);
      if (match.meaning) {
        const meaning = document.createElement("div");
        meaning.className = "decon-meaning";
        meaning.textContent = match.meaning;
        card.appendChild(meaning);
      }
      const breakdown = document.createElement("div");
      breakdown.className = "decon-breakdown";
      const rows = deconRootFirst.checked ? match.breakdown : [...match.breakdown].reverse();
      for (const { marker, text, changedRanges, gloss } of rows) {
        const row = document.createElement("div");
        let cursor = 0;
        row.appendChild(document.createTextNode(marker));
        for (const { start, end } of changedRanges) {
          if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
          const changed = document.createElement("span");
          changed.className = "decon-changed";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(` — ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);
      deconResults.appendChild(card);
    }
    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `Found in the dictionary: ${dictMatch.expected} — ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;
  deconRootFirst.checked = getStoredRootFirst();
  const deconController = createController({
    isRootFirst: () => deconRootFirst.checked,
    onStatus: (text) => {
      deconStatus.textContent = text;
    },
    onRender: (analysis) => renderDeconResults(analysis),
    onClear: () => {
      deconResults.textContent = "";
    },
  });

  deconRootFirst.addEventListener("change", () => {
    setStoredRootFirst(deconRootFirst.checked);
    deconController.reRenderLast();
    window.OqRouter.navigate({ order: deconRootFirst.checked ? null : "final" }, { replace: true });
  });

  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  // ---------- Router ----------
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq") {
      if (winOq.classList.contains("closed") || winOq.classList.contains("minimized")) {
        wm.forceOpenWindow(winOq);
      } else {
        wm.focus(winOq);
      }
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
      syncDockRunning();
      syncAppMenu(winOq);
    } else if (screen === "decon") {
      if (winDecon.classList.contains("closed") || winDecon.classList.contains("minimized")) {
        wm.forceOpenWindow(winDecon);
      } else {
        wm.focus(winDecon);
      }
      const orderParam = params.get("order");
      const rootFirst = orderParam ? orderParam !== "final" : getStoredRootFirst();
      if (deconRootFirst.checked !== rootFirst) {
        deconRootFirst.checked = rootFirst;
        deconController.reRenderLast();
      }
      const word = params.get("word") || "";
      if (deconWord.value !== word) {
        deconWord.value = word;
        deconController.search(word);
      }
      syncDockRunning();
      syncAppMenu(winDecon);
    } else {
      // screen: null — do not close OQ! / Word Deconstructor (independent).
      // Explicit close already updated the query via routeClose + WM close.
      syncDockRunning();
    }
  });

  syncDockRunning();
  syncAppMenu(null);
})();
