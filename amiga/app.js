(() => {
  "use strict";

  const bootScreen = document.getElementById("boot-screen");
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  window.setTimeout(finishBoot, 2000);

  // Mac-lineage window/menu/drag logic, adapted in spirit from
  // mac8/app.js's own makeDraggable/makeResizable/focus/menu-bar
  // functions — genuinely new code, not a shared module. Amiga Workbench
  // is Intuition, not Platinum: a depth gadget (to-back) sits next to
  // zoom, gadgets stay visible on inactive windows, and the screen bar
  // is a Workbench screen, not a Mac menu bar. Classic scripts sharing
  // state via window.<Namespace> globals, same convention as every
  // other theme (see CLAUDE.md).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".gadget, button, a, input, select, textarea")) return;
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

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  // Intuition windows resize from the single bottom-right sizing gadget
  // only — same "one corner" convention as a classic Mac growbox, not
  // the omnidirectional edge handles win98/xp/win7 share.
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
      event.stopPropagation();
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

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".wb-window:not(.wb-dialog)"));
  let zTop = 10;

  function animateZoomGeometry(win, mutate) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mutate();
      return;
    }
    win.style.transition = "top 180ms linear, left 180ms linear, width 180ms linear, height 180ms linear";
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
    setTimeout(finish, 260);
  }

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
  const winRobocod = document.getElementById("win-robocod");
  const robocodFrame = document.getElementById("wb-robocod-frame");

  function openWindow(win) {
    win.classList.remove("closed");
    focus(win);
    if (win === winRobocod && robocodFrame && robocodFrame.src.endsWith("about:blank")) {
      robocodFrame.src = "https://archive.org/embed/jamespond_adf";
    }
  }

  function closeWindowEl(win) {
    const wasActive = !win.classList.contains("inactive");
    win.classList.add("closed");
    if (win === winRobocod && robocodFrame) {
      robocodFrame.src = "about:blank";
    }
    if (wasActive) {
      const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
      if (next) focus(next);
      else win.classList.add("inactive");
    }
  }

  function sendToBack(win) {
    let lowest = 10;
    for (const w of windows) {
      if (w === win || w.classList.contains("closed")) continue;
      const z = Number(w.style.zIndex) || 10;
      if (z < lowest) lowest = z;
    }
    win.style.zIndex = String(lowest - 1);
    win.classList.add("inactive");
    const front = windows
      .filter((w) => w !== win && !w.classList.contains("closed"))
      .sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0];
    if (front) front.classList.remove("inactive");
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);
    const zoomBtn = document.getElementById(`${id}-zoom`);
    const depthBtn = document.getElementById(`${id}-depth`);
    const growbox = document.getElementById(`${id}-growbox`);

    win.classList.add("inactive");
    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    if (growbox) makeResizable(growbox, win, 240, 140);

    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (win === winOq || win === winDecon || win === winRobocod) {
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }

    if (zoomBtn) {
      let savedRect = null;
      zoomBtn.addEventListener("click", (event) => {
        event.stopPropagation();
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
          const desktopRect = desktop.getBoundingClientRect();
          animateZoomGeometry(win, () => {
            win.style.top = "0px";
            win.style.left = "0px";
            win.style.width = `${desktopRect.width}px`;
            win.style.height = `${desktopRect.height}px`;
          });
        }
      });
    }

    if (depthBtn) {
      depthBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        sendToBack(win);
      });
    }
  }

  if (window.innerWidth < 640) {
    for (const win of windows) {
      win.style.left = "6px";
      win.style.top = "6px";
      win.style.width = `${Math.max(240, window.innerWidth - 12)}px`;
      win.style.height = `${Math.min(window.innerHeight - 90, 460)}px`;
    }
  }

  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".desktop-icon")) {
        other.classList.toggle("is-selected", other === icon);
      }
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
      if (target === winRobocod) {
        window.OqRouter.navigate({ screen: "robocod" });
        return;
      }
      openWindow(target);
    });
  }

  for (const item of document.querySelectorAll('[role="menu"] [data-open]')) {
    const link = item.querySelector("a");
    if (link) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = document.getElementById(item.dataset.open);
        if (target) {
          openWindow(target);
        }
        closeMenu();
      });
    }
  }

  // ---------- Menu bar ----------
  const menuBar = document.getElementById("screen-bar");
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
      if (event.target.closest('[role="menu"]')) return;
      if (openMenuItem === item) closeMenu();
      else openMenu(item);
    });
    item.addEventListener("pointerenter", () => {
      if (openMenuItem && openMenuItem !== item) openMenu(item);
    });
    for (const link of item.querySelectorAll('[role="menu"] a')) {
      if (!link.closest("[data-open]") && !link.closest("#menu-quit, #menu-execute, #menu-boing, #menu-copper")) {
        link.addEventListener("click", (event) => {
          event.preventDefault();
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

  // ---------- Quit ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("menu-quit").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    window.location.href = "../";
  });

  // ---------- Execute Command → Guru Meditation (undocumented, same
  // idea as dos/'s DOOM and win98/'s Hot Dog Stand) ----------
  const guru = document.getElementById("guru");
  document.getElementById("menu-execute").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    guru.hidden = false;
  });
  guru.addEventListener("click", () => { guru.hidden = true; });

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
    } else if (screen === "robocod" || screen === "jamespond") {
      if (winRobocod.classList.contains("closed")) openWindow(winRobocod);
      else focus(winRobocod);
    } else {
      if (!winOq.classList.contains("closed")) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed")) closeWindowEl(winDecon);
      if (!winRobocod.classList.contains("closed")) closeWindowEl(winRobocod);
    }
  });

  // ---------- Clock (Kickstart-style HH:MM:SS) ----------
  const clockEl = document.getElementById("screen-clock");
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- Copper bars (12-bit scanline wash, demo-scene not WB) ----------
  const copper = document.getElementById("copper");
  const copperCtx = copper.getContext("2d");
  let copperOn = true;

  function resizeCopper() {
    const w = Math.max(64, desktop.clientWidth);
    copper.width = w;
    copper.height = 64;
  }
  resizeCopper();
  window.addEventListener("resize", resizeCopper);

  function quant12(v) {
    return Math.round(v * 15) * 17;
  }

  function drawCopper(t) {
    const w = copper.width;
    const h = copper.height;
    const band = 4;
    for (let y = 0; y < h; y += band) {
      const v = (y / h + t * 0.12) % 1;
      const r = quant12(0.55 + 0.45 * Math.sin(v * Math.PI * 2));
      const g = quant12(0.25 + 0.35 * Math.sin(v * Math.PI * 2 + 2.0));
      const b = quant12(0.15 + 0.55 * Math.sin(v * Math.PI * 2 + 4.1));
      copperCtx.fillStyle = `rgb(${r},${g},${b})`;
      copperCtx.fillRect(0, y, w, band);
    }
  }

  document.getElementById("menu-copper").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    copperOn = !copperOn;
    copper.classList.toggle("is-off", !copperOn);
  });

  document.getElementById("screen-depth").addEventListener("click", () => {
    copperOn = !copperOn;
    copper.classList.toggle("is-off", !copperOn);
  });

  // ---------- Boing ball (the 1984 show-floor mascot, checkered sphere) ----------
  const boing = document.getElementById("boing");
  const boingCtx = boing.getContext("2d");
  const BOING_SIZE = 32;
  const boingShadow = document.getElementById("boing-shadow");
  let boingOn = true;
  let bx = Math.max(160, (desktop.clientWidth || 640) - 200);
  let by = 28;
  let bvx = 1.6;
  let bvy = 0;
  let rotY = 0;
  let rotX = 0.35;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sph(theta, phi) {
    return {
      x: Math.sin(theta) * Math.cos(phi),
      y: Math.cos(theta),
      z: Math.sin(theta) * Math.sin(phi),
    };
  }

  function drawBoing() {
    const cx = BOING_SIZE / 2;
    const cy = BOING_SIZE / 2 - 2;
    const R = BOING_SIZE * 0.38;
    const nLon = 8;
    const nLat = 6;
    boingCtx.clearRect(0, 0, BOING_SIZE, BOING_SIZE);

    const squash = reduceMotion ? 1 : 1 - Math.max(0, (by + BOING_SIZE - (desktop.clientHeight - 8)) / 80) * 0.18;
    boingCtx.save();
    boingCtx.translate(cx, cy + (1 - squash) * R);
    boingCtx.scale(1, squash);

    const quads = [];
    for (let i = 0; i < nLat; i++) {
      const theta0 = (i / nLat) * Math.PI;
      const theta1 = ((i + 1) / nLat) * Math.PI;
      for (let j = 0; j < nLon; j++) {
        const phi0 = (j / nLon) * Math.PI * 2 + rotY;
        const phi1 = ((j + 1) / nLon) * Math.PI * 2 + rotY;
        const pts = [sph(theta0, phi0), sph(theta0, phi1), sph(theta1, phi1), sph(theta1, phi0)];
        const proj = pts.map((p) => {
          const y = p.y * Math.cos(rotX) - p.z * Math.sin(rotX);
          const z = p.y * Math.sin(rotX) + p.z * Math.cos(rotX);
          return { x: p.x * R, y: y * R, z };
        });
        const zMid = (proj[0].z + proj[1].z + proj[2].z + proj[3].z) / 4;
        if (zMid < 0) continue;
        quads.push({
          proj,
          z: zMid,
          color: (i + j) % 2 === 0 ? "#ee1111" : "#ffffff",
        });
      }
    }
    quads.sort((a, b) => a.z - b.z);
    for (const q of quads) {
      boingCtx.beginPath();
      boingCtx.moveTo(q.proj[0].x, q.proj[0].y);
      for (let k = 1; k < 4; k++) boingCtx.lineTo(q.proj[k].x, q.proj[k].y);
      boingCtx.closePath();
      boingCtx.fillStyle = q.color;
      boingCtx.fill();
    }

    boingCtx.beginPath();
    boingCtx.arc(0, 0, R, 0, Math.PI * 2);
    boingCtx.strokeStyle = "#000000";
    boingCtx.lineWidth = 2;
    boingCtx.stroke();

    boingCtx.fillStyle = "rgba(255,255,255,0.28)";
    boingCtx.beginPath();
    boingCtx.ellipse(-R * 0.28, -R * 0.32, R * 0.22, R * 0.14, -0.5, 0, Math.PI * 2);
    boingCtx.fill();
    boingCtx.restore();
  }

  function placeBoing() {
    boing.style.left = `${bx}px`;
    boing.style.top = `${by}px`;
    boingShadow.style.left = `${bx + BOING_SIZE / 2}px`;
    boingShadow.style.top = `${desktop.clientHeight - 14}px`;
  }

  function tickBoing(t) {
    if (!boingOn) {
      drawCopper(t / 1000);
      requestAnimationFrame(tickBoing);
      return;
    }
    const maxX = Math.max(0, desktop.clientWidth - BOING_SIZE);
    const maxY = Math.max(0, desktop.clientHeight - BOING_SIZE - (copperOn ? 24 : 0));
    if (!reduceMotion) {
      bvy += 0.18;
      bx += bvx;
      by += bvy;
      if (bx < 0) { bx = 0; bvx = Math.abs(bvx); }
      if (bx > maxX) { bx = maxX; bvx = -Math.abs(bvx); }
      if (by < 0) { by = 0; bvy = Math.abs(bvy) * 0.4; }
      if (by > maxY) { by = maxY; bvy = -Math.abs(bvy) * 0.92; bvx *= 1.0; }
      rotY += 0.045 * Math.sign(bvx || 1);
    }
    placeBoing();
    drawBoing();
    if (copperOn) drawCopper(t / 1000);
    requestAnimationFrame(tickBoing);
  }

  boing.addEventListener("click", () => {
    bvy = -7.5;
    bvx = (bvx || 1.6) * -1;
    if (Math.abs(bvx) < 1.2) bvx = 1.6 * Math.sign(bvx || 1);
  });

  document.getElementById("menu-boing").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    boingOn = !boingOn;
    boing.classList.toggle("is-off", !boingOn);
    boingShadow.classList.toggle("is-off", !boingOn);
  });

  drawBoing();
  placeBoing();
  if (copperOn) drawCopper(0);
  requestAnimationFrame(tickBoing);

  // ---------- Workbench Version Switcher ----------
  const STORAGE_KEY = "retr-oq:amiga-version";
  const screenTitle = document.querySelector(".wb-screen-title");
  const winVersion = document.getElementById("win-version");
  const versionApply = document.getElementById("version-apply");
  const versionCancel = document.getElementById("version-cancel");
  const radioInputs = document.querySelectorAll('input[name="wb-version-choice"]');

  const iconImgs = {
    ram: document.getElementById("icon-img-ram"),
    oq: document.getElementById("icon-img-oq"),
    decon: document.getElementById("icon-img-decon"),
    about: document.getElementById("icon-img-about"),
    version: document.getElementById("icon-img-version"),
    trash: document.getElementById("icon-img-trash"),
  };
  const aboutArtImg = document.getElementById("about-art-img");
  const aboutVersionKicker = document.getElementById("about-version-kicker");
  const aboutVersionDesc = document.getElementById("about-version-desc");

  const VERSION_CONFIGS = {
    "1.3": {
      screenTitle: "Workbench 1.3",
      bodyClass: null,
      kickstart: "Kickstart 34.5",
      artSuffix: "",
      aboutKicker: "Workbench 1.3 \u00a0 Kickstart 34.5",
      aboutDesc: "A classic Amiga desktop — four-pen Intuition chrome (blue / white / black / orange) around a Deluxe Paint backdrop and icons, 12-bit OCS color, the way an A500 owner dressed the machine: Workbench in the gadgets, a macaw and a chrome torus on the wallpaper because they could.",
      romIcon: "art/icon-rom.png",
    },
    "2.0": {
      screenTitle: "Workbench 2.04",
      bodyClass: "wb-mode-2",
      kickstart: "Kickstart 37.175",
      artSuffix: "-wb2",
      aboutKicker: "Workbench 2.04 \u00a0 Kickstart 37.175",
      aboutDesc: "The ECS revolution — Commodore\u2019s clean 3D sculpted aesthetic introduced on the A3000 and A500 Plus. Professional neutral greys, chiseled bevel borders, deep blue titlebars, and crisp modern system typography.",
      romIcon: "art/icon-rom-wb2.png",
    },
    "3.1": {
      screenTitle: "Workbench 3.1",
      bodyClass: "wb-mode-3",
      kickstart: "Kickstart 40.68",
      artSuffix: "-wb3",
      aboutKicker: "Workbench 3.1 \u00a0 Kickstart 40.68",
      aboutDesc: "The AGA powerhouse — refined MagicWB styling for the A1200 and A4000. Dithered slate textures, metallic copper accents, sharp bevelled panels, and higher-density desktop ergonomics.",
      romIcon: "art/icon-rom-wb3.png",
    },
  };

  function setWorkbenchVersion(version, persist = true) {
    const config = VERSION_CONFIGS[version] || VERSION_CONFIGS["1.3"];
    document.body.classList.remove("wb-mode-2", "wb-mode-3");
    if (config.bodyClass) {
      document.body.classList.add(config.bodyClass);
    }
    if (screenTitle) {
      screenTitle.textContent = config.screenTitle;
    }
    for (const radio of radioInputs) {
      radio.checked = radio.value === (VERSION_CONFIGS[version] ? version : "1.3");
    }

    // Dynamic graphic adaptations
    const sfx = config.artSuffix;
    if (iconImgs.ram) iconImgs.ram.src = sfx ? `art/icon-disk${sfx}.png` : "art/icon-disk.png";
    if (iconImgs.oq) iconImgs.oq.src = sfx ? `art/icon-oq${sfx}.png` : "art/icon-oq.png";
    if (iconImgs.decon) iconImgs.decon.src = sfx ? `art/icon-decon${sfx}.png` : "art/icon-decon.png";
    if (iconImgs.about) iconImgs.about.src = sfx ? `art/icon-drawer${sfx}.png` : "art/icon-drawer.png";
    if (iconImgs.trash) iconImgs.trash.src = sfx ? `art/icon-trash${sfx}.png` : "art/icon-trash.png";
    if (iconImgs.version) iconImgs.version.src = config.romIcon;

    if (aboutArtImg) aboutArtImg.src = sfx ? `art/about${sfx}.png` : "art/about.png";
    if (aboutVersionKicker) aboutVersionKicker.textContent = config.aboutKicker;
    if (aboutVersionDesc) aboutVersionDesc.textContent = config.aboutDesc;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, version);
      } catch {}
    }
  }

  // Load from URL param or localStorage
  const urlParam = new URLSearchParams(window.location.search).get("version");
  let savedVersion = "1.3";
  try {
    savedVersion = localStorage.getItem(STORAGE_KEY) || "1.3";
  } catch {}
  const initialVersion = urlParam || savedVersion;
  setWorkbenchVersion(initialVersion, false);

  if (versionApply) {
    versionApply.addEventListener("click", () => {
      let selected = "1.3";
      for (const radio of radioInputs) {
        if (radio.checked) {
          selected = radio.value;
          break;
        }
      }
      setWorkbenchVersion(selected, true);
      closeWindowEl(winVersion);
    });
  }

  if (versionCancel) {
    versionCancel.addEventListener("click", () => {
      closeWindowEl(winVersion);
    });
  }

  const menuResetWB = document.getElementById("menu-resetwb");
  if (menuResetWB) {
    menuResetWB.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      closeMenu();
      setWorkbenchVersion("1.3", true);
    });
  }
})();
