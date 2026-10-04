(() => {
  "use strict";

  // Plain classic script, matching this repo's convention (see CLAUDE.md)
  // -- shares state with shared/dict-source.js, shared/hyphenation.js, and
  // shared/redmond/window-manager.js via window.<Namespace> globals rather
  // than imports, so index.html has to load all three before this file.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const desktop = document.getElementById("desktop");
  const taskbarWindows = document.getElementById("taskbar-windows");
  const windows = Array.from(document.querySelectorAll(".xp-window"));

  const MIN_WIN_WIDTH = 200;
  const MIN_WIN_HEIGHT = 120;

  // Drag/resize/focus/minimize/maximize/close/taskbar-buttons/viewport-
  // clamp all come from shared/redmond/window-manager.js -- the same
  // theme-agnostic "Redmond" window-chrome behavior win98/app.js uses, see
  // that module's own file comment for why it's shared rather than
  // reimplemented per theme. What's genuinely xp-specific stays below:
  // OQ!'s own lazy dictionary load (wired in as onOpen, since every
  // window-opening trigger already funnels through the shared module's
  // one openWindow()), the Turn Off Computer dialog, and the taskbar
  // clock.
  // OQ! and DECON are the two windows whose open/closed state is real,
  // shareable URL state (?screen=oq&filter=... / ?screen=decon&word=...),
  // the same way dos/'s DICT.EXE/DECON.EXE own theirs via
  // shared/router.js -- see routeOpen/routeClose below and this file's own
  // "OQ! router wiring"/"DECON" sections, mirroring win98/app.js's
  // identical wiring.
  const winOq = document.getElementById("win-oq");
  // Word Deconstructor is a Luna tab inside #win-oq. One OQ! launch icon;
  // resolveOpen still maps a leftover win-decon id onto this shell.
  let pendingOqScreen = null;
  const bootScreen = document.getElementById("boot-screen");

  const { openWindow, forceOpenWindow, closeWindow } = window.OqRedmond.initWindowManager({
    desktop,
    taskbarWindows,
    windows,
    resizeHandleSelector: ".xp-resize-handle",
    minWidth: MIN_WIN_WIDTH,
    minHeight: MIN_WIN_HEIGHT,
    // Luna's real minimize/maximize animations had a bit more ease-out
    // "settle" to them than Win98's flat snap -- a touch longer and
    // curved, not linear, without going as soft/glassy as win7's Aero
    // profile below. minimizeStyle isn't set -- same "outline" default as
    // win98/app.js, for the same reason (see its own comment).
    animation: {
      geometryMs: 180,
      geometryEasing: "ease-out",
      minimizeMs: 200,
      minimizeEasing: "ease-out",
    },
    onOpen(win) {
      if (win.id === "win-oq") startOqLoad();
    },
    routeOpen(win) {
      if (win.id === "win-oq") {
        const screen = pendingOqScreen === "decon" ? "decon" : "oq";
        pendingOqScreen = null;
        if (screen === "decon") {
          window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null, filter: null });
        } else {
          window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null, word: null });
        }
        return true;
      }
      return false;
    },
    routeClose(win) {
      if (win.id === "win-oq") {
        window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
      }
    },
  });

  // Start-menu items open their window on a single click -- a menu-item
  // convention, same as any real Windows Start menu, regardless of
  // pointer type.
  for (const el of document.querySelectorAll(".start-menu-item[data-open]")) {
    el.addEventListener("click", () => {
      const openId = el.dataset.open;
      if (openId === "win-oq" || openId === "win-decon") {
        pendingOqScreen = openId === "win-decon" ? "decon" : "oq";
        openWindow(winOq);
        return;
      }
      const target = document.getElementById(openId);
      if (target) openWindow(target);
    });
  }

  window.OqRedmond.initDesktopIcons({
    desktop,
    iconSelector: ".desktop-icon[data-open]",
    openWindow,
    resolveOpen(icon) {
      if (icon.dataset.open === "win-oq" || icon.dataset.open === "win-decon") {
        pendingOqScreen = icon.dataset.open === "win-decon" || icon.dataset.screen === "decon"
          ? "decon"
          : "oq";
        return winOq;
      }
      return null;
    },
  });

  // ---------- Desktop right-click menu ----------
  // Real (not suppress-only) context menu (issue #100), same shape as
  // win98/app.js's own #desktop-context-menu: only two items, both with
  // real behavior behind them -- no Properties/New/Paste/Arrange submenu,
  // since none of those have a feature backing them in this theme.
  const desktopContextMenu = document.getElementById("desktop-context-menu");
  const desktopIconsEl = document.querySelector(".desktop-icons");
  const desktopContextRefresh = document.getElementById("desktop-context-refresh");
  const desktopContextShowIcons = document.getElementById("desktop-context-show-icons");
  const SHOW_ICONS_STORAGE_KEY = "retr-oq:xp-desktop-icons";

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return; // not over an icon -- real Windows gives icons their own (unbuilt) context menu instead
    event.preventDefault();
    // Clamp so the menu never opens partly off-screen -- desktop.getBoundingClientRect()
    // excludes the taskbar already, same reasoning clampToViewport() uses
    // elsewhere in shared/redmond/window-manager.js.
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 176; // matches .desktop-context-menu's own min-width (11rem)
    const menuHeight = 76; // two real items tall
    const left = Math.min(event.clientX, deskRect.right - menuWidth);
    const top = Math.min(event.clientY, deskRect.bottom - menuHeight);
    desktopContextMenu.style.left = `${left}px`;
    desktopContextMenu.style.top = `${top}px`;
    desktopContextMenu.style.bottom = "auto";
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

  // "Refresh" -- a real, visible action standing in for a desktop redraw:
  // briefly dip the icons' opacity and bring it back via the CSS
  // transition on .desktop-icons, same idea as a real Windows repaint
  // flicker.
  desktopContextRefresh.addEventListener("click", () => {
    closeDesktopContextMenu();
    if (!desktopIconsEl) return;
    desktopIconsEl.classList.add("refreshing");
    window.setTimeout(() => desktopIconsEl.classList.remove("refreshing"), 150);
  });

  // "Show desktop icons" -- a real, re-toggleable checkbox item. The
  // desktop background itself (and this same menu) stays reachable even
  // with icons hidden, so a visitor can never get stranded.
  function getStoredShowIcons() {
    try {
      const stored = localStorage.getItem(SHOW_ICONS_STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true; // localStorage can throw in a sandboxed iframe -- default to shown
    }
  }

  function applyShowIcons(show) {
    if (desktopIconsEl) desktopIconsEl.classList.toggle("icons-hidden", !show);
    desktopContextShowIcons.classList.toggle("is-checked", show);
    desktopContextShowIcons.setAttribute("aria-checked", String(show));
    try {
      localStorage.setItem(SHOW_ICONS_STORAGE_KEY, String(show));
    } catch {
      // sandboxed iframe or storage disabled -- the toggle still applies for this visit, just doesn't persist
    }
  }

  let showDesktopIcons = getStoredShowIcons();
  applyShowIcons(showDesktopIcons);

  desktopContextShowIcons.addEventListener("click", () => {
    showDesktopIcons = !showDesktopIcons;
    applyShowIcons(showDesktopIcons);
    closeDesktopContextMenu();
  });

  // ---------- Start menu ----------
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");
  const { close: closeStartMenu } = window.OqRedmond.initStartMenu({ startButton, startMenu });

  // ---------- Turn off computer dialog ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("start-menu-shutdown").addEventListener("click", () => {
    closeStartMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    // "Turn off" sends the visitor back to the theme picker, not just
    // closing the dialog -- a relative "../" (not the absolute GitHub
    // Pages URL) so this keeps working when served from a fork or a local
    // http.server, same as every other cross-file reference in this repo.
    window.location.href = "../";
  });

  // ---------- Taskbar clock ----------
  const clockEl = document.getElementById("taskbar-clock");
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

  // ---------- OQ! (Kalaallisut dictionary lookup) ----------
  // Same fetch/cache/filter/hyphenate pipeline as win98/app.js's own OQ!
  // section, reused via shared/dict-source.js and shared/hyphenation.js
  // rather than reimplemented -- only the rendering below is xp-flavored
  // (xp.css ships no table.interactive/.sunken-panel component, so
  // selection highlight and the recessed panel look are this theme's own
  // CSS instead, see style.css).
  const OQ_DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const OQ_MAX_FILTERED_ROWS = 200; // 17,000+ entries -- never render a full match set into the DOM

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  let oqEntries = null; // null until a load succeeds
  let oqLoadStarted = false; // guards against re-fetching every time the window is reopened

  // Clicking/tapping a row selects it with this theme's own Luna
  // selection blue (see .oq-table tbody tr.highlighted in style.css).
  // Event delegation on the tbody itself, not a per-row listener, since
  // renderOqRows() below rebuilds every row from scratch on each
  // keystroke -- a per-row listener would need re-attaching every time,
  // this doesn't.
  let oqSelectedRow = null;
  oqTbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    if (oqSelectedRow) oqSelectedRow.classList.remove("highlighted");
    row.classList.add("highlighted");
    oqSelectedRow = row;
  });

  function renderOqRows(rows) {
    oqTbody.textContent = ""; // also drops whatever row was .highlighted -- nothing left to track
    oqSelectedRow = null;
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      // syllabify() inserts soft hyphens at real Kalaallisut syllable
      // boundaries -- see dos/app.js's own comment on why this matters
      // more than generic overflow-wrap for this specific language.
      lexemeCell.textContent = syllabify(entry.lexeme);
      const glossCell = document.createElement("td");
      glossCell.textContent = entry.gloss_en;
      row.append(lexemeCell, glossCell);
      oqTbody.appendChild(row);
    }
  }

  function renderOqResults() {
    if (oqEntries === null) return; // still loading or failed -- oqStatus already says so

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
      oqLoadStarted = false; // let a retry actually re-fetch instead of silently no-op'ing forever
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
  // see that file's own comment, and win98/app.js's identical DECON
  // section this one mirrors (rendering is xp-flavored: xp.css's own Luna
  // chrome instead of a sunken-panel table, see style.css).
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
  // Mirrors win98/app.js's identical onChange callback -- see its own
  // comment for the full reasoning.

  // ---------- OQ! tab shell (Dictionary ↔ Word Deconstructor) ----------
  const oqShell = window.OqRedmond.initOqShell({
    shellWin: winOq,
    tabs: [
      {
        view: "oq",
        button: document.getElementById("oq-tab-dict"),
        panel: document.getElementById("oq-view-dict"),
      },
      {
        view: "decon",
        button: document.getElementById("oq-tab-decon"),
        panel: document.getElementById("oq-view-decon"),
      },
    ],
    onTabSelect(view) {
      if (view === "decon") {
        window.OqRouter.navigate(
          { screen: "decon", word: deconWord.value || null, filter: null },
          { replace: true },
        );
      } else {
        window.OqRouter.navigate(
          { screen: "oq", filter: oqFilter.value || null, word: null },
          { replace: true },
        );
      }
    },
  });

  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq" || screen === "decon") {
      if (winOq.classList.contains("minimized")) forceOpenWindow(winOq);
      oqShell.applyView(screen);
      if (screen === "oq") {
        const filter = params.get("filter") || "";
        if (oqFilter.value !== filter) {
          oqFilter.value = filter;
          renderOqResults();
        }
      } else {
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
      }
    } else {
      if (!winOq.classList.contains("minimized")) closeWindow(winOq);
    }
  });

  // Brief startup screen before the desktop appears, same mechanical
  // pattern as win31/app.js's finishBoot (boot logic is per-theme, not
  // shared -- see that file's own comment). The desktop underneath
  // already initializes normally; this only needs to hide itself.
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  window.setTimeout(finishBoot, 1400);
})();
