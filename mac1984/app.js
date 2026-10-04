(() => {
  "use strict";

  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest("button, a, input, select, textarea")) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      origX = (rect.left - parentRect.left) / zoomFactor;
      origY = (rect.top - parentRect.top) / zoomFactor;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const dx = (event.clientX - startX) / zoomFactor;
      const dy = (event.clientY - startY) / zoomFactor;
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

  // Same pointer-capture shape as makeDraggable, but resizes instead of moves.
  function makeResizable(handle, target, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      startW = rect.width / zoomFactor;
      startH = rect.height / zoomFactor;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation(); // don't also trigger the window's own focus-on-pointerdown
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const dx = (event.clientX - startX) / zoomFactor;
      const dy = (event.clientY - startY) / zoomFactor;
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

  // Real Mac OS never showed a browser's own right-click menu over the
  // desktop -- suppress it, but let it through inside a window's own
  // scrollable content (the framework has no bare "desktop" element here).
  // Deliberately stays suppress-only, not just pending: the 1984 128K Mac
  // shipped a one-button mouse, full stop -- there's no second button to
  // right-click with, and Control-click contextual menus weren't a thing
  // until Mac OS 8's Contextual Menu Manager, over a decade later (see
  // mac8/, which does get a real one). Adding a right-click menu here
  // would be less accurate than the current suppress-only behavior, not
  // more (tracked as intentionally out of scope in issue #100).
  document.body.addEventListener("contextmenu", (event) => {
    if (!event.target.closest(".window-pane")) event.preventDefault();
  });

  const reopenBtn = document.getElementById("reopen");
  const windows = Array.from(document.querySelectorAll(".desktop-window"));
  let zTop = 10;
  const winDecon = document.getElementById("win-decon");

  function openWindow(win) {
    win.classList.remove("closed");
    focus(win);
  }

  function closeWindowEl(win) {
    const titlebar = document.getElementById(`${win.id}-titlebar`);
    const wasActive = titlebar && titlebar.classList.contains("title-bar");
    win.classList.add("closed");
    if (win !== winDecon) {
      reopenBtn.classList.add("visible");
      reopenBtn.dataset.target = win.id;
    }
    if (wasActive) {
      const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
      if (next) focus(next);
    }
  }

  // Swaps .title-bar/.inactive-title-bar, which is what actually draws
  // (or doesn't) the active-window chrome -- this is the whole activation
  // mechanism, not a layer on top of it.
  function focus(win) {
    const bar = win.querySelector(".title-bar, .inactive-title-bar");
    if (bar.classList.contains("title-bar")) return; // already active
    for (const w of windows) {
      const b = w.querySelector(".title-bar, .inactive-title-bar");
      if (w === win) {
        b.classList.remove("inactive-title-bar");
        b.classList.add("title-bar");
      } else if (b.classList.contains("title-bar")) {
        b.classList.remove("title-bar");
        b.classList.add("inactive-title-bar");
      }
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);

    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    const growbox = win.querySelector(".growbox");
    if (growbox) makeResizable(growbox, win, 224, 128); // matches .desktop-window's min-width/min-height

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (win === winDecon) {
          // Routed window: close via URL (CLAUDE.md OqRouter rule).
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }
  }

  reopenBtn.addEventListener("click", () => {
    const target = document.getElementById(reopenBtn.dataset.target || "win2");
    target.classList.remove("closed");
    reopenBtn.classList.remove("visible");
    focus(target);
  });

  document.getElementById("win2-icon").addEventListener("click", () => {
    const win2 = document.getElementById("win2");
    win2.classList.remove("closed");
    focus(win2);
  });

  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      const target = document.getElementById(icon.dataset.open);
      if (!target) return;
      if (target === winDecon) {
        const wordInput = document.getElementById("decon-word");
        window.OqRouter.navigate({ screen: "decon", word: (wordInput && wordInput.value) || null });
        return;
      }
      openWindow(target);
    });
  }

  // Menu bar: takes over open/closed state entirely in JS (see .menu-open
  // in style.css) instead of the framework's flicker-prone :focus CSS.
  const menuBar = document.querySelector(".desktop-menu-bar");
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
      if (event.target.closest('[role="menu"]')) return; // handled by the link's own listener below
      if (openMenuItem === item) closeMenu();
      else openMenu(item);
    });
    // Real Mac menu bars open whatever you're pointing at once a menu is
    // already open, so you can drag across File/Edit/View without re-clicking.
    item.addEventListener("pointerenter", () => {
      if (openMenuItem && openMenuItem !== item) openMenu(item);
    });
    for (const link of item.querySelectorAll('[role="menu"] a')) {
      if (link.id === "mac1984-shutdown") {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          closeMenu();
          // Every other theme's own Shut Down/Turn Off Computer sends the
          // visitor back to the hub -- relative "../" keeps working from a
          // fork or a local http.server too.
          window.location.href = "../";
        });
        continue;
      }
      if (link.id === "mac1984-restart") {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          closeMenu();
          // System 1.0 Restart rebooted the machine; here a full page
          // reload re-runs the boot sequence without leaving the theme.
          window.location.reload();
        });
        continue;
      }
      link.addEventListener("click", (event) => {
        event.preventDefault(); // every other menu command here is a placeholder ("#")
        closeMenu();
      });
    }
  }

  document.addEventListener("pointerdown", (event) => {
    if (openMenuItem && !menuBar.contains(event.target)) closeMenu();
  });

  // Boot screen: passive startup, with no user gesture or audio required.
  const bootScreen = document.getElementById("boot-screen");
  const bootSequence = document.getElementById("boot-sequence");
  bootSequence.classList.add("visible");
  setTimeout(() => bootScreen.classList.add("hidden"), 1400);

  // ---------- Word Parts (DECON via shared/decon-app.js) ----------
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;
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
      for (const { marker, text: rowText, changedRanges, gloss } of rows) {
        const row = document.createElement("div");
        let cursor = 0;
        row.appendChild(document.createTextNode(marker));
        for (const { start, end } of changedRanges) {
          if (start > cursor) row.appendChild(document.createTextNode(rowText.slice(cursor, start)));
          const changed = document.createElement("span");
          changed.className = "decon-changed";
          changed.textContent = rowText.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < rowText.length) row.appendChild(document.createTextNode(rowText.slice(cursor)));
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
    if (screen === "decon") {
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
    } else if (!winDecon.classList.contains("closed")) {
      closeWindowEl(winDecon);
    }
  });

})();
