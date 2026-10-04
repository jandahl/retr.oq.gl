(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as nes/app.js -- see CLAUDE.md. The chrome is hand-drawn
  // PAL Super Nintendo plastic (no vendored kit); this file is the "game"
  // the same way nes/app.js is: which screen is up, D-pad focus, OQ!/DECON.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;

  const SCREENS = {
    boot: document.getElementById("boot-screen"),
    title: document.getElementById("title-screen"),
    menu: document.getElementById("menu-screen"),
    oq: document.getElementById("oq-screen"),
    decon: document.getElementById("decon-screen"),
    klax: document.getElementById("klax-screen"),
    about: document.getElementById("about-screen"),
    gameover: document.getElementById("gameover-screen"),
  };
  // Attract is an in-LCD overlay, not a router screen -- keep it out of
  // SCREENS so showScreen() cannot land on it and hide the CRT chrome.
  const attractScreen = document.getElementById("attract-screen");
  const attractCanvas = document.getElementById("attract-canvas");

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

  // Region jumper. PAL dogbone is the default; the NA toaster is the
  // other CIC. Undocumented, same shelf as Konami / Hot Dog Stand.
  const REGION_KEY = "retr-oq:snes-region";
  const shouldersHeld = new Set();

  function getStoredRegion() {
    try {
      return localStorage.getItem(REGION_KEY) === "ntsc" ? "ntsc" : "pal";
    } catch {
      return "pal";
    }
  }

  function applyRegion(region) {
    const ntsc = region === "ntsc";
    document.documentElement.classList.toggle("is-ntsc", ntsc);
    try {
      localStorage.setItem(REGION_KEY, ntsc ? "ntsc" : "pal");
    } catch {
      /* sandboxed iframe -- scheme still applies for this visit */
    }
  }

  function toggleRegion() {
    applyRegion(document.documentElement.classList.contains("is-ntsc") ? "pal" : "ntsc");
    // KAL-Q's canvas caches its colors (can't hand fillStyle a CSS var
    // directly) -- refresh them or a mid-game toggle leaves the canvas
    // stuck on whichever region was active when the page loaded. Function
    // declaration below is hoisted, so this reference is always live.
    refreshKlaxColors();
    sfx("konami");
  }

  function shoulderDown(side) {
    const was = shouldersHeld.has("l") && shouldersHeld.has("r");
    shouldersHeld.add(side);
    if (!was && shouldersHeld.has("l") && shouldersHeld.has("r")) {
      toggleRegion();
      return true;
    }
    return false;
  }

  function shoulderUp(side) {
    shouldersHeld.delete(side);
  }

  applyRegion(getStoredRegion());

  function showScreen(name) {
    if (attractRunning) hideAttract();
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
    pingIdle();
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
    if (id === "klax") {
      window.OqRouter.navigate({ screen: "klax" });
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

  // SNES S-SMP-ish bed: pitched samples (10.5 kHz hold-upsample, 6-bit
  // crunch), ADSR, hardware echo. Not pulse/triangle NES leftovers and
  // not a ripped Nintendo track. High-paced -- 168 BPM, the kind of
  // tempo the 8-channel sampler was bought to carry. Silent until the
  // first pad/key gesture (autoplay policy). Typing in SEARCH/WORD
  // stays silent on purpose.
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let echoIn = null;
  let samples = null;
  let musicTrack = null;
  let musicGen = 0;
  let musicNext = 0;
  let musicTimer = 0;
  let musicStep = 0;
  const BPM = 168;
  const SIXTEENTH = 60 / BPM / 4;
  const BASS0 = 110;
  const LEAD0 = 440;
  const BRASS0 = 220;

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        try {
          audioCtx = new AC({ latencyHint: "interactive" });
        } catch (err) {
          audioCtx = new AC();
        }
        buildGraph();
        samples = buildSamples(audioCtx);
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

  function buildGraph() {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(audioCtx.destination);

    const echoFilter = audioCtx.createBiquadFilter();
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 3200;
    echoFilter.Q.value = 0.4;
    const delay = audioCtx.createDelay(0.4);
    delay.delayTime.value = 0.148;
    const echoFb = audioCtx.createGain();
    echoFb.gain.value = 0.42;
    echoIn = audioCtx.createGain();
    echoIn.gain.value = 1;
    echoIn.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(echoFb);
    echoFb.connect(delay);
    echoFilter.connect(masterGain);

    const air = audioCtx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = 11000;
    air.connect(masterGain);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(air);
    const musicEcho = audioCtx.createGain();
    musicEcho.gain.value = 0.55;
    musicGain.connect(musicEcho);
    musicEcho.connect(echoIn);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(air);
    const sfxEcho = audioCtx.createGain();
    sfxEcho.gain.value = 0.28;
    sfxGain.connect(sfxEcho);
    sfxEcho.connect(echoIn);
  }

  function crunch(x) {
    return Math.round(Math.max(-1, Math.min(1, x)) * 40) / 40;
  }

  function makeToneSample(ctx, seconds, render) {
    const sr = ctx.sampleRate;
    const srcRate = 10547;
    const srcN = Math.max(2, Math.floor(srcRate * seconds));
    const src = new Float32Array(srcN);
    for (let i = 0; i < srcN; i++) src[i] = crunch(render(i / srcRate));
    const n = Math.max(2, Math.floor(sr * seconds));
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = (i * srcRate) / sr;
      const j = Math.min(srcN - 2, Math.floor(t));
      const f = t - j;
      d[i] = src[j] * (1 - f) + src[j + 1] * f;
    }
    return buf;
  }

  function buildSamples(ctx) {
    const bass = makeToneSample(ctx, 0.45, (t) => {
      let s = 0;
      for (let h = 1; h <= 7; h++) s += Math.sin(2 * Math.PI * BASS0 * h * t) / h;
      return s * 0.45 * Math.exp(-t * 6.5);
    });
    const lead = makeToneSample(ctx, 0.28, (t) => {
      const duty = t % (1 / LEAD0) < 0.35 / LEAD0 ? 1 : -1;
      const saw = 2 * ((LEAD0 * t) % 1) - 1;
      return (duty * 0.55 + saw * 0.2) * Math.exp(-t * 9);
    });
    const brass = makeToneSample(ctx, 0.32, (t) => {
      const a = Math.sin(2 * Math.PI * BRASS0 * t);
      const b = Math.sin(2 * Math.PI * BRASS0 * 2 * t) * 0.4;
      const c = Math.sin(2 * Math.PI * BRASS0 * 3 * t) * 0.18;
      return (a + b + c) * 0.5 * Math.exp(-t * 7);
    });
    const kick = makeToneSample(ctx, 0.22, (t) => {
      const f = 150 * Math.exp(-t * 22);
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14);
    });
    const snare = makeToneSample(ctx, 0.16, (t) => {
      const n = (Math.random() * 2 - 1) * Math.exp(-t * 22);
      const tone = Math.sin(2 * Math.PI * 196 * t) * Math.exp(-t * 18);
      return n * 0.7 + tone * 0.35;
    });
    const hat = makeToneSample(ctx, 0.05, (t) => {
      return (Math.random() * 2 - 1) * Math.exp(-t * 70);
    });
    return { bass, lead, brass, kick, snare, hat };
  }

  function playSample(buf, when, dur, peak, dest, rate) {
    if (!buf || !audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate || 1, when);
    const g = audioCtx.createGain();
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g);
    src.onended = () => {
      try { src.disconnect(); g.disconnect(); } catch (err) { /* already gone */ }
    };
    src.start(when);
    src.stop(when + dur + 0.03);
  }

  function sfx(kind) {
    const ctx = unlockAudio();
    if (!ctx || !sfxGain || !samples) return;
    const t = ctx.currentTime + 0.01;
    const dest = sfxGain;
    if (kind === "move") {
      playSample(samples.hat, t, 0.05, 0.55, dest, 1.6);
      playSample(samples.lead, t, 0.07, 0.35, dest, 392 / LEAD0);
    } else if (kind === "ok") {
      playSample(samples.lead, t, 0.1, 0.55, dest, 523.25 / LEAD0);
      playSample(samples.lead, t + 0.05, 0.14, 0.5, dest, 783.99 / LEAD0);
      playSample(samples.brass, t, 0.16, 0.4, dest, 261.63 / BRASS0);
    } else if (kind === "back") {
      playSample(samples.lead, t, 0.09, 0.4, dest, 330 / LEAD0);
      playSample(samples.bass, t + 0.05, 0.14, 0.45, dest, 98 / BASS0);
    } else if (kind === "start") {
      playSample(samples.brass, t, 0.12, 0.5, dest, 196 / BRASS0);
      playSample(samples.lead, t + 0.06, 0.1, 0.5, dest, 523.25 / LEAD0);
      playSample(samples.lead, t + 0.13, 0.1, 0.5, dest, 659.25 / LEAD0);
      playSample(samples.lead, t + 0.2, 0.18, 0.55, dest, 880 / LEAD0);
      playSample(samples.kick, t, 0.16, 0.7, dest, 1);
    } else if (kind === "boot") {
      playSample(samples.snare, t, 0.12, 0.45, dest, 0.7);
      playSample(samples.bass, t + 0.05, 0.28, 0.5, dest, 82 / BASS0);
      playSample(samples.brass, t + 0.16, 0.16, 0.45, dest, 196 / BRASS0);
      playSample(samples.lead, t + 0.28, 0.14, 0.5, dest, 392 / LEAD0);
      playSample(samples.lead, t + 0.4, 0.22, 0.55, dest, 523.25 / LEAD0);
    } else if (kind === "konami") {
      const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
      seq.forEach((f, i) => {
        playSample(samples.lead, t + i * 0.06, 0.1, 0.5, dest, f / LEAD0);
      });
    }
  }

  // Original 2-bar vamps, 16th grid. Not a licensed track.
  const TITLE_LEAD = [
    659, 0, 784, 880, 0, 880, 1047, 0, 880, 784, 659, 0, 587, 659, 784, 0,
    523, 0, 659, 784, 0, 880, 784, 659, 587, 523, 440, 0, 523, 659, 784, 880,
  ];
  const TITLE_BASS = [
    110, 110, 130.8, 146.8, 164.8, 146.8, 130.8, 110,
    98, 98, 110, 123.5, 130.8, 146.8, 164.8, 110,
  ];
  const TITLE_BRASS = [
    0, 0, 0, 0, 261.6, 0, 0, 0, 0, 0, 0, 0, 329.6, 0, 0, 0,
    0, 0, 0, 0, 220, 0, 0, 0, 0, 0, 0, 0, 196, 0, 261.6, 0,
  ];
  const MENU_LEAD = [
    523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 784, 0, 880, 0, 0, 0,
    523, 0, 440, 0, 523, 0, 659, 0, 587, 523, 440, 392, 330, 0, 0, 0,
  ];
  const MENU_BASS = [
    110, 110, 82.4, 82.4, 110, 110, 98, 98,
    130.8, 130.8, 110, 110, 82.4, 82.4, 110, 110,
  ];

  function scheduleStep(track, step, when) {
    if (!samples || !musicGain) return;
    const dest = musicGain;
    const i = step % 32;
    playSample(samples.hat, when, 0.045, i % 2 === 0 ? 0.09 : 0.05, dest, i % 4 === 0 ? 1.15 : 1.4);
    if (i % 4 === 0) playSample(samples.kick, when, 0.14, 0.55, dest, 1);
    if (i % 8 === 4) playSample(samples.snare, when, 0.12, 0.42, dest, 1);
    if (i % 16 === 14) playSample(samples.kick, when, 0.1, 0.35, dest, 1.08);

    if (track === "title") {
      const lead = TITLE_LEAD[i];
      const bass = TITLE_BASS[Math.floor(i / 2) % TITLE_BASS.length];
      const brass = TITLE_BRASS[i];
      if (lead) playSample(samples.lead, when, SIXTEENTH * 1.35, 0.22, dest, lead / LEAD0);
      if (i % 2 === 0) playSample(samples.bass, when, SIXTEENTH * 2.1, 0.32, dest, bass / BASS0);
      if (brass) playSample(samples.brass, when, SIXTEENTH * 2.4, 0.2, dest, brass / BRASS0);
    } else {
      const lead = MENU_LEAD[i];
      const bass = MENU_BASS[Math.floor(i / 2) % MENU_BASS.length];
      if (lead) playSample(samples.lead, when, SIXTEENTH * 1.2, 0.16, dest, lead / LEAD0);
      if (i % 2 === 0) playSample(samples.bass, when, SIXTEENTH * 2.1, 0.28, dest, bass / BASS0);
      if (i % 8 === 0) playSample(samples.brass, when, SIXTEENTH * 3, 0.12, dest, 220 / BRASS0);
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
    if (name === "title") return 0.22;
    if (name === "menu" || name === "gameover") return 0.18;
    return 0.1;
  }

  function setMusic(track, level) {
    const lvl = level == null ? 0.18 : level;
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
    if (pageHidden()) pauseAttractClock();
    else resumeAttractClock();
    if (!audioCtx) return;
    // Only suspend the top-level page. A preview iframe often reports
    // hidden while the user is looking at it, which is what killed the
    // APU the instant PRESS START left the title screen.
    if (document.hidden && window.top === window) audioCtx.suspend();
    else audioCtx.resume();
  });

  // In-LCD attract: Mode 7-style perspective checkerboard at 256×224,
  // drawn only on the CRT. The PAL gray dogbone stays visible -- this is
  // not a fullscreen overlay. Silent. Idle 45s; any handleInput / on-screen
  // pad dismisses. Pauses when the tab is hidden (top-level only, same
  // iframe caveat as the APU). prefers-reduced-motion freezes the camera.
  const ATTRACT_W = 256;
  const ATTRACT_H = 224;
  const ATTRACT_IDLE_MS = 45000;
  const ATTRACT_TILE = 24;
  const attractReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const attractCtx = attractCanvas.getContext("2d", { alpha: false });
  const attractFrame = attractCtx.createImageData(ATTRACT_W, ATTRACT_H);
  const attractPix = new Uint32Array(attractFrame.data.buffer);

  let attractRunning = false;
  let attractRaf = 0;
  let attractTime = 0;
  let attractLast = 0;
  let idleTimer = 0;

  function packSnes(r, g, b) {
    r &= 248; g &= 248; b &= 248;
    r |= r >> 5; g |= g >> 5; b |= b >> 5;
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  // 15-bit SNES-ish pens, quantized from this theme's own family
  // (--snes-black/navy/gold/x/mist/white), not a Nintendo logo palette.
  const ATTR_SKY_TOP = packSnes(16, 20, 48);
  const ATTR_SKY_HORIZ = packSnes(232, 168, 56);
  const ATTR_SUN = packSnes(240, 200, 48);
  const ATTR_SUN_HALO = packSnes(232, 152, 48);
  const ATTR_STAR = packSnes(244, 244, 240);
  const ATTR_TILE_A = packSnes(28, 36, 48);
  const ATTR_TILE_B = packSnes(48, 96, 216);
  const ATTR_FOG = packSnes(200, 176, 120);

  function mixPack(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ar = a & 255, ag = (a >> 8) & 255, ab = (a >> 16) & 255;
    const br = b & 255, bg = (b >> 8) & 255, bb = (b >> 16) & 255;
    return packSnes(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
  }

  function pageHidden() {
    return document.hidden && window.top === window;
  }

  function drawMode7(t) {
    const reduce = attractReduce.matches;
    const yaw = reduce ? 0.55 : t * 0.18;
    const pitch = reduce ? 0.1 : Math.sin(t * 0.32) * 0.2;
    const roll = reduce ? 0 : Math.sin(t * 0.41) * 0.2;
    const horizon = (90 - pitch * 72) | 0;
    const camH = 42 + pitch * 16;
    const focal = 168;
    const camX = reduce ? 8 : t * 14;
    const camZ = reduce ? 32 : t * 20;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const sunX = 128 + cos * 36;
    const sunY = horizon - 26;
    const pix = attractPix;

    for (let y = 0; y < ATTRACT_H; y++) {
      const rowOff = y * ATTRACT_W;
      if (y <= horizon) {
        const u = horizon <= 0 ? 1 : y / horizon;
        const sky = mixPack(ATTR_SKY_TOP, ATTR_SKY_HORIZ, u * u);
        for (let x = 0; x < ATTRACT_W; x++) {
          const dx = x - sunX;
          const dy = y - sunY;
          const d2 = dx * dx + dy * dy;
          let c = sky;
          if (d2 < 72) c = ATTR_SUN;
          else if (d2 < 210) c = mixPack(ATTR_SUN_HALO, sky, (d2 - 72) / 138);
          else {
            let n = (x * 374761393 + y * 668265263) | 0;
            n = Math.imul(n ^ (n >>> 13), 1274126177);
            if (((n >>> 0) & 1023) < 2 && u < 0.72) c = ATTR_STAR;
          }
          pix[rowOff + x] = c;
        }
      } else {
        const row = y - horizon;
        const z = (camH * focal) / row;
        const scale = z / focal;
        const fog = Math.max(0, 1 - row / 108);
        const x0 = -128 + roll * row;
        let wx = camX + z * sin + x0 * scale * cos;
        let wz = camZ + z * cos - x0 * scale * sin;
        const dwx = scale * cos;
        const dwz = -scale * sin;
        for (let x = 0; x < ATTRACT_W; x++) {
          const tx = Math.floor(wx / ATTRACT_TILE);
          const tz = Math.floor(wz / ATTRACT_TILE);
          const tile = ((tx ^ tz) & 1) ? ATTR_TILE_B : ATTR_TILE_A;
          pix[rowOff + x] = mixPack(tile, ATTR_FOG, fog);
          wx += dwx;
          wz += dwz;
        }
      }
    }
    attractCtx.putImageData(attractFrame, 0, 0);
  }

  function tickAttract(now) {
    if (!attractRunning) return;
    if (pageHidden()) {
      attractRaf = 0;
      attractLast = 0;
      return;
    }
    if (attractLast) attractTime += Math.min(0.1, (now - attractLast) / 1000);
    attractLast = now;
    drawMode7(attractReduce.matches ? 2.8 : attractTime);
    if (attractReduce.matches) {
      attractRaf = 0;
      return;
    }
    attractRaf = requestAnimationFrame(tickAttract);
  }

  function showAttract() {
    if (attractRunning || pageHidden()) return;
    if (currentScreen === "boot") return;
    attractRunning = true;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    attractScreen.hidden = false;
    attractLast = 0;
    attractRaf = requestAnimationFrame(tickAttract);
  }

  function hideAttract() {
    const was = attractRunning;
    attractRunning = false;
    attractScreen.hidden = true;
    if (attractRaf) {
      cancelAnimationFrame(attractRaf);
      attractRaf = 0;
    }
    attractLast = 0;
    if (was) pingIdle();
  }

  function pingIdle() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    if (attractRunning) return;
    if (pageHidden()) return;
    if (currentScreen === "boot") return;
    idleTimer = window.setTimeout(showAttract, ATTRACT_IDLE_MS);
  }

  function pauseAttractClock() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    if (attractRaf) {
      cancelAnimationFrame(attractRaf);
      attractRaf = 0;
    }
    attractLast = 0;
  }

  function resumeAttractClock() {
    if (pageHidden()) return;
    if (attractRunning) {
      attractLast = 0;
      if (!attractRaf) attractRaf = requestAnimationFrame(tickAttract);
    } else {
      pingIdle();
    }
  }

  attractScreen.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    hideAttract();
  });
  if (attractReduce.addEventListener) {
    attractReduce.addEventListener("change", () => {
      if (!attractRunning) return;
      if (attractReduce.matches) {
        if (attractRaf) {
          cancelAnimationFrame(attractRaf);
          attractRaf = 0;
        }
        drawMode7(2.8);
      } else if (!attractRaf) {
        attractLast = 0;
        attractRaf = requestAnimationFrame(tickAttract);
      }
    });
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
  // reusable by any future console theme -- this section is only
  // rendering, input, and pacing, same split as shared/morph-game.js gets
  // from gb/app.js's MORPH! screen. "klax" stays the internal/file-level
  // codename (genre lineage, matches the shared engine's name). Super KAL-Q!
  // is the on-screen title on this cart, matching Super OQ!.
  //
  // Best-case 1992 cart: Mode 7 + HDMA on the conveyor (PPU), Super FX 2
  // on the rising sprite (continuous scale + tumble). Stacks stay Mode 1
  // so morpheme text stays readable. Palette still comes only from
  // --snes-* (tools/check_palette.py).
  const klaxCanvas = document.getElementById("klax-canvas");
  const klaxCtx = klaxCanvas.getContext("2d");
  klaxCtx.imageSmoothingEnabled = false;

  // The canvas can't reach CSS var(--snes-*) directly -- fillStyle wants a
  // literal color -- so this reads the theme's own declared palette once
  // via getComputedStyle instead of re-inventing hex for KAL-Q. That's the
  // actual fix for a canvas drifting into off-palette ("haram") colors: it
  // can't drift if it's never handed its own numbers to begin with, and
  // tools/check-palette.py enforces the same rule on every other literal.
  const snesVars = getComputedStyle(document.documentElement);
  const snesColor = (name) => snesVars.getPropertyValue(`--snes-${name}`).trim();
  function hexToRgbTriplet(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  // Mutable, not const: html.is-ntsc (the L+R region toggle) redefines
  // every --snes-* value to the NA-toaster purple palette live, and these
  // three need re-deriving from it or KAL-Q's canvas would keep rendering
  // pre-toggle colors until a reload. refreshKlaxColors() is the one place
  // that happens -- called once below, and again from toggleRegion().
  let KLAX_C, KLAX_TILE_COLOR, KLAX_CLEAR_COLOR;
  // Offscreen Mode 7 belt (64x64 riveted metal) and mosaic scratch.
  // Recreated from KLAX_C so L+R region toggle re-tints the conveyor.
  let klaxBelt = null;
  let klaxScratch = null;

  function makeKlaxBelt() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = KLAX_C.hud;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = KLAX_C.bg;
    for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1);
    g.fillStyle = KLAX_C.padDark;
    for (let x = 4; x < 64; x += 16) {
      for (let y = 4; y < 64; y += 16) g.fillRect(x, y, 2, 2);
    }
    g.fillStyle = "rgba(255,255,255,.12)";
    for (let x = 12; x < 64; x += 16) {
      for (let y = 12; y < 64; y += 16) g.fillRect(x, y, 1, 1);
    }
    klaxBelt = c;
    if (!klaxScratch) {
      klaxScratch = document.createElement("canvas");
      klaxScratch.width = 256;
      klaxScratch.height = 224;
    }
  }

  function refreshKlaxColors() {
    KLAX_C = {
      bg: snesColor("black"),
      hud: snesColor("navy"),
      ink: snesColor("navy"),
      paper: snesColor("white"),
      gold: snesColor("gold"),
      mist: snesColor("mist"),
      padDark: snesColor("pad-dark"),
    };

    KLAX_TILE_COLOR = {
      // Root and its correct/wrong affixes reuse the four SNES face-button
      // colors (rainbow Y/X/B/A, same rule the title wordmark follows) --
      // that's the whole rainbow this theme is allowed, so KAL-Q draws
      // from it instead of a made-up hue like the old off-palette purple
      // pill.
      root: snesColor("b"),
      "affix-correct": snesColor("y"),
      "affix-wrong": snesColor("a"),
      "power-lane": snesColor("x"),
      "power-screen": KLAX_C.paper,
      // 1-UP isn't one of the four button colors or the match/lane/screen
      // set above -- mist is already canon (used for hint text) and reads
      // as a fifth, distinct hue without adding a new one.
      "power-1up": KLAX_C.mist,
    };

    // rgb triplets (for rgba() strings) rather than more hex literals --
    // still every one of them sourced from KLAX_C/KLAX_TILE_COLOR above,
    // so there's still only one place this theme's colors are ever
    // spelled out.
    KLAX_CLEAR_COLOR = {
      match: hexToRgbTriplet(KLAX_C.paper),
      "power-lane": hexToRgbTriplet(KLAX_TILE_COLOR["power-lane"]),
      "power-screen": hexToRgbTriplet(KLAX_TILE_COLOR["power-screen"]),
    };
    makeKlaxBelt();
  }
  refreshKlaxColors();

  // 4x5 bitmap font -- drawn one fillRect per pixel, same technique as the
  // concept-art pass, so canvas text never falls back to anti-aliased
  // browser glyph rendering at this resolution.
  const KLAX_FONT = {
    " ": ["....", "....", "....", "....", "...."],
    "!": ["..#.", "..#.", "..#.", "....", "..#."],
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
  let klaxTumble = 0; // Super FX 2 rotation on the rising sprite
  let klaxBeltOff = 0; // Mode 7 belt scroll (scanline sample offset)
  let klaxHold = 0; // beat after catch/miss before the next tile rises
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

  // Mode 7 well: z=1.08 at the paddle (near, top of the well), z=3.35 at
  // the floor (far, spawn). Inverse-z maps engine y onto scanlines so more
  // of the CRT is spent near the catcher -- Super Mario Kart / F-Zero
  // floor math, not a linear trapezoid.
  const KLAX_Z_NEAR = 1.08;
  const KLAX_Z_FAR = 3.35;
  function klaxWellGeom(t) {
    const z = KLAX_Z_NEAR + t * (KLAX_Z_FAR - KLAX_Z_NEAR);
    const w = KLAX_WELL.w * (KLAX_Z_NEAR / z);
    return { z, w, x: 128 - w / 2, colW: w / KLAX_COLS };
  }
  function klaxWellFromY(y) {
    const z = KLAX_Z_FAR + y * (KLAX_Z_NEAR - KLAX_Z_FAR);
    const inv = 1 / z;
    const u = (inv - 1 / KLAX_Z_FAR) / (1 / KLAX_Z_NEAR - 1 / KLAX_Z_FAR);
    const py = KLAX_WELL.bottom + (KLAX_WELL.top - KLAX_WELL.bottom) * u;
    const t = (py - KLAX_WELL.top) / (KLAX_WELL.bottom - KLAX_WELL.top);
    return { py, t, ...klaxWellGeom(t) };
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
    klaxText("SUPER KAL-Q!", 128, 3, 1, KLAX_C.gold, "center");
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

    // Mode 7 conveyor -- one affine scanline per CRT row, receding toward
    // the floor. HDMA would have rewritten Mode 7's scale each line; here
    // that's klaxWellGeom(t). Super FX 2 does not draw the belt.
    const nearY = KLAX_WELL.top;
    const farY = KLAX_WELL.bottom;
    const hudRgb = hexToRgbTriplet(KLAX_C.hud);
    klaxCtx.imageSmoothingEnabled = false;
    for (let py = nearY; py < farY; py++) {
      const t = (py - nearY) / (farY - nearY);
      const g = klaxWellGeom(t);
      if (klaxBelt) {
        // srcY's growth rate is capped at 1 texel per scanline -- the old
        // 0.65+t*1.9 ramp topped out over 2.5 texels/row at the far end,
        // aliasing against the belt's 8px rivet stripes into a moire that
        // shimmered far faster than klaxBeltOff's own scroll ever moved.
        const srcY = Math.floor(py * (0.5 + t * 0.5) + klaxBeltOff) & 63;
        klaxCtx.drawImage(klaxBelt, 0, srcY, 64, 1, g.x, py, g.w, 1);
        // Fade toward the HUD navy as the belt recedes -- fog hides
        // whatever aliasing the capped ramp above doesn't, same trick a
        // real Mode 7 floor uses instead of fighting moire at the horizon.
        if (t > 0.45) {
          klaxCtx.fillStyle = `rgba(${hudRgb},${((t - 0.45) * 0.8).toFixed(2)})`;
          klaxCtx.fillRect(g.x, py, g.w, 1);
        }
      } else {
        klaxPx(g.x, py, g.w, 1, KLAX_C.hud);
      }
      for (let c = 1; c < KLAX_COLS; c++) {
        klaxPx(g.x + c * g.colW, py, 1, 1, "rgba(255,255,255,.10)");
      }
      klaxPx(g.x, py, 2, 1, KLAX_C.padDark);
      klaxPx(g.x + g.w - 2, py, 2, 1, KLAX_C.padDark);
    }
    klaxPx(KLAX_WELL.x, nearY, KLAX_WELL.w, 1, KLAX_C.gold);

    const gNear = klaxWellGeom(0);
    const wellColW = gNear.colW;

    if (state.active) {
      // Super FX 2 sprite: continuous 1/z scale + X-axis tumble. Not the
      // three baked LOD sizes a stock SNES cart would have used.
      const g = klaxWellFromY(state.active.y);
      const cx = g.x + (state.active.col + 0.5) * g.colW;
      const flip = Math.max(0.16, Math.abs(Math.cos(klaxTumble)));
      const tw = Math.max(8, g.colW - 5);
      const th = Math.max(3, tw * 0.48 * flip);
      const color = KLAX_TILE_COLOR[state.active.kind];
      klaxCtx.save();
      klaxCtx.translate(Math.round(cx), Math.round(g.py));
      klaxCtx.rotate(Math.sin(klaxTumble) * 0.12);
      klaxBevel(-tw / 2, -th / 2, tw, th, color, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      if (flip > 0.42) {
        // A tile spends most of its rise far from the paddle, where
        // klaxWellFromY's perspective shrinks tw to a handful of pixels --
        // nowhere near a full marker's width. Truncating to one letter
        // down there still read as blank to a player scanning past at a
        // glance, so instead this overlays a same-color plate sized to
        // the *text*, not the tile's own perspective-shrunk box: the
        // marker stays fully legible the entire climb, at the cost of the
        // plate occasionally reading larger than the "physical" tile
        // beneath it.
        const marker = state.active.marker;
        const textW = marker.length * 5 - 1; // klaxText's own width at scale 1
        const plateW = Math.max(tw, textW + 4);
        const plateH = Math.max(th, 7);
        klaxBevel(-plateW / 2, -plateH / 2, plateW, plateH, color, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
        klaxText(marker, 0, -2, 1, KLAX_C.ink, "center");
      } else {
        klaxPx(-tw / 2, -1, tw, 2, "rgba(255,255,255,.55)");
      }
      klaxCtx.restore();
    }

    // Paddle: always sits on the catch/place line -- it's the same spot
    // whether it's about to catch a rising tile or about to push a held
    // one up into the highlighted lane above. Only the highlight above
    // moves; the paddle doesn't need to travel between two positions.
    const paddleX = gNear.x + (klaxCol + 0.5) * wellColW;
    klaxBevel(paddleX - wellColW / 2 + 2, nearY - 6, wellColW - 4, 6, KLAX_C.paper, "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
    if (state.paddle.length) {
      // Up to paddleCap small color-coded chips show the whole LIFO
      // stack at a glance (oldest catch on the left); the readable one
      // with its text is the last one caught -- the tile place()/
      // discard() will actually act on next.
      const slotW = (wellColW - 6) / state.paddleCap;
      state.paddle.forEach((tile, i) => {
        const sx = paddleX - wellColW / 2 + 3 + i * slotW;
        klaxPx(sx, nearY - 10, slotW - 1, 7, KLAX_TILE_COLOR[tile.kind]);
      });
      const top = state.paddle[state.paddle.length - 1];
      klaxBevel(paddleX - wellColW / 2 + 3, nearY - 24, wellColW - 6, 12, KLAX_TILE_COLOR[top.kind], "rgba(255,255,255,.55)", "rgba(0,0,0,.4)");
      klaxText(top.marker, paddleX, nearY - 21, 1, KLAX_C.ink, "center");
    }

    // SNES mosaic register on miss/overflow -- PPU MOSAIC, not a fade.
    if (klaxFlash > 0 && klaxScratch) {
      const m = Math.max(1, Math.round(1 + klaxFlash * 18));
      const sw = Math.max(8, (256 / m) | 0);
      const sh = Math.max(8, (224 / m) | 0);
      const sctx = klaxScratch.getContext("2d");
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, 256, 224);
      sctx.drawImage(klaxCanvas, 0, 0, 256, 224, 0, 0, sw, sh);
      klaxCtx.drawImage(klaxScratch, 0, 0, sw, sh, 0, 0, 256, 224);
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
      klaxTumble += dt * 5.5;
      klaxBeltOff += dt * 9;
      if (klaxHold > 0) klaxHold -= dt;
      if (klaxFlash > 0) klaxFlash -= dt;
      if (klaxClearAnim) {
        klaxClearAnim.timeLeft -= dt;
        if (klaxClearAnim.timeLeft <= 0) klaxClearAnim = null;
      }
      if (klaxPopup) {
        klaxPopup.timeLeft -= dt;
        if (klaxPopup.timeLeft <= 0) klaxPopup = null;
      }
      if (klaxHold <= 0) {
        const result = klaxGame.tick(dt, klaxCol, klaxUpHeld ? KLAX_FAST_MULT : 1);
        if (result.event === "caught") {
          sfx(result.tile.kind === "power-lane" || result.tile.kind === "power-screen" ? "konami" : "move");
          klaxHold = 0.55;
        } else if (result.event === "missed") { klaxFlash = 0.12; sfx("back"); klaxHold = 0.7; }
      }
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
    if (!klaxGame) klaxGame = window.OqKlaxGame.createGame({
      puzzles: window.OqMorphPuzzles.puzzles,
      columns: KLAX_COLS,
      riseSpeed: 0.12,
    });
    klaxGame.start();
    klaxCol = 0;
    klaxFlash = 0;
    klaxClearAnim = null;
    klaxPopup = null;
    klaxUpHeld = false;
    klaxPaused = false;
    klaxTumble = 0;
    klaxBeltOff = 0;
    klaxHold = 0.45;
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
    pingIdle();
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

  function handleInput(action) {
    if (attractRunning) {
      hideAttract();
      return;
    }
    pingIdle();
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
      if (action === "select") {
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
    if (attractRunning) {
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
      if (event.key === "y" || event.key === "Y") keyMap[event.key] = "b";
      if (event.key === "a" || event.key === "A") keyMap[event.key] = "a";
      if (event.key === "b" || event.key === "B") keyMap[event.key] = "b";
    }
    if (!event.repeat) {
      const isL = event.key === "Tab" || event.key === "l" || event.key === "L";
      const isR = event.key === " " || event.key === "r" || event.key === "R";
      if (!inputFocused() && (isL || isR)) {
        if (shoulderDown(isL ? "l" : "r")) {
          event.preventDefault();
          return;
        }
        if (event.key === "l" || event.key === "L" || event.key === "r" || event.key === "R") {
          event.preventDefault();
          return;
        }
      }
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
    if (event.key === "Tab" || event.key === "l" || event.key === "L") shoulderUp("l");
    if (event.key === " " || event.key === "r" || event.key === "R") shoulderUp("r");
    if (event.key === "ArrowUp") klaxUpHeld = false;
  });

  document.getElementById("snes-controller").addEventListener("pointerdown", (event) => {
    const btn = event.target.closest("[data-input]");
    if (!btn) return;
    event.preventDefault();
    if (attractRunning) {
      hideAttract();
      return;
    }
    const raw = btn.dataset.input;
    if (raw === "l" || raw === "r") {
      try { btn.setPointerCapture(event.pointerId); } catch (err) { /* old browser */ }
      if (shoulderDown(raw)) return;
    }
    // Face diamond extras: X confirms like A, Y backs out like B.
    // Shoulders: L cycles (Select), R starts. Convenience mapping, not
    // a second set of verbs -- handleInput() still only sees the six
    // actions nes/ uses.
    const alias = { x: "a", y: "b", l: "select", r: "start" };
    const resolved = alias[raw] || raw;
    if (resolved === "up" && currentScreen === "klax") {
      // Same stuck fast-drop as c64/app.js: pointerup only clears the flag
      // when its target is still this button. Capture keeps it so.
      try { btn.setPointerCapture(event.pointerId); } catch (err) { /* old browser */ }
      klaxUpHeld = true;
    }
    handleInput(resolved);
  });
  window.addEventListener("pointerup", (event) => {
    const btn = event.target && event.target.closest && event.target.closest("[data-input]");
    const raw = (btn && btn.dataset.input) || "";
    if (raw === "l" || raw === "r") shoulderUp(raw);
    if (raw === "up") klaxUpHeld = false;
  });
  window.addEventListener("pointercancel", () => {
    klaxUpHeld = false;
    shoulderUp("l");
    shoulderUp("r");
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
  document.addEventListener("input", pingIdle, true);
  pingIdle();
})();
