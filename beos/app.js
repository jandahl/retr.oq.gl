(() => {
  "use strict";

  // BeOS R5 Tracker/Deskbar window logic — genuinely new code, not a
  // shared module. Yellow-tab chrome, hide-on-double-click, Deskbar in
  // the upper right. Not Redmond, not Mac-lineage (CLAUDE.md). Classic
  // scripts sharing state via window.<Namespace> globals.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const DRAG_SLOP = 4;
  const bootedAt = Date.now();

  // ---------- Sounds (tiny square blips; first gesture unlocks AudioContext) ----------
  let audioCtx = null;
  function beep(freq, dur) {
    if (reduceMotion) return;
    try {
      audioCtx = audioCtx || new AudioContext();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.value = 0.028;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch { /* autoplay / missing Web Audio */ }
  }
  const soundMenu = () => beep(1480, 0.04);
  const soundOpen = () => beep(880, 0.055);
  const soundHide = () => beep(420, 0.05);

  // ---------- Boot: fill the six boxes left-to-right, then go ----------
  const bootScreen = document.getElementById("boot-screen");
  const bootProgress = document.getElementById("boot-progress");
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  if (reduceMotion) {
    finishBoot();
  } else {
    bootProgress.classList.add("is-run");
    window.setTimeout(finishBoot, 1100);
  }

  // ---------- Geometry helpers ----------
  function makeTabDrag(handle, target) {
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;
    let origTab = 0;
    let dragging = false;
    let tabSlide = false;
    let lastClickAt = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".be-close, .be-zoom, button, a, input, select, textarea")) return;
      activePointerId = event.pointerId;
      dragging = false;
      tabSlide = event.shiftKey;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      origTab = parseFloat(handle.style.getPropertyValue("--be-tab-x")) || 0;
      startX = event.clientX;
      startY = event.clientY;
      try { handle.setPointerCapture(event.pointerId); } catch { /* capture optional */ }
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        dragging = true;
      }
      if (tabSlide) {
        const max = Math.max(0, target.clientWidth - handle.offsetWidth - 16);
        const next = Math.max(0, Math.min(max, origTab + dx));
        handle.style.setProperty("--be-tab-x", `${next}px`);
        return;
      }
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      const wasDrag = dragging;
      activePointerId = null;
      dragging = false;
      if (handle.hasPointerCapture?.(event.pointerId)) {
        try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      if (wasDrag) return;
      const now = Date.now();
      if (now - lastClickAt < 400) {
        lastClickAt = 0;
        hideWindow(target);
      } else {
        lastClickAt = now;
      }
    }

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  function makeResize(handle, target, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let dragging = false;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      dragging = false;
      const rect = target.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startX = event.clientX;
      startY = event.clientY;
      try { handle.setPointerCapture(event.pointerId); } catch { /* capture optional */ }
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        dragging = true;
      }
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      dragging = false;
      if (handle.hasPointerCapture?.(event.pointerId)) {
        try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      }
    }

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  const desktop = document.getElementById("desktop");
  const deskbar = document.getElementById("deskbar");
  const windows = Array.from(document.querySelectorAll(".be-window:not(.be-panel-window)"));
  let zTop = 10;
  const zooms = new Map();
  let currentWs = 0;

  const desktopContextMenu = document.getElementById("desktop-context-menu");
  const desktopIcons = document.getElementById("desktop-icons");
  const showIconsCheck = document.getElementById("desktop-context-showicons-check");
  const ICONS_HIDDEN_KEY = "retr-oq:beos-desktop-icons";

  function getIconsHidden() {
    try { return localStorage.getItem(ICONS_HIDDEN_KEY) === "hidden"; } catch { return false; }
  }
  function setIconsHidden(hidden) {
    if (desktopIcons) desktopIcons.classList.toggle("is-hidden", hidden);
    if (showIconsCheck) showIconsCheck.classList.toggle("is-checked", !hidden);
    try { localStorage.setItem(ICONS_HIDDEN_KEY, hidden ? "hidden" : "shown"); } catch { /* sandboxed iframe */ }
  }
  setIconsHidden(getIconsHidden());

  function closeDesktopContextMenu() { desktopContextMenu.hidden = true; }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop && !event.target.classList.contains("desktop-icons")) return;
    event.preventDefault();
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 96;
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
    layoutIcons();
    closeDesktopContextMenu();
  });
  document.getElementById("desktop-context-showicons").addEventListener("click", () => {
    setIconsHidden(!getIconsHidden());
    closeDesktopContextMenu();
  });

  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");
  const deskApps = document.getElementById("desk-apps");
  const appMenu = document.getElementById("app-menu");
  const ICONS = {
    "win-oq": "art/icon-oq.svg",
    "win-decon": "art/icon-decon.svg",
    "win-tracker": "art/icon-home.svg",
    "win-about": "art/icon-disk.svg",
    "win-term": "art/icon-term.svg",
    "win-ws": "art/icon-disk.svg",
    "win-teams": "art/icon-term.svg",
  };

  function isOpen(win) {
    return !win.classList.contains("closed") && !win.classList.contains("is-hidden") && !win.classList.contains("ws-away");
  }

  function applyWorkspace() {
    for (const win of windows) {
      const ws = Number(win.dataset.ws || 0);
      win.classList.toggle("ws-away", ws !== currentWs && !win.classList.contains("closed"));
    }
    for (const btn of document.querySelectorAll("#ws-replicant [data-ws], #ws-grid [data-ws]")) {
      btn.classList.toggle("is-current", Number(btn.dataset.ws) === currentWs);
    }
    paintWorkspaceMinis();
    refreshDeskbar();
  }

  function setWorkspace(index) {
    const next = Math.max(0, Math.min(3, index));
    if (next === currentWs) return;
    currentWs = next;
    applyWorkspace();
  }

  function paintWorkspaceMinis() {
    for (const cell of document.querySelectorAll("#ws-grid .ws-cell")) {
      const ws = Number(cell.dataset.ws);
      cell.textContent = "";
      let n = 0;
      for (const win of windows) {
        if (win.classList.contains("closed")) continue;
        if (Number(win.dataset.ws || 0) !== ws) continue;
        const mini = document.createElement("span");
        mini.className = "ws-mini";
        mini.style.left = `${8 + (n % 3) * 28}px`;
        mini.style.top = `${8 + Math.floor(n / 3) * 14}px`;
        mini.style.width = `${18 + (win.querySelector(".be-title")?.textContent.length || 4)}px`;
        cell.appendChild(mini);
        n += 1;
      }
    }
  }

  function refreshDeskbar() {
    deskApps.textContent = "";
    for (const win of windows) {
      if (win.classList.contains("closed")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "be-deskbar-item";
      if (win.classList.contains("is-hidden")) btn.classList.add("is-hidden-app");
      if (Number(win.dataset.ws || 0) !== currentWs) btn.classList.add("is-elsewhere");
      if (!win.classList.contains("inactive") && isOpen(win)) btn.classList.add("is-front");
      const img = document.createElement("img");
      img.alt = "";
      img.width = 16;
      img.height = 16;
      img.src = ICONS[win.id] || "art/icon-disk.svg";
      const label = document.createElement("span");
      label.textContent = win.querySelector(".be-title")?.textContent || "Window";
      btn.append(img, label);
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        openAppMenu(btn, win);
      });
      deskApps.appendChild(btn);
    }
    paintWorkspaceMinis();
    syncDesktopChromePad();
  }

  function closeAppMenu() { appMenu.hidden = true; }

  function openAppMenu(anchor, win) {
    const title = win.querySelector(".be-title")?.textContent || "Window";
    appMenu.textContent = "";
    const mk = (label, fn, gray) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "be-menu-item";
      b.setAttribute("role", "menuitem");
      b.textContent = label;
      if (gray) b.style.fontStyle = "italic";
      b.addEventListener("click", () => { closeAppMenu(); fn(); });
      li.appendChild(b);
      appMenu.appendChild(li);
    };
    mk(title, () => revealWindow(win), win.classList.contains("is-hidden"));
    mk("Hide", () => hideWindow(win));
    mk("Show", () => revealWindow(win));
    mk("Close", () => requestClose(win));
    const rect = anchor.getBoundingClientRect();
    appMenu.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`;
    appMenu.style.top = `${rect.bottom}px`;
    appMenu.hidden = false;
    soundMenu();
  }

  function focus(win) {
    if (!win.classList.contains("inactive") && isOpen(win)) {
      if (Number(win.style.zIndex) >= zTop) {
        refreshDeskbar();
        return;
      }
    }
    for (const w of windows) {
      if (w === win) w.classList.remove("inactive");
      else w.classList.add("inactive");
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
    refreshDeskbar();
  }

  function openWindow(win) {
    if (!win.dataset.ws) win.dataset.ws = String(currentWs);
    if (Number(win.dataset.ws) !== currentWs) setWorkspace(Number(win.dataset.ws));
    const wasClosed = win.classList.contains("closed");
    win.classList.remove("closed");
    win.classList.remove("is-hidden");
    win.classList.remove("ws-away");
    win.dataset.ws = String(currentWs);
    focus(win);
    if (wasClosed) soundOpen();
  }

  function revealWindow(win) {
    if (Number(win.dataset.ws || 0) !== currentWs) setWorkspace(Number(win.dataset.ws || 0));
    if (win === winOq) {
      window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
      return;
    }
    if (win === winDecon) {
      window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
      return;
    }
    openWindow(win);
  }

  function closeWindowEl(win) {
    const wasActive = !win.classList.contains("inactive");
    win.classList.add("closed");
    win.classList.remove("is-hidden");
    win.classList.remove("ws-away");
    zooms.delete(win);
    if (wasActive) {
      const next = windows.find((w) => w !== win && isOpen(w));
      if (next) focus(next);
      else win.classList.add("inactive");
    }
    refreshDeskbar();
  }

  function requestClose(win) {
    if (win === winOq || win === winDecon) {
      window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
      return;
    }
    closeWindowEl(win);
  }

  function hideWindow(win) {
    if (win.classList.contains("closed")) return;
    win.classList.add("is-hidden");
    soundHide();
    const next = windows.find((w) => w !== win && isOpen(w));
    if (next) focus(next);
    else win.classList.add("inactive");
    refreshDeskbar();
  }

  function zoomWindow(win) {
    const prev = zooms.get(win);
    if (prev) {
      win.style.left = prev.left;
      win.style.top = prev.top;
      win.style.width = prev.width;
      win.style.height = prev.height;
      zooms.delete(win);
      return;
    }
    zooms.set(win, {
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height,
    });
    const desk = desktop.getBoundingClientRect();
    win.style.left = "8px";
    win.style.top = "8px";
    win.style.width = `${Math.max(280, desk.width - 16)}px`;
    win.style.height = `${Math.max(180, desk.height - 16)}px`;
  }

  function frontWindow() {
    return windows
      .filter((w) => isOpen(w))
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0] || null;
  }

  for (const win of windows) {
    const id = win.id;
    const tab = document.getElementById(`${id}-tab`);
    const closeBtn = document.getElementById(`${id}-close`);
    const zoomBtn = document.getElementById(`${id}-zoom`);
    const resize = document.getElementById(`${id}-resize`);
    win.dataset.ws = win.dataset.ws || "0";
    win.classList.add("inactive");
    if (tab) makeTabDrag(tab, win);
    win.addEventListener("pointerdown", () => focus(win));
    if (resize) makeResize(resize, win, 240, 140);
    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        requestClose(win);
      });
    }
    if (zoomBtn) {
      zoomBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        zoomWindow(win);
      });
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

  // ---------- Desktop icons: select on click, open on double-click (single on coarse) ----------
  let selectedIcon = null;
  function selectIcon(icon) {
    for (const other of document.querySelectorAll(".desktop-icon")) {
      other.classList.toggle("is-selected", other === icon);
    }
    selectedIcon = icon;
  }

  function isNarrowViewport() {
    return window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
  }

  /**
   * Top-strip Deskbar: sits at the top of the viewport and spans ~≥90% width
   * (mobile stacked chrome, or any layout that forces a full-width top bar).
   * Side Deskbar is a tall right strip — do NOT treat its rect.bottom as top chrome.
   */
  function isTopStripDeskbar(bar) {
    if (!bar || bar.classList.contains("is-bottom")) return false;
    const rect = bar.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (!(vw > 0) || !(rect.width > 0)) return false;
    const atTop = rect.top <= 1;
    const fullWidth = rect.width >= vw * 0.9;
    return atTop && fullWidth;
  }

  /** Full occupied top chrome (yellow Be + status + apps), or 0 if side/bottom Deskbar. */
  function topChromeOccupiedPx() {
    const bar = document.getElementById("deskbar") || document.querySelector(".be-deskbar");
    if (!isTopStripDeskbar(bar)) return 0;
    const bottom = bar.getBoundingClientRect().bottom;
    if (Number.isFinite(bottom) && bottom > 0) return Math.ceil(bottom);
    return 52; // Be (~25) + status (~27) fallback
  }

  /** Single source of truth: CSS --be-top-chrome pads .be-desktop below a top-strip Deskbar. */
  function syncDesktopChromePad() {
    const occupied = topChromeOccupiedPx();
    const pad = occupied > 0 ? occupied + 4 : 0;
    document.documentElement.style.setProperty("--be-top-chrome", `${pad}px`);
    return pad;
  }

  function iconColumnTop() {
    // Canvas already cleared via --be-top-chrome when top-strip; just an inner gutter.
    return 16;
  }

  function layoutIcons() {
    const icons = Array.from(document.querySelectorAll(".desktop-icon"));
    const top0 = iconColumnTop();
    icons.forEach((icon, i) => {
      icon.style.left = "16px";
      icon.style.top = `${top0 + i * 80}px`;
    });
  }

  function placeWindowsForViewport() {
    if (!isNarrowViewport()) return;
    // Clear the left icon column (~76px + gutter) so Tracker/Home does not cover icons.
    const iconClear = 96;
    const left = iconClear;
    const width = Math.max(200, window.innerWidth - left - 8);
    const top = iconColumnTop();
    const deskH = desktop.getBoundingClientRect().height;
    const height = Math.min(Math.max(deskH - top - 16, 140), 420);
    for (const win of windows) {
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.width = `${width}px`;
      win.style.height = `${height}px`;
    }
  }

  function relayoutDesktop() {
    syncDesktopChromePad();
    layoutIcons();
    placeWindowsForViewport();
  }

  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    let pid = null;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    let dragging = false;
    icon.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pid = event.pointerId;
      dragging = false;
      const rect = icon.getBoundingClientRect();
      const parent = desktopIcons.getBoundingClientRect();
      ox = rect.left - parent.left;
      oy = rect.top - parent.top;
      sx = event.clientX;
      sy = event.clientY;
      try { icon.setPointerCapture(event.pointerId); } catch { /* optional */ }
    });
    icon.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pid) return;
      const dx = event.clientX - sx;
      const dy = event.clientY - sy;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        dragging = true;
      }
      icon.style.left = `${Math.max(0, ox + dx)}px`;
      icon.style.top = `${Math.max(0, oy + dy)}px`;
    });
    icon.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pid) return;
      pid = null;
      if (icon.hasPointerCapture?.(event.pointerId)) {
        try { icon.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      if (dragging) return;
      selectIcon(icon);
      if (coarsePointer) {
        closeBeMenu();
        closeDesktopContextMenu();
        openFromTarget(icon.dataset.open);
      }
    });
    icon.addEventListener("dblclick", () => {
      closeBeMenu();
      closeDesktopContextMenu();
      openFromTarget(icon.dataset.open);
    });
  }

  for (const row of document.querySelectorAll(".tracker-row[data-open]")) {
    row.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".tracker-row")) {
        other.classList.toggle("is-selected", other === row);
      }
      if (coarsePointer) openFromTarget(row.dataset.open);
    });
    row.addEventListener("dblclick", () => openFromTarget(row.dataset.open));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openFromTarget(row.dataset.open);
    });
  }

  for (const item of document.querySelectorAll(".be-menu-item[data-open], .be-context-item[data-open]")) {
    item.addEventListener("click", () => {
      closeBeMenu();
      closeDesktopContextMenu();
      closeAppMenu();
      openFromTarget(item.dataset.open);
    });
  }
  for (const item of document.querySelectorAll("[data-close]")) {
    item.addEventListener("click", () => {
      closeTrackerMenus();
      requestClose(document.getElementById(item.dataset.close));
    });
  }

  // ---------- Be menu ----------
  const beMenuBtn = document.getElementById("be-menu-btn");
  const beMenu = document.getElementById("be-menu");
  function closeBeMenu() {
    beMenu.hidden = true;
    beMenuBtn.setAttribute("aria-expanded", "false");
  }
  function openBeMenu() {
    beMenu.hidden = false;
    beMenuBtn.setAttribute("aria-expanded", "true");
    soundMenu();
  }
  beMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (beMenu.hidden) openBeMenu();
    else closeBeMenu();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!beMenu.hidden && !beMenu.contains(event.target) && event.target !== beMenuBtn && !beMenuBtn.contains(event.target)) {
      closeBeMenu();
    }
    if (!appMenu.hidden && !appMenu.contains(event.target)) closeAppMenu();
  });

  document.getElementById("menu-find").addEventListener("click", () => {
    closeBeMenu();
    window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
  });
  document.getElementById("menu-replicants").addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("show-replicants");
    document.getElementById("replicants-check").classList.toggle("is-checked", on);
    const dragger = document.querySelector(".be-dragger");
    if (dragger) dragger.hidden = !on;
    closeBeMenu();
  });

  const quitOverlay = document.getElementById("quit-overlay");
  const quitTitle = document.getElementById("quit-title");
  const quitCopy = document.getElementById("quit-copy");
  const quitOk = document.getElementById("quit-ok");
  function askQuit(kind) {
    closeBeMenu();
    quitTitle.textContent = kind === "shutdown" ? "Shut Down" : "Restart";
    quitCopy.textContent = kind === "shutdown"
      ? "Shut down and return to the theme picker?"
      : "Restart and return to the theme picker?";
    quitOk.textContent = kind === "shutdown" ? "Shut Down" : "Restart";
    quitOverlay.hidden = false;
  }
  document.getElementById("menu-restart").addEventListener("click", () => askQuit("restart"));
  document.getElementById("menu-shutdown").addEventListener("click", () => askQuit("shutdown"));
  document.getElementById("quit-cancel").addEventListener("click", () => { quitOverlay.hidden = true; });
  quitOk.addEventListener("click", () => {
    if (window.self !== window.top) {
      window.location.reload();
      return;
    }
    window.location.href = "../";
  });

  const legalOverlay = document.getElementById("legal-overlay");
  document.getElementById("menu-legal").addEventListener("click", () => {
    closeBeMenu();
    legalOverlay.hidden = false;
  });
  function hideLegal() { legalOverlay.hidden = true; }
  document.getElementById("legal-ok").addEventListener("click", hideLegal);
  document.getElementById("legal-close").addEventListener("click", hideLegal);

  // ---------- Tracker File / Window menus + Get Info ----------
  const trackerFileBtn = document.getElementById("tracker-file-btn");
  const trackerWindowBtn = document.getElementById("tracker-window-btn");
  const trackerFileMenu = document.getElementById("tracker-file-menu");
  const trackerWindowMenu = document.getElementById("tracker-window-menu");
  function closeTrackerMenus() {
    trackerFileMenu.hidden = true;
    trackerWindowMenu.hidden = true;
    trackerFileBtn.setAttribute("aria-expanded", "false");
    trackerWindowBtn.setAttribute("aria-expanded", "false");
  }
  function toggleBarMenu(btn, menu) {
    const open = menu.hidden;
    closeTrackerMenus();
    if (open) {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      soundMenu();
    }
  }
  trackerFileBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleBarMenu(trackerFileBtn, trackerFileMenu);
  });
  trackerWindowBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleBarMenu(trackerWindowBtn, trackerWindowMenu);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!trackerFileMenu.contains(event.target) && event.target !== trackerFileBtn &&
        !trackerWindowMenu.contains(event.target) && event.target !== trackerWindowBtn) {
      closeTrackerMenus();
    }
  });
  document.getElementById("tracker-open").addEventListener("click", () => {
    closeTrackerMenus();
    const row = document.querySelector(".tracker-row.is-selected");
    if (row) openFromTarget(row.dataset.open);
  });
  const infoOverlay = document.getElementById("info-overlay");
  document.getElementById("tracker-info").addEventListener("click", () => {
    closeTrackerMenus();
    const row = document.querySelector(".tracker-row.is-selected");
    const name = row ? row.querySelector("td")?.textContent.trim() : null;
    document.getElementById("info-copy").textContent = name
      ? `${name} — a retr-oq prototype document on /boot/home.`
      : "No item selected.";
    infoOverlay.hidden = false;
  });
  function hideInfo() { infoOverlay.hidden = true; }
  document.getElementById("info-ok").addEventListener("click", hideInfo);
  document.getElementById("info-close").addEventListener("click", hideInfo);

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
      if (!isOpen(winOq)) openWindow(winOq);
      else focus(winOq);
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
    } else if (screen === "decon") {
      if (!isOpen(winDecon)) openWindow(winDecon);
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
      if (!winOq.classList.contains("closed") && !winOq.classList.contains("is-hidden")) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed") && !winDecon.classList.contains("is-hidden")) closeWindowEl(winDecon);
    }
  });

  // ---------- Clock (click to flash the date) + Pulse ----------
  const clockEl = document.getElementById("desk-clock");
  let use24Hour = true;
  let showingDate = false;
  try {
    const resolved = Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
    if (typeof resolved.hour12 === "boolean") use24Hour = !resolved.hour12;
  } catch { /* default 24h */ }
  function formatTime(now) {
    const minutes = String(now.getMinutes()).padStart(2, "0");
    if (use24Hour) return `${String(now.getHours()).padStart(2, "0")}:${minutes}`;
    let hours = now.getHours();
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${suffix}`;
  }
  function updateClock() {
    const now = new Date();
    if (showingDate) {
      clockEl.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return;
    }
    clockEl.textContent = formatTime(now);
  }
  updateClock();
  setInterval(updateClock, 1000);
  clockEl.addEventListener("click", () => {
    showingDate = true;
    updateClock();
    window.setTimeout(() => { showingDate = false; updateClock(); }, 2500);
  });

  const cpuBars = Array.from(document.querySelectorAll("#cpu-replicant i"));
  function tickCpu() {
    for (const bar of cpuBars) {
      bar.style.height = `${20 + Math.round(Math.random() * 80)}%`;
    }
  }
  tickCpu();
  if (!reduceMotion) setInterval(tickCpu, 700);

  const aboutUptime = document.getElementById("about-uptime");
  function tickUptime() {
    const s = Math.floor((Date.now() - bootedAt) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    aboutUptime.textContent = `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  tickUptime();
  setInterval(tickUptime, 1000);

  // ---------- Workspaces ----------
  for (const btn of document.querySelectorAll("#ws-replicant [data-ws], #ws-grid [data-ws]")) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      setWorkspace(Number(btn.dataset.ws));
    });
  }

  // ---------- Deskbar dock (gripper) ----------
  const grip = document.getElementById("desk-grip");
  (function makeGrip() {
    let pid = null;
    let sy = 0;
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pid = event.pointerId;
      sy = event.clientY;
      try { grip.setPointerCapture(event.pointerId); } catch { /* optional */ }
    });
    grip.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pid) return;
      const dy = event.clientY - sy;
      pid = null;
      if (Math.abs(dy) < 12) {
        deskbar.classList.toggle("is-compact");
        syncDesktopChromePad();
        return;
      }
      if (event.clientY > window.innerHeight * 0.7) deskbar.classList.add("is-bottom");
      else deskbar.classList.remove("is-bottom");
      if (dy < -24) deskbar.classList.add("is-compact");
      if (dy > 24 && !deskbar.classList.contains("is-bottom")) deskbar.classList.remove("is-compact");
      syncDesktopChromePad();
    });
  })();

  // ---------- Twitcher (Control-Tab) ----------
  const twitcher = document.getElementById("twitcher");
  const twitcherPanel = document.getElementById("twitcher-panel");
  let twitcherIndex = 0;
  let twitcherLive = false;

  function runningWins() {
    return windows.filter((w) => !w.classList.contains("closed"));
  }

  function renderTwitcher() {
    const list = runningWins();
    twitcherPanel.textContent = "";
    if (list.length === 0) return;
    twitcherIndex = ((twitcherIndex % list.length) + list.length) % list.length;
    list.forEach((win, i) => {
      const item = document.createElement("div");
      item.className = "be-twitcher-item" + (i === twitcherIndex ? " is-on" : "");
      const img = document.createElement("img");
      img.src = ICONS[win.id] || "art/icon-disk.svg";
      img.alt = "";
      const cap = document.createElement("span");
      cap.textContent = win.querySelector(".be-title")?.textContent || "Window";
      item.append(img, cap);
      twitcherPanel.appendChild(item);
    });
  }

  function commitTwitcher() {
    const list = runningWins();
    twitcher.hidden = true;
    twitcherLive = false;
    const win = list[twitcherIndex];
    if (win) revealWindow(win);
  }

  // ---------- Team Monitor ----------
  const teamsBody = document.getElementById("teams-body");
  function refreshTeams() {
    teamsBody.textContent = "";
    const rows = [
      { name: "kernel", id: 1, kill: false },
      { name: "app_server", id: 2, kill: false },
      { name: "input_server", id: 4, kill: false },
      ...windows.filter((w) => !w.classList.contains("closed")).map((w) => ({
        name: w.dataset.team || w.id,
        id: w.dataset.teamId || "—",
        kill: true,
        win: w,
      })),
    ];
    for (const row of rows) {
      const tr = document.createElement("tr");
      const n = document.createElement("td");
      n.textContent = row.name;
      const i = document.createElement("td");
      i.textContent = String(row.id);
      const k = document.createElement("td");
      if (row.kill) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "be-push";
        btn.textContent = "Kill";
        btn.addEventListener("click", () => requestClose(row.win));
        k.appendChild(btn);
      }
      tr.append(n, i, k);
      teamsBody.appendChild(tr);
    }
  }

  // ---------- Terminal ----------
  const consoleLog = document.getElementById("console-log");
  const consoleCmd = document.getElementById("console-cmd");
  const panic = document.getElementById("panic");

  function appendConsole(line) {
    consoleLog.textContent += `${line}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function runConsole(raw) {
    const cmd = raw.trim().toLowerCase();
    appendConsole(`~/ > ${raw}`);
    if (cmd === "debugger" || cmd === "panic" || cmd === "kernel") {
      panic.classList.add("is-on");
      panic.hidden = false;
      return;
    }
    if (cmd === "clear" || cmd === "cls") {
      consoleLog.textContent = "";
      return;
    }
    if (cmd === "help") {
      appendConsole("Commands: help, clear, date, ls, whoami, workspaces");
      return;
    }
    if (cmd === "date") {
      appendConsole(new Date().toString());
      return;
    }
    if (cmd === "whoami") {
      appendConsole("baron");
      return;
    }
    if (cmd === "ls") {
      appendConsole("OQ!  Word Deconstructor  Terminal  about  Workspaces");
      return;
    }
    if (cmd === "workspaces") {
      openWindow(document.getElementById("win-ws"));
      return;
    }
    if (cmd === "hey") {
      appendConsole("hey: application/x-vnd.retr-oq.Tracker got B_PULSE");
      return;
    }
    if (cmd === "") return;
    appendConsole(`bash: ${raw}: command not found`);
  }

  consoleCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const raw = consoleCmd.value;
    consoleCmd.value = "";
    runConsole(raw);
  });
  panic.addEventListener("click", () => {
    panic.classList.remove("is-on");
    panic.hidden = true;
  });

  // ---------- Keyboard: Twitcher, Team Monitor, workspaces, Alt+W ----------
  document.addEventListener("keydown", (event) => {
    const inField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (event.key === "Escape") {
      closeBeMenu();
      closeAppMenu();
      closeTrackerMenus();
      if (twitcherLive) { twitcher.hidden = true; twitcherLive = false; }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.altKey && (event.key === "Delete" || event.key === "Backspace" || event.code === "Delete")) {
      event.preventDefault();
      openWindow(document.getElementById("win-teams"));
      refreshTeams();
      return;
    }
    if (event.ctrlKey && event.key === "Tab") {
      event.preventDefault();
      const list = runningWins();
      if (list.length === 0) return;
      if (!twitcherLive) {
        twitcherLive = true;
        twitcher.hidden = false;
        const front = frontWindow();
        twitcherIndex = Math.max(0, list.indexOf(front));
        twitcherIndex = (twitcherIndex + 1) % list.length;
      } else if (event.shiftKey) {
        twitcherIndex -= 1;
      } else {
        twitcherIndex += 1;
      }
      renderTwitcher();
      return;
    }
    if (event.altKey && (event.key === "w" || event.key === "W") && !inField) {
      event.preventDefault();
      const front = frontWindow();
      if (front) requestClose(front);
      return;
    }
    if (event.altKey && event.key >= "1" && event.key <= "4" && !inField) {
      event.preventDefault();
      setWorkspace(Number(event.key) - 1);
    }
  });
  document.addEventListener("keyup", (event) => {
    if (twitcherLive && event.key === "Control") commitTwitcher();
  });

  document.addEventListener("click", () => { if (audioCtx?.state === "suspended") audioCtx.resume(); }, { once: true });

  // Tracker is the shell — a BeBox always has a Home window running.
  // Open first so the Deskbar apps row is in the measured top chrome, then pad the canvas.
  openWindow(document.getElementById("win-tracker"));
  applyWorkspace();
  relayoutDesktop();

  window.addEventListener("resize", () => { relayoutDesktop(); });
  window.addEventListener("orientationchange", () => { relayoutDesktop(); });
})();
