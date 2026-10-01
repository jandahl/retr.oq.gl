(() => {
  "use strict";

  // Plain classic script, matching this repo's convention (see CLAUDE.md).
  // Window chrome behavior comes from shared/redmond/window-manager.js;
  // what's 3.1-specific stays here: Program Manager as the shell (open
  // on boot, close = end session), Control-menus instead of an X,
  // minimize-to-desktop-icons (the shared WM's taskbar slot, restyled),
  // analog Clock, the undocumented teddy-bear About credits.

  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const desktop = document.getElementById("desktop");
  const taskbarWindows = document.getElementById("taskbar-windows");
  const windows = Array.from(document.querySelectorAll(".win31-window"));

  const MIN_WIN_WIDTH = 200;
  const MIN_WIN_HEIGHT = 120;

  const winOq = document.getElementById("win-oq");
  const mdiOq = document.getElementById("mdi-oq");
  const mdiDecon = document.getElementById("mdi-decon");
  const mdiClient = document.getElementById("oq-mdi-client");
  const mdiChildren = [mdiOq, mdiDecon].filter(Boolean);
  // Program Manager has one OQ! icon. resolveOpen still maps a leftover
  // win-decon id onto the single OQ! MDI frame + pending child if present.
  let pendingOqScreen = null;
  const winProgman = document.getElementById("win-progman");
  const winClock = document.getElementById("win-clock");
  const bootScreen = document.getElementById("boot-screen");
  const standalone = new URLSearchParams(location.search).get("standalone") === "1";
  if (standalone) {
    winProgman.hidden = true;
    bootScreen.hidden = true;
    for (const win of windows) {
      if (win !== winOq) win.classList.add("minimized");
    }
  }

  const wm = window.OqRedmond.initWindowManager({
    desktop,
    taskbarWindows,
    windows,
    resizeHandleSelector: ".win31-resize-handle",
    minWidth: MIN_WIN_WIDTH,
    minHeight: MIN_WIN_HEIGHT,
    pointerScale: 2,
    // 3.1's minimize animation was the same outline-rectangle as 95/98,
    // just flying to a desktop icon instead of a taskbar button.
    animation: {
      geometryMs: 120,
      geometryEasing: "linear",
      minimizeMs: 140,
      minimizeEasing: "linear",
    },
    onOpen(win) {
      if (win.id === "win-oq") startOqLoad();
      if (win.id === "win-clock") startClock();
      if (minimizeOnUse && win !== winProgman) maybeMinimizeLauncher(win);
      syncChrome();
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

  const { openWindow, forceOpenWindow, closeWindow, toggleMinimize, toggleMaximize, focus } = wm;

  // ---------- 3.1 chrome: inactive titles + icon-strip visibility ----------
  // The shared WM puts a taskbar button on every *open* window. Win 3.1
  // only shows an icon for a *minimized* one, and paints inactive title
  // bars gray. Both are derived from class/z-index the WM already writes.

  function syncChrome() {
    let topWin = null;
    let topZ = -1;
    for (const w of windows) {
      if (w.classList.contains("minimized")) continue;
      const z = parseInt(w.style.zIndex || "0", 10);
      if (z >= topZ) {
        topZ = z;
        topWin = w;
      }
    }
    for (const w of windows) {
      w.classList.toggle("inactive", w !== topWin);
      const s = wm.state.get(w);
      if (s && s.taskbarButton) {
        s.taskbarButton.classList.toggle("is-minimized", w.classList.contains("minimized"));
      }
    }
    for (const w of windows) updateSysmenuState(w);
  }

  const chromeObserver = new MutationObserver(syncChrome);
  for (const win of windows) {
    chromeObserver.observe(win, { attributes: true, attributeFilter: ["class", "style"] });
  }

  // ---------- Control-menu (system menu) ----------

  function closeAllSysmenus() {
    for (const menu of document.querySelectorAll(".sysmenu")) menu.hidden = true;
  }

  function updateSysmenuState(win) {
    const menu = win.querySelector(".sysmenu");
    if (!menu) return;
    const minimized = win.classList.contains("minimized");
    const maximized = win.classList.contains("maximized");
    const restore = menu.querySelector(".sysmenu-restore");
    const minBtn = menu.querySelector(".sysmenu-min");
    const maxBtn = menu.querySelector(".sysmenu-max");
    if (restore) restore.disabled = !(minimized || maximized);
    if (minBtn) minBtn.disabled = minimized;
    if (maxBtn) maxBtn.disabled = maximized;
  }

  for (const win of windows) {
    const sys = win.querySelector(".win-sysmenu");
    const menu = win.querySelector(".sysmenu");
    sys.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closeAllSysmenus();
      closeAllMenus();
      if (willOpen) {
        updateSysmenuState(win);
        menu.hidden = false;
      }
    });
    // Authentic 3.1: double-click the Control-menu box to close.
    sys.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllSysmenus();
      // A double-click on the Control-menu box is the original instant-close
      // gesture. Bypass the synthetic button click so it cannot reopen the
      // menu or wait on any click handling before the window disappears.
      if (win === winProgman) {
        openExitDialog();
      } else {
        closeWindow(win);
        if (win.id === "win-oq") {
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
        }
      }
    });
    menu.querySelector(".sysmenu-restore").addEventListener("click", () => {
      closeAllSysmenus();
      if (win.classList.contains("minimized")) toggleMinimize(win);
      else if (win.classList.contains("maximized")) toggleMaximize(win);
    });
    menu.querySelector(".sysmenu-min").addEventListener("click", () => {
      closeAllSysmenus();
      if (!win.classList.contains("minimized")) toggleMinimize(win);
    });
    menu.querySelector(".sysmenu-max").addEventListener("click", () => {
      closeAllSysmenus();
      if (!win.classList.contains("maximized")) toggleMaximize(win);
    });
    menu.querySelector(".win-close").addEventListener("click", () => {
      closeAllSysmenus();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".sysmenu") && !event.target.closest(".win-sysmenu")) {
      closeAllSysmenus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllSysmenus();
      closeAllMenus();
    }
  });

  // Closing Program Manager ends the Windows session, same as File >
  // Exit Windows. Capture-phase so the shared WM's own close listener
  // never hides ProgMan as if it were an ordinary group window.
  winProgman.querySelector(".win-close").addEventListener("click", (event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
    openExitDialog();
  }, true);

  // ---------- Program Manager menus ----------

  function closeAllMenus() {
    for (const root of document.querySelectorAll(".menu-root")) {
      root.classList.remove("open");
      const drop = root.querySelector(".menu-drop");
      if (drop) drop.hidden = true;
    }
  }

  for (const root of document.querySelectorAll(".menu-root")) {
    const btn = root.querySelector(":scope > button");
    const drop = root.querySelector(".menu-drop");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = drop.hidden;
      closeAllMenus();
      closeAllSysmenus();
      if (willOpen) {
        // .menu-drop is position:fixed (see style.css) so it isn't
        // clipped by .window-body's own overflow:auto -- position it
        // under the button in viewport coordinates each time it opens,
        // since the window it belongs to can have moved since last time.
        // getBoundingClientRect() reports already-zoomed (rendered) px
        // under this theme's own `html { zoom: 2 }` at >=700px width (see
        // style.css's own media query), but a length assigned via
        // el.style.left is *pre*-zoom and gets multiplied by zoom again
        // on render -- divide back out, same pattern as mac8/app.js's
        // zoom-box and desktop-context-menu handlers (see CLAUDE.md).
        const zoomFactor = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        const btnRect = btn.getBoundingClientRect();
        drop.style.left = `${btnRect.left / zoomFactor}px`;
        drop.style.top = `${btnRect.bottom / zoomFactor}px`;
        drop.hidden = false;
        root.classList.add("open");
      }
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".menu-root")) closeAllMenus();
  });
  for (const item of document.querySelectorAll(".menu-drop button")) {
    item.addEventListener("click", () => closeAllMenus());
  }

  const exitOverlay = document.getElementById("exit-overlay");
  function openExitDialog() {
    closeAllSysmenus();
    closeAllMenus();
    exitOverlay.hidden = false;
    requestAnimationFrame(() => document.getElementById("exit-ok").focus());
  }
  document.getElementById("menu-exit").addEventListener("click", openExitDialog);
  document.getElementById("exit-ok").addEventListener("click", () => {
    window.location.href = "../";
  });
  document.getElementById("exit-cancel").addEventListener("click", () => {
    exitOverlay.hidden = true;
  });

  const aboutOverlay = document.getElementById("about-overlay");
  const creditsOverlay = document.getElementById("credits-overlay");
  function openAbout() {
    aboutOverlay.hidden = false;
  }
  document.getElementById("menu-about").addEventListener("click", openAbout);
  const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
  const accAbout = document.getElementById("acc-about");
  accAbout.addEventListener("click", () => {
    if (opensOnSingleClick) openAbout();
  });
  if (!opensOnSingleClick) {
    accAbout.addEventListener("dblclick", openAbout);
  }
  document.getElementById("about-ok").addEventListener("click", () => {
    aboutOverlay.hidden = true;
  });
  document.getElementById("credits-ok").addEventListener("click", () => {
    creditsOverlay.hidden = true;
  });
  // Undocumented: Ctrl+Shift click the About icon, same idea as
  // win98's Hot Dog Stand / dos's DOOM / the real 3.1 teddy-bear credits.
  document.getElementById("about-icon").addEventListener("click", (event) => {
    if (event.ctrlKey && event.shiftKey) {
      aboutOverlay.hidden = true;
      creditsOverlay.hidden = false;
    }
  });

  let minimizeOnUse = false;
  const minOnUseBtn = document.getElementById("menu-min-on-use");
  minOnUseBtn.addEventListener("click", () => {
    minimizeOnUse = !minimizeOnUse;
    minOnUseBtn.textContent = minimizeOnUse ? "✓ Minimize on Use" : "Minimize on Use";
  });

  function maybeMinimizeLauncher(win) {
    // Real 3.1 "Minimize on Use": launching an app from a group
    // minimizes that group (and Program Manager stays put).
    const launchers = {
      "win-oq": document.getElementById("win-group-main"),
      "win-clock": document.getElementById("win-group-acc"),
      "win-solitaire": document.getElementById("win-group-games"),
    };
    const group = launchers[win.id];
    if (group && !group.classList.contains("minimized")) toggleMinimize(group);
  }

  document.getElementById("menu-cascade").addEventListener("click", () => {
    let i = 0;
    for (const w of windows) {
      if (w.classList.contains("minimized")) continue;
      w.classList.remove("maximized");
      w.style.top = `${12 + i * 22}px`;
      w.style.left = `${12 + i * 22}px`;
      focus(w);
      i += 1;
    }
    syncChrome();
  });
  document.getElementById("menu-tile").addEventListener("click", () => {
    const open = windows.filter((w) => !w.classList.contains("minimized"));
    if (open.length === 0) return;
    const desk = desktop.getBoundingClientRect();
    const cols = Math.ceil(Math.sqrt(open.length));
    const rows = Math.ceil(open.length / cols);
    const w = Math.floor(desk.width / cols);
    const h = Math.floor(desk.height / rows);
    open.forEach((win, i) => {
      win.classList.remove("maximized");
      const col = i % cols;
      const row = Math.floor(i / cols);
      win.style.left = `${col * w}px`;
      win.style.top = `${row * h}px`;
      win.style.width = `${w}px`;
      win.style.height = `${h}px`;
    });
    syncChrome();
  });

  window.OqRedmond.initDesktopIcons({
    desktop,
    iconSelector: ".prog-icon[data-open]",
    openWindow,
    resolveOpen(icon) {
      if (icon.dataset.open === "win-oq" || icon.dataset.open === "win-decon") {
        pendingOqScreen = icon.dataset.open === "win-decon" ? "decon" : "oq";
        return winOq;
      }
      return null;
    },
  });

  // ---------- Analog Clock ----------

  let clockStarted = false;
  let clockTimer = null;
  function drawClock() {
    const canvas = document.getElementById("clock-canvas");
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const r = size / 2;
    const now = new Date();
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);
    ctx.beginPath();
    ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 18), Math.sin(a) * (r - 18));
      ctx.lineTo(Math.cos(a) * (r - 10), Math.sin(a) * (r - 10));
      ctx.lineWidth = i % 3 === 0 ? 3 : 1;
      ctx.stroke();
    }
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    function hand(angle, length, width, color) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "square";
      ctx.stroke();
    }
    const hourA = ((hours + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const minA = ((minutes + seconds / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    const secA = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
    hand(hourA, r * 0.45, 4, "#000080");
    hand(minA, r * 0.68, 2, "#000000");
    hand(secA, r * 0.72, 1, "#c00000");
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();
  }
  function startClock() {
    if (clockStarted) return;
    clockStarted = true;
    drawClock();
    clockTimer = setInterval(drawClock, 1000);
  }

  // ---------- Solitaire ----------
  // A small original, dependency-free Klondike-style game. It is deliberately
  // click-based so it remains usable on the tiny 3.1 window and on touch.
  const solitaireBoard = document.getElementById("solitaire-board");
  const solitaireStatus = document.getElementById("solitaire-status");
  const solitaireNew = document.getElementById("solitaire-new");
  const suits = ["♠", "♥", "♦", "♣"];
  const suitNames = ["spades", "hearts", "diamonds", "clubs"];
  let solitaire = null;

  function newSolitaireGame() {
    const deck = [];
    suits.forEach((suit, suitIndex) => {
      for (let rank = 1; rank <= 13; rank += 1) deck.push({ suit, suitIndex, rank, faceUp: false });
    });
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const tableau = Array.from({ length: 7 }, () => []);
    for (let column = 0; column < 7; column += 1) {
      for (let row = 0; row <= column; row += 1) tableau[column].push(deck.pop());
      tableau[column][tableau[column].length - 1].faceUp = true;
    }
    solitaire = { stock: deck, waste: [], tableau, foundations: [[], [], [], []], selected: null, moves: 0 };
    solitaireStatus.textContent = "Click a card, then a destination.";
    renderSolitaire();
  }

  function cardLabel(card) {
    return `${card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : card.rank}${card.suit}`;
  }

  function makeSolitairePile(className, label, pile, pileIndex, kind) {
    const pileEl = document.createElement("div");
    pileEl.className = `solitaire-pile ${className}`;
    pileEl.dataset.kind = kind;
    pileEl.dataset.pile = pileIndex;
    pileEl.setAttribute("aria-label", label);
    if (kind === "stock") {
      const button = document.createElement("button");
      button.className = `solitaire-card ${pile.length ? "face-down" : ""}`;
      button.dataset.action = "deal";
      button.textContent = pile.length ? "##" : "↻";
      button.setAttribute("aria-label", `Stock, ${pile.length} cards`);
      pileEl.appendChild(button);
    } else if (!pile.length) {
      const empty = document.createElement("span");
      empty.className = "solitaire-empty";
      empty.textContent = kind === "foundation" ? "A" : "";
      pileEl.appendChild(empty);
    }
    if (kind === "waste" && pile.length) {
      const card = pile[pile.length - 1];
      const button = document.createElement("button");
      button.className = `solitaire-card ${card.suit === "♥" || card.suit === "♦" ? "red" : ""}`;
      button.dataset.action = "select";
      button.dataset.card = `waste:${pileIndex}`;
      button.textContent = cardLabel(card);
      if (solitaire.selected && solitaire.selected.kind === "waste" && solitaire.selected.index === pileIndex) button.classList.add("selected");
      pileEl.appendChild(button);
    }
    if (kind === "foundation" && pile.length) {
      const card = pile[pile.length - 1];
      const button = document.createElement("button");
      button.className = `solitaire-card ${card.suit === "♥" || card.suit === "♦" ? "red" : ""}`;
      button.dataset.action = "select-foundation";
      button.dataset.card = `foundation:${pileIndex}`;
      button.textContent = cardLabel(card);
      pileEl.appendChild(button);
    }
    if (kind === "tableau") pile.forEach((card, cardIndex) => {
      const button = document.createElement("button");
      button.className = `solitaire-card ${card.faceUp ? "" : "face-down"} ${card.faceUp && (card.suit === "♥" || card.suit === "♦") ? "red" : ""}`;
      button.style.top = `${cardIndex * 13}px`;
      button.dataset.action = card.faceUp ? "select" : "flip";
      button.dataset.card = `tableau:${pileIndex}:${cardIndex}`;
      button.textContent = card.faceUp ? cardLabel(card) : "##";
      if (solitaire.selected && solitaire.selected.kind === "tableau" && solitaire.selected.column === pileIndex && solitaire.selected.index === cardIndex) button.classList.add("selected");
      pileEl.appendChild(button);
    });
    return pileEl;
  }

  function renderSolitaire() {
    if (!solitaireBoard || !solitaire) return;
    solitaireBoard.textContent = "";
    solitaireBoard.appendChild(makeSolitairePile("solitaire-stock", "Stock", solitaire.stock, 0, "stock"));
    solitaireBoard.appendChild(makeSolitairePile("solitaire-waste", "Waste", solitaire.waste, 0, "waste"));
    solitaire.foundations.forEach((pile, index) => solitaireBoard.appendChild(makeSolitairePile("solitaire-foundation", `Foundation ${suitNames[index]}`, pile, index, "foundation")));
    solitaire.tableau.forEach((pile, index) => solitaireBoard.appendChild(makeSolitairePile("solitaire-tableau", `Tableau column ${index + 1}`, pile, index, "tableau")));
  }

  function selectedCard() {
    if (!solitaire.selected) return null;
    if (solitaire.selected.kind === "waste") return solitaire.waste.at(-1);
    if (solitaire.selected.kind === "tableau") return solitaire.tableau[solitaire.selected.column][solitaire.selected.index];
    return null;
  }

  function removeSelected() {
    if (solitaire.selected.kind === "waste") return solitaire.waste.pop();
    const pile = solitaire.tableau[solitaire.selected.column];
    const card = pile.splice(solitaire.selected.index, 1)[0];
    if (pile.length && !pile.at(-1).faceUp) pile.at(-1).faceUp = true;
    return card;
  }

  solitaireBoard.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    const destination = event.target.closest(".solitaire-pile");
    if ((!target && !destination) || !solitaire) return;
    if (target && target.dataset.action === "deal") {
      if (!solitaire.stock.length) {
        solitaire.stock = solitaire.waste.reverse();
        solitaire.waste = [];
      } else {
        solitaire.waste.push(solitaire.stock.pop());
      }
      solitaire.selected = null;
      renderSolitaire();
      return;
    }
    const [kind, first, third] = (target.dataset.card || "").split(":");
    if (target && target.dataset.action === "flip") {
      solitaire.tableau[Number(first)][Number(third)].faceUp = true;
      renderSolitaire();
      return;
    }
    if (target && target.dataset.action === "select-foundation") {
      if (!solitaire.selected) return;
    }
    if (solitaire.selected && destination) {
      const card = selectedCard();
      const destKind = destination.dataset.kind;
      const destIndex = Number(destination.dataset.pile);
      const dest = destKind === "tableau" ? solitaire.tableau[destIndex] : solitaire.foundations[destIndex];
      const top = dest.at(-1);
      const validTableau = destKind === "tableau" && (!top ? card.rank === 13 : top.faceUp && top.rank === card.rank + 1 && ((top.suit === "♥" || top.suit === "♦") !== (card.suit === "♥" || card.suit === "♦")));
      const validFoundation = destKind === "foundation" && card.rank === (top ? top.rank + 1 : 1) && (!top || top.suit === card.suit);
      if (card && (validTableau || validFoundation)) {
        dest.push(removeSelected());
        solitaire.moves += 1;
        solitaire.selected = null;
        solitaireStatus.textContent = solitaire.foundations.every((pile) => pile.length === 13) ? "You win!" : `${solitaire.moves} move${solitaire.moves === 1 ? "" : "s"}`;
        renderSolitaire();
        return;
      }
    }
    if (!target) return;
    solitaire.selected = kind === "waste" ? { kind, index: 0 } : { kind: "tableau", column: Number(first), index: Number(third) };
    renderSolitaire();
  });
  solitaireNew.addEventListener("click", newSolitaireGame);
  newSolitaireGame();

  // ---------- OQ! ----------

  const OQ_DEFAULT_ROWS = 50;
  const OQ_MAX_FILTERED_ROWS = 200;

  // ---------- OQ! MDI children (Dictionary + Word Deconstructor) ----------
  // Painful-but-correct Win 3.x: one EXE frame, document windows inside the
  // client area. Children are NOT .win31-window (so the shared Redmond WM
  // does not treat them as top-level / icon-strip apps).
  let mdiZ = 1;
  function focusMdiChild(child) {
    if (!child || child.classList.contains("mdi-minimized")) {
      if (child) {
        child.classList.remove("mdi-minimized");
      }
    }
    if (!child) return;
    mdiZ += 1;
    child.style.zIndex = String(mdiZ);
    for (const c of mdiChildren) c.classList.toggle("mdi-inactive", c !== child);
  }

  function showMdiForScreen(screen) {
    const child = screen === "decon" ? mdiDecon : mdiOq;
    // Ensure both children exist in the client (restore if minimized).
    for (const c of mdiChildren) {
      if (c.classList.contains("mdi-minimized") && c === child) {
        c.classList.remove("mdi-minimized");
      }
    }
    focusMdiChild(child);
  }

  function cascadeMdiChildren() {
    let i = 0;
    for (const c of mdiChildren) {
      if (c.classList.contains("mdi-minimized")) continue;
      c.classList.remove("mdi-maximized");
      const max = c.querySelector(".mdi-maximize");
      if (max) max.setAttribute("aria-label", "Maximize");
      c.style.top = `${8 + i * 22}px`;
      c.style.left = `${8 + i * 22}px`;
      c.style.width = "18rem";
      c.style.height = "14rem";
      focusMdiChild(c);
      i += 1;
    }
  }

  function tileMdiChildren() {
    const open = mdiChildren.filter((c) => !c.classList.contains("mdi-minimized"));
    if (!open.length || !mdiClient) return;
    const rect = mdiClient.getBoundingClientRect();
    const cols = Math.ceil(Math.sqrt(open.length));
    const rows = Math.ceil(open.length / cols);
    const w = Math.floor(rect.width / cols);
    const h = Math.floor(rect.height / rows);
    open.forEach((child, i) => {
      child.classList.remove("mdi-maximized");
      const max = child.querySelector(".mdi-maximize");
      if (max) max.setAttribute("aria-label", "Maximize");
      const col = i % cols;
      const row = Math.floor(i / cols);
      child.style.left = `${col * w}px`;
      child.style.top = `${row * h}px`;
      child.style.width = `${Math.max(160, w - 4)}px`;
      child.style.height = `${Math.max(120, h - 4)}px`;
    });
  }

  function makeMdiDraggable(child) {
    const handle = child.querySelector(".mdi-title-bar");
    if (!handle) return;
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (child.classList.contains("mdi-maximized")) return;
      if (event.target.closest("button")) return;
      focusMdiChild(child);
      activePointerId = event.pointerId;
      origX = child.offsetLeft;
      origY = child.offsetTop;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId) return;
      const dx = (event.clientX - startX) / 2; // win31 pointerScale
      const dy = (event.clientY - startY) / 2;
      child.style.left = `${Math.max(0, origX + dx)}px`;
      child.style.top = `${Math.max(0, origY + dy)}px`;
    });
    function end(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
    }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    child.addEventListener("pointerdown", () => focusMdiChild(child));
    const minBtn = child.querySelector(".mdi-minimize");
    const maxBtn = child.querySelector(".mdi-maximize");
    if (minBtn) {
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        child.classList.add("mdi-minimized");
        child.classList.remove("mdi-maximized");
        if (maxBtn) maxBtn.setAttribute("aria-label", "Maximize");
      });
    }
    if (maxBtn) {
      maxBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        child.classList.toggle("mdi-maximized");
        focusMdiChild(child);
      });
    }
    const sys = child.querySelector(".mdi-sysmenu");
    if (sys) {
      sys.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        child.classList.add("mdi-minimized");
      });
    }
  }

  for (const child of mdiChildren) makeMdiDraggable(child);
  focusMdiChild(mdiOq);

  const oqMenuCascade = document.getElementById("oq-menu-cascade");
  const oqMenuTile = document.getElementById("oq-menu-tile");
  const oqMenuClose = document.getElementById("oq-menu-close");
  if (oqMenuCascade) oqMenuCascade.addEventListener("click", () => { cascadeMdiChildren(); closeAllMenus(); });
  if (oqMenuTile) oqMenuTile.addEventListener("click", () => { tileMdiChildren(); closeAllMenus(); });
  if (oqMenuClose) {
    oqMenuClose.addEventListener("click", () => {
      closeAllMenus();
      closeWindow(winOq);
      window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
    });
  }
  for (const btn of document.querySelectorAll("#oq-menubar [data-mdi]")) {
    btn.addEventListener("click", () => {
      const child = document.getElementById(btn.dataset.mdi);
      if (!child) return;
      const view = child.dataset.oqView === "decon" ? "decon" : "oq";
      pendingOqScreen = view;
      // Navigate so URL matches the focused child.
      if (view === "decon") {
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null, filter: null }, { replace: true });
      } else {
        window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null, word: null }, { replace: true });
      }
      closeAllMenus();
    });
  }


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
    if (screen === "oq" || screen === "decon") {
      if (winOq.classList.contains("minimized")) forceOpenWindow(winOq);
      showMdiForScreen(screen);
      if (screen === "oq") {
        startOqLoad();
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

  // Boot to Program Manager, with a brief startup screen before the shell
  // appears. Continue is useful for keyboard and automated previews.
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
    if (standalone) return;
    forceOpenWindow(winProgman);
    syncChrome();
  }
  bootScreen.addEventListener("click", finishBoot);
  window.setTimeout(finishBoot, 1400);
})();
