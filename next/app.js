(() => {
  "use strict";

  // NeXTSTEP Workspace window/menu/dock logic — genuinely new code, not
  // a shared module. Miniaturize-left / close-right, a full-width
  // resize bar, a vertical main menu, miniwindows. Not Redmond, not
  // Mac-lineage (CLAUDE.md). Classic scripts sharing state via
  // window.<Namespace> globals, same convention as every other theme.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const bootScreen = document.getElementById("boot-screen");
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  window.setTimeout(finishBoot, 1400);

  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".nx-btn, button, a, input, select, textarea")) return;
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
      target.style.left = `${origX + (event.clientX - startX)}px`;
      target.style.top = `${origY + (event.clientY - startY)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  // NeXT resize bar: the right-hand dimple (and the right third of the
  // bar) grows width+height; the rest of the bar is height-only. Real
  // 3.3 let you drag "any of the regions of the resize bar."
  function makeResizeBar(handle, target, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;
    let both = true;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const bar = handle.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startX = event.clientX;
      startY = event.clientY;
      both = event.clientX > bar.left + bar.width * 0.66;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dy = event.clientY - startY;
      const dx = both ? event.clientX - startX : 0;
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".nx-window:not(.nx-panel-window)"));
  let zTop = 10;

  // Real NeXTSTEP never showed a browser's own right-click menu over the
  // desktop -- suppress it over the bare desktop background, and open a
  // real one instead. Clean Up clears any current icon selection (icons
  // themselves aren't draggable in this theme, so there's nothing to
  // rearrange); Show Icons is a real, re-toggleable checkbox -- the
  // desktop background stays visible and clickable even with icons
  // hidden, so right-clicking it still reaches this same menu.
  const desktopContextMenu = document.getElementById("desktop-context-menu");
  const desktopIcons = document.querySelector(".desktop-icons");
  const showIconsCheck = document.getElementById("desktop-context-showicons-check");
  const ICONS_HIDDEN_KEY = "retr-oq:next-desktop-icons";

  function getIconsHidden() {
    try {
      return localStorage.getItem(ICONS_HIDDEN_KEY) === "hidden";
    } catch {
      return false; // localStorage can throw in a sandboxed iframe -- default to shown
    }
  }

  function setIconsHidden(hidden) {
    if (desktopIcons) desktopIcons.classList.toggle("is-hidden", hidden);
    if (showIconsCheck) showIconsCheck.classList.toggle("is-checked", !hidden);
    try {
      localStorage.setItem(ICONS_HIDDEN_KEY, hidden ? "hidden" : "shown");
    } catch {
      // localStorage can throw in a sandboxed iframe -- toggle still works for this load
    }
  }

  setIconsHidden(getIconsHidden());

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return; // not over an icon -- icons have no context menu of their own (yet)
    event.preventDefault();
    // Clamp so the menu never opens partly off-screen, same reasoning
    // win98's own desktop-context-menu clamp uses.
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 168; // matches .desktop-context-menu's own min-width
    const menuHeight = 56; // two items tall
    const left = Math.min(event.clientX, deskRect.right - menuWidth);
    const top = Math.min(event.clientY, deskRect.bottom - menuHeight);
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

  document.getElementById("desktop-context-cleanup").addEventListener("click", () => {
    for (const icon of document.querySelectorAll(".desktop-icon.is-selected")) {
      icon.classList.remove("is-selected");
    }
    closeDesktopContextMenu();
  });
  document.getElementById("desktop-context-showicons").addEventListener("click", () => {
    setIconsHidden(!getIconsHidden());
    closeDesktopContextMenu();
  });

  const minis = new Map();

  function focus(win) {
    if (!win.classList.contains("inactive") && !win.classList.contains("closed")) {
      if (Number(win.style.zIndex) >= zTop) return;
    }
    for (const w of windows) {
      if (w === win) w.classList.remove("inactive");
      else w.classList.add("inactive");
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");

  function openWindow(win) {
    restoreMini(win);
    win.classList.remove("closed");
    focus(win);
  }

  function closeWindowEl(win) {
    restoreMini(win);
    const wasActive = !win.classList.contains("inactive");
    win.classList.add("closed");
    if (wasActive) {
      const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
      if (next) focus(next);
      else win.classList.add("inactive");
    }
  }

  function restoreMini(win) {
    const mini = minis.get(win);
    if (!mini) return;
    mini.remove();
    minis.delete(win);
  }

  function miniaturize(win) {
    if (win.classList.contains("closed")) return;
    const title = win.querySelector(".nx-title")?.textContent || "Window";
    closeWindowEl(win);
    if (minis.has(win)) return;
    const mini = document.createElement("button");
    mini.type = "button";
    mini.className = "miniwindow";
    const img = document.createElement("img");
    img.alt = "";
    img.width = 48;
    img.height = 48;
    const dockMatch = document.querySelector(`.nx-dock-icon[data-open="${win.id}"] img`);
    img.src = dockMatch ? dockMatch.getAttribute("src") : "art/icon-cube.png";
    const label = document.createElement("span");
    label.className = "miniwindow-title";
    label.textContent = title;
    mini.append(img, label);
    const n = minis.size;
    mini.style.left = `${12 + (n % 6) * 84}px`;
    mini.style.bottom = `${12 + Math.floor(n / 6) * 84}px`;
    mini.addEventListener("click", () => openWindow(win));
    desktop.appendChild(mini);
    minis.set(win, mini);
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);
    const miniBtn = document.getElementById(`${id}-mini`);
    const resize = document.getElementById(`${id}-resize`);

    win.classList.add("inactive");
    if (titlebar) makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));
    if (resize) makeResizeBar(resize, win, 240, 140);

    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (win === winOq || win === winDecon) {
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }

    if (miniBtn) {
      miniBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (win === winOq || win === winDecon) {
          // Miniaturize is UI state, not URL state — leave the route
          // pointing at the app so restoring the miniwindow still has
          // the right screen. Closing still goes through the router.
          miniaturize(win);
          return;
        }
        miniaturize(win);
      });
    }
  }

  if (window.innerWidth < 640) {
    for (const win of windows) {
      win.style.left = "148px";
      win.style.top = "8px";
      win.style.width = `${Math.max(220, window.innerWidth - 156)}px`;
      win.style.height = `${Math.min(window.innerHeight - 168, 400)}px`;
    }
  }

  function openFromTarget(id) {
    const target = document.getElementById(id);
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
  }

  for (const icon of document.querySelectorAll(".desktop-icon[data-open], .nx-dock-icon[data-open]")) {
    icon.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".desktop-icon")) {
        other.classList.toggle("is-selected", other === icon);
      }
      openFromTarget(icon.dataset.open);
    });
  }

  // ---------- Vertical menus ----------
  const mainMenu = document.getElementById("main-menu");
  makeDraggable(document.getElementById("main-menu-titlebar"), mainMenu);
  // The main menu is an ordinary item in the same stacking order as
  // windows (see its z-index: 10 base in style.css) -- clicking it
  // brings it to front just like focus() does for a window, instead of
  // it sitting permanently above everything.
  mainMenu.addEventListener("pointerdown", () => {
    if (Number(mainMenu.style.zIndex) >= zTop) return;
    zTop += 1;
    mainMenu.style.zIndex = String(zTop);
  });
  const subHosts = Array.from(mainMenu.querySelectorAll(".nx-menuitem.has-sub"));
  let openSub = null;

  function closeSubs() {
    for (const item of subHosts) {
      item.classList.remove("is-open");
      item.setAttribute("aria-expanded", "false");
    }
    openSub = null;
  }

  function openSubOf(item) {
    if (openSub === item) return;
    closeSubs();
    item.classList.add("is-open");
    item.setAttribute("aria-expanded", "true");
    openSub = item;
  }

  for (const item of subHosts) {
    item.setAttribute("aria-expanded", "false");
    item.addEventListener("click", (event) => {
      if (event.target.closest(".nx-submenu")) return;
      event.stopPropagation();
      if (openSub === item) closeSubs();
      else openSubOf(item);
    });
    item.addEventListener("pointerenter", () => {
      if (openSub && openSub !== item) openSubOf(item);
    });
  }

  for (const item of document.querySelectorAll(".nx-submenu [data-open]")) {
    const link = item.querySelector("a");
    if (!link) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeSubs();
      openFromTarget(item.dataset.open);
    });
  }

  for (const link of mainMenu.querySelectorAll(".nx-submenu a, .nx-menuitem > a")) {
    if (link.closest("[data-open], #menu-quit, #menu-hide, #menu-legal, #menu-arrange, #menu-miniall")) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeSubs();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (openSub && !mainMenu.contains(event.target)) closeSubs();
  });

  document.getElementById("menu-hide").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeSubs();
    for (const w of windows) {
      if (!w.classList.contains("closed")) miniaturize(w);
    }
  });

  document.getElementById("menu-miniall").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeSubs();
    for (const w of windows) {
      if (!w.classList.contains("closed")) miniaturize(w);
    }
  });

  document.getElementById("menu-arrange").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeSubs();
    let i = 0;
    for (const w of windows) {
      if (w.classList.contains("closed")) continue;
      w.style.left = `${180 + i * 18}px`;
      w.style.top = `${16 + i * 22}px`;
      focus(w);
      i += 1;
    }
  });

  const quitOverlay = document.getElementById("quit-overlay");
  document.getElementById("menu-quit").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeSubs();
    quitOverlay.hidden = false;
  });
  document.getElementById("quit-cancel").addEventListener("click", () => {
    quitOverlay.hidden = true;
  });
  document.getElementById("quit-ok").addEventListener("click", () => {
    window.location.href = "../";
  });

  const legalOverlay = document.getElementById("legal-overlay");
  document.getElementById("menu-legal").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeSubs();
    legalOverlay.hidden = false;
  });
  function hideLegal() { legalOverlay.hidden = true; }
  document.getElementById("legal-ok").addEventListener("click", hideLegal);
  document.getElementById("legal-close").addEventListener("click", hideLegal);

  // ---------- OQ! ----------
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
      oqStatus.textContent = `${oqEntries.length.toLocaleString()} entries loaded — showing first ${OQ_DEFAULT_ROWS}, type to filter.`;
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

  // ---------- DECON ----------
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
      if (!winOq.classList.contains("closed") && !minis.has(winOq)) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed") && !minis.has(winDecon)) closeWindowEl(winDecon);
    }
  });

  // ---------- Clock ----------
  const clockEl = document.getElementById("dock-clock");
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

  // ---------- Console + undocumented panic (this theme's DOOM) ----------
  const consoleLog = document.getElementById("console-log");
  const consoleCmd = document.getElementById("console-cmd");
  const panic = document.getElementById("panic");

  function appendConsole(line) {
    consoleLog.textContent += `${line}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  consoleCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const raw = consoleCmd.value.trim();
    const cmd = raw.toLowerCase();
    appendConsole(`me> ${raw}`);
    consoleCmd.value = "";
    if (cmd === "panic" || cmd === "halt" || cmd === "wekit") {
      panic.hidden = false;
      return;
    }
    if (cmd === "clear" || cmd === "cls") {
      consoleLog.textContent = "";
      return;
    }
    if (cmd === "help") {
      appendConsole("Commands: help, clear, date, whoami");
      return;
    }
    if (cmd === "date") {
      appendConsole(new Date().toString());
      return;
    }
    if (cmd === "whoami") {
      appendConsole("me");
      return;
    }
    if (cmd === "") return;
    appendConsole(`${raw}: Command not found.`);
  });

  panic.addEventListener("click", () => { panic.hidden = true; });

  // Triple-click the Cube also panics — undocumented, same idea.
  let cubeClicks = 0;
  let cubeTimer = 0;
  document.querySelector('.nx-dock-icon[data-open="win-about"]').addEventListener("click", () => {
    cubeClicks += 1;
    clearTimeout(cubeTimer);
    cubeTimer = setTimeout(() => { cubeClicks = 0; }, 600);
    if (cubeClicks >= 3) {
      cubeClicks = 0;
      panic.hidden = false;
    }
  });
})();
