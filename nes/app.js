(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as dos/app.js and c64/app.js -- see CLAUDE.md. NES.css is
  // the chrome; this file is the "game": which screen is up, D-pad focus,
  // and the OQ!/DECON programs behind two of the menu items.
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
    klax: document.getElementById("klax-screen"),
  };

  const MENU_ORDER = ["oq", "decon", "about", "klax", "quit"];
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
  const BOOT_MS = (navigator.webdriver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 2200;
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
    syncMusic();
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
      return;
    }
    if (id === "klax") {
      window.OqRouter.navigate({ screen: "klax", filter: null, word: null });
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

  // NES APU, not a sample pack -- two pulse channels (12.5/25/50% duty
  // via PeriodicWave), a triangle, and a 15-bit-ish LFSR noise buffer.
  // Same "no real build step" bar as the rest of this theme; nothing here
  // is a ripped Nintendo track. Silent until the first pad/key gesture
  // (autoplay policy). Typing in SEARCH/WORD stays silent on purpose.
  let audioCtx = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  const pulseWaves = Object.create(null);
  let musicTrack = null;
  let musicGen = 0;
  let musicNext = 0;
  let musicTimer = 0;
  let musicStep = 0;
  const BPM = 112;
  const SIXTEENTH = 60 / BPM / 4;

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        audioCtx = new AC();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.0001;
        musicGain.connect(audioCtx.destination);
        sfxGain = audioCtx.createGain();
        sfxGain.gain.value = 0.45;
        sfxGain.connect(audioCtx.destination);
        noiseBuf = makeNoiseBuffer(audioCtx);
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      // Always (re)attach the bed for the current screen -- an earlier
      // version silenced everything that wasn't the title, which is why
      // bloops/music died the moment PRESS START landed on the menu.
      syncMusic();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function pulseWave(duty) {
    const key = String(duty);
    if (pulseWaves[key]) return pulseWaves[key];
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    }
    pulseWaves[key] = audioCtx.createPeriodicWave(real, imag);
    return pulseWaves[key];
  }

  function makeNoiseBuffer(ctx) {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let reg = 1;
    for (let i = 0; i < len; i++) {
      const bit = (reg ^ (reg >> 1)) & 1;
      reg = (reg >> 1) | (bit << 14);
      data[i] = bit ? 0.55 : -0.55;
    }
    return buf;
  }

  function envGain(dest, when, dur, peak, hold) {
    const g = audioCtx.createGain();
    g.connect(dest);
    const h = hold == null ? 0.012 : hold;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + Math.min(h, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    return g;
  }

  function playPulse(freq, when, dur, peak, duty, dest) {
    if (!freq || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.setPeriodicWave(pulseWave(duty));
    osc.frequency.setValueAtTime(freq, when);
    osc.connect(envGain(dest, when, dur, peak));
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function playTriangle(freq, when, dur, peak, dest) {
    if (!freq || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, when);
    const g = audioCtx.createGain();
    g.connect(dest);
    g.gain.setValueAtTime(peak, when);
    g.gain.setValueAtTime(peak, when + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function playNoise(when, dur, peak, dest, playback) {
    if (!audioCtx || !noiseBuf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.setValueAtTime(playback || 1.4, when);
    src.connect(envGain(dest, when, dur, peak, 0.004));
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx || !sfxGain) return;
    const t = ctx.currentTime + 0.01;
    const dest = sfxGain;
    if (kind === "move") {
      playPulse(392, t, 0.05, 0.7, 0.125, dest);
      playNoise(t, 0.035, 0.28, dest, 3);
    } else if (kind === "ok") {
      playPulse(523.25, t, 0.08, 0.8, 0.25, dest);
      playPulse(783.99, t + 0.06, 0.12, 0.75, 0.25, dest);
      playTriangle(130.81, t, 0.18, 0.55, dest);
    } else if (kind === "back") {
      playPulse(330, t, 0.08, 0.65, 0.5, dest);
      playPulse(196, t + 0.055, 0.11, 0.55, 0.5, dest);
      playTriangle(98, t, 0.18, 0.45, dest);
    } else if (kind === "start") {
      playPulse(392, t, 0.09, 0.75, 0.25, dest);
      playPulse(523.25, t + 0.08, 0.09, 0.75, 0.25, dest);
      playPulse(659.25, t + 0.16, 0.11, 0.8, 0.25, dest);
      playPulse(784, t + 0.26, 0.2, 0.7, 0.5, dest);
      playTriangle(130.81, t, 0.24, 0.5, dest);
      playTriangle(196, t + 0.16, 0.3, 0.55, dest);
    } else if (kind === "boot") {
      // CRT power-on: noise burst, then a rising chord that is not the
      // Famicom jingle -- original, short.
      playNoise(t, 0.14, 0.55, dest, 0.45);
      playTriangle(82, t + 0.06, 0.35, 0.4, dest);
      playPulse(262, t + 0.18, 0.14, 0.7, 0.5, dest);
      playPulse(330, t + 0.32, 0.14, 0.7, 0.5, dest);
      playPulse(392, t + 0.46, 0.28, 0.8, 0.25, dest);
      playTriangle(131, t + 0.46, 0.35, 0.5, dest);
    } else if (kind === "konami") {
      const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
      seq.forEach((f, i) => {
        playPulse(f, t + i * 0.07, 0.11, 0.75, 0.25, dest);
        playTriangle(f / 4, t + i * 0.07, 0.13, 0.4, dest);
      });
    }
  }

  // Original 4-bar title / 2-bar menu vamp. Frequencies in Hz, 0 = rest.
  // 16th-note grid. Pulse2 is the same melody delayed two 16ths.
  const TITLE_P1 = [
    659, 0, 659, 784, 0, 784, 1047, 0, 784, 0, 659, 0, 587, 659, 698, 0,
    587, 0, 587, 698, 0, 698, 880, 0, 698, 0, 587, 0, 523, 587, 659, 0,
    523, 0, 523, 659, 0, 659, 784, 0, 659, 0, 523, 0, 392, 523, 659, 784,
    784, 698, 659, 587, 523, 0, 659, 0, 784, 0, 1047, 0, 784, 0, 0, 0,
  ];
  const TITLE_BASS = [
    131, 131, 98, 98, 131, 131, 165, 165, 175, 175, 131, 131, 175, 175, 110, 110,
    131, 131, 98, 98, 110, 110, 87, 87, 98, 98, 147, 147, 131, 131, 131, 131,
  ];
  const MENU_P1 = [
    523, 0, 659, 0, 784, 0, 659, 0, 698, 0, 587, 0, 784, 0, 0, 0,
    523, 0, 392, 0, 523, 0, 659, 0, 587, 523, 392, 330, 262, 0, 0, 0,
  ];
  const MENU_BASS = [
    131, 131, 98, 98, 131, 131, 98, 98, 175, 175, 131, 131, 98, 98, 98, 98,
  ];

  function scheduleStep(track, step, when) {
    const dest = musicGain;
    if (track === "title") {
      const i = step % TITLE_P1.length;
      const p1 = TITLE_P1[i];
      const p2 = TITLE_P1[(i + TITLE_P1.length - 2) % TITLE_P1.length];
      const bass = TITLE_BASS[Math.floor(i / 2) % TITLE_BASS.length];
      playPulse(p1, when, SIXTEENTH * 1.15, 0.22, 0.25, dest);
      playPulse(p2, when, SIXTEENTH * 1.05, 0.09, 0.5, dest);
      if (i % 2 === 0) playTriangle(bass, when, SIXTEENTH * 2.05, 0.2, dest);
      if (i % 4 === 2) playNoise(when, 0.04, 0.045, dest, 2.6);
      if (i % 16 === 0) playNoise(when, 0.07, 0.07, dest, 0.7);
    } else if (track === "menu") {
      const i = step % MENU_P1.length;
      const p1 = MENU_P1[i];
      const bass = MENU_BASS[Math.floor(i / 2) % MENU_BASS.length];
      playPulse(p1, when, SIXTEENTH * 1.1, 0.16, 0.125, dest);
      if (i % 2 === 0) playTriangle(bass, when, SIXTEENTH * 2.05, 0.16, dest);
      if (i % 8 === 4) playNoise(when, 0.035, 0.04, dest, 2.8);
    }
  }

  function musicScheduler() {
    if (!audioCtx || !musicTrack) return;
    const gen = musicGen;
    const horizon = audioCtx.currentTime + 0.25;
    while (musicNext < horizon) {
      if (gen !== musicGen) return;
      scheduleStep(musicTrack, musicStep, musicNext);
      musicStep += 1;
      musicNext += SIXTEENTH;
    }
    musicTimer = setTimeout(musicScheduler, 40);
  }

  function trackForScreen(name) {
    if (name === "boot") return null;
    if (name === "title") return "title";
    return "menu";
  }

  function levelForScreen(name) {
    if (name === "title") return 0.2;
    if (name === "menu" || name === "gameover") return 0.16;
    return 0.08;
  }

  function setMusic(track, level) {
    const lvl = level == null ? 0.16 : level;
    if (!audioCtx || !musicGain) return;
    const now = audioCtx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.0001), now);
    if (!track) {
      if (musicTrack !== null) {
        musicTrack = null;
        musicGen += 1;
        if (musicTimer) {
          clearTimeout(musicTimer);
          musicTimer = 0;
        }
      }
      musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      return;
    }
    musicGain.gain.linearRampToValueAtTime(lvl, now + 0.1);
    if (musicTrack === track) return;
    musicTrack = track;
    musicGen += 1;
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = 0;
    }
    musicStep = 0;
    musicNext = now + 0.04;
    musicScheduler();
  }

  function syncMusic() {
    if (!audioCtx) return;
    setMusic(trackForScreen(currentScreen), levelForScreen(currentScreen));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) klaxUpHeld = false;
    if (!audioCtx) return;
    // Only suspend the top-level page. A preview iframe often reports
    // hidden while the user is looking at it, which is what killed the
    // APU the instant PRESS START left the title screen.
    if (document.hidden && window.top === window) audioCtx.suspend();
    else audioCtx.resume();
  });


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
      // Two lines, same as dos/'s lexeme/translation columns -- a balloon
      // alone hid the gloss under the list (and NES.css's own pixel padding
      // left that balloon ~one line tall). Lexeme on top, English under it.
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
      card.className = "nes-container is-dark is-rounded decon-card";

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

  // ---------- KAL-Q (Klax, upside down) ----------
  // Game state lives in shared/klax-game.js (window.OqKlaxGame) so it's
  // reusable by any console theme -- this section is only rendering,
  // input, and pacing, same split snes/app.js's KAL-Q gets and the same
  // split shared/morph-game.js gets from gb/app.js's MORPH! screen.
  // "klax" stays the internal/file-level codename (genre lineage, matches
  // the shared engine's name); KAL-Q is only the on-screen title.
  const klaxCanvas = document.getElementById("klax-canvas");
  const klaxCtx = klaxCanvas.getContext("2d");

  // Same reasoning as snes/app.js: the canvas can't reach CSS var(--nes-*)
  // directly, so it reads this theme's own declared palette once via
  // getComputedStyle instead of re-inventing hex for KAL-Q --
  // tools/check_palette.py enforces the same rule on every other literal.
  const nesVars = getComputedStyle(document.documentElement);
  const nesColor = (name) => nesVars.getPropertyValue(`--nes-${name}`).trim();
  function hexToRgbTriplet(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  const KLAX_C = {
    bg: nesColor("black"),
    hud: nesColor("navy"),
    ink: nesColor("navy"),
    paper: nesColor("white"),
    gold: nesColor("gold"),
    mist: nesColor("grey"),
    padDark: nesColor("pad-dark"),
  };

  const KLAX_TILE_COLOR = {
    // This theme's chrome only ever declared black/navy/white/grey/red --
    // green/gold/purple/orange (added above, all grandfathered NES hex
    // literals per tools/palette-baseline.json) are the whole rainbow
    // KAL-Q gets here, same reasoning as snes/'s four face-button colors.
    root: KLAX_C.gold,
    "affix-correct": nesColor("green"),
    "affix-wrong": nesColor("red"),
    "power-lane": nesColor("purple"),
    "power-screen": KLAX_C.paper,
    "power-1up": nesColor("orange"),
  };

  const KLAX_CLEAR_COLOR = {
    match: hexToRgbTriplet(KLAX_C.paper),
    "power-lane": hexToRgbTriplet(KLAX_TILE_COLOR["power-lane"]),
    "power-screen": hexToRgbTriplet(KLAX_TILE_COLOR["power-screen"]),
  };

  // 4x5 bitmap font -- drawn one fillRect per pixel, same technique as
  // snes/app.js's KLAX_FONT, so canvas text never falls back to
  // anti-aliased browser glyph rendering at this resolution.
  const KLAX_FONT = {
    " ": ["....", "....", "....", "....", "...."],
    ".": ["....", "....", "....", "....", ".#.."],
    "-": ["....", "....", "####", "....", "...."],
    "+": ["....", ".#..", "###.", ".#..", "...."],
    "=": ["....", "####", "....", "####", "...."],
    "0": [".##.", "#..#", "#..#", "#..#", ".##."],
    "1": ["..#.", ".##.", "..#.", "..#.", ".###"],
    "2": [".##.", "#..#", "..#.", ".#..", "####"],
    "3": ["###.", "...#", "..#.", "...#", "###."],
    "4": ["#..#", "#..#", "####", "...#", "...#"],
    "5": ["####", "#...", "###.", "...#", "###."],
    "6": [".##.", "#...", "###.", "#..#", ".##."],
    "7": ["####", "...#", "..#.", ".#..", ".#.."],
    "8": [".##.", "#..#", ".##.", "#..#", ".##."],
    "9": [".##.", "#..#", ".###", "...#", ".##."],
    A: [".##.", "#..#", "####", "#..#", "#..#"],
    B: ["###.", "#..#", "###.", "#..#", "###."],
    C: [".##.", "#...", "#...", "#...", ".##."],
    D: ["###.", "#..#", "#..#", "#..#", "###."],
    E: ["####", "#...", "###.", "#...", "####"],
    F: ["####", "#...", "###.", "#...", "#..."],
    G: [".##.", "#...", "#.##", "#..#", ".##."],
    H: ["#..#", "#..#", "####", "#..#", "#..#"],
    I: [".##.", ".##.", ".##.", ".##.", ".##."],
    J: ["..##", "...#", "...#", "#..#", ".##."],
    K: ["#..#", "#.#.", "##..", "#.#.", "#..#"],
    L: ["#...", "#...", "#...", "#...", "####"],
    M: ["#..#", "####", "####", "#..#", "#..#"],
    N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
    O: [".##.", "#..#", "#..#", "#..#", ".##."],
    P: ["###.", "#..#", "###.", "#...", "#..."],
    Q: [".##.", "#..#", "#..#", ".##.", "...#"],
    R: ["###.", "#..#", "###.", "#.#.", "#..#"],
    S: [".###", "#...", ".##.", "...#", "###."],
    T: ["####", "..#.", "..#.", "..#.", "..#."],
    U: ["#..#", "#..#", "#..#", "#..#", ".##."],
    V: ["#..#", "#..#", "#..#", ".##.", ".##."],
    W: ["#..#", "#..#", "####", "####", "#..#"],
    X: ["#..#", ".##.", ".##.", "#..#", "#..#"],
    Y: ["#..#", ".##.", "..#.", "..#.", "..#."],
    Z: ["####", "...#", "..#.", ".#..", "####"],
  };

  function klaxPx(x, y, w, h, c) {
    klaxCtx.fillStyle = c;
    klaxCtx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function klaxText(str, x, y, scale, color, align) {
    const w = String(str).length * 5 * scale - scale;
    let ox = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    for (const ch of String(str).toUpperCase()) {
      const glyph = KLAX_FONT[ch] || KLAX_FONT[" "];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          if (glyph[row][col] === "#") klaxPx(ox + col * scale, y + row * scale, scale, scale, color);
        }
      }
      ox += 5 * scale;
    }
  }

  function klaxBevel(x, y, w, h, fill, hi, lo) {
    klaxPx(x, y, w, h, fill);
    klaxPx(x, y, w, 1, hi);
    klaxPx(x, y, 1, h, hi);
    klaxPx(x, y + h - 1, w, 1, lo);
    klaxPx(x + w - 1, y, 1, h, lo);
  }

  let klaxGame = null;
  let klaxCol = 0;
  let klaxRaf = 0;
  let klaxLastT = 0;
  // Fast-forward while held (up) -- set true on keydown/pointerdown, false
  // on keyup/pointerup/pointercancel/tab-hide so it can never get stuck on.
  let klaxUpHeld = false;
  const KLAX_FAST_MULT = 2;
  let klaxFlash = 0; // seconds remaining on a match/miss/overflow flash
  let klaxPaused = false;
  // Just-cleared cells (a match, or a pill's lane/screen wipe), kept around
  // to draw a pulsing outline over their old spots for a second instead of
  // them just vanishing the instant place()/tryMatch() splices them out of
  // the real stacks. Pulse color marks which kind of clear it was.
  let klaxClearAnim = null;
  // A short-lived center-screen callout -- 1-UP doesn't clear any cells
  // (klaxClearAnim has nothing to point at), so it needs its own feedback
  // beyond the HUD's LIVES count quietly incrementing.
  let klaxPopup = null;
  const KLAX_POPUP_S = 1.1;
  const KLAX_CLEAR_ANIM_S = 1;

  const KLAX_COLS = 4;
  // The engine's own active.y is a smooth 0..1 float (real, continuous
  // physics) -- rendering it directly reads as a perfectly smooth glide,
  // which doesn't sit right on a chonky-pixel console screen. Snapping the
  // DISPLAYED position to a fixed number of grid steps gives the classic
  // stepped/chunky motion instead, with no change to the actual catch
  // timing (still governed by the untouched, continuous active.y).
  const KLAX_GRID_STEPS = 10;
  function snapGridY(y) {
    return Math.floor(y * KLAX_GRID_STEPS) / KLAX_GRID_STEPS;
  }
  // Klax's bin sits at the floor because that's where its tiles fall to.
  // This game flips gravity, so the bin flips with it: the stacking yard
  // is up at the ceiling, right where the rising tiles are headed, and
  // grows DOWN from there as more get placed. The well fills the rest of
  // the screen below it, floor at the bottom where tiles spawn.
  const KLAX_STACK = { x: 20, top: 14, bottom: 78, w: 216 };
  const KLAX_WELL = { x: 20, top: 82, bottom: 210, w: 216 };

  function klaxColumnX(c, region) {
    const colW = region.w / KLAX_COLS;
    return region.x + c * colW + colW / 2;
  }

  function renderKlax() {
    const state = klaxGame.getState();
    klaxCtx.fillStyle = KLAX_C.bg;
    klaxCtx.fillRect(0, 0, 256, 224);

    // HUD is drawn first but the paddle/well below it are what were
    // getting clipped off on very wide-but-short browser windows -- see
    // .klax-canvas in style.css (max-height fix) for the actual cause.
    klaxPx(0, 0, 256, 12, KLAX_C.hud);
    klaxText(`SCORE ${state.score}`, 6, 3, 1, KLAX_C.paper, "left");
    klaxText("KAL-Q", 128, 3, 1, KLAX_C.gold, "center");
    klaxText(`LIVES ${state.lives}`, 250, 3, 1, KLAX_TILE_COLOR["affix-wrong"], "right");

    // Color legend: root (gold) + its correct affix (green) is the only
    // pair that ever clears a lane -- a wrong affix (red) never matches
    // anything, it just costs a paddle slot until discarded. Drawn in the
    // left margin, the one strip beside the stacking yard the layout
    // doesn't already use.
    const legend = [
      { label: "RT", color: KLAX_TILE_COLOR.root },
      { label: "OK", color: KLAX_TILE_COLOR["affix-correct"] },
      { label: "NO", color: KLAX_TILE_COLOR["affix-wrong"] },
    ];
    legend.forEach((item, i) => {
      const ly = KLAX_STACK.top + i * 20;
      klaxBevel(3, ly, 12, 8, item.color, "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
      klaxText(item.label, 3, ly + 10, 1, item.color, "left");
    });

    // Stacking yard: one lane per source lane, growing DOWN from the
    // ceiling as tiles get placed -- the physical place caught pieces
    // actually go, not an abstract "HOLDING" row.
    const stackColW = KLAX_STACK.w / KLAX_COLS;
    for (let c = 0; c < KLAX_COLS; c++) {
      const cx = klaxColumnX(c, KLAX_STACK);
      const highlighted = state.paddle.length > 0 && klaxCol === c;
      klaxPx(cx - stackColW / 2 + 1, KLAX_STACK.top, stackColW - 2, KLAX_STACK.bottom - KLAX_STACK.top,
        highlighted ? "rgba(231,194,63,.12)" : "rgba(255,255,255,.04)");
      const lane = state.stacks[c];
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      lane.forEach((tile, i) => {
        const ty = KLAX_STACK.top + i * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[tile.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(tile.marker, cx, ty + tileH / 2 - 2, 1, KLAX_C.ink, "center");
      });
    }

    // The just-cleared cells -- a match, or a pill's lane/screen wipe --
    // already spliced out of the real stacks, redrawn as ghosts at their
    // old spots with a pulsing outline for KLAX_CLEAR_ANIM_S seconds
    // instead of them just popping out of existence. Outline color marks
    // which kind of clear it was: white for a match, pill blue/purple for
    // a lane/screen wipe.
    if (klaxClearAnim) {
      const tileH = (KLAX_STACK.bottom - KLAX_STACK.top) / state.stackCap;
      const pulse = 0.5 + 0.5 * Math.sin(klaxClearAnim.timeLeft * 22);
      const rgb = KLAX_CLEAR_COLOR[klaxClearAnim.kind] || KLAX_CLEAR_COLOR.match;
      for (const cell of klaxClearAnim.cells) {
        const cx = klaxColumnX(cell.col, KLAX_STACK);
        const ty = KLAX_STACK.top + cell.row * tileH;
        klaxBevel(cx - stackColW / 2 + 3, ty + 1, stackColW - 6, tileH - 2, KLAX_TILE_COLOR[cell.kind], "rgba(255,255,255,.5)", "rgba(0,0,0,.4)");
        klaxText(cell.marker, cx, ty + tileH / 2 - 2, 1, KLAX_C.ink, "center");
        klaxCtx.strokeStyle = `rgba(${rgb},${(0.4 + 0.6 * pulse).toFixed(2)})`;
        klaxCtx.lineWidth = 2;
        klaxCtx.strokeRect(cx - stackColW / 2 + 2, ty, stackColW - 4, tileH);
      }
    }

    // The catch/place line -- floor of the stacking yard, ceiling of the
    // well -- is the one boundary the paddle ever sits on.
    klaxPx(KLAX_WELL.x, KLAX_WELL.top, KLAX_WELL.w, 1, KLAX_C.gold);
    const wellColW = KLAX_WELL.w / KLAX_COLS;
    klaxPx(KLAX_WELL.x - 2, KLAX_WELL.top, 2, KLAX_WELL.bottom - KLAX_WELL.top, KLAX_C.padDark);
    klaxPx(KLAX_WELL.x + KLAX_WELL.w, KLAX_WELL.top, 2, KLAX_WELL.bottom - KLAX_WELL.top, KLAX_C.padDark);
    // Column guides -- only one tile is ever in play, so these faint
    // dividers are what tells the player which lane it's rising in.
    for (let c = 1; c < KLAX_COLS; c++) {
      klaxPx(KLAX_WELL.x + c * wellColW, KLAX_WELL.top, 1, KLAX_WELL.bottom - KLAX_WELL.top, "rgba(255,255,255,.08)");
    }

    if (state.active) {
      const cx = klaxColumnX(state.active.col, KLAX_WELL);
      // y=1 lands the tile's vertical CENTER on the paddle line -- the
      // catch and the ceiling line up exactly, so a caught tile visibly
      // stops there instead of drifting past it.
      const ty = KLAX_WELL.bottom - snapGridY(state.active.y) * (KLAX_WELL.bottom - KLAX_WELL.top) - 11;
      const color = KLAX_TILE_COLOR[state.active.kind];
      klaxBevel(cx - wellColW / 2 + 3, ty, wellColW - 6, 22, color, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(state.active.marker, cx, ty + 8, 1, KLAX_C.ink, "center");
    }

    // Paddle: always sits on the catch/place line -- it's the same spot
    // whether it's about to catch a rising tile or about to push a held
    // one up into the highlighted lane above. Only the highlight above
    // moves; the paddle doesn't need to travel between two positions.
    const paddleX = klaxColumnX(klaxCol, KLAX_WELL);
    klaxBevel(paddleX - wellColW / 2 + 2, KLAX_WELL.top - 6, wellColW - 4, 6, KLAX_C.paper, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
    if (state.paddle.length) {
      // Up to paddleCap small color-coded chips show the whole LIFO
      // stack at a glance (oldest catch on the left); the readable one
      // with its text is the last one caught -- the tile place()/
      // discard() will actually act on next.
      const slotW = (wellColW - 6) / state.paddleCap;
      state.paddle.forEach((tile, i) => {
        const sx = paddleX - wellColW / 2 + 3 + i * slotW;
        klaxPx(sx, KLAX_WELL.top - 10, slotW - 1, 7, KLAX_TILE_COLOR[tile.kind]);
      });
      const top = state.paddle[state.paddle.length - 1];
      klaxBevel(paddleX - wellColW / 2 + 3, KLAX_WELL.top - 24, wellColW - 6, 12, KLAX_TILE_COLOR[top.kind], "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(top.marker, paddleX, KLAX_WELL.top - 21, 1, KLAX_C.ink, "center");
    }

    if (klaxFlash > 0) {
      klaxCtx.fillStyle = "rgba(255,255,255,.12)";
      klaxCtx.fillRect(0, 0, 256, 224);
    }

    // 1-UP callout -- rises slightly and fades out over KLAX_POPUP_S, the
    // only feedback for a pill that doesn't clear any cells for
    // klaxClearAnim to point at.
    if (klaxPopup) {
      const t = 1 - klaxPopup.timeLeft / KLAX_POPUP_S;
      const y = 110 - t * 14;
      klaxCtx.globalAlpha = Math.min(1, klaxPopup.timeLeft * 2);
      klaxText(klaxPopup.text, 128, y, 2, KLAX_C.mist, "center");
      klaxCtx.globalAlpha = 1;
    }

    if (klaxPaused) {
      klaxCtx.fillStyle = "rgba(10,10,20,.75)";
      klaxCtx.fillRect(0, 0, 256, 224);
      klaxText("PAUSED", 128, 100, 2, KLAX_C.paper, "center");
      klaxText("START=RESUME  B=MENU", 128, 120, 1, KLAX_C.mist, "center");
    }

    if (state.gameOver) {
      klaxCtx.fillStyle = "rgba(10,10,20,.75)";
      klaxCtx.fillRect(0, 0, 256, 224);
      klaxText("GAME OVER", 128, 96, 2, KLAX_TILE_COLOR["affix-wrong"], "center");
      klaxText(`SCORE ${state.score}`, 128, 116, 1, KLAX_C.paper, "center");
      klaxText("A=RETRY  B=MENU", 128, 132, 1, KLAX_C.mist, "center");
    }
  }

  function klaxLoop(t) {
    // klaxLastT keeps advancing every frame even while paused, so dt
    // doesn't spike on resume -- only the game-state tick() call is
    // skipped, same as gb/'s MORPH! freezing the step timer in place.
    const dt = klaxLastT ? Math.min(0.1, (t - klaxLastT) / 1000) : 0;
    klaxLastT = t;
    if (!klaxPaused) {
      if (klaxFlash > 0) klaxFlash -= dt;
      if (klaxClearAnim) {
        klaxClearAnim.timeLeft -= dt;
        if (klaxClearAnim.timeLeft <= 0) klaxClearAnim = null;
      }
      if (klaxPopup) {
        klaxPopup.timeLeft -= dt;
        if (klaxPopup.timeLeft <= 0) klaxPopup = null;
      }
      const result = klaxGame.tick(dt, klaxCol, klaxUpHeld ? KLAX_FAST_MULT : 1);
      if (result.event === "caught") {
        sfx(result.tile.kind === "power-lane" || result.tile.kind === "power-screen" ? "konami" : "move");
      } else if (result.event === "missed") { klaxFlash = 0.12; sfx("back"); }
    }
    renderKlax();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function stopKlaxLoop() {
    if (klaxRaf) cancelAnimationFrame(klaxRaf);
    klaxRaf = 0;
    klaxLastT = 0;
  }

  function launchKlax() {
    showScreen("klax");
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    if (!klaxGame) klaxGame = window.OqKlaxGame.createGame({ puzzles: window.OqMorphPuzzles.puzzles, columns: KLAX_COLS, debug });
    klaxGame.start();
    klaxCol = 0;
    klaxFlash = 0;
    klaxClearAnim = null;
    klaxPopup = null;
    klaxUpHeld = false;
    klaxPaused = false;
    stopKlaxLoop();
    klaxRaf = requestAnimationFrame(klaxLoop);
  }

  function exitKlax() {
    stopKlaxLoop();
    klaxUpHeld = false;
    klaxPaused = false;
  }

  function handleKlaxInput(action) {
    const state = klaxGame.getState();
    if (state.gameOver) {
      if (action === "a" || action === "start") { sfx("ok"); klaxGame.start(); }
      else if (action === "b") { sfx("back"); goMenu(); }
      return;
    }
    if (klaxPaused) {
      if (action === "start") resumeKlax();
      else if (action === "b") { resumeKlax(); sfx("back"); goMenu(); }
      return;
    }
    if (action === "start") { pauseKlax(); return; }
    // Left/right always just move the paddle -- what that means depends on
    // whether the catcher is empty-handed (lining up under the rising
    // tile) or carrying one (choosing a stacking lane to place it in).
    if (action === "left") { sfx("move"); klaxCol = (klaxCol - 1 + KLAX_COLS) % KLAX_COLS; }
    else if (action === "right") { sfx("move"); klaxCol = (klaxCol + 1) % KLAX_COLS; }
    else if (action === "a") {
      if (!state.paddle.length) return;
      const res = klaxGame.place(klaxCol);
      if (res.event === "match") { klaxFlash = 0.12; klaxClearAnim = { kind: "match", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S }; sfx("ok"); }
      else if (res.event === "power-screen") { klaxFlash = 0.25; klaxClearAnim = { kind: "power-screen", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S }; sfx("konami"); }
      else if (res.event === "power-lane") { klaxFlash = 0.16; klaxClearAnim = { kind: "power-lane", cells: res.cells, timeLeft: KLAX_CLEAR_ANIM_S }; sfx("ok"); }
      else if (res.event === "power-1up") { klaxPopup = { text: "+1UP", timeLeft: KLAX_POPUP_S }; sfx("konami"); }
      else if (res.event === "discarded") { sfx("back"); }
      else if (res.placed) { sfx("move"); }
      else { sfx("back"); }
    } else if (action === "down") {
      klaxGame.discard();
      sfx("back");
    } else if (action === "b") {
      sfx("back");
      goMenu();
    }
  }

  // Start pauses mid-round, same as gb/'s MORPH! -- freezes the well and
  // paddle exactly where they stood and puts up a blocking card, with its
  // own distinct music (the title theme, not the in-round bed) so it's
  // unmistakably a different state, not just a quiet moment.
  function pauseKlax() {
    if (klaxPaused || klaxGame.getState().gameOver) return;
    klaxPaused = true;
    sfx("start");
    setMusic("title", levelForScreen("title"));
  }

  function resumeKlax() {
    if (!klaxPaused) return;
    klaxPaused = false;
    sfx("start");
    syncMusic();
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

  // window.OqRouter owns "which screen is open", same reasoning as
  // dos/app.js -- every user-facing trigger (D-pad, A/B, click, the
  // on-screen pad) goes through navigate() instead of calling
  // showScreen()/launchOq() directly.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (!screen && !bootDone) {
      startBoot();
      return;
    }
    const dest = screen || "title";
    if (dest === "oq") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "klax") exitKlax();
      if (currentScreen !== "oq" || SCREENS.oq.hidden) {
        launchOq(params.get("filter") || "");
      } else if (oqFilter.value !== (params.get("filter") || "")) {
        oqFilter.value = params.get("filter") || "";
        renderOqResults();
      }
    } else if (dest === "decon") {
      if (currentScreen === "klax") exitKlax();
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
    } else if (dest === "klax") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen !== "klax" || SCREENS.klax.hidden) launchKlax();
    } else if (dest === "menu" || dest === "about" || dest === "gameover" || dest === "title") {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "klax") exitKlax();
      bootDone = true;
      showScreen(dest);
    } else {
      if (currentScreen === "decon") exitDecon();
      if (currentScreen === "klax") exitKlax();
      showScreen("title");
    }
  });

  oqFilter.addEventListener("input", () => {
    pingAttract();
    renderOqResults();
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });
  deconWord.addEventListener("input", () => { pingAttract(); });
  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sfx("ok");
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  menuButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      pingAttract();
      setMenuIndex(i);
      sfx("ok");
      chooseMenuItem(MENU_ORDER[i]);
    });
  });
  continueYes.addEventListener("click", () => { pingAttract(); sfx("ok"); goMenu(); });
  continueNo.addEventListener("click", () => { pingAttract(); sfx("back"); goTitle(); });
  // One listener on the whole title screen -- PRESS START is inside it, so
  // a second listener on #press-start would fire navigate() twice.
  SCREENS.title.addEventListener("click", () => { pingAttract(); sfx("start"); goMenu(); });
  SCREENS.boot.addEventListener("click", () => {
    pingAttract();
    unlockAudio();
    sfx("boot");
    finishBoot();
  });

  function moveOqSelection(delta) {
    if (visibleRows.length === 0) return;
    selectedIndex = (selectedIndex + delta + visibleRows.length) % visibleRows.length;
    highlightOqRow();
  }

  // In-LCD attract mode. 256x240 starfield over the TV picture only --
  // never the grey bezel or the pad. Original PPU-feel warp (2C02 colors
  // from --nes-ppu-* in style.css); no Nintendo logo, no Mario, no audio.
  const ATTRACT_IDLE_MS = 45000;
  const ATTRACT_W = 256;
  const ATTRACT_H = 240;
  const attractCanvas = document.getElementById("attract-canvas");
  const attractCtx = attractCanvas.getContext("2d", { alpha: false });
  attractCtx.imageSmoothingEnabled = false;

  const reduceMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  function attractStarSpeed() {
    return reduceMotionMq.matches ? 0.42 : 1.7;
  }

  function ppuColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  const PPU_BLACK = ppuColor("--nes-ppu-black", "#000000");
  const PPU_NAVY = ppuColor("--nes-ppu-navy", "#0000bc");
  const PPU_BLUE = ppuColor("--nes-ppu-blue", "#0058f8");
  const PPU_CYAN = ppuColor("--nes-ppu-cyan", "#3cbcfc");
  const PPU_GREY = ppuColor("--nes-ppu-grey", "#7c7c7c");
  const PPU_SILVER = ppuColor("--nes-ppu-silver", "#bcbcbc");
  const PPU_WHITE = ppuColor("--nes-ppu-white", "#fcfcfc");
  const STAR_PAL = [PPU_NAVY, PPU_GREY, PPU_BLUE, PPU_SILVER, PPU_CYAN, PPU_WHITE];

  const STAR_COUNT = 64;
  const attractStars = [];
  function spawnStar(star, far) {
    star.x = (Math.random() * 2 - 1) * 128;
    star.y = (Math.random() * 2 - 1) * 120;
    star.z = far ? 256 : 1 + Math.random() * 255;
    star.hue = (Math.random() * STAR_PAL.length) | 0;
  }
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = { x: 0, y: 0, z: 1, hue: 0 };
    spawnStar(s, false);
    attractStars.push(s);
  }

  let attractOn = false;
  let attractRaf = 0;
  let attractLast = 0;
  let attractIdleTimer = 0;

  function pingAttract() {
    if (attractIdleTimer) {
      clearTimeout(attractIdleTimer);
      attractIdleTimer = 0;
    }
    if (attractOn || document.hidden) return;
    attractIdleTimer = window.setTimeout(showAttract, ATTRACT_IDLE_MS);
  }

  function showAttract() {
    if (attractOn || document.hidden) return;
    attractOn = true;
    attractCanvas.hidden = false;
    attractLast = 0;
    if (!attractRaf) attractRaf = requestAnimationFrame(tickAttract);
  }

  function hideAttract() {
    if (!attractOn) return false;
    attractOn = false;
    attractCanvas.hidden = true;
    if (attractRaf) {
      cancelAnimationFrame(attractRaf);
      attractRaf = 0;
    }
    pingAttract();
    return true;
  }

  function tickAttract(now) {
    if (!attractOn) {
      attractRaf = 0;
      return;
    }
    if (document.hidden) {
      attractRaf = 0;
      attractLast = 0;
      return;
    }
    const dt = attractLast ? Math.min(50, now - attractLast) / 16.6667 : 1;
    attractLast = now;
    const speed = attractStarSpeed() * dt;
    const ctx = attractCtx;
    ctx.fillStyle = PPU_BLACK;
    ctx.fillRect(0, 0, ATTRACT_W, ATTRACT_H);

    for (let i = 0; i < attractStars.length; i++) {
      const s = attractStars[i];
      s.z -= speed;
      if (s.z <= 1) spawnStar(s, true);
      const k = 128 / s.z;
      const px = (s.x * k + 128);
      const py = (s.y * k + 120);
      if (px < 0 || px >= ATTRACT_W || py < 0 || py >= ATTRACT_H) {
        spawnStar(s, true);
        continue;
      }
      const near = 1 - s.z / 256;
      let color;
      if (near > 0.72) color = PPU_WHITE;
      else if (near > 0.5) color = s.hue === 4 ? PPU_CYAN : PPU_SILVER;
      else if (near > 0.28) color = s.hue === 2 ? PPU_BLUE : PPU_GREY;
      else color = s.hue === 0 ? PPU_NAVY : PPU_GREY;
      ctx.fillStyle = color;
      const sz = near > 0.68 ? 2 : 1;
      const ix = px | 0;
      const iy = py | 0;
      ctx.fillRect(ix, iy, sz, sz);
      // Short warp streak on near stars -- still 1px NES dots, not a fade.
      if (near > 0.55 && !reduceMotionMq.matches) {
        const k2 = 128 / (s.z + 10);
        ctx.fillStyle = near > 0.72 ? PPU_SILVER : PPU_GREY;
        ctx.fillRect((s.x * k2 + 128) | 0, (s.y * k2 + 120) | 0, 1, 1);
      }
    }
    attractRaf = requestAnimationFrame(tickAttract);
  }

  attractCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    hideAttract();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (attractIdleTimer) {
        clearTimeout(attractIdleTimer);
        attractIdleTimer = 0;
      }
      if (attractRaf) {
        cancelAnimationFrame(attractRaf);
        attractRaf = 0;
      }
      attractLast = 0;
    } else if (attractOn) {
      attractRaf = requestAnimationFrame(tickAttract);
    } else {
      pingAttract();
    }
  });

  function handleInput(action) {
    if (hideAttract()) return;
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
        const dir = action === "up" ? -1 : 1;
        setContinueIndex(continueIndex + dir);
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

    if (currentScreen === "klax") {
      handleKlaxInput(action);
      return;
    }
  }

  document.addEventListener("keydown", (event) => {
    pingAttract();
    if (attractOn) {
      event.preventDefault();
      hideAttract();
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
    if (action === "up" && currentScreen === "klax" && !inputFocused()) klaxUpHeld = true;
    if (!inputFocused()) event.preventDefault();
    handleInput(action);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp") klaxUpHeld = false;
  });

  document.getElementById("nes-controller").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    const raw = btn.dataset.input;
    if (raw === "up" && currentScreen === "klax") {
      // A finger that slides off the button fires pointerup on something
      // else, so the fast-drop flag would stick. Capture keeps pointerup
      // on this button, same as c64/app.js.
      try { btn.setPointerCapture(event.pointerId); } catch (err) { /* old browser */ }
      klaxUpHeld = true;
    }
    handleInput(raw);
  });
  window.addEventListener("pointerup", (event) => {
    const btn = event.target && event.target.closest && event.target.closest("[data-input]");
    const raw = (btn && btn.dataset.input) || "";
    if (raw === "up") klaxUpHeld = false;
  });
  window.addEventListener("pointercancel", () => {
    klaxUpHeld = false;
  });

  // Same visualViewport tracking as dos/app.js / c64/app.js -- a mobile
  // keyboard shrinks the visual viewport without shrinking position:fixed
  // elements, so the pad would sit under the keyboard without this.
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

  // Hide the on-screen pad while SEARCH/WORD is focused. visualViewport
  // already shrinks the shell above the keyboard; the pad still ate the
  // leftover height, and iOS's input-zoom made that leftover a giant
  // D-pad with the field off-screen. focusin/out covers hardware and
  // on-screen keyboards; the 16px input floor in style.css stops the zoom.
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
  pingAttract();
})();
