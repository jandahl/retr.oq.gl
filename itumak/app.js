(() => {
  "use strict";

  // Itumak Tallimat (Palm V / Vx) Application Logic
  // Handles:
  // 1. Palm OS navigation (OQ! Dictionary, Decon, Morph, About)
  // 2. Hardware buttons & Rocker scrolling
  // 3. LCD passive-matrix persistence/ghosting engine
  // 4. Reverse-EL Indiglo backlight toggle
  // 5. Graffiti single-stroke gesture recognizer & canvas inker
  // 6. On-screen virtual pixel keyboard (abc / 123)

  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  // DOM Elements
  const lcd = document.getElementById("palm-lcd");
  const ghostCanvas = document.getElementById("palm-ghost-canvas");
  const ghostCtx = ghostCanvas ? ghostCanvas.getContext("2d") : null;
  const appTitle = document.getElementById("palm-app-title");
  const dropdown = document.getElementById("palm-dropdown");
  const clockEl = document.getElementById("palm-clock");
  const btnPower = document.getElementById("btn-power");
  const btnTitleMenu = document.getElementById("btn-title-menu");
  const silkApps = document.getElementById("silk-apps");
  const silkMenu = document.getElementById("silk-menu");
  const silkCalc = document.getElementById("silk-calc");
  const silkFind = document.getElementById("silk-find");
  
  // Hardware controls
  const hwDatebook = document.getElementById("hw-btn-datebook");
  const hwAddress = document.getElementById("hw-btn-address");
  const hwTodo = document.getElementById("hw-btn-todo");
  const hwMemo = document.getElementById("hw-btn-memo");
  const hwRockerUp = document.getElementById("hw-rocker-up");
  const hwRockerDown = document.getElementById("hw-rocker-down");
  const stylusSlot = document.getElementById("palm-stylus");

  // Screens
  const SCREENS = {
    oq: document.getElementById("screen-oq"),
    decon: document.getElementById("screen-decon"),
    morph: document.getElementById("screen-morph"),
    about: document.getElementById("screen-about"),
  };

  const TITLE_MAP = {
    oq: "OQ! Dictionary",
    decon: "Word Decon",
    morph: "Morph Challenge",
    about: "About Itumak",
  };

  let currentScreen = "oq";
  let dictEntries = null;
  let visibleRows = [];
  let selectedIndex = 0;

  // Dictionary elements
  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqResults = document.getElementById("oq-results");
  const oqAttribution = document.getElementById("oq-attribution");
  if (oqAttribution) oqAttribution.textContent = DICT_ATTRIBUTION;

  // Decon elements
  const deconWord = document.getElementById("decon-word");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");
  const deconRootFirst = document.getElementById("decon-root-first");
  const deconAnalyzeBtn = document.getElementById("decon-analyze-btn");

  // Morph elements
  const morphLives = document.getElementById("morph-lives");
  const morphScore = document.getElementById("morph-score");
  const morphWord = document.getElementById("morph-word");
  const morphStatus = document.getElementById("morph-status");
  const morphOptions = document.getElementById("morph-options");
  const morphCard = document.getElementById("morph-card");
  const morphCardMeaning = document.getElementById("morph-card-meaning");
  const morphCardNext = document.getElementById("morph-card-next");

  // Virtual keyboard elements
  const kbdDialog = document.getElementById("palm-keyboard");
  const kbdTitle = document.getElementById("kbd-title");
  const kbdClose = document.getElementById("kbd-close");
  const kbdShift = document.getElementById("kbd-shift");
  const dotAbc = document.getElementById("dot-abc");
  const dot123 = document.getElementById("dot-123");
  let kbdShifted = false;
  let activeInputTarget = oqFilter;

  // -------------------------------------------------------------
  // Passive-Matrix LCD Ghosting & Persistence Engine
  // -------------------------------------------------------------
  function setupGhostCanvas() {
    if (!ghostCanvas) return;
    ghostCanvas.width = 160;
    ghostCanvas.height = 160;
  }
  setupGhostCanvas();
  window.addEventListener("resize", setupGhostCanvas);

  let ghostDecayTimer = null;
  function triggerLcdGhosting(intensity = 0.8) {
    if (!ghostCtx || !ghostCanvas) return;
    try {
      // Paint ghosting smear into the ghost canvas representing passive-matrix lag
      ghostCanvas.style.opacity = intensity;
      const isBacklight = document.body.classList.contains("backlight-on");
      ghostCtx.fillStyle = isBacklight ? "rgba(75, 248, 211, 0.28)" : "rgba(17, 24, 15, 0.25)";
      
      // Draw simulated ghosting lines across the display
      for (let y = 0; y < 160; y += 4) {
        if (Math.random() > 0.4) {
          ghostCtx.fillRect(0, y, 160, 2);
        }
      }

      clearTimeout(ghostDecayTimer);
      ghostDecayTimer = setTimeout(() => {
        ghostCanvas.style.opacity = "0";
        setTimeout(() => {
          if (ghostCtx) ghostCtx.clearRect(0, 0, 160, 160);
        }, 160);
      }, 140);
    } catch {
      // Fallback
    }
  }

  // -------------------------------------------------------------
  // Screen Navigation
  // -------------------------------------------------------------
  function showScreen(name) {
    if (!SCREENS[name]) return;
    triggerLcdGhosting(0.9);
    currentScreen = name;
    for (const [key, el] of Object.entries(SCREENS)) {
      el.hidden = key !== name;
    }
    appTitle.textContent = TITLE_MAP[name] || "Itumak";
    dropdown.hidden = true;

    if (name === "oq") {
      activeInputTarget = oqFilter;
    } else if (name === "decon") {
      activeInputTarget = deconWord;
    } else {
      kbdDialog.hidden = true;
    }
  }

  // Clock updater
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    clockEl.textContent = `${h}:${m}`;
  }
  updateClock();
  setInterval(updateClock, 30000);

  // Power / Backlight Toggle
  btnPower.addEventListener("click", () => {
    document.body.classList.toggle("backlight-on");
    triggerLcdGhosting(1.0);
  });

  // Stylus tap feedback
  stylusSlot.addEventListener("click", () => {
    if (navigator.vibrate) navigator.vibrate([15]);
    triggerLcdGhosting(0.5);
  });

  // Menu Dropdown toggle
  function toggleDropdown() {
    dropdown.hidden = !dropdown.hidden;
  }
  btnTitleMenu.addEventListener("click", toggleDropdown);
  silkMenu.addEventListener("click", toggleDropdown);

  document.querySelectorAll(".palm-menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      dropdown.hidden = true;
      if (action === "oq" || action === "decon" || action === "morph" || action === "about") {
        window.OqRouter.navigate({ screen: action });
      } else if (action === "toggle-el") {
        document.body.classList.toggle("backlight-on");
        triggerLcdGhosting(1.0);
      } else if (action === "hub") {
        location.assign("../");
      }
    });
  });

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== btnTitleMenu && e.target !== silkMenu) {
      dropdown.hidden = true;
    }
  });

  // Soft touch silk buttons
  silkApps.addEventListener("click", () => {
    window.OqRouter.navigate({ screen: currentScreen === "oq" ? "decon" : "oq" });
  });

  silkCalc.addEventListener("click", () => {
    window.OqRouter.navigate({ screen: "decon" });
  });

  silkFind.addEventListener("click", () => {
    window.OqRouter.navigate({ screen: "oq" });
    oqFilter.focus();
    oqFilter.select();
  });

  // Hardware buttons
  hwAddress.addEventListener("click", () => window.OqRouter.navigate({ screen: "oq" }));
  hwMemo.addEventListener("click", () => window.OqRouter.navigate({ screen: "oq" }));
  hwTodo.addEventListener("click", () => window.OqRouter.navigate({ screen: "decon" }));
  hwDatebook.addEventListener("click", () => window.OqRouter.navigate({ screen: "morph" }));

  // Up/Down Rocker scrolling
  function scrollActiveView(delta) {
    triggerLcdGhosting(0.7);
    if (currentScreen === "oq") {
      const items = oqResults.querySelectorAll(".palm-list-item");
      if (items.length === 0) return;
      selectedIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
      items.forEach((it, i) => it.classList.toggle("selected", i === selectedIndex));
      if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: "nearest" });
    } else if (currentScreen === "decon") {
      deconResults.scrollTop += delta * 24;
    }
  }

  hwRockerUp.addEventListener("click", () => scrollActiveView(-1));
  hwRockerDown.addEventListener("click", () => scrollActiveView(1));

  // About screen close
  const btnAboutClose = document.getElementById("btn-about-close");
  if (btnAboutClose) {
    btnAboutClose.addEventListener("click", () => window.OqRouter.navigate({ screen: "oq" }));
  }

  // -------------------------------------------------------------
  // OQ! Dictionary Logic (Shows BOTH Lexeme and English Gloss)
  // -------------------------------------------------------------
  function renderOqResults(query) {
    if (!dictEntries) return;
    const filter = (query || "").trim();
    visibleRows = filterDictEntries(dictEntries, filter).slice(0, 50);
    selectedIndex = 0;
    oqResults.innerHTML = "";
    
    if (visibleRows.length === 0) {
      oqStatus.textContent = "0 records";
      const empty = document.createElement("div");
      empty.className = "palm-list-item";
      empty.textContent = "No matches found.";
      oqResults.appendChild(empty);
      return;
    }

    oqStatus.textContent = `${visibleRows.length} records`;
    const frag = document.createDocumentFragment();
    visibleRows.forEach((row, i) => {
      const item = document.createElement("div");
      item.className = "palm-list-item" + (i === 0 ? " selected" : "");
      item.role = "option";
      
      // Lexeme (headword) - syllabified for linguistic readability
      const head = document.createElement("span");
      head.className = "palm-item-headword";
      const lexemeText = row.lexeme || row.word || "";
      head.textContent = syllabify ? syllabify(lexemeText) : lexemeText;

      // English Gloss (translation)
      const gloss = document.createElement("span");
      gloss.className = "palm-item-gloss";
      gloss.textContent = row.gloss_en || row.gloss || "—";

      item.appendChild(head);
      item.appendChild(gloss);

      item.addEventListener("click", () => {
        selectedIndex = i;
        triggerLcdGhosting(0.4);
        document.querySelectorAll(".palm-list-item").forEach((el, idx) => {
          el.classList.toggle("selected", idx === i);
        });
      });

      frag.appendChild(item);
    });
    oqResults.appendChild(frag);
  }

  oqFilter.addEventListener("input", (e) => {
    triggerLcdGhosting(0.3);
    renderOqResults(e.target.value);
    window.OqRouter.navigate({ filter: e.target.value || null }, { replace: true });
  });

  // -------------------------------------------------------------
  // Word Deconstructor Controller
  // -------------------------------------------------------------
  const deconController = createController({
    wordInput: deconWord,
    statusEl: deconStatus,
    resultsEl: deconResults,
    rootFirstCheckbox: deconRootFirst,
    onStateChange: () => triggerLcdGhosting(0.8),
  });

  deconAnalyzeBtn.addEventListener("click", () => {
    triggerLcdGhosting(0.8);
    deconController.analyze();
  });

  // -------------------------------------------------------------
  // Morph Challenge Game
  // -------------------------------------------------------------
  let morphEngine = null;

  function initMorphGame() {
    if (!window.OqMorphGame || !window.OqMorphPuzzles) return;
    morphEngine = window.OqMorphGame.createGame({
      puzzles: window.OqMorphPuzzles,
      onUpdate: (state) => {
        triggerLcdGhosting(0.8);
        morphLives.textContent = "❤".repeat(Math.max(0, state.lives));
        morphScore.textContent = `Score: ${state.score}`;
        morphWord.textContent = state.targetWord || "---";

        if (state.isRoundWon) {
          morphStatus.textContent = "Correct!";
          morphOptions.innerHTML = "";
          morphCardMeaning.textContent = state.targetMeaning || "";
          morphCard.hidden = false;
        } else if (state.isGameOver) {
          morphStatus.textContent = "Game Over!";
          morphOptions.innerHTML = "";
          morphCardMeaning.textContent = `Final Score: ${state.score}`;
          morphCard.hidden = false;
        } else {
          morphCard.hidden = true;
          morphStatus.textContent = "Select next morpheme:";
          morphOptions.innerHTML = "";
          (state.choices || []).forEach((choice) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "palm-choice-btn";
            btn.textContent = `${choice.text} (${choice.gloss})`;
            btn.addEventListener("click", () => {
              morphEngine.choose(choice.id);
            });
            morphOptions.appendChild(btn);
          });
        }
      },
    });
    morphEngine.start();
  }

  morphCardNext.addEventListener("click", () => {
    if (morphEngine) morphEngine.nextRound();
  });

  // -------------------------------------------------------------
  // Virtual Pixel Keyboard (abc / 123 popup)
  // -------------------------------------------------------------
  const KBD_LAYOUT_ABC = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", ".", ","],
  ];

  const KBD_LAYOUT_123 = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    ["-", "+", "=", "/", "?", ":", ";", "\"", "'"],
  ];

  function openKeyboard(mode) {
    triggerLcdGhosting(0.5);
    kbdTitle.textContent = mode === "123" ? "Keyboard (123)" : "Keyboard (abc)";
    const layout = mode === "123" ? KBD_LAYOUT_123 : KBD_LAYOUT_ABC;
    
    [1, 2, 3].forEach((rowNum) => {
      const rowEl = document.getElementById(`kbd-row-${rowNum}`);
      rowEl.innerHTML = "";
      layout[rowNum - 1].forEach((char) => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "palm-kbd-key";
        key.textContent = kbdShifted ? char.toUpperCase() : char;
        key.dataset.char = char;
        key.addEventListener("click", () => injectChar(kbdShifted ? char.toUpperCase() : char));
        rowEl.appendChild(key);
      });
    });

    kbdDialog.hidden = false;
  }

  function injectChar(char) {
    if (!activeInputTarget) {
      activeInputTarget = currentScreen === "decon" ? deconWord : oqFilter;
    }
    triggerLcdGhosting(0.3);
    const start = activeInputTarget.selectionStart || activeInputTarget.value.length;
    const end = activeInputTarget.selectionEnd || activeInputTarget.value.length;
    const val = activeInputTarget.value;
    activeInputTarget.value = val.substring(0, start) + char + val.substring(end);
    activeInputTarget.selectionStart = activeInputTarget.selectionEnd = start + char.length;
    activeInputTarget.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function backspaceChar() {
    if (!activeInputTarget) {
      activeInputTarget = currentScreen === "decon" ? deconWord : oqFilter;
    }
    triggerLcdGhosting(0.3);
    const start = activeInputTarget.selectionStart;
    const end = activeInputTarget.selectionEnd;
    const val = activeInputTarget.value;
    if (start === end && start > 0) {
      activeInputTarget.value = val.substring(0, start - 1) + val.substring(end);
      activeInputTarget.selectionStart = activeInputTarget.selectionEnd = start - 1;
    } else if (start !== end) {
      activeInputTarget.value = val.substring(0, start) + val.substring(end);
      activeInputTarget.selectionStart = activeInputTarget.selectionEnd = start;
    }
    activeInputTarget.dispatchEvent(new Event("input", { bubbles: true }));
  }

  dotAbc.addEventListener("click", (e) => {
    e.stopPropagation();
    openKeyboard("abc");
  });

  dot123.addEventListener("click", (e) => {
    e.stopPropagation();
    openKeyboard("123");
  });

  kbdClose.addEventListener("click", () => {
    kbdDialog.hidden = true;
  });

  kbdShift.addEventListener("click", () => {
    kbdShifted = !kbdShifted;
    kbdShift.classList.toggle("is-active", kbdShifted);
    openKeyboard(kbdTitle.textContent.includes("123") ? "123" : "abc");
  });

  document.getElementById("kbd-backspace").addEventListener("click", backspaceChar);

  // Focus tracking for input injection
  oqFilter.addEventListener("focus", () => { activeInputTarget = oqFilter; });
  deconWord.addEventListener("focus", () => { activeInputTarget = deconWord; });

  // -------------------------------------------------------------
  // GRAFFITI GESTURE RECOGNIZER & CANVAS INKER
  // -------------------------------------------------------------
  const canvas = document.getElementById("graffiti-canvas");
  const ctx = canvas.getContext("2d");
  const indicator = document.getElementById("graffiti-indicator");
  let drawing = false;
  let strokePoints = [];

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  function showIndicator(text) {
    if (!indicator) return;
    indicator.textContent = text === " " ? "␣" : text;
    indicator.classList.add("visible");
    setTimeout(() => {
      indicator.classList.remove("visible");
    }, 450);
  }

  function startStroke(e) {
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    drawing = true;
    strokePoints = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pt = getCanvasCoords(e);
    strokePoints.push(pt);
    if (navigator.vibrate) navigator.vibrate([6]);
  }

  function moveStroke(e) {
    if (!drawing) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getCanvasCoords(e);
    strokePoints.push(pt);

    // Inking on canvas: 1-bit crisp stroke
    ctx.lineWidth = 2.5;
    ctx.lineCap = "square";
    ctx.strokeStyle = document.body.classList.contains("backlight-on") ? "#4bf8d3" : "#11180f";
    
    ctx.beginPath();
    const len = strokePoints.length;
    if (len >= 2) {
      ctx.moveTo(Math.round(strokePoints[len - 2].x), Math.round(strokePoints[len - 2].y));
      ctx.lineTo(Math.round(pt.x), Math.round(pt.y));
      ctx.stroke();
    }
  }

  function endStroke(e) {
    if (!drawing) return;
    e.preventDefault();
    e.stopPropagation();
    drawing = false;
    if (strokePoints.length < 2) return;

    const char = recognizeGraffiti(strokePoints);
    if (char) {
      showIndicator(char);
      if (char === "BACKSPACE") {
        backspaceChar();
      } else if (char === "ENTER") {
        if (currentScreen === "decon") deconController.analyze();
      } else {
        injectChar(char);
      }
      if (navigator.vibrate) navigator.vibrate([10]);
    }

    // LCD persistence / ghosting decay for stroke
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 160);
  }

  canvas.addEventListener("mousedown", startStroke);
  canvas.addEventListener("mousemove", moveStroke);
  window.addEventListener("mouseup", (e) => { if (drawing) endStroke(e); });
  canvas.addEventListener("touchstart", startStroke, { passive: false });
  canvas.addEventListener("touchmove", moveStroke, { passive: false });
  canvas.addEventListener("touchend", endStroke, { passive: false });

  // Deterministic Palm Unistroke Graffiti Recognizer
  function recognizeGraffiti(pts) {
    const start = pts[0];
    const end = pts[pts.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const midX = canvas.width / 2;
    const isNumberZone = start.x > midX;

    // Minimum stroke length
    if (dist < 4 && pts.length < 4) return null;

    // 1. Horizontal Swipes: Space (Left-to-Right) and Backspace (Right-to-Left)
    if (Math.abs(dx) > Math.abs(dy) * 1.8 && Math.abs(dx) > 16) {
      if (dx > 0) return " "; // Space
      if (dx < 0) return "BACKSPACE";
    }

    // 2. Simple Vertical Downstroke: "I" / "1"
    if (dy > 12 && Math.abs(dx) < 9) {
      return isNumberZone ? "1" : "i";
    }

    // 3. Simple Vertical Upstroke: "T" / "/"
    if (dy < -12 && Math.abs(dx) < 9) {
      return isNumberZone ? "7" : "t";
    }

    // 4. Calculate Bounding Box and Extrema
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const w = maxX - minX;
    const h = maxY - minY;

    // Diagonal stroke down-left: Enter
    if (dx < -14 && dy > 14) return "ENTER";

    // Inverted V gesture: "A" / "4" (starts bottom-left, goes up to apex, then down to bottom-right)
    if (start.y > minY + h * 0.35 && end.y > minY + h * 0.35) {
      const minPt = pts.reduce((acc, p) => p.y < acc.y ? p : acc, pts[0]);
      if (minPt.y <= minY + 4 && minPt.x > minX + 2 && minPt.x < maxX - 2) {
        return isNumberZone ? "4" : "a";
      }
    }

    // Normal V gesture: "V"
    if (start.y < maxY - h * 0.35 && end.y < maxY - h * 0.35) {
      const maxPt = pts.reduce((acc, p) => p.y > acc.y ? p : acc, pts[0]);
      if (maxPt.y >= maxY - 4 && maxPt.x > minX + 2 && maxPt.x < maxX - 2) {
        return "v";
      }
    }

    // C shape: starts top-right, arches left, ends bottom-right
    if (start.x > minX + w * 0.35 && end.x > minX + w * 0.35 && dx < 12) {
      const leftPt = pts.reduce((acc, p) => p.y < acc.y ? p : acc, pts[0]);
      if (leftPt.x <= minX + 4) {
        return isNumberZone ? "0" : "c";
      }
    }

    // O shape / Loop: start and end are close together
    if (dist < 12 && w > 8 && h > 8) {
      return isNumberZone ? "0" : "o";
    }

    // L shape: vertical down then horizontal right
    if (start.y < end.y && start.x < end.x && end.x > minX + w * 0.5) {
      return isNumberZone ? "2" : "l";
    }

    // P or D shape: downstroke followed by loop right
    if (dy > 10 && maxX > start.x + 8) {
      return isNumberZone ? "9" : "p";
    }

    // S shape: curve back and forth
    if (h > 14 && w > 8 && Math.abs(dx) < 12) {
      return isNumberZone ? "5" : "s";
    }

    // Fallbacks
    if (isNumberZone) {
      if (dy > 8) return "1";
      return null;
    } else {
      if (dy > 8) return "i";
      return null;
    }
  }

  // -------------------------------------------------------------
  // Router Initialization
  // -------------------------------------------------------------
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen") || "oq";
    showScreen(screen);

    const filter = params.get("filter");
    if (filter !== null && filter !== undefined) {
      oqFilter.value = filter;
      renderOqResults(filter);
    }

    const word = params.get("word");
    if (word && screen === "decon") {
      deconWord.value = word;
      deconController.analyze();
    }
  });

  // Load Dictionary Data
  loadDictEntries().then((entries) => {
    dictEntries = entries;
    oqStatus.textContent = `${entries.length} records`;
    const initialQuery = oqFilter.value || "";
    renderOqResults(initialQuery);
    initMorphGame();
  }).catch((err) => {
    oqStatus.textContent = "Error loading dictionary";
    console.error(err);
  });

})();
