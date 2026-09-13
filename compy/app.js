(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as gg/app.js -- see CLAUDE.md. The chrome is a beige VGA CRT
  // (no vendored kit); this file is the "game" the same way snes/app.js is:
  // which screen is up, keyboard focus, OQ!/DECON. Not dos/'s COMMAND.COM:
  // one handleInput(), screens swap via hidden, DIR listing is SELECT.
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
  const CONTRAST_MAX = 17;

  let currentScreen = "boot";
  let menuIndex = 0;
  let bootDone = false;
  let bootTimer = 0;
  const BOOT_MS = (navigator.webdriver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 2000;
  let continueIndex = 0;
  let dictEntries = null;
  let visibleRows = [];
  let selectedIndex = 0;
  let contrast = 8;
  // Konami tracker -- title screen only. Contra's 30 lives, not a real
  // unlock: CONTINUE on the game-over screen just goes to the file-select
  // menu. Not listed on the title, same idea as dos/'s undocumented DOOM
  // command and win98/'s Hot Dog Stand scheme.
  const KONAMI = [
    "up", "up", "down", "down", "left", "right", "left", "right", "b", "a",
  ];
  let konamiProgress = 0;

  function applyContrast() {
    const t = contrast / CONTRAST_MAX;
    document.documentElement.style.setProperty("--compy-tube-brightness", String(0.4 + t * 0.7));
    // 18-step black → blue → black wash, the cartoon wheels' whole joke.
    document.documentElement.style.setProperty("--compy-blue-wash", `${Math.round(Math.sin(t * Math.PI) * 45)}%`);
  }
  applyContrast();

  const CHASSIS_ORDER = ["386", "400", "486"];
  const CHASSIS_KEY = "compy-chassis";
  const CHASSIS_META = {
    "386": { brand: "BEIGE 386", boot: "BEIGE 386 BIOS 3.86", tag: "A SPECTACLE OF GRAPHICS AND SOUND", vol: "Volume in drive C is BEIGE386" },
    "400": { brand: "400", boot: "400 BIOS", tag: "GREEN PHOSPHOR", vol: "Volume in drive C is 400" },
    "486": { brand: "486", boot: "486 BIOS", tag: "SEVERAL COLORS", vol: "Volume in drive C is 486" },
  };
  const brandEl = document.getElementById("compy-brand");
  const bootKicker = document.querySelector(".boot-kicker");
  const bootTag = document.querySelector(".boot-tag");
  const volEl = document.querySelector(".vol");

  function readChassis() {
    try {
      const v = localStorage.getItem(CHASSIS_KEY);
      return CHASSIS_ORDER.includes(v) ? v : "386";
    } catch {
      return "386";
    }
  }

  function applyChassis(id) {
    if (!CHASSIS_ORDER.includes(id)) id = "386";
    document.documentElement.classList.toggle("is-tandy", id === "400");
    document.documentElement.classList.toggle("is-lappy", id === "486");
    const meta = CHASSIS_META[id];
    if (brandEl) brandEl.textContent = meta.brand;
    if (bootKicker) bootKicker.textContent = meta.boot;
    if (bootTag) bootTag.textContent = meta.tag;
    if (volEl) volEl.textContent = meta.vol;
    try {
      localStorage.setItem(CHASSIS_KEY, id);
    } catch {
      /* sandboxed iframe -- scheme still applies for this visit */
    }
  }

  function cycleChassis() {
    const cur = document.documentElement.classList.contains("is-tandy")
      ? "400"
      : document.documentElement.classList.contains("is-lappy")
        ? "486"
        : "386";
    const next = CHASSIS_ORDER[(CHASSIS_ORDER.indexOf(cur) + 1) % CHASSIS_ORDER.length];
    applyChassis(next);
  }

  applyChassis(readChassis());

  function nudgeContrast(delta) {
    contrast = Math.max(0, Math.min(CONTRAST_MAX, contrast + delta));
    applyContrast();
  }

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

  // PC speaker squares. Not NES pulse, not SNES samples. Silent until the
  // first pad/key gesture; typing in SEARCH/WORD is silent.
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
  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const vol = 0.05;
    if (kind === "move") {
      tone(196, t, 0.03, vol);
    } else if (kind === "ok") {
      tone(523.25, t, 0.05, vol);
      tone(659.25, t + 0.05, 0.07, vol * 0.85);
    } else if (kind === "back") {
      tone(196, t, 0.05, vol);
      tone(130.81, t + 0.05, 0.07, vol * 0.75);
    } else if (kind === "start") {
      tone(392, t, 0.05, vol);
      tone(523.25, t + 0.06, 0.05, vol);
      tone(659.25, t + 0.12, 0.1, vol);
    } else if (kind === "boot") {
      // POST beep, not a licensed BIOS sting.
      tone(990, t, 0.12, vol);
      tone(784, t + 0.16, 0.18, vol * 0.9);
    } else if (kind === "konami") {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.09, vol));
    } else if (kind === "contrast") {
      tone(440, t, 0.025, vol * 0.7);
    }
  }

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

  {
    const initialOrder = window.OqRouter.getParams().get("order");
    deconRootFirst.checked = initialOrder ? initialOrder !== "final" : getStoredRootFirst();
  }

  function renderDeconResults({ matches, dictMatch }) {
    deconResults.textContent = "";
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
    deconStatus.textContent = "TYPE A WORD, PRESS ENTER.";
    deconWord.focus();
    if (initialWord.trim()) await deconController.search(initialWord);
  }

  function exitDecon() {
    deconController.abort();
  }

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
  SCREENS.title.addEventListener("click", () => { sfx("start"); goMenu(); });
  SCREENS.boot.addEventListener("click", () => {
    unlockAudio();
    sfx("boot");
    finishBoot();
  });
  if (brandEl) {
    brandEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      unlockAudio();
      sfx("konami");
      cycleChassis();
    });
  }

  function moveOqSelection(delta) {
    if (visibleRows.length === 0) return;
    selectedIndex = (selectedIndex + delta + visibleRows.length) % visibleRows.length;
    highlightOqRow();
  }

  // In-CRT attract -- CGA starfield on the tube, not a fullscreen overlay.
  // The beige keyboard stays. Silent. Idle 45s; any handleInput dismisses
  // without also performing that press. Pauses while hidden.
  // prefers-reduced-motion freezes the stars (still shows).
  const attractScreen = document.getElementById("attract-screen");
  const attractCanvas = document.getElementById("attract-canvas");
  const ATTRACT_W = 320;
  const ATTRACT_H = 200;
  const ATTRACT_IDLE_MS = 45000;
  const attractReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const attractCtx = attractCanvas && attractCanvas.getContext("2d");
  const STARS = Array.from({ length: 48 }, () => ({
    x: Math.random() * ATTRACT_W,
    y: Math.random() * ATTRACT_H,
    z: 0.4 + Math.random() * 1.6,
    amber: Math.random() < 0.18,
  }));
  let attractOn = false;
  let attractRaf = 0;
  let attractIdleTimer = 0;
  let attractT0 = 0;
  let attractFrozen = 0;

  function cssRgb(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const hex = raw.replace("#", "");
    if (hex.length !== 6) return fallback;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  function attractTime() {
    if (attractReduce.matches) return 0;
    return (performance.now() - attractT0) / 1000;
  }

  function drawAttract(t) {
    if (!attractCtx) return;
    const bg = cssRgb("--compy-black", [5, 8, 10]);
    const cyan = cssRgb("--compy-cyan", [90, 212, 232]);
    const amber = cssRgb("--compy-amber", [232, 192, 64]);
    attractCtx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    attractCtx.fillRect(0, 0, ATTRACT_W, ATTRACT_H);
    for (const star of STARS) {
      const y = (star.y + t * 18 * star.z) % ATTRACT_H;
      const c = star.amber ? amber : cyan;
      const a = 0.35 + star.z * 0.4;
      attractCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      const s = star.z < 1 ? 1 : 2;
      attractCtx.fillRect(star.x | 0, y | 0, s, s);
    }
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
    if (attractOn || !attractCanvas || !attractCtx || !attractScreen) return;
    if (document.hidden) return;
    attractOn = true;
    clearTimeout(attractIdleTimer);
    attractIdleTimer = 0;
    attractScreen.hidden = false;
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
    if (attractScreen) attractScreen.hidden = true;
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
    if (action === "contrast-up" || action === "contrast-down") {
      pingAttract();
      unlockAudio();
      sfx("contrast");
      nudgeContrast(action === "contrast-up" ? 1 : -1);
      return;
    }
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
      if (action === "start" || action === "select") {
        konamiProgress = 0;
        sfx("start");
        goMenu();
        return;
      }
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
    if (!inputFocused() && event.key === "[") {
      event.preventDefault();
      handleInput("contrast-down");
      return;
    }
    if (!inputFocused() && event.key === "]") {
      event.preventDefault();
      handleInput("contrast-up");
      return;
    }
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

  document.getElementById("compy-shell").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    handleInput(btn.dataset.input);
  });

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
  syncKeyboardChrome();
})();
