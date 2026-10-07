(() => {
  "use strict";

  // Time Machine–inspired OS X era switcher (visual skins only).
  // Persists html[data-osx-era] via localStorage key retr-oq:aqua-osx-era.
  // Galaxy: original canvas 2D star-tunnel / nebula (not Apple TM art).

  const ERA_KEY = "retr-oq:aqua-osx-era";
  const ERAS = [
    {
      id: "aqua",
      year: "2001",
      name: "Aqua",
      blurb: "Cheetah–Puma jelly & shelf Dock",
    },
    {
      id: "tiger",
      year: "2005",
      name: "Tiger",
      blurb: "Unified toolbar · metal-ish chrome",
    },
    {
      id: "leopard",
      year: "2007",
      name: "Leopard",
      blurb: "Dark menubar · reflective Dock",
    },
    {
      id: "lion",
      year: "2011",
      name: "Lion",
      blurb: "Peak skeuomorphism · linen & leather",
    },
    {
      id: "yosemite",
      year: "2014",
      name: "Yosemite",
      blurb: "Translucent flat · vibrancy blur",
    },
    {
      id: "bigsur",
      year: "2020",
      name: "Big Sur",
      blurb: "Rounder chrome · dense translucency",
    },
    {
      id: "glass",
      year: "2026",
      name: "Glassholism",
      blurb: "Maximal liquid glass · frost & bloom",
    },
  ];

  const ERA_IDS = new Set(ERAS.map((e) => e.id));

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readStoredEra() {
    try {
      const v = localStorage.getItem(ERA_KEY);
      if (ERA_IDS.has(v)) return v;
    } catch {
      /* ignore */
    }
    return "aqua";
  }

  function writeStoredEra(id) {
    try {
      localStorage.setItem(ERA_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function applyEra(id, { persist = false } = {}) {
    const era = ERA_IDS.has(id) ? id : "aqua";
    document.documentElement.dataset.osxEra = era;
    window.dispatchEvent(new CustomEvent("oq:aqua-era-change", { detail: era }));
    if (persist) writeStoredEra(era);
    return era;
  }

  function currentEra() {
    const d = document.documentElement.dataset.osxEra;
    return ERA_IDS.has(d) ? d : "aqua";
  }

  // Ensure attribute exists even if boot script missed (tests / odd loads).
  if (!document.documentElement.dataset.osxEra) {
    applyEra(readStoredEra());
  }

  const overlay = document.getElementById("tm-overlay");
  const timeline = document.getElementById("tm-timeline");
  const scrubThumb = document.getElementById("tm-scrubber-thumb");
  const labelEl = document.getElementById("tm-era-label");
  const btnPrev = document.getElementById("tm-prev");
  const btnNext = document.getElementById("tm-next");
  const btnRestore = document.getElementById("tm-restore");
  const btnCancel = document.getElementById("tm-cancel");
  const menuItem = document.getElementById("menu-time-machine");
  const dockItem = document.getElementById("dock-timemachine");
  const galaxyCanvas = document.getElementById("tm-galaxy");

  if (!overlay || !timeline) return;

  /** @type {string} */
  let eraBeforeOpen = "aqua";
  /** @type {number} */
  let selectedIndex = 0;
  let open = false;
  let transitioning = false;

  /* ---------- Galaxy (canvas 2D star tunnel + nebula dust) ---------- */
  const galaxy = (() => {
    if (!galaxyCanvas || !galaxyCanvas.getContext) {
      return { start() {}, stop() {}, paintStatic() {} };
    }
    const ctx = galaxyCanvas.getContext("2d", { alpha: false });
    /** @type {number|null} */
    let raf = null;
    let running = false;
    let lastTs = 0;
    let rot = 0;
    /** @type {{x:number,y:number,z:number,r:number,g:number,b:number,s:number}[]} */
    let stars = [];
    /** @type {{x:number,y:number,z:number,hue:number,sat:number,size:number}[]} */
    let dust = [];
    const DEPTH = 1;
    const STAR_COUNT = 380;
    const DUST_COUNT = 48;

    function rand(a, b) {
      return a + Math.random() * (b - a);
    }

    function resetStar(s, far) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.55) * 1.15;
      s.x = Math.cos(angle) * radius;
      s.y = Math.sin(angle) * radius * 0.72;
      s.z = far ? rand(0.55, DEPTH) : DEPTH;
      // Colorful dust: whites, gold, pink, teal, soft violet — original palette.
      const tint = Math.random();
      if (tint < 0.34) {
        s.r = 245;
        s.g = 248;
        s.b = 255;
      } else if (tint < 0.52) {
        s.r = 255;
        s.g = 210;
        s.b = 140; // gold
      } else if (tint < 0.7) {
        s.r = 255;
        s.g = 150;
        s.b = 210; // pink
      } else if (tint < 0.86) {
        s.r = 120;
        s.g = 235;
        s.b = 230; // teal
      } else {
        s.r = 200;
        s.g = 160;
        s.b = 255; // violet
      }
      s.s = rand(0.55, 1.7);
    }

    function resetDust(d, far) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(0.05, 0.95);
      d.x = Math.cos(angle) * radius;
      d.y = Math.sin(angle) * radius * 0.55;
      d.z = far ? rand(0.35, DEPTH) : DEPTH;
      // Nebula bands: pink / purple / teal / gold.
      const band = Math.random();
      if (band < 0.28) d.hue = rand(320, 350); // pink–magenta
      else if (band < 0.55) d.hue = rand(265, 300); // purple
      else if (band < 0.8) d.hue = rand(165, 195); // teal
      else d.hue = rand(38, 52); // gold
      d.sat = rand(55, 90);
      d.size = rand(100, 280);
    }

    function seed() {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const s = { x: 0, y: 0, z: 0, r: 255, g: 255, b: 255, s: 1 };
        resetStar(s, true);
        stars.push(s);
      }
      dust = [];
      for (let i = 0; i < DUST_COUNT; i++) {
        const d = { x: 0, y: 0, z: 0, hue: 240, sat: 50, size: 120 };
        resetDust(d, true);
        dust.push(d);
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, overlay.clientWidth || window.innerWidth);
      const h = Math.max(1, overlay.clientHeight || window.innerHeight);
      galaxyCanvas.width = Math.round(w * dpr);
      galaxyCanvas.height = Math.round(h * dpr);
      galaxyCanvas.style.width = w + "px";
      galaxyCanvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFrame(dt, animate) {
      const w = overlay.clientWidth || window.innerWidth;
      const h = overlay.clientHeight || window.innerHeight;
      const cx = w * 0.5;
      const cy = h * 0.48;
      const focal = Math.min(w, h) * 0.55;

      // Deep space wash — purple core into teal rim (colorful, not cool-grey).
      const bg = ctx.createRadialGradient(cx, cy + h * 0.12, 0, cx, cy, Math.max(w, h) * 0.9);
      bg.addColorStop(0, "#2a1040");
      bg.addColorStop(0.35, "#160a2a");
      bg.addColorStop(0.7, "#081428");
      bg.addColorStop(1, "#03040c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Fixed nebula blotches (pink / purple / teal / gold) — soft bloom.
      const blotches = [
        { x: -0.3, y: -0.2, r: 0.48, c0: "rgba(255, 90, 170, 0.34)", c1: "rgba(255, 90, 170, 0)" },
        { x: 0.34, y: -0.14, r: 0.44, c0: "rgba(150, 70, 255, 0.3)", c1: "rgba(150, 70, 255, 0)" },
        { x: 0.08, y: 0.3, r: 0.55, c0: "rgba(40, 210, 200, 0.26)", c1: "rgba(40, 210, 200, 0)" },
        { x: -0.12, y: 0.18, r: 0.36, c0: "rgba(255, 190, 70, 0.2)", c1: "rgba(255, 190, 70, 0)" },
        { x: 0.22, y: 0.05, r: 0.3, c0: "rgba(255, 120, 200, 0.18)", c1: "rgba(255, 120, 200, 0)" },
      ];
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      for (const b of blotches) {
        const bx = b.x * cosR - b.y * sinR;
        const by = b.x * sinR + b.y * cosR;
        const px = cx + bx * w * 0.55;
        const py = cy + by * h * 0.55;
        const rad = Math.min(w, h) * b.r;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, b.c0);
        g.addColorStop(1, b.c1);
        ctx.fillStyle = g;
        ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }

      // Calm galactic crawl — no spin. Reduced motion = fully static.
      const speed = animate ? (prefersReducedMotion() ? 0 : 0.0012) : 0;
      const rotSpeed = 0; // kill rotation (was dizzying); blotches stay fixed
      if (animate) rot += rotSpeed * dt;

      // Nebula dust slabs — drift even slower than stars; soft colorful blobs.
      for (const d of dust) {
        if (animate) {
          d.z -= speed * 0.25 * dt * 0.016;
          if (d.z <= 0.04) resetDust(d, false);
        }
        const z = Math.max(0.04, d.z);
        const rx = d.x * cosR - d.y * sinR;
        const ry = d.x * sinR + d.y * cosR;
        const k = focal / z;
        const px = cx + rx * k;
        const py = cy + ry * k * 0.9;
        const size = (d.size * focal) / (z * 160);
        const alpha = Math.min(0.48, 0.12 + (1 - z) * 0.4);
        const g = ctx.createRadialGradient(px, py, 0, px, py, size);
        g.addColorStop(0, `hsla(${d.hue}, ${d.sat}%, 68%, ${alpha})`);
        g.addColorStop(0.4, `hsla(${d.hue + 12}, ${d.sat - 5}%, 55%, ${alpha * 0.45})`);
        g.addColorStop(1, `hsla(${d.hue}, 45%, 35%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px, py, size, size * 0.58, rot * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stars — very slow radial crawl toward the viewer (no streaks).
      for (const s of stars) {
        if (animate) {
          s.z -= speed * dt * 0.016;
          if (s.z <= 0.02) resetStar(s, false);
        }
        const z = Math.max(0.02, s.z);
        const rx = s.x * cosR - s.y * sinR;
        const ry = s.x * sinR + s.y * cosR;
        const k = focal / z;
        const px = cx + rx * k;
        const py = cy + ry * k * 0.9;
        if (px < -20 || py < -20 || px > w + 20 || py > h + 20) continue;
        const size = Math.max(0.45, (s.s * focal) / (z * 400));
        const alpha = Math.min(1, 0.3 + (1 - z) * 0.9);
        // Soft bloom halo (colorful dust feel).
        if (size > 1.1 && !prefersReducedMotion()) {
          const bloom = ctx.createRadialGradient(px, py, 0, px, py, size * 3.2);
          bloom.addColorStop(0, `rgba(${s.r},${s.g},${s.b},${alpha * 0.35})`);
          bloom.addColorStop(1, `rgba(${s.r},${s.g},${s.b},0)`);
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(px, py, size * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Points only — no motion-blur streaks (dizzying).
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Soft vignette (keep nebula colors visible in the mid-field).
      const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.78);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.48)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    function tick(ts) {
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(48, ts - lastTs);
      lastTs = ts;
      drawFrame(dt, true);
      raf = window.requestAnimationFrame(tick);
    }

    function paintStatic() {
      resize();
      if (!stars.length) seed();
      drawFrame(16, false);
    }

    function start() {
      if (running) return;
      resize();
      if (!stars.length) seed();
      running = true;
      lastTs = 0;
      // Reduced motion: still paint, but almost frozen (tiny drift).
      raf = window.requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (raf != null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
      lastTs = 0;
    }

    window.addEventListener("resize", () => {
      if (!open && !running) return;
      resize();
      if (!running) paintStatic();
    });

    // Prefer-reduced-motion changes mid-session: keep loop but drawFrame dials speed.
    try {
      window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
        if (running) {
          /* speed read live via prefersReducedMotion() */
        }
      });
    } catch {
      /* older Safari */
    }

    return { start, stop, paintStatic };
  })();

  function indexOfEra(id) {
    const i = ERAS.findIndex((e) => e.id === id);
    return i >= 0 ? i : 0;
  }

  function setSelected(index, { preview = true } = {}) {
    selectedIndex = Math.max(0, Math.min(ERAS.length - 1, index));
    const era = ERAS[selectedIndex];
    const cards = timeline.querySelectorAll(".tm-era-card");
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selectedIndex);
      card.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
    });
    if (scrubThumb) {
      const pct = ERAS.length <= 1 ? 0 : (selectedIndex / (ERAS.length - 1)) * 100;
      scrubThumb.style.left = pct + "%";
    }
    if (labelEl) {
      labelEl.textContent = era.year + " — " + era.name + " · " + era.blurb;
    }
    // Live skin + #tm-oq-preview (inherits via html[data-osx-era] CSS variables).
    if (preview) applyEra(era.id, { persist: false });
  }

  function buildCards() {
    timeline.textContent = "";
    ERAS.forEach((era, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tm-era-card";
      btn.dataset.era = era.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", era.name + " " + era.year);
      btn.innerHTML =
        '<span class="tm-era-preview" aria-hidden="true"></span>' +
        '<span class="tm-era-meta">' +
        '<span class="tm-era-year">' +
        era.year +
        "</span>" +
        '<span class="tm-era-name">' +
        era.name +
        "</span>" +
        "</span>";
      btn.addEventListener("click", () => setSelected(i));
      btn.addEventListener("dblclick", () => {
        setSelected(i);
        restore();
      });
      timeline.appendChild(btn);
    });
  }


  // OQ! chrome preview: fill sample rows from the merged dict when available
  // (Chicago + katersat via OqDictMerge), else Chicago-only. Load once on first open.
  let oqPreviewLoaded = false;
  let oqPreviewLoading = false;

  // Jan's preferred demo set (may include katersat-only / empty-english rows).
  const TM_PREFERRED_LEXEMES = ["kujannippoq", "qulluk", "usuk", "aalajavoq"];

  function tmPreviewTbody() {
    return document.querySelector("#tm-oq-preview .oq-table tbody");
  }

  function tmPreviewStatus() {
    return document.querySelector("#tm-oq-preview .tm-oq-preview-status");
  }

  /** Short Chicago-style samples (3–14 chars, non-empty gloss); take up to `limit`. */
  function pickShortSamples(entries, limit, skipKeys) {
    const out = [];
    const skip = skipKeys || new Set();
    for (const e of entries) {
      const lex = (e && e.lexeme ? String(e.lexeme) : "").trim();
      const gloss = (e && e.gloss_en ? String(e.gloss_en) : "").trim();
      if (!lex || !gloss) continue;
      if (lex.length < 3 || lex.length > 14) continue;
      const key = lex.toLowerCase();
      if (skip.has(key)) continue;
      out.push({ lexeme: lex, gloss_en: gloss });
      if (out.length >= limit) break;
    }
    return out;
  }

  /**
   * Prefer Jan's four when present in the merged set (empty gloss_en ok —
   * e.g. aalajavoq). Otherwise fall back to short Chicago samples.
   */
  function pickPreviewEntries(entries) {
    const byKey = new Map();
    for (const e of entries || []) {
      const lex = (e && e.lexeme ? String(e.lexeme) : "").trim();
      if (!lex) continue;
      const key = lex.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, e);
    }
    const preferred = [];
    const used = new Set();
    for (const want of TM_PREFERRED_LEXEMES) {
      const e = byKey.get(want);
      if (!e) continue;
      const lex = String(e.lexeme).trim();
      const gloss = e.gloss_en != null ? String(e.gloss_en).trim() : "";
      preferred.push({ lexeme: lex, gloss_en: gloss });
      used.add(want);
    }
    if (preferred.length >= 4) return preferred.slice(0, 4);
    const need = 4 - preferred.length;
    const fillers = pickShortSamples(entries, need, used);
    return preferred.concat(fillers).slice(0, 4);
  }

  function renderPreviewRows(rows) {
    const tbody = tmPreviewTbody();
    if (!tbody) return;
    tbody.textContent = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      const tdLex = document.createElement("td");
      const tdGloss = document.createElement("td");
      tdLex.textContent = row.lexeme;
      tdGloss.textContent = row.gloss_en;
      tr.append(tdLex, tdGloss);
      tbody.appendChild(tr);
    }
  }

  function fillOqPreviewFromDict() {
    if (oqPreviewLoaded || oqPreviewLoading) return;
    const status = tmPreviewStatus();
    const src = window.OqDictSource;
    if (!src || typeof src.loadDictEntries !== "function") {
      if (status) status.textContent = "Dictionary unavailable.";
      renderPreviewRows([]);
      return;
    }
    oqPreviewLoading = true;
    if (status) status.textContent = "Loading dictionary…";

    src
      .loadDictEntries()
      .then((entries) => {
        const list = Array.isArray(entries) ? entries : [];
        const sample = pickPreviewEntries(list);
        renderPreviewRows(sample);
        oqPreviewLoaded = true;
        if (status) {
          const n = sample.length;
          const total = list.length;
          const kat =
            typeof src.wasKatersatLoaded === "function" && src.wasKatersatLoaded();
          const tag = kat ? "merged sample" : "dictionary sample";
          let line =
            n === 0
              ? "No sample lexemes."
              : `${n} of ${total.toLocaleString()} · ${tag}`;
          line += kat ? " · Chicago + katersat" : " · Chicago";
          status.textContent = line;
        }
      })
      .catch((err) => {
        renderPreviewRows([]);
        if (status) {
          const msg = err && err.message ? String(err.message) : "load failed";
          status.textContent = `Could not load dictionary (${msg}).`;
        }
      })
      .finally(() => {
        oqPreviewLoading = false;
      });
  }

  function openTM() {
    if (open || transitioning) return;
    eraBeforeOpen = currentEra();
    open = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    // Preview is display-only chrome — never treat as an unfocused WM window.
    const previewEl = document.getElementById("tm-oq-preview");
    if (previewEl) {
      previewEl.classList.remove("inactive");
      previewEl.classList.add("is-focused");
    }
    setSelected(indexOfEra(eraBeforeOpen), { preview: true });
    {
      const tmPreview = document.getElementById("tm-oq-preview");
      if (tmPreview) {
        tmPreview.classList.add("is-focused");
        tmPreview.classList.remove("inactive");
      }
    }
    galaxy.start();
    fillOqPreviewFromDict();
    // Focus selected card for keyboard.
    const sel = timeline.querySelector(".tm-era-card.is-selected");
    if (sel) sel.focus();
  }

  function closeOverlay() {
    open = false;
    galaxy.stop();
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("tm-transitioning");
  }

  function cancel() {
    if (!open || transitioning) return;
    applyEra(eraBeforeOpen, { persist: false });
    closeOverlay();
  }

  function restore() {
    if (!open || transitioning) return;
    const era = ERAS[selectedIndex];
    applyEra(era.id, { persist: true });
    if (prefersReducedMotion()) {
      closeOverlay();
      return;
    }
    transitioning = true;
    document.documentElement.classList.add("tm-transitioning");
    const done = () => {
      transitioning = false;
      closeOverlay();
    };
    // Match CSS animation length (~700ms).
    window.setTimeout(done, 720);
  }

  buildCards();

  menuItem?.querySelector("a")?.addEventListener("click", (event) => {
    event.preventDefault();
    openTM();
  });

  dockItem?.addEventListener("click", (event) => {
    event.preventDefault();
    openTM();
  });

  btnPrev?.addEventListener("click", () => setSelected(selectedIndex - 1));
  btnNext?.addEventListener("click", () => setSelected(selectedIndex + 1));
  btnRestore?.addEventListener("click", () => restore());
  btnCancel?.addEventListener("click", () => cancel());

  window.addEventListener(
    "keydown",
    (event) => {
      // ⌥⌘T — open Time Machine when not already in an input.
      if (
        !open &&
        !transitioning &&
        event.key.toLowerCase() === "t" &&
        event.altKey &&
        (event.metaKey || event.ctrlKey) &&
        !event.target.closest("input, textarea, select, [contenteditable]")
      ) {
        event.preventDefault();
        openTM();
        return;
      }
      if (!open || transitioning) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelected(selectedIndex - 1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelected(selectedIndex + 1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        restore();
      }
    },
    true,
  );

  // Public test / debug hook
  window.__aquaTimeMachine = {
    open: openTM,
    cancel,
    restore,
    applyEra,
    readStoredEra,
    eras: ERAS.slice(),
    get selected() {
      return ERAS[selectedIndex] && ERAS[selectedIndex].id;
    },
    get isOpen() {
      return open;
    },
  };
})();
