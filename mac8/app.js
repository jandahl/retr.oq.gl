(() => {
  "use strict";

  // Mac-lineage window/menu/drag logic, adapted in spirit from
  // mac1984/app.js's own makeDraggable/makeResizable/focus/menu-bar
  // functions (see that file's own comments) -- genuinely new code, not a
  // shared module, since no Mac-lineage equivalent of
  // shared/redmond/window-manager.js exists and this task doesn't create
  // one (CLAUDE.md's mac1984/ section: do not touch or share code with
  // mac1984/'s own bespoke drag/window logic).
  //
  // Classic scripts sharing state via window.<Namespace> globals, same
  // convention as every other theme (see CLAUDE.md) -- this file reads
  // window.OqDictSource, window.OqHyphenation, window.OqRouter, and
  // window.OqDecon, all classic scripts that must load before this one
  // (see index.html's own script-order comment).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".control-box, button, a, input, select, textarea")) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    function onLostPointerCapture() {
      activePointerId = null;
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", onLostPointerCapture);
  }

  // Real Mac OS 8.1 windows resize from a single bottom-right growbox only
  // -- unlike win98/xp/win7's own omnidirectional edge/corner resize
  // handles (a later Windows convention), the classic Mac Finder never
  // offered edge-drag resizing at all, only the one striped corner box.
  function makeResizable(handle, target, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation(); // don't also trigger the window's own focus-on-pointerdown
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    function onLostPointerCapture() {
      activePointerId = null;
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", onLostPointerCapture);
  }

  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".mac8-window:not(.mac8-dialog)"));
  let zTop = 10;

  // Real Mac OS never showed a browser's own right-click menu over the
  // desktop -- suppress it over the bare desktop background.
  desktop.addEventListener("contextmenu", (event) => {
    if (event.target === desktop) event.preventDefault();
  });

  // ---------- Desktop right-click / Control-click context menu ----------
  // Mac OS 8 introduced the Contextual Menu Manager -- the first real
  // right-click/Control-click desktop menu in Mac OS history (mac1984/ is
  // 1984, one-button mouse, no such thing, and deliberately stays
  // suppress-only; don't touch it). The browser's own "contextmenu" event
  // already fires for both a real right-click *and* a Control-click on
  // Mac, so no separate Control-click handling is needed -- same trigger
  // win98/app.js's own desktop-context-menu code uses.
  const desktopIcons = document.querySelector(".desktop-icons");
  const desktopContextMenu = document.getElementById("desktop-context-menu");
  const desktopContextCleanup = document.getElementById("desktop-context-cleanup");
  const desktopContextToggleIcons = document.getElementById("desktop-context-toggle-icons");
  const DESKTOP_ICONS_STORAGE_KEY = "retr-oq:mac8-desktop-icons";

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  // Real Mac OS selects an icon on click (a second click, or dragging a
  // marquee, is what actually opens/moves it) -- this theme's icons are
  // plain buttons that still open their window on a single click (see
  // this file's own "Desktop icons open... on a single click" comment
  // below), but they can still carry a real selection highlight for
  // "Clean Up Desktop" to act on. No drag-to-rearrange exists here (see
  // this file's own makeDraggable, which is only ever wired to window
  // titlebars, never to .desktop-icon), so this is the one real,
  // always-meaningful thing "Clean Up Desktop" can do.
  for (const icon of document.querySelectorAll(".desktop-icon")) {
    icon.addEventListener("pointerdown", () => {
      for (const other of document.querySelectorAll(".desktop-icon.selected")) {
        if (other !== icon) other.classList.remove("selected");
      }
      icon.classList.add("selected");
    });
  }
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target !== desktop) return;
    for (const icon of document.querySelectorAll(".desktop-icon.selected")) icon.classList.remove("selected");
  });

  function cleanUpDesktop() {
    for (const icon of document.querySelectorAll(".desktop-icon.selected")) icon.classList.remove("selected");
  }

  function getStoredIconsHidden() {
    try {
      return localStorage.getItem(DESKTOP_ICONS_STORAGE_KEY) === "hidden";
    } catch {
      return false; // localStorage can throw in a sandboxed iframe -- default to icons shown
    }
  }

  function applyIconsHidden(hidden) {
    desktopIcons.classList.toggle("icons-hidden", hidden);
    desktopContextToggleIcons.classList.toggle("checked", !hidden);
    try {
      localStorage.setItem(DESKTOP_ICONS_STORAGE_KEY, hidden ? "hidden" : "shown");
    } catch {
      // sandboxed iframe or storage disabled -- still applies for this visit, just doesn't persist
    }
  }

  // Applied on load too, not just from the menu -- a returning visitor who
  // already hid the icons should get that back immediately, same as
  // win98/app.js's own applyScheme(getStoredScheme()) on load.
  applyIconsHidden(getStoredIconsHidden());

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return; // not over an icon -- real Mac OS gives icons their own (unbuilt) contextual menu instead
    event.preventDefault();
    // Clamp so the menu never opens partly off-screen, same reasoning
    // win98/app.js's own desktop-context-menu handler uses. event.clientX/Y
    // and getBoundingClientRect() both report already-zoomed (rendered) px
    // under this theme's own `html { zoom: 2 }` (see the zoom box handler
    // above and style.css's own comment) -- but a CSS length assigned via
    // JS is a *pre*-zoom value that gets multiplied by zoom again on
    // render, so dividing back out here is what keeps the menu positioned
    // where the click actually happened instead of twice as far away.
    const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 160; // matches .desktop-context-menu's own min-width
    const menuHeight = 44; // two real items tall
    const left = Math.min(event.clientX, deskRect.right - menuWidth) / zoomFactor;
    const top = Math.min(event.clientY, deskRect.bottom - menuHeight) / zoomFactor;
    desktopContextMenu.style.left = `${left}px`;
    desktopContextMenu.style.top = `${top}px`;
    desktopContextMenu.hidden = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!desktopContextMenu.hidden && !desktopContextMenu.contains(event.target)) {
      closeDesktopContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !desktopContextMenu.hidden) closeDesktopContextMenu();
  });
  desktopContextCleanup.addEventListener("click", (event) => {
    event.preventDefault();
    closeDesktopContextMenu();
    cleanUpDesktop();
  });
  desktopContextToggleIcons.addEventListener("click", (event) => {
    event.preventDefault();
    closeDesktopContextMenu();
    applyIconsHidden(!desktopIcons.classList.contains("icons-hidden"));
  });

  // Zoom box geometry animation -- same "set transition, force a reflow so
  // the old rect is committed as the start point, then mutate" technique
  // shared/redmond/window-manager.js's own withGeometryTransition uses for
  // win98/xp/win7's maximize/restore, kept as a separate copy here rather
  // than shared since mac8's own window logic is deliberately bespoke (see
  // this file's own top comment). A little snappier and slightly bouncy --
  // real Mac OS 8.1's zoom had a quick spring to it, unlike Windows'
  // straighter ease.
  function animateZoomGeometry(win, mutate) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mutate();
      return;
    }
    win.style.transition = "top 200ms cubic-bezier(0.34, 1.56, 0.64, 1), left 200ms cubic-bezier(0.34, 1.56, 0.64, 1), " +
      "width 200ms cubic-bezier(0.34, 1.56, 0.64, 1), height 200ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    void win.offsetWidth;
    mutate();
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      win.style.transition = "";
      win.removeEventListener("transitionend", onEnd);
    }
    function onEnd(event) {
      if (event.target === win) finish();
    }
    win.addEventListener("transitionend", onEnd);
    setTimeout(finish, 280);
  }

  // Swaps .mac8-title-bar's own "inactive" class, which is what actually
  // draws (or doesn't) the active-window chrome and hides/shows the close
  // and zoom boxes -- the whole activation mechanism, not a layer on top
  // of it, same idea as mac1984/app.js's own focus().
  function focus(win) {
    const bar = win.querySelector(".mac8-title-bar");
    if (!bar.classList.contains("inactive")) return; // already active
    for (const w of windows) {
      const b = w.querySelector(".mac8-title-bar");
      if (w === win) b.classList.remove("inactive");
      else b.classList.add("inactive");
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  // Router wiring only cares about OQ! and DECON's open/closed state --
  // every other window's open/closed state is plain UI state, not URL
  // state, same split win7/app.js makes for its own windows.
  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");

  function openWindow(win) {
    win.classList.remove("closed");
    focus(win);
  }

  function closeWindowEl(win) {
    const bar = win.querySelector(".mac8-title-bar");
    const wasActive = !bar.classList.contains("inactive");
    win.classList.add("closed");
    if (wasActive) {
      const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
      if (next) {
        focus(next); // marks every other window (including this one) inactive
      } else {
        // No other window to hand focus to -- without this, this window's
        // own bar would keep reading as "active" (no .inactive class)
        // while hidden, and a later focus(win) reopening it would hit
        // focus()'s own early-return guard ("already active") and skip
        // the z-index bump.
        bar.classList.add("inactive");
      }
    }
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);
    const zoomBtn = document.getElementById(`${id}-zoom`);
    const growbox = document.getElementById(`${id}-growbox`);

    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    if (growbox) makeResizable(growbox, win, 224, 128); // matches .mac8-window's min-width/min-height

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (win === winOq || win === winDecon) {
          // Routed windows close via the URL, same single-source-of-truth
          // rule every other theme's router wiring follows (see
          // CLAUDE.md's dos/ section) -- never call closeWindowEl()
          // directly for these two.
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }

    // Zoom box: toggles between the window's current (dragged/resized)
    // rect and a rect filling the desktop -- the real Mac OS 8.1 zoom
    // box's behavior, restoring the exact prior rect on a second click
    // rather than a fixed "maximized" size. Animated via
    // animateZoomGeometry below -- real Mac OS zoomed with a quick,
    // slightly springy grow/shrink, not an instant jump.
    if (zoomBtn) {
      let savedRect = null;
      zoomBtn.addEventListener("click", () => {
        focus(win);
        if (savedRect) {
          const target = savedRect;
          savedRect = null;
          animateZoomGeometry(win, () => {
            win.style.top = target.top;
            win.style.left = target.left;
            win.style.width = target.width;
            win.style.height = target.height;
          });
        } else {
          savedRect = {
            top: win.style.top,
            left: win.style.left,
            width: win.style.width,
            height: win.style.height,
          };
          // getBoundingClientRect() reports already-zoomed (rendered) px
          // under this theme's own `html { zoom: 2 }` (see style.css's own
          // comment on it), but a style.width/height assignment is read as
          // *pre*-zoom CSS length and gets multiplied by zoom again on
          // render -- dividing back out here is what keeps the zoomed
          // window's rect matching the desktop's real rendered size
          // instead of rendering at 2x that (4x the area). Drag/resize
          // elsewhere in this file only ever work with *differences*
          // between two such rects (dx/dy), which cancel this same offset
          // out on their own -- only this one absolute assignment needs
          // the explicit divide.
          const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
          const desktopRect = desktop.getBoundingClientRect();
          animateZoomGeometry(win, () => {
            win.style.top = "0px";
            win.style.left = "0px";
            win.style.width = `${desktopRect.width / zoomFactor}px`;
            win.style.height = `${desktopRect.height / zoomFactor}px`;
          });
        }
      });
    }
  }

  // Desktop icons open (and re-open) their window on a single click.
  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      const target = document.getElementById(icon.dataset.open);
      if (!target) return;
      if (target === winOq) {
        window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
        return;
      }
      if (target === winDecon) {
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        return;
      }
      openWindow(target);
    });
  }

  // Apple-menu "About This Macintosh..." also opens the About window.
  for (const item of document.querySelectorAll('[role="menu"] [data-open]')) {
    const link = item.querySelector("a");
    if (link) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(item.dataset.open);
        if (target) openWindow(target);
      });
    }
  }

  // ---------- Menu bar ----------
  // Same JS-owned open/close state as mac1984/app.js's own menu bar (see
  // its comment): the framework here (classic.css) supplies no menu-bar
  // component at all, so this whole block -- including the dropdown
  // visibility rule in style.css -- is this theme's own, not adapted from
  // a vendored default.
  const menuBar = document.getElementById("menu-bar");
  const menuItems = Array.from(
    menuBar.querySelectorAll(':scope > [role="menu-item"][aria-haspopup="true"]'),
  );
  let openMenuItem = null;

  function closeMenu() {
    if (!openMenuItem) return;
    openMenuItem.classList.remove("menu-open");
    openMenuItem.setAttribute("aria-expanded", "false");
    openMenuItem.blur();
    openMenuItem = null;
  }

  function openMenu(item) {
    if (openMenuItem === item) return;
    closeMenu();
    item.classList.add("menu-open");
    item.setAttribute("aria-expanded", "true");
    openMenuItem = item;
  }

  for (const item of menuItems) {
    item.setAttribute("aria-expanded", "false");
    item.addEventListener("click", (event) => {
      if (event.target.closest('[role="menu"]')) return; // handled by the link's own listener
      if (openMenuItem === item) closeMenu();
      else openMenu(item);
    });
    // Real Mac menu bars open whatever you're pointing at once a menu is
    // already open, so dragging across File/Edit/View works without
    // re-clicking each one.
    item.addEventListener("pointerenter", () => {
      if (openMenuItem && openMenuItem !== item) openMenu(item);
    });
    for (const link of item.querySelectorAll('[role="menu"] a')) {
      if (!link.closest("[data-open]")) {
        link.addEventListener("click", (event) => {
          event.preventDefault(); // every other menu command here is a placeholder ("#")
          closeMenu();
        });
      } else {
        link.addEventListener("click", () => closeMenu());
      }
    }
  }

  document.addEventListener("pointerdown", (event) => {
    if (openMenuItem && !menuBar.contains(event.target)) closeMenu();
  });

  // ---------- Restart ----------
  // Era-plausible: reload the theme (boot again) rather than a silent no-op.
  const restartItem = document.getElementById("menu-restart");
  if (restartItem) {
    restartItem.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      window.location.reload();
    });
  }

  // ---------- Shut Down ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("menu-shutdown").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    // Sends the visitor back to the theme picker, not just closing the
    // dialog -- a relative "../" so this keeps working when served from a
    // fork or a local http.server, same as every other theme's own Shut
    // Down/Turn Off Computer.
    window.location.href = "../";
  });

  // ---------- OQ! (Kalaallisut dictionary lookup) ----------
  // Same fetch/cache/filter/hyphenate pipeline as every other theme's own
  // OQ!, reused via shared/dict-source.js and shared/hyphenation.js.
  const OQ_DEFAULT_ROWS = 50;
  const OQ_MAX_FILTERED_ROWS = 200;

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

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
      oqStatus.textContent = `${oqEntries.length.toLocaleString()} entries loaded -- showing first ${OQ_DEFAULT_ROWS}, type to filter.`;
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
    oqStatus.textContent = "Loading dictionary...";
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

  // ---------- DECON (word deconstruction) ----------
  // shared/decon-app.js owns the search/abort/order-persistence core --
  // rendering here is this theme's own sunken-panel-style markup.
  const deconWord = document.getElementById("decon-word");
  const deconRootFirst = document.getElementById("decon-root-first");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");

  function renderDeconResults(result) {
    deconResults.textContent = "";
    if (!result) return;

    if (result.type === "sentence") {
      if (result.clause && result.clause.text) {
        const clauseBanner = document.createElement("div");
        clauseBanner.className = "decon-sentence-header";
        const modeLabel = result.clause.mode ? `[${result.clause.mode.toUpperCase()}] ` : "";
        clauseBanner.textContent = `${modeLabel}${result.clause.text}`;
        deconResults.appendChild(clauseBanner);
      }

      for (const token of (result.tokens || [])) {
        const card = document.createElement("div");
        card.className = "decon-card";

        const header = document.createElement("div");
        const tag = document.createElement("span");
        const band = token.reading?.band;
        tag.className = band === "approximate" ? "decon-tag decon-tag--approximate" : "decon-tag";
        tag.textContent = band ? band : "token";
        const word = document.createElement("span");
        word.className = "decon-word";
        word.textContent = ` ${token.surface}`;
        header.append(tag, word);
        card.appendChild(header);

        if (token.reading && token.reading.headline) {
          const meaning = document.createElement("div");
          meaning.className = "decon-meaning";
          meaning.textContent = token.reading.headline;
          card.appendChild(meaning);
        }

        if (token.breakdown && token.breakdown.length > 0) {
          const breakdown = document.createElement("div");
          breakdown.className = "decon-breakdown";
          const rows = deconRootFirst.checked ? token.breakdown : [...token.breakdown].reverse();
          for (const { marker, text, changedRanges, gloss } of rows) {
            const row = document.createElement("div");
            let cursor = 0;
            row.appendChild(document.createTextNode(marker));
            for (const { start, end } of (changedRanges || [])) {
              if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
              const changed = document.createElement("span");
              changed.className = "decon-truncated";
              changed.textContent = text.slice(start, end);
              row.appendChild(changed);
              cursor = end;
            }
            if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
            row.appendChild(document.createTextNode(` - ${gloss}`));
            breakdown.appendChild(row);
          }
          card.appendChild(breakdown);
        }

        deconResults.appendChild(card);
      }
      return;
    }

    const matches = result.matches || [];
    const dictMatch = result.dictMatch;
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
          changed.className = "decon-truncated";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(` - ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);

      deconResults.appendChild(card);
    }

    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `Found in the dictionary: ${dictMatch.expected} -- ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;
  deconRootFirst.checked = getStoredRootFirst();

  const deconController = createController({
    isRootFirst: () => deconRootFirst.checked,
    onStatus: (text) => { deconStatus.textContent = text; },
    onRender: (analysis) => renderDeconResults(analysis),
    onClear: () => { deconResults.textContent = ""; },
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

  // ---------- Router wiring: OQ! and DECON's shared open/close/state ----------
  // Mirrors win7/app.js's identical onChange callback (see its own
  // comment) -- .closed/openWindow/focus stand in for that file's
  // minimize/forceOpenWindow/closeWindow since this theme has no taskbar
  // to minimize to.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq") {
      if (winOq.classList.contains("closed")) openWindow(winOq);
      else focus(winOq);
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
    } else if (screen === "decon") {
      if (winDecon.classList.contains("closed")) openWindow(winDecon);
      else focus(winDecon);
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
    } else {
      if (!winOq.classList.contains("closed")) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed")) closeWindowEl(winDecon);
    }
  });

  // ---------- Menu bar clock ----------
  // Real-time updating text, not a static screenshot-style clock -- same
  // convention win98/xp/win7's own taskbar clocks already follow. Real
  // Mac OS 8 always shows one at the menu bar's own right edge.
  const clockEl = document.getElementById("menu-clock");
  // Honor the visitor's own 24-hour-clock preference when the browser
  // exposes one; default to 24-hour when it doesn't rather than assuming
  // English 12-hour AM/PM.
  let use24Hour = true;
  try {
    const resolved = Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
    if (typeof resolved.hour12 === "boolean") use24Hour = !resolved.hour12;
  } catch {}
  function updateClock() {
    const now = new Date();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    if (use24Hour) {
      clockEl.textContent = `${String(now.getHours()).padStart(2, "0")}:${minutes}`;
      return;
    }
    let hours = now.getHours();
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    clockEl.textContent = `${hours}:${minutes} ${suffix}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- Boot screen ----------
  // Passive auto-boot like mac1984 (no power button). Optional chime on the
  // first pointer/key gesture unlocks AudioContext under autoplay policy.
  // Not shared code -- each Mac-lineage theme owns its own app.js per CLAUDE.md.
  const bootScreen = document.getElementById("boot-screen");
  const bootSequence = document.getElementById("boot-sequence");

  function playChime() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      // Mac OS 8's real startup sound was a richer multi-tone chime, not the
      // old 128K Mac's single square-wave beep -- two quick notes back to
      // back distinguishes it from mac1984's single tone.
      const notes = [
        { freq: 523.25, start: 0, dur: 0.18 }, // C5
        { freq: 783.99, start: 0.16, dur: 0.28 }, // G5
      ];
      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      });
    } catch {
      // Web Audio unavailable/blocked -- boot proceeds silently
    }
  }

  if (bootScreen && bootSequence) {
    bootSequence.classList.add("visible");
    setTimeout(() => bootScreen.classList.add("hidden"), 1400);
    const unlockChime = () => {
      playChime();
      window.removeEventListener("pointerdown", unlockChime, true);
      window.removeEventListener("keydown", unlockChime, true);
    };
    window.addEventListener("pointerdown", unlockChime, { once: true, capture: true });
    window.addEventListener("keydown", unlockChime, { once: true, capture: true });
  }
})();
