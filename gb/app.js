(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as nes/app.js -- see CLAUDE.md. The chrome is hand-drawn
  // DMG plastic (no vendored kit); this file is the "game" the same way
  // nes/app.js is: which screen is up, D-pad focus, OQ!/DECON.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  const SCREENS = {
    boot: document.getElementById("boot-screen"),
    title: document.getElementById("title-screen"),
    menu: document.getElementById("menu-screen"),
    oq: document.getElementById("oq-screen"),
    decon: document.getElementById("decon-screen"),
    morph: document.getElementById("morph-screen"),
    about: document.getElementById("about-screen"),
    gameover: document.getElementById("gameover-screen"),
  };

  const MENU_ORDER = ["oq", "decon", "morph", "about", "quit"];
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
    if (id === "morph") {
      window.OqRouter.navigate({ screen: "morph", filter: null, word: null });
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

  // Square-wave bloops. The DMG APU was also pulse channels -- same
  // trick as nes/, no sample pack. Silent until the first pad/key
  // gesture; typing in SEARCH/WORD is silent on purpose.
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
      // Rising fourths, not the Nintendo logo jingle.
      tone(220, t, 0.12, vol);
      tone(277, t + 0.13, 0.12, vol);
      tone(330, t + 0.26, 0.12, vol);
      tone(440, t + 0.4, 0.3, vol * 1.15);
    } else if (kind === "konami") {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.09, vol));
    } else if (kind === "shock") {
      // A harsh detuned buzz for the wrong-morpheme jolt -- distinct from
      // "back" (which is a calm two-note descend), this one clashes.
      tone(110, t, 0.09, vol * 1.3);
      tone(98, t + 0.02, 0.11, vol * 1.1);
    } else if (kind === "roundwin") {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.06, 0.1, vol));
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
    deconStatus.textContent = "TYPE A WORD, PRESS A.";
    deconWord.focus();
    if (initialWord.trim()) await deconController.search(initialWord);
  }

  function exitDecon() {
    deconController.abort();
  }

  // ---------- MORPH! (WarioWare-style morpheme minigame) ----------
  // The state machine (puzzle sequencing, lives/score, which option is
  // correct) lives in shared/morph-game.js; this is just the GB-specific
  // rendering, sprite, sfx, and timing wrapped around it -- same split as
  // deconController above.
  const morphLives = document.getElementById("morph-lives");
  const morphScoreEl = document.getElementById("morph-score");
  const morphSprite = document.getElementById("morph-sprite");
  const morphImg = document.getElementById("morph-sprite-img");
  const morphFx = document.getElementById("morph-fx");
  const morphMouth = document.getElementById("morph-mouth");
  const morphPupils = document.querySelectorAll(".morph-pupil");
  const morphWordEl = document.getElementById("morph-word");
  const morphStatusEl = document.getElementById("morph-status");
  const morphOptionsEl = document.getElementById("morph-options");
  const morphTimerFill = document.getElementById("morph-timer-fill");
  const morphCard = document.getElementById("morph-card");
  const morphCardWord = document.getElementById("morph-card-word");
  const morphCardMeaning = document.getElementById("morph-card-meaning");
  const morphPauseCard = document.getElementById("morph-pause-card");

  const MORPH_START_LIVES = 3;
  // Hectic-but-fair: long enough to read a Kalaallisut morpheme and its
  // gloss once, short enough that the round still feels like a WarioWare
  // beat rather than an untimed quiz. Bumped from 6000 -- players reported
  // 6s too tight to read a fresh word and its options both.
  const MORPH_STEP_MS = 8000;
  const MORPH_POSES = {
    idle: "sprites/fox-idle.png?v=8",
    breathe: "sprites/fox-breathe.png?v=8",
    happy: "sprites/fox-happy.png?v=8",
    shocked: "sprites/fox-shocked.png?v=8",
    win: "sprites/fox-winsquint.png?v=8",
  };
  const morphReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || Boolean(navigator.webdriver);
  const morphGame = window.OqMorphGame.createGame({
    puzzles: window.OqMorphPuzzles.puzzles,
    startLives: MORPH_START_LIVES,
    // Same navigator.webdriver signal morphReduceMotion above already
    // relies on: under real automated testing (Playwright et al.), give
    // tests a repeatable puzzle order instead of a real shuffle, so a test
    // that needs a specific puzzle (e.g. the one with 3 options, for a
    // layout worst-case check) doesn't have to reload-and-hope.
    deterministicOrder: Boolean(navigator.webdriver),
  });
  let morphSelected = 0;
  let morphOptionCount = 0;
  let morphBusy = false; // true during the brief shock/win pause -- input ignored
  let morphCardWaiting = false; // true once the win card is up, waiting on an A press
  let morphPaused = false;
  let morphPauseRemaining = 0; // ms left on the step timer when Start paused it
  let morphTimerRaf = 0;
  let morphTimerDeadline = 0;
  let morphIdleTimer = 0;
  let morphIdleFrame = 0;
  let morphFxTimer = 0;

  function setMorphPose(pose) {
    morphImg.src = MORPH_POSES[pose];
    const gazing = pose === "idle" || pose === "breathe" || pose === "happy" || pose === "shocked";
    morphSprite.classList.toggle("is-gazing", gazing);
  }

  function stopMorphIdle() {
    if (morphIdleTimer) clearInterval(morphIdleTimer);
    morphIdleTimer = 0;
  }

  function startMorphIdle() {
    stopMorphIdle();
    morphIdleFrame = 0;
    setMorphPose("idle");
    if (morphReduceMotion) return;
    morphIdleTimer = setInterval(() => {
      if (morphSprite.classList.contains("is-happy") || morphSprite.classList.contains("is-shocked")) return;
      morphIdleFrame ^= 1;
      setMorphPose(morphIdleFrame ? "breathe" : "idle");
    }, 380);
  }

  function stopMorphFx() {
    if (morphFxTimer) clearInterval(morphFxTimer);
    morphFxTimer = 0;
    morphFx.hidden = true;
  }

  function startMorphFx() {
    stopMorphFx();
    if (morphReduceMotion) return;
    let i = 1;
    morphFx.hidden = false;
    morphFx.src = `sprites/fx-${i}.png?v=8`;
    morphFxTimer = setInterval(() => {
      i = (i % 4) + 1;
      morphFx.src = `sprites/fx-${i}.png?v=8`;
    }, 90);
  }

  function stopMorphAnim() {
    stopMorphIdle();
    stopMorphFx();
    stopMorphTimer();
  }

  function renderMorphHud() {
    const { lives, score } = morphGame.getState();
    morphLives.replaceChildren();
    for (let i = 0; i < MORPH_START_LIVES; i++) {
      const img = document.createElement("img");
      img.className = "morph-heart";
      img.src = i < lives ? "sprites/heart-full.png?v=8" : "sprites/heart-empty.png?v=8";
      img.width = 8;
      img.height = 8;
      img.alt = "";
      morphLives.appendChild(img);
    }
    morphScoreEl.textContent = `SCORE ${score}`;
  }

  // The sprite's eyes track toward the currently-selected option's row --
  // "his attention on currently selected option" -- by shifting the pupils
  // down proportionally to how far down the (vertically stacked) option
  // list the selection is, 0 at the top option to 1 at the bottom one.
  function updateMorphGaze() {
    const t = morphOptionCount > 1 ? morphSelected / (morphOptionCount - 1) : 0;
    morphPupils.forEach((p) => { p.style.setProperty("--look-y", t.toFixed(3)); });
  }

  function highlightMorphOptions() {
    const nodes = morphOptionsEl.querySelectorAll(".morph-option");
    nodes.forEach((node, i) => {
      const on = i === morphSelected;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateMorphGaze();
  }

  function stopMorphTimer() {
    if (morphTimerRaf) cancelAnimationFrame(morphTimerRaf);
    morphTimerRaf = 0;
  }

  // Start, mid-round, now pauses instead of confirming -- freezes the step
  // timer where it stood (not just visually: the remaining ms is what
  // startMorphTimer() gets handed back on resume) and puts up a blocking
  // Zzz card. Only valid on an active step, not while the shock/win pause
  // or the win card already owns the screen.
  function pauseMorph() {
    if (morphPaused || morphBusy) return;
    morphPaused = true;
    morphPauseRemaining = Math.max(0, morphTimerDeadline - performance.now());
    stopMorphTimer();
    stopMorphIdle();
    stopMorphFx();
    sfx("start");
    morphPauseCard.hidden = false;
  }

  function resumeMorph() {
    if (!morphPaused) return;
    morphPaused = false;
    morphPauseCard.hidden = true;
    sfx("start");
    startMorphIdle();
    startMorphTimer(morphPauseRemaining);
  }

  function startMorphTimer(ms = MORPH_STEP_MS) {
    stopMorphTimer();
    morphTimerDeadline = performance.now() + ms;
    const tick = (now) => {
      const remaining = Math.max(0, morphTimerDeadline - now);
      morphTimerFill.style.width = `${(remaining / MORPH_STEP_MS) * 100}%`;
      if (remaining <= 0) {
        morphTimerRaf = 0;
        handleMorphTimeout();
        return;
      }
      morphTimerRaf = requestAnimationFrame(tick);
    };
    morphTimerRaf = requestAnimationFrame(tick);
  }

  // Renders a step handed back by the engine's start()/advanceStep()/
  // advancePuzzle()/retryStep() -- they all return the same { word,
  // stepType, options } shape.
  function renderMorphStep(step) {
    morphOptionCount = step.options.length;
    morphSelected = 0;
    morphSprite.classList.remove("is-shocked", "is-happy");
    morphMouth.className = "morph-mouth";
    startMorphIdle();
    stopMorphFx();
    morphWordEl.textContent = syllabify(step.word) + "-";
    morphStatusEl.textContent = step.stepType === "suffix" ? "PICK THE ENDING." : "PICK THE NEXT AFFIX.";
    morphOptionsEl.textContent = "";
    step.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "morph-option";
      btn.setAttribute("role", "option");
      btn.textContent = `-${opt.marker}`;
      btn.addEventListener("click", () => {
        morphSelected = i;
        highlightMorphOptions();
        chooseMorphOption();
      });
      morphOptionsEl.appendChild(btn);
    });
    highlightMorphOptions();
    startMorphTimer();
  }

  function launchMorph() {
    showScreen("morph");
    morphBusy = false;
    morphCardWaiting = false;
    morphPaused = false;
    morphCard.hidden = true;
    morphPauseCard.hidden = true;
    renderMorphHud();
    renderMorphStep(morphGame.start());
  }

  function showMorphCard(word, meaning) {
    morphCardWord.textContent = word.toUpperCase();
    morphCardMeaning.textContent = meaning;
    morphCard.hidden = false;
  }

  function settleMorphRound(result) {
    // Every branch below resumes on a setTimeout, after which the player
    // may have already left the MORPH! screen (B to menu mid-pause, say).
    // Without this guard a stray timer -- now including startMorphTimer()'s
    // own rAF loop, which the pre-timer version of this code didn't have
    // to worry about -- would keep running in the background and could
    // yank the player back into gameover-screen from wherever they'd
    // navigated to, seconds later, for no visible reason.
    const resumeIfStillOnMorph = (fn) => {
      morphBusy = false;
      if (currentScreen !== "morph") return;
      fn();
    };
    if (result.outcome === "wrong") {
      sfx("shock");
      renderMorphHud();
      stopMorphIdle();
      stopMorphFx();
      morphSprite.classList.add("is-shocked");
      morphMouth.className = "morph-mouth is-shocked";
      setMorphPose("shocked");
      morphStatusEl.textContent = `NOT THERE -- ${result.gloss}`;
      setTimeout(() => resumeIfStillOnMorph(() => {
        if (result.gameOver) {
          window.OqRouter.navigate({ screen: "gameover" });
          return;
        }
        morphSprite.classList.remove("is-shocked");
        renderMorphStep(morphGame.retryStep());
      }), 900);
      return;
    }
    if (result.outcome === "timeout") {
      sfx("shock");
      renderMorphHud();
      stopMorphIdle();
      stopMorphFx();
      morphSprite.classList.add("is-shocked");
      morphMouth.className = "morph-mouth is-shocked";
      setMorphPose("shocked");
      morphStatusEl.textContent = "TOO SLOW!";
      setTimeout(() => resumeIfStillOnMorph(() => {
        if (result.gameOver) {
          window.OqRouter.navigate({ screen: "gameover" });
          return;
        }
        morphSprite.classList.remove("is-shocked");
        renderMorphStep(morphGame.retryStep());
      }), 900);
      return;
    }
    if (result.outcome === "win") {
      sfx("roundwin");
      stopMorphIdle();
      morphSprite.classList.add("is-happy");
      morphMouth.className = "morph-mouth is-happy";
      setMorphPose("happy");
      startMorphFx();
      renderMorphHud();
      showMorphCard(result.word, result.resultGloss);
      // No auto-advance timer here -- the card's PRESS A cta (below,
      // handleInput's morphCardWaiting branch) is what moves this along
      // now, so morphBusy just stays true until the player acts on it.
      morphCardWaiting = true;
      return;
    }
    // "continue" -- a correct mid-chain affix
    sfx("ok");
    setTimeout(() => resumeIfStillOnMorph(() => {
      renderMorphStep(morphGame.advanceStep());
    }), 350);
  }

  // Advances past the win card on the player's own A press (see the "win"
  // branch of settleMorphRound above) instead of the old fixed timeout.
  function advancePastCard() {
    morphCard.hidden = true;
    morphCardWaiting = false;
    morphBusy = false;
    if (currentScreen !== "morph") return;
    sfx("ok");
    renderMorphStep(morphGame.advancePuzzle());
  }

  function handleMorphTimeout() {
    if (morphBusy) return;
    morphBusy = true;
    settleMorphRound(morphGame.timeout());
  }

  function chooseMorphOption() {
    if (morphBusy || morphOptionCount === 0) return;
    stopMorphTimer();
    morphBusy = true;
    settleMorphRound(morphGame.choose(morphSelected));
  }

  function moveMorphSelection(delta) {
    if (morphOptionCount === 0) return;
    morphSelected = (morphSelected + delta + morphOptionCount) % morphOptionCount;
    highlightMorphOptions();
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
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "morph") stopMorphAnim();
      if (currentScreen !== "oq" || SCREENS.oq.hidden) {
        launchOq(params.get("filter") || "");
      } else if (oqFilter.value !== (params.get("filter") || "")) {
        oqFilter.value = params.get("filter") || "";
        renderOqResults();
      }
    } else if (dest === "decon") {
      if (currentScreen === "morph") stopMorphAnim();
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
    } else if (dest === "morph") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen !== "morph" || SCREENS.morph.hidden) launchMorph();
    } else if (dest === "menu" || dest === "about" || dest === "gameover" || dest === "title") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "morph") stopMorphAnim();
      bootDone = true;
      showScreen(dest);
    } else {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "morph") stopMorphAnim();
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

  // ---------- In-LCD attract (tiny fox screensaver) ----------
  // DVD-logo bounce of the original 16×16 fox inside #gb-lcd only -- never
  // a fullscreen overlay, never over the brick/pad, no Nintendo logo, no
  // audio. 45s idle; any handleInput (keyboard or on-screen pad) dismisses
  // without also performing that press. Pauses when the tab is hidden.
  // prefers-reduced-motion parks the fox in a corner instead of bouncing.
  const ATTRACT_IDLE_MS = 45000;
  const ATTRACT_W = 160;
  const ATTRACT_H = 144;
  const ATTRACT_FOX = 16;
  const ATTRACT_STEP_MS = 50;
  const attractCanvas = document.getElementById("gb-attract");
  const attractCtx = attractCanvas.getContext("2d");
  attractCtx.imageSmoothingEnabled = false;
  attractCtx.webkitImageSmoothingEnabled = false;
  const attractFox = new Image();
  attractFox.src = "sprites/fox-idle.png?v=8";
  const attractReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let attractTimer = 0;
  let attractRaf = 0;
  let attractRunning = false;
  let attractX = 0;
  let attractY = 0;
  let attractVx = 1;
  let attractVy = 1;
  let attractLastTs = 0;

  function lcdGreen(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function drawAttract() {
    attractCtx.imageSmoothingEnabled = false;
    attractCtx.webkitImageSmoothingEnabled = false;
    attractCtx.fillStyle = lcdGreen("--gb-lightest");
    attractCtx.fillRect(0, 0, ATTRACT_W, ATTRACT_H);
    if (attractFox.complete && attractFox.naturalWidth) {
      attractCtx.drawImage(attractFox, attractX | 0, attractY | 0, ATTRACT_FOX, ATTRACT_FOX);
    }
  }

  function parkAttract() {
    attractX = 2;
    attractY = ATTRACT_H - ATTRACT_FOX - 2;
    attractVx = 0;
    attractVy = 0;
  }

  function bounceAttract(steps) {
    attractX += attractVx * steps;
    attractY += attractVy * steps;
    if (attractX <= 0) { attractX = 0; attractVx = 1; }
    else if (attractX >= ATTRACT_W - ATTRACT_FOX) { attractX = ATTRACT_W - ATTRACT_FOX; attractVx = -1; }
    if (attractY <= 0) { attractY = 0; attractVy = 1; }
    else if (attractY >= ATTRACT_H - ATTRACT_FOX) { attractY = ATTRACT_H - ATTRACT_FOX; attractVy = -1; }
  }

  function stopAttractAnim() {
    if (attractRaf) cancelAnimationFrame(attractRaf);
    attractRaf = 0;
    attractLastTs = 0;
  }

  function tickAttract(ts) {
    if (!attractRunning || attractReduceMotion) return;
    if (document.hidden) {
      attractLastTs = 0;
      return;
    }
    if (!attractLastTs) attractLastTs = ts;
    const dt = ts - attractLastTs;
    if (dt >= ATTRACT_STEP_MS) {
      const n = Math.floor(dt / ATTRACT_STEP_MS);
      attractLastTs += n * ATTRACT_STEP_MS;
      bounceAttract(n);
      drawAttract();
    }
    attractRaf = requestAnimationFrame(tickAttract);
  }

  function startAttract() {
    if (attractRunning) return;
    attractRunning = true;
    clearTimeout(attractTimer);
    attractTimer = 0;
    if (attractReduceMotion) {
      parkAttract();
    } else {
      attractX = Math.floor(Math.random() * (ATTRACT_W - ATTRACT_FOX));
      attractY = Math.floor(Math.random() * (ATTRACT_H - ATTRACT_FOX));
      attractVx = Math.random() < 0.5 ? 1 : -1;
      attractVy = Math.random() < 0.5 ? 1 : -1;
    }
    attractCanvas.hidden = false;
    attractCanvas.setAttribute("aria-hidden", "false");
    drawAttract();
    if (!attractReduceMotion) {
      attractLastTs = 0;
      attractRaf = requestAnimationFrame(tickAttract);
    }
  }

  function pingAttract() {
    if (attractRunning) return;
    clearTimeout(attractTimer);
    attractTimer = 0;
    if (document.hidden) return;
    attractTimer = window.setTimeout(startAttract, ATTRACT_IDLE_MS);
  }

  function stopAttract() {
    if (!attractRunning) return;
    attractRunning = false;
    stopAttractAnim();
    attractCanvas.hidden = true;
    attractCanvas.setAttribute("aria-hidden", "true");
    pingAttract();
  }

  attractFox.addEventListener("load", () => { if (attractRunning) drawAttract(); });

  attractCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (attractRunning) stopAttract();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(attractTimer);
      attractTimer = 0;
      stopAttractAnim();
      return;
    }
    if (attractRunning) {
      if (!attractReduceMotion) {
        attractLastTs = 0;
        attractRaf = requestAnimationFrame(tickAttract);
      }
      return;
    }
    pingAttract();
  });

  // Typing in SEARCH/WORD never hits handleInput -- still counts as activity.
  document.addEventListener("input", () => { if (!attractRunning) pingAttract(); });
  document.addEventListener("pointerdown", () => { if (!attractRunning) pingAttract(); }, true);

  pingAttract();

  function handleInput(action) {
    if (attractRunning) {
      stopAttract();
      return;
    }
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
      return;
    }

    if (currentScreen === "morph") {
      if (action === "b") {
        sfx("back");
        goMenu();
        return;
      }
      // Start now pauses/resumes instead of doubling as confirm -- it no
      // longer reaches chooseMorphOption() below.
      if (action === "start") {
        if (morphPaused) resumeMorph();
        else pauseMorph();
        return;
      }
      if (morphPaused) return;
      if (morphBusy) {
        // The win card no longer auto-advances; A is the only way past it.
        if (morphCardWaiting && action === "a") advancePastCard();
        return;
      }
      if (action === "up") { sfx("move"); moveMorphSelection(-1); }
      else if (action === "down") { sfx("move"); moveMorphSelection(1); }
      else if (action === "a") { chooseMorphOption(); }
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

  document.getElementById("gb-controller").addEventListener("pointerdown", (event) => {
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
  // lesson as nes/. 16px input floor in style.css stops the zoom.
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
