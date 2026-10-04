(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as gb/app.js -- see CLAUDE.md. The chrome is hand-drawn
  // Game Gear plastic (no vendored kit); this file is the "game" the same way
  // nes/app.js is: which screen is up, D-pad focus, OQ!/DECON. Hardware is a
  // pocket Master System, not a color DMG: same Z80 + SN76489 family as the
  // living-room deck. Face buttons are labeled 1 and 2 -- markup maps 2→A
  // and 1→B so Enter still confirms.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  const SCREENS = {
    boot: document.getElementById("boot-screen"),
    title: document.getElementById("title-screen"),
    menu: document.getElementById("menu-screen"),
    oq: document.getElementById("oq-screen"),
    decon: document.getElementById("decon-screen"),
    about: document.getElementById("about-screen"),
    gameover: document.getElementById("gameover-screen"),
  };

  const MENU_ORDER = ["oq", "decon", "about", "quit"];
  const menuButtons = MENU_ORDER.map((id) => document.getElementById(`menu-${id}`));
  const continueYes = document.getElementById("continue-yes");
  const continueNo = document.getElementById("continue-no");
  const continueButtons = [continueYes, continueNo];

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqResults = document.getElementById("oq-results");
  const deconWord = document.getElementById("decon-word");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");
  const deconRootFirst = document.getElementById("decon-root-first");

  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  const DEFAULT_ROWS = 50;
  const MAX_FILTERED_ROWS = 200;

  let currentScreen = "boot";
  let menuIndex = 0;
  let bootDone = false;
  let bootTimer = 0;
  const BOOT_MS = (navigator.webdriver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 2000;
  let continueIndex = 0;
  let dictEntries = null;
  let visibleRows = [];
  let selectedIndex = 0;
  // Konami tracker -- title screen only. Contra's 30 lives, not a real
  // unlock: CONTINUE on the game-over screen just goes to the file-select
  // menu. Not listed on the title, same idea as dos/'s undocumented DOOM
  // command and win98/'s Hot Dog Stand scheme.
  const KONAMI = [
    "up", "up", "down", "down", "left", "right", "left", "right", "b", "a",
  ];
  let konamiProgress = 0;

  function showScreen(name) {
    currentScreen = name;
    for (const [key, el] of Object.entries(SCREENS)) {
      el.hidden = key !== name;
    }
    if (name !== "title" && name !== "boot") konamiProgress = 0;
    if (name === "oq") oqFilter.focus();
    else if (name === "decon") deconWord.focus();
    else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function setMenuIndex(next) {
    const len = menuButtons.length;
    menuIndex = ((next % len) + len) % len;
    menuButtons.forEach((btn, i) => btn.classList.toggle("is-selected", i === menuIndex));
  }

  function setContinueIndex(next) {
    const len = continueButtons.length;
    continueIndex = ((next % len) + len) % len;
    continueButtons.forEach((btn, i) => btn.classList.toggle("is-selected", i === continueIndex));
  }

  function chooseMenuItem(id) {
    if (id === "quit") {
      location.assign("../");
      return;
    }
    if (id === "oq") {
      window.OqRouter.navigate({ screen: "oq", filter: null, word: null, order: null });
      return;
    }
    if (id === "decon") {
      window.OqRouter.navigate({ screen: "decon", word: null, filter: null });
      return;
    }
    if (id === "about") {
      window.OqRouter.navigate({ screen: "about", filter: null, word: null });
    }
  }

  function goTitle() {
    window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
  }

  function goMenu() {
    window.OqRouter.navigate({ screen: "menu", filter: null, word: null, order: null });
  }

  function inputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  // Square-wave bloops. Game Gear's PSG is the Master System SN76489:
  // three pulse channels + noise. Not the GB's two pulse + wave. Silent
  // until the first pad/key gesture; typing in SEARCH/WORD is silent.
  let audioCtx = null;
  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }
  function tone(freq, when, dur, gain) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
  function noise(when, dur, gain) {
    if (!audioCtx) return;
    const length = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    src.buffer = buffer;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(g);
    g.connect(audioCtx.destination);
    src.start(when);
  }
  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const vol = 0.06;
    if (kind === "move") {
      tone(196, t, 0.04, vol);
    } else if (kind === "ok") {
      tone(523.25, t, 0.055, vol);
      tone(659.25, t + 0.055, 0.08, vol * 0.85);
    } else if (kind === "back") {
      tone(196, t, 0.06, vol);
      tone(130.81, t + 0.05, 0.08, vol * 0.75);
    } else if (kind === "start") {
      tone(392, t, 0.06, vol);
      tone(523.25, t + 0.07, 0.06, vol);
      tone(659.25, t + 0.14, 0.11, vol);
    } else if (kind === "boot") {
      // Three-voice PSG fanfare + noise, not a licensed BIOS jingle.
      tone(196, t, 0.18, vol);
      tone(247, t, 0.18, vol * 0.7);
      tone(294, t, 0.18, vol * 0.55);
      tone(392, t + 0.18, 0.22, vol);
      tone(494, t + 0.18, 0.22, vol * 0.7);
      tone(587, t + 0.4, 0.32, vol * 1.1);
      tone(784, t + 0.4, 0.32, vol * 0.6);
      noise(t + 0.38, 0.12, vol * 0.35);
    } else if (kind === "konami") {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.09, vol));
    }
  }

  // ---------- OQ! (dictionary) ----------
  function renderOqRows(rows) {
    visibleRows = rows;
    oqResults.textContent = "";
    if (rows.length === 0) {
      return;
    }
    if (selectedIndex >= rows.length) selectedIndex = 0;
    rows.forEach((entry, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "oq-row" + (i === selectedIndex ? " is-selected" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
      // Two lines, same as nes/ and dos/'s lexeme/translation columns.
      const lexeme = document.createElement("span");
      lexeme.className = "oq-lexeme";
      lexeme.textContent = syllabify(entry.lexeme);
      const gloss = document.createElement("span");
      gloss.className = "oq-gloss-line";
      gloss.textContent = entry.gloss_en || "";
      btn.append(lexeme, gloss);
      btn.addEventListener("click", () => {
        selectedIndex = i;
        highlightOqRow();
        sfx("move");
      });
      oqResults.appendChild(btn);
    });
    highlightOqRow();
  }

  function highlightOqRow() {
    const nodes = oqResults.querySelectorAll(".oq-row");
    nodes.forEach((node, i) => {
      const on = i === selectedIndex;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
      if (on) node.scrollIntoView({ block: "nearest" });
    });
  }

  function renderOqResults() {
    if (dictEntries === null) return;
    const query = oqFilter.value.trim();
    if (query === "") {
      selectedIndex = 0;
      renderOqRows(dictEntries.slice(0, DEFAULT_ROWS));
      oqStatus.textContent = `${dictEntries.length.toLocaleString()} WORDS -- FIRST ${DEFAULT_ROWS}.`;
      return;
    }
    const matches = filterDictEntries(dictEntries, query);
    selectedIndex = 0;
    renderOqRows(matches.slice(0, MAX_FILTERED_ROWS));
    oqStatus.textContent =
      matches.length === 0
        ? "NO MATCHES."
        : matches.length > MAX_FILTERED_ROWS
          ? `FIRST ${MAX_FILTERED_ROWS} OF ${matches.length.toLocaleString()}.`
          : `${matches.length.toLocaleString()} MATCH${matches.length === 1 ? "" : "ES"}.`;
  }

  async function launchOq(initialFilter = "") {
    showScreen("oq");
    oqFilter.value = initialFilter;
    oqResults.textContent = "";
    if (dictEntries === null) {
      oqStatus.textContent = "LOADING...";
      try {
        dictEntries = await loadDictEntries();
      } catch (err) {
        oqStatus.textContent = `LOAD ERROR (${err.message}).`;
        oqFilter.focus();
        return;
      }
    }
    renderOqResults();
    oqFilter.focus();
  }

  // ---------- DECON ----------
  {
    const initialOrder = window.OqRouter.getParams().get("order");
    deconRootFirst.checked = initialOrder ? initialOrder !== "final" : getStoredRootFirst();
  }

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
        tag.textContent = band ? `[${band.toUpperCase()}]` : "[TOKEN]";
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
          for (const { marker, text, changedRanges, gloss, leftPad, rightPad } of rows) {
            const row = document.createElement("div");
            row.appendChild(document.createTextNode(`${".".repeat(leftPad || 0)}${marker}`));
            let cursor = 0;
            for (const { start, end } of (changedRanges || [])) {
              if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
              const changed = document.createElement("span");
              changed.className = "decon-truncated";
              changed.textContent = text.slice(start, end);
              row.appendChild(changed);
              cursor = end;
            }
            if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
            row.appendChild(document.createTextNode(`${".".repeat(rightPad || 0)} - ${gloss}`));
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
      tag.textContent = match.approximate ? "[~ APPROX]" : "[EXACT]";
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
      for (const { marker, text, changedRanges, gloss, leftPad, rightPad } of rows) {
        const row = document.createElement("div");
        row.appendChild(document.createTextNode(`${".".repeat(leftPad)}${marker}`));
        let cursor = 0;
        for (const { start, end } of changedRanges) {
          if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
          const changed = document.createElement("span");
          changed.className = "decon-truncated";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(`${".".repeat(rightPad)} - ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);
      deconResults.appendChild(card);
    }

    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `IN DICT: ${dictMatch.expected} -- ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

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

  async function launchDecon(initialWord = "") {
    deconController.reset();
    showScreen("decon");
    deconWord.value = initialWord;
    deconStatus.textContent = "TYPE A WORD, PRESS 2.";
    deconWord.focus();
    if (initialWord.trim()) await deconController.search(initialWord);
  }

  function exitDecon() {
    deconController.abort();
  }

  // window.OqRouter owns "which screen is open", same reasoning as
  // dos/app.js -- every user-facing trigger (D-pad, A/B, click, the
  // on-screen pad) goes through navigate() instead of calling
  // showScreen()/launchOq() directly.
  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = 0;
    }
    showScreen("title");
  }

  function startBoot() {
    if (bootDone) {
      showScreen("title");
      return;
    }
    if (currentScreen === "boot" && bootTimer) return;
    showScreen("boot");
    if (BOOT_MS === 0) {
      finishBoot();
      return;
    }
    bootTimer = setTimeout(finishBoot, BOOT_MS);
  }

  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (!screen && !bootDone) {
      startBoot();
      return;
    }
    const dest = screen || "title";
    if (dest === "oq") {
      if (currentScreen !== "oq" || SCREENS.oq.hidden) {
        launchOq(params.get("filter") || "");
      } else if (oqFilter.value !== (params.get("filter") || "")) {
        oqFilter.value = params.get("filter") || "";
        renderOqResults();
      }
    } else if (dest === "decon") {
      const orderParam = params.get("order");
      const rootFirst = orderParam ? orderParam !== "final" : getStoredRootFirst();
      if (deconRootFirst.checked !== rootFirst) {
        deconRootFirst.checked = rootFirst;
        deconController.reRenderLast();
      }
      if (currentScreen !== "decon" || SCREENS.decon.hidden) {
        launchDecon(params.get("word") || "");
      } else if (deconWord.value !== (params.get("word") || "")) {
        deconWord.value = params.get("word") || "";
        deconController.search(deconWord.value);
      }
    } else if (dest === "menu" || dest === "about" || dest === "gameover" || dest === "title") {
      if (currentScreen === "decon") exitDecon();
      bootDone = true;
      showScreen(dest);
    } else {
      if (currentScreen === "decon") exitDecon();
      showScreen("title");
    }
  });

  oqFilter.addEventListener("input", () => {
    renderOqResults();
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });
  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sfx("ok");
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  menuButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      setMenuIndex(i);
      sfx("ok");
      chooseMenuItem(MENU_ORDER[i]);
    });
  });
  continueYes.addEventListener("click", () => { sfx("ok"); goMenu(); });
  continueNo.addEventListener("click", () => { sfx("back"); goTitle(); });
  // One listener on the whole title screen -- PRESS START is inside it, so
  // a second listener on #press-start would fire navigate() twice.
  SCREENS.title.addEventListener("click", () => { sfx("start"); goMenu(); });
  SCREENS.boot.addEventListener("click", () => {
    unlockAudio();
    sfx("boot");
    finishBoot();
  });

  function moveOqSelection(delta) {
    if (visibleRows.length === 0) return;
    selectedIndex = (selectedIndex + delta + visibleRows.length) % visibleRows.length;
    highlightOqRow();
  }


  // In-LCD attract -- plasma / palette-cycle on the 160×144 VDP, not a
  // fullscreen overlay. The landscape slab stays in view; the washed teal
  // LCD filter is chrome sitting on top of this canvas, not the plasma.
  // Silent. No SEGA mark. Idle 45s; any handleInput (keyboard or pad)
  // dismisses without also performing that press. Pauses while hidden.
  // prefers-reduced-motion freezes the plasma (still shows).
  const attractLcd = document.getElementById("gg-lcd");
  const attractCanvas = attractLcd
    ? attractLcd.querySelector("#gg-attract")
    : document.getElementById("gg-attract");
  const ATTRACT_W = 160;
  const ATTRACT_H = 144;
  const ATTRACT_COLORS = 32;
  const ATTRACT_IDLE_MS = 45000;
  const attractReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const attractCtx = attractCanvas && attractCanvas.getContext("2d");
  const attractFrame = attractCtx ? attractCtx.createImageData(ATTRACT_W, ATTRACT_H) : null;
  const attractPixels = attractFrame ? attractFrame.data : null;
  let attractOn = false;
  let attractRaf = 0;
  let attractIdleTimer = 0;
  let attractT0 = 0;
  let attractFrozen = 0;
  let attractPalette = null;

  function buildAttractPalette() {
    // navy → cyan → magenta → gold, 32 slots, 4-bit VDP quantize (4096).
    const stops = [
      [0, 16, 96],
      [88, 216, 248],
      [248, 48, 120],
      [248, 208, 48],
    ];
    const pal = new Uint8Array(ATTRACT_COLORS * 3);
    const n = stops.length;
    for (let i = 0; i < ATTRACT_COLORS; i++) {
      const t = (i / ATTRACT_COLORS) * n;
      const a = Math.floor(t) % n;
      const b = (a + 1) % n;
      const f = t - Math.floor(t);
      pal[i * 3] = (stops[a][0] + (stops[b][0] - stops[a][0]) * f) & 0xf0;
      pal[i * 3 + 1] = (stops[a][1] + (stops[b][1] - stops[a][1]) * f) & 0xf0;
      pal[i * 3 + 2] = (stops[a][2] + (stops[b][2] - stops[a][2]) * f) & 0xf0;
    }
    return pal;
  }

  function attractTime() {
    if (attractReduce.matches) return 0;
    return (performance.now() - attractT0) / 1000;
  }

  function drawAttract(t) {
    if (!attractPixels || !attractPalette) return;
    const cycle = (t * 14) | 0;
    const px = attractPixels;
    const pal = attractPalette;
    for (let y = 0; y < ATTRACT_H; y++) {
      for (let x = 0; x < ATTRACT_W; x++) {
        const v =
          Math.sin(x * 0.11 + t) +
          Math.sin(y * 0.13 + t * 1.25) +
          Math.sin((x + y) * 0.08 + t * 0.7) +
          Math.sin(Math.hypot(x - 80, y - 72) * 0.1 - t * 1.05);
        const idx = (((v + 4) * 4 + cycle) & 31);
        const o = (y * ATTRACT_W + x) * 4;
        const p = idx * 3;
        px[o] = pal[p];
        px[o + 1] = pal[p + 1];
        px[o + 2] = pal[p + 2];
        px[o + 3] = 255;
      }
    }
    attractCtx.putImageData(attractFrame, 0, 0);
  }

  function attractLoop() {
    attractRaf = 0;
    if (!attractOn || document.hidden || attractReduce.matches) return;
    drawAttract(attractTime());
    attractRaf = requestAnimationFrame(attractLoop);
  }

  function stopAttractLoop() {
    if (attractRaf) {
      cancelAnimationFrame(attractRaf);
      attractRaf = 0;
    }
  }

  function startAttract() {
    if (attractOn || !attractCanvas || !attractCtx) return;
    if (document.hidden) return;
    attractOn = true;
    clearTimeout(attractIdleTimer);
    attractIdleTimer = 0;
    if (!attractPalette) attractPalette = buildAttractPalette();
    attractCanvas.hidden = false;
    attractCtx.imageSmoothingEnabled = false;
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    if (attractReduce.matches) {
      attractT0 = performance.now();
      drawAttract(0);
      return;
    }
    attractT0 = performance.now() - attractFrozen * 1000;
    attractLoop();
  }

  function stopAttract() {
    if (!attractOn) {
      pingAttract();
      return;
    }
    attractOn = false;
    attractFrozen = 0;
    stopAttractLoop();
    if (attractCanvas) attractCanvas.hidden = true;
    pingAttract();
  }

  function dismissAttract() {
    if (!attractOn) return false;
    stopAttract();
    return true;
  }

  function pingAttract() {
    if (attractOn) return;
    clearTimeout(attractIdleTimer);
    attractIdleTimer = 0;
    if (document.hidden) return;
    attractIdleTimer = window.setTimeout(startAttract, ATTRACT_IDLE_MS);
  }

  function pauseAttractForHidden() {
    if (document.hidden) {
      clearTimeout(attractIdleTimer);
      attractIdleTimer = 0;
      if (attractOn && !attractReduce.matches) {
        attractFrozen = attractTime();
        stopAttractLoop();
      }
      return;
    }
    if (attractOn && !attractReduce.matches) {
      attractT0 = performance.now() - attractFrozen * 1000;
      if (!attractRaf) attractLoop();
    } else {
      pingAttract();
    }
  }

  if (attractCanvas) {
    attractCanvas.addEventListener("pointerdown", (event) => {
      if (!attractOn) return;
      event.preventDefault();
      event.stopPropagation();
      stopAttract();
    });
  }
  document.addEventListener("visibilitychange", pauseAttractForHidden);
  attractReduce.addEventListener("change", () => {
    if (!attractOn) return;
    stopAttractLoop();
    if (attractReduce.matches) {
      drawAttract(0);
    } else if (!document.hidden) {
      attractT0 = performance.now();
      attractFrozen = 0;
      attractLoop();
    }
  });
  document.addEventListener("input", () => { if (!attractOn) pingAttract(); });
  document.addEventListener("pointerdown", () => { if (!attractOn) pingAttract(); }, true);
  pingAttract();

  function handleInput(action) {
    if (dismissAttract()) return;
    pingAttract();
    unlockAudio();
    if (currentScreen === "boot") {
      sfx("boot");
      finishBoot();
      return;
    }
    if (currentScreen === "title") {
      if (action === "up" || action === "down" || action === "left" || action === "right" || action === "b" || action === "a") {
        if (KONAMI[konamiProgress] === action) {
          konamiProgress += 1;
          if (konamiProgress === KONAMI.length) {
            konamiProgress = 0;
            sfx("konami");
            window.OqRouter.navigate({ screen: "gameover" });
            return;
          }
          sfx("move");
        } else {
          konamiProgress = KONAMI[0] === action ? 1 : 0;
        }
      }
      if (action === "start") {
        konamiProgress = 0;
        sfx("start");
        goMenu();
        return;
      }
      // Tab is select. There is no Select button; Tab cycles the menu
      // once you are in it, and must not start the game from the title.
      if (action === "select") return;
      if (action === "a" && konamiProgress === 0) {
        sfx("start");
        goMenu();
      }
      return;
    }

    if (currentScreen === "menu") {
      if (action === "up") { sfx("move"); setMenuIndex(menuIndex - 1); }
      else if (action === "down" || action === "select") { sfx("move"); setMenuIndex(menuIndex + 1); }
      else if (action === "a" || action === "start") { sfx("ok"); chooseMenuItem(MENU_ORDER[menuIndex]); }
      else if (action === "b") { sfx("back"); goTitle(); }
      return;
    }

    if (currentScreen === "gameover") {
      if (action === "up" || action === "down" || action === "select") {
        sfx("move");
        setContinueIndex(continueIndex + (action === "up" ? -1 : 1));
      } else if (action === "a" || action === "start") {
        sfx("ok");
        if (continueIndex === 0) goMenu();
        else goTitle();
      } else if (action === "b") { sfx("back"); goTitle(); }
      return;
    }

    if (currentScreen === "about") {
      if (action === "b" || action === "start" || action === "a") { sfx("back"); goMenu(); }
      return;
    }

    if (currentScreen === "oq") {
      if (action === "b") {
        sfx("back");
        goMenu();
        return;
      }
      if (action === "up" || action === "down") {
        if (inputFocused() && action === "down") {
          oqFilter.blur();
          moveOqSelection(0);
          sfx("move");
          return;
        }
        if (!inputFocused()) {
          sfx("move");
          moveOqSelection(action === "down" ? 1 : -1);
        }
      }
      return;
    }

    if (currentScreen === "decon") {
      if (action === "b") {
        sfx("back");
        goMenu();
        return;
      }
      if (action === "a" && !inputFocused()) {
        sfx("ok");
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        deconController.search(deconWord.value);
      }
    }
  }

  document.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Escape: "b",
      Enter: "a",
      " ": "start",
      Tab: "select",
    };
    // Physical A/B only when not typing -- otherwise the letter "a" in
    // SEARCH would confirm the menu. Emulator convention (Z=B, X=A) is
    // the other path, also gated on !inputFocused.
    if (!inputFocused()) {
      if (event.key === "z" || event.key === "Z") keyMap[event.key] = "b";
      if (event.key === "x" || event.key === "X") keyMap[event.key] = "a";
      if (event.key === "a" || event.key === "A") keyMap[event.key] = "a";
      if (event.key === "b" || event.key === "B") keyMap[event.key] = "b";
    }
    const action = keyMap[event.key];
    if (!action) return;
    if (inputFocused() && action === "select") return;
    if (inputFocused() && (action === "up" || action === "down" || action === "left" || action === "right" || action === "a" || action === "start")) {
      // Let the caret move / Enter submit DECON. Down from OQ's filter
      // still hops to the list.
      if (currentScreen === "oq" && action === "down") {
        event.preventDefault();
        handleInput("down");
        return;
      }
      if (currentScreen === "decon" && action === "a") return;
      if (currentScreen === "oq") return;
      if (currentScreen === "decon") return;
    }
    if (!inputFocused()) event.preventDefault();
    handleInput(action);
  });

  document.querySelector(".gg-body").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    handleInput(btn.dataset.input);
  });

  // Same visualViewport tracking as nes/app.js / dos/app.js -- a mobile
  // keyboard shrinks the visual viewport without shrinking position:fixed
  // elements, so the onboard pad would sit under the keyboard without this.
  function syncAppHeight() {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
    document.documentElement.style.setProperty("--app-top", `${vv.offsetTop}px`);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppHeight);
    window.visualViewport.addEventListener("scroll", syncAppHeight);
  }
  window.addEventListener("orientationchange", syncAppHeight);
  window.addEventListener("pageshow", syncAppHeight);
  syncAppHeight();

  // Hide the onboard pad while SEARCH/WORD is focused -- same iOS
  // lesson as nes/ and gb/. 16px input floor in style.css stops the zoom.
  function syncKeyboardChrome() {
    const on = inputFocused();
    document.documentElement.classList.toggle("is-keyboard", on);
    if (!on) return;
    const el = document.activeElement;
    requestAnimationFrame(() => {
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  document.addEventListener("focusin", syncKeyboardChrome);
  document.addEventListener("focusout", () => {
    setTimeout(syncKeyboardChrome, 0);
  });
  // launchOq/launchDecon focus the field during router onChange, which
  // ran before these listeners existed -- catch that initial focus so a
  // deep link into OQ! doesn't leave the pad up under the keyboard.
  syncKeyboardChrome();
})();
