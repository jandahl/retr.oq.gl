(() => {
  "use strict";

  // Plain classic script, matching today's convention across this repo's
  // theme files (see CLAUDE.md) -- shares state with shared/dict-source.js,
  // shared/hyphenation.js, and shared/redmond/window-manager.js via
  // window.<Namespace> globals rather than imports, so index.html has to
  // load all three before this file (see its own comment on load order).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const desktop = document.getElementById("desktop");
  const taskbarWindows = document.getElementById("taskbar-windows");
  const windows = Array.from(document.querySelectorAll(".win95-window"));

  const MIN_WIN_WIDTH = 200;
  const MIN_WIN_HEIGHT = 120;

  // Drag/resize/focus/minimize/maximize/close/taskbar-buttons/viewport-
  // clamp -- none of that is actually Win95-specific, it's the Windows-
  // lineage window-chrome behavior shared/redmond/window-manager.js
  // extracts for reuse by a future Windows theme (XP, etc). What's
  // genuinely win95-specific stays below: OQ!'s own lazy dictionary load
  // (wired in as onOpen, since every window-opening trigger already
  // funnels through the shared module's one openWindow()), the Hot Dog
  // Stand/Display Properties scheme, the Shut Down dialog, and the
  // taskbar clock.
  // OQ! is one window whose open/closed + tab state is real shareable URL
  // state (?screen=oq&filter=... / ?screen=decon&word=...). Dictionary and
  // Word Deconstructor are tabs inside #win-oq (one taskbar button), not
  // two top-level windows. My Computer/About/Recycle Bin/Settings stay
  // plain chrome with no router state.
  const winOq = document.getElementById("win-oq");
  // Word Deconstructor lives inside #win-oq (property-sheet tabs). One desktop
  // / Start affordance (OQ!); resolveOpen still maps a leftover win-decon id
  // onto this shell + pendingOqScreen for deep links / router ids.
  let pendingOqScreen = null;

  const { openWindow, forceOpenWindow, closeWindow } = window.OqRedmond.initWindowManager({
    desktop,
    taskbarWindows,
    windows,
    resizeHandleSelector: ".win95-resize-handle",
    minWidth: MIN_WIN_WIDTH,
    minHeight: MIN_WIN_HEIGHT,
    // Win95's own minimize/maximize/restore animations were short and
    // linear -- no easing curve, no bounce, just a quick snap -- matching
    // the flat, no-gloss chrome the rest of this theme already goes for.
    // minimizeStyle isn't set -- this keeps the shared module's own
    // default "outline" (a plain rectangle flying to/from the taskbar
    // button, not the window's own content scaling/fading), the real
    // Win95 minimize/restore behavior.
    animation: {
      geometryMs: 120,
      geometryEasing: "linear",
      minimizeMs: 140,
      minimizeEasing: "linear",
    },
    onOpen(win) {
      if (win.id === "win-oq") startOqLoad();
    },
    // Desktop icon / Start menu / taskbar-restore clicks on OQ! or DECON
    // all funnel through this one openWindow() (see shared/redmond/
    // window-manager.js's own comment) -- routing them to OqRouter.navigate()
    // instead of opening directly keeps the URL and the visible window in
    // sync no matter which of those three triggered it.
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

  // Welcome Desk buttons use the same real window manager path as desktop
  // icons and Start-menu entries; the assistant is optional, never a boot
  // gate or replacement shell.
  for (const el of document.querySelectorAll(".welcome-desk-actions [data-open]")) {
    el.addEventListener("click", () => {
      const target = document.getElementById(el.dataset.open);
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

  // ---------- Start menu ----------
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");
  const { close: closeStartMenu } = window.OqRedmond.initStartMenu({ startButton, startMenu });

  // ---------- Shut Down dialog ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("start-menu-shutdown").addEventListener("click", () => {
    closeStartMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    // "Shut down" sends the visitor back to the theme picker, not just
    // closing the dialog -- a relative "../" (not the absolute GitHub
    // Pages URL) so this keeps working when served from a fork or a local
    // http.server, same as every other cross-file reference in this repo.
    window.location.href = "../";
  });

  // ---------- Desktop right-click menu + Display Properties ----------
  // Real Windows 95: right-clicking the bare desktop opens a context menu
  // whose "Properties" item is the *only* path to the color-scheme
  // picker -- there's no icon, no Start-menu entry, nothing else pointing
  // at it. Same here on purpose: this is the one deliberately hidden
  // feature in this theme.
  const desktopContextMenu = document.getElementById("desktop-context-menu");

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return; // not over an icon -- real Windows gives icons their own (unbuilt) context menu instead
    event.preventDefault();
    // Clamp so the menu never opens partly off-screen -- desktop.getBoundingClientRect()
    // excludes the taskbar already (see style.css's `bottom: 32px`), same
    // reasoning clampToViewport() above uses.
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 180; // matches .start-menu's own min-width
    const menuHeight = 60; // one real item tall
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

  const displayPropsOverlay = document.getElementById("display-props-overlay");
  const schemeSelect = document.getElementById("scheme-select");
  const SCHEME_STORAGE_KEY = "retr-oq:win95-scheme";
  let schemeBeforeDialog = "standard"; // for Cancel to revert to

  function getStoredScheme() {
    try {
      return localStorage.getItem(SCHEME_STORAGE_KEY) || "standard";
    } catch {
      return "standard"; // localStorage can throw in a sandboxed iframe -- fall back to the default rather than crash
    }
  }

  function applyScheme(scheme) {
    document.body.classList.toggle("hotdog-stand", scheme === "hotdog");
    try {
      localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
    } catch {
      // sandboxed iframe or storage disabled -- the scheme still applies for this visit, just doesn't persist
    }
  }

  // Applied on load too, not just from the dialog -- a returning visitor
  // who already found Hot Dog Stand should get it back immediately, the
  // same way a real OS remembers your chosen scheme across reboots.
  applyScheme(getStoredScheme());

  function openDisplayProperties() {
    schemeBeforeDialog = getStoredScheme();
    schemeSelect.value = schemeBeforeDialog;
    displayPropsOverlay.hidden = false;
  }

  // Two triggers reach the same dialog: the desktop's right-click
  // Properties item (mouse-only -- there's no real right-click gesture on
  // touch), and Display in the Settings window below (works identically
  // on touch and mouse alike, since it's a normal click target inside a
  // normal window, not a context-menu gesture).
  document.getElementById("desktop-context-properties").addEventListener("click", () => {
    closeDesktopContextMenu();
    openDisplayProperties();
  });
  document.getElementById("settings-display-icon").addEventListener("click", openDisplayProperties);
  document.getElementById("display-props-apply").addEventListener("click", () => {
    applyScheme(schemeSelect.value);
  });
  document.getElementById("display-props-ok").addEventListener("click", () => {
    applyScheme(schemeSelect.value);
    displayPropsOverlay.hidden = true;
  });
  document.getElementById("display-props-cancel").addEventListener("click", () => {
    applyScheme(schemeBeforeDialog); // undo any Apply already clicked, same as a real Cancel button
    displayPropsOverlay.hidden = true;
  });

  // ---------- Taskbar clock ----------
  // Real-time updating text, not a static screenshot-style clock (issue
  // #29 calls this out explicitly as a period-accurate touch 98.css
  // doesn't give you out of the box).
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
  // Same fetch/cache/filter/hyphenate pipeline as dos/'s DICT.EXE, reused
  // via shared/dict-source.js and shared/hyphenation.js rather than
  // reimplemented -- only the rendering below is win95-flavored (a plain
  // scrollable table in a window instead of a full-screen text-mode
  // takeover).
  const OQ_DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const OQ_MAX_FILTERED_ROWS = 200; // 17,000+ entries -- never render a full match set into the DOM

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  let oqEntries = null; // null until a load succeeds
  let oqLoadStarted = false; // guards against re-fetching every time the window is reopened

  // Clicking/tapping a row selects it with the theme's own selection
  // color -- 98.css's real `table.interactive > tbody > tr.highlighted`
  // rule (navy background, white text), the same convention any other
  // 98.css table already uses, not a one-off style invented for this
  // table. Event delegation on the tbody itself, not a per-row listener,
  // since renderOqRows() below rebuilds every row from scratch on each
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
    // replace: true -- every keystroke reshaping the same search shouldn't
    // each get their own back-button stop, only the act of opening OQ! and
    // its final filter state should (same reasoning as dos/app.js's own
    // dictFilter input handler).
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });

  // ---------- DECON (word deconstruction) ----------
  // shared/decon-app.js owns the search/abort/order-persistence core
  // (search/abort/order-persistence, extracted so dos/, win95/, and xp/
  // share one implementation -- see that file's own comment). This
  // section is the win95-specific consumer: window-styled rendering,
  // reading/writing the router-owned word/order state, and the
  // window-manager-driven open/close wiring shared with OQ! above.
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
        // Same changedRanges slicing dos/app.js's own renderDeconResults
        // does (jandahl/oq#833) -- see its own comment for why. No
        // "."-padding here, unlike dos's text-mode columns: this theme has
        // a real proportional font, so lining up column position via
        // repeated "." characters wouldn't actually align anything.
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
    // Enter, not "input" like oqFilter -- deconstructing a word runs a real
    // (occasionally seconds-long) search, unlike OQ!'s instant local
    // filter, so re-running it on every keystroke would be wasteful (same
    // reasoning as dos/app.js's own decon-word keydown handler).
    if (event.key !== "Enter") return;
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  // ---------- Router wiring: OQ! and DECON's shared open/close/state ----------
  // window.OqRouter (shared/router.js) is the single source of truth for
  // which OQ! tab is reflected in the URL -- desktop icon / Start menu /
  // taskbar restore via routeOpen; the shell close button via routeClose;
  // tab clicks; oqFilter; decon-word Enter; root-first checkbox all go
  // through navigate(). This onChange is what forceOpenWindow()/closeWindow()
  // /applyView()/renderOqResults()/deconController.search() run from.

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

  // Boot screen: purely cosmetic overlay, dismissed on click or after a
  // timeout. The desktop underneath initializes normally regardless --
  // unlike win31/app.js's finishBoot(), this one doesn't force-open any
  // window (win95 has no single-shell-window concept to restore).
  const bootScreen = document.getElementById("boot-screen");
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  window.setTimeout(finishBoot, 1400);
})();
