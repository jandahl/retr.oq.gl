// Fullscreen screensaver host for vendored remakes.
// Auto-wires win31 / win98 / xp / win7 / kde / mac / amiga / next / dos / c64.
// Nested browsing contexts (live-preview iframes) composite child-iframe
// WebGL as black, so start() navigates this document with ?oqret= when
// nested. Top-level (GitHub Pages, Playwright) uses #oq-ss-overlay:
// unhide the overlay, then set iframe src so GL is not 0×0. ss-exit.js
// returns to the desk when ?oqret= is present.
(function (global) {
  const CSS = [
    "#oq-ss-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;background:#000;}",
    "#oq-ss-overlay[hidden]{display:none !important;}",
    "#oq-ss-overlay iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#000;pointer-events:none;}",
    ".icon-ss{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Crect width='16' height='16' fill='%23000000'/%3E%3Crect x='1' y='1' width='6' height='6' fill='%23c00000'/%3E%3Crect x='9' y='1' width='6' height='6' fill='%2300a000'/%3E%3Crect x='1' y='9' width='6' height='6' fill='%230000c0'/%3E%3Crect x='9' y='9' width='6' height='6' fill='%23c0c000'/%3E%3C/svg%3E\");}",
    ".start-menu-submenu{position:relative;overflow:visible;}",
    ".start-menu-submenu>.start-menu-item{width:100%;}",
    ".start-menu-caret{margin-left:auto;padding-left:0.75rem;}",
    "#start-menu{overflow:visible!important;}",
    ".start-menu-flyout,#start-menu ul[role=menu].start-menu-flyout{display:none;position:absolute!important;left:100%!important;right:auto!important;top:auto!important;bottom:0!important;z-index:20!important;margin:0!important;padding:3px!important;list-style:none;min-width:14rem!important;width:max-content!important;max-width:18rem;max-height:70vh!important;overflow-x:hidden!important;overflow-y:auto!important;height:auto!important;background:silver;box-shadow:inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff;}",
    ".start-menu-flyout .start-menu-item{display:flex;align-items:center;min-height:1.75rem;white-space:nowrap;}",
    ".start-menu-submenu:hover>.start-menu-flyout,.start-menu-submenu:focus-within>.start-menu-flyout,.start-menu-submenu.open>.start-menu-flyout{display:block!important;}",
    "body.theme-xp .start-menu-flyout{background:#fff!important;border:1px solid #0a4fc4;border-radius:0 3px 3px 0;box-shadow:2px 2px 6px rgba(0,0,0,.35),0 0 0 1px #7aa6ec!important;}",
    "body.theme-win7 .start-menu-flyout{background:rgba(245,249,255,.95)!important;border:1px solid rgba(255,255,255,.55);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,10,.4),inset 0 1px rgba(255,255,255,.6)!important;}",
    ".k-submenu>.k-menu{position:absolute!important;left:100%!important;top:auto!important;bottom:0!important;height:auto!important;min-width:14rem!important;width:max-content!important;max-height:70vh!important;overflow-x:hidden!important;overflow-y:auto!important;z-index:1003!important;}",
  ].join("");

  function attach(opts) {
    let idleMs = opts.idleMs == null ? 45000 : opts.idleMs;
    let src = opts.src;
    if (!document.getElementById("oq-ss-style")) {
      const style = document.createElement("style");
      style.id = "oq-ss-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    let overlay = document.getElementById("oq-ss-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "oq-ss-overlay";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "Screen saver");
      overlay.innerHTML = '<iframe title="Screen saver"></iframe>';
      document.body.appendChild(overlay);
    }
    const frame = overlay.querySelector("iframe");
    // Keep the preview document out of the render tree until it is actually
    // needed. This matters for themes that expose several WebGL savers but
    // only ever run one at a time.
    frame.loading = "lazy";
    let timer = 0;
    let running = false;
    let ignoreUntil = 0;
    let launchGeneration = 0;

    function layoutOverlay() {
      // win31/mac8/mac1984 set html { zoom }. style.width is pre-zoom and
      // gets multiplied on render; innerWidth/visualViewport are post-zoom.
      // inset:0 alone leaves a teal (or desktop) strip under the overlay.
      var z = parseFloat(getComputedStyle(document.documentElement).zoom);
      if (!isFinite(z) || z <= 0) z = 1;
      var vv = window.visualViewport;
      var top = vv ? vv.offsetTop : 0;
      var left = vv ? vv.offsetLeft : 0;
      var vw = vv && vv.width ? vv.width : window.innerWidth;
      var vh = vv && vv.height ? vv.height : window.innerHeight;
      overlay.style.top = top / z + "px";
      overlay.style.left = left / z + "px";
      overlay.style.width = vw / z + "px";
      overlay.style.height = vh / z + "px";
    }

    function nestedFrame() {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    }

    function stop(event) {
      if (event && running) {
        event.preventDefault();
        event.stopPropagation();
      }
      running = false;
      launchGeneration += 1;
      overlay.hidden = true;
      frame.removeAttribute("src");
      frame.setAttribute("aria-busy", "false");
      ping();
    }

    function resolveSrc() {
      return typeof src === "function" ? src() : src;
    }

    function returnUrl() {
      var path = location.pathname || "/";
      if (!/\/$/.test(path)) path = path.replace(/[^/]+$/, "");
      if (!path) path = "/";
      return path + "?nosplash=1";
    }

    function launchUrl() {
      var url = resolveSrc();
      var join = url.indexOf("?") >= 0 ? "&" : "?";
      return url + join + "oqret=" + encodeURIComponent(returnUrl());
    }

    function start() {
      // Nested browsing contexts (live-preview iframes, embeds) composite
      // child-iframe WebGL as black. Navigate this document instead.
      if (nestedFrame()) {
        location.href = launchUrl();
        return;
      }
      if (running) return;
      running = true;
      const generation = ++launchGeneration;
      clearTimeout(timer);
      ignoreUntil = Date.now() + 800;
      overlay.hidden = false;
      frame.setAttribute("aria-busy", "true");
      layoutOverlay();
      frame.removeAttribute("src");
      requestAnimationFrame(function () {
        if (!running || generation !== launchGeneration) return;
        requestAnimationFrame(function () {
          if (!running || generation !== launchGeneration) return;
          layoutOverlay();
          frame.src = resolveSrc();
        });
      });
    }

    function ping() {
      if (running) return;
      clearTimeout(timer);
      if (idleMs > 0) timer = window.setTimeout(start, idleMs);
    }

    function setSrc(next) {
      src = next;
      if (running && !nestedFrame()) frame.src = resolveSrc();
    }
    function setIdleMs(next) {
      idleMs = Math.max(0, Number(next) || 0);
      ping();
    }

    function destroy() {
      clearTimeout(timer);
      running = false;
      launchGeneration += 1;
      overlay.hidden = true;
      frame.removeAttribute("src");
      frame.setAttribute("aria-busy", "false");
    }

    function tapOut(event) {
      if (Date.now() < ignoreUntil) return;
      stop(event);
    }
    overlay.addEventListener("pointerdown", tapOut);
    overlay.addEventListener("click", tapOut);
    overlay.addEventListener("touchstart", tapOut, { passive: false });
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow.dispatchEvent(new Event("resize"));
      } catch (e) {}
    });
    window.addEventListener("resize", layoutOverlay);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layoutOverlay);
      window.visualViewport.addEventListener("scroll", layoutOverlay);
    }
    window.addEventListener("keydown", (event) => {
      if (running) stop(event);
      else ping();
    }, true);
    window.addEventListener("pointerdown", ping, true);
    window.addEventListener("pointermove", ping, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer);
      else ping();
    });
    ping();
    const api = { start, stop, setSrc, setIdleMs, ping, launchUrl, destroy };
    global.OqScreensaver = global.OqScreensaver || { attach };
    global.OqScreensaver.host = api;
    return api;
  }

  function vendor(name) {
    var bust = name === "maze-backrooms" ? "?v=14" : name === "backrooms-ii" ? "?v=6" : name === "flying-windows" ? "?v=ss5" : "?v=ss4";
    return "../vendor/screensavers/" + name + "/index.html" + bust;
  }

  function catalogEntries(theme, fallback) {
    if (global.OqScreenSaverCatalog) {
      var byId = Object.fromEntries(global.OqScreenSaverCatalog.forTheme(theme).map(function (entry) {
        return [entry.id, entry];
      }));
      // Keep each desktop's established historical menu order while taking
      // labels and membership from the shared catalog.
      return fallback.filter(function (entry) { return byId[entry[0]]; }).map(function (entry) {
        return [entry[0], byId[entry[0]].label];
      });
    }
    return fallback;
  }

  function themeKey() {
    const p = location.pathname;
    if (p.includes("/win31/")) return "win31";
    if (p.includes("/win98/")) return "win98";
    if (p.includes("/win7/")) return "win7";
    if (p.includes("/xp/")) return "xp";
    if (p.includes("/mac1984/")) return "mac1984";
    if (p.includes("/mac8/")) return "mac8";
    if (p.includes("/aqua/")) return "aqua";
    if (p.includes("/kde/")) return "kde";
    if (p.includes("/amiga/")) return "amiga";
    if (p.includes("/next/")) return "next";
    if (p.includes("/dos/")) return "dos";
    if (p.includes("/c64/")) return "c64";
    return null;
  }

  function saverFlyout(menu) {
    let wrap = menu.querySelector("#start-ss-submenu");
    if (wrap) return wrap.querySelector(".start-menu-flyout");
    wrap = document.createElement("li");
    wrap.id = "start-ss-submenu";
    wrap.className = "start-menu-submenu";
    const parent = document.createElement("div");
    parent.setAttribute("role", "menu-item");
    parent.className = "start-menu-item";
    parent.setAttribute("aria-haspopup", "true");
    const icon = document.createElement("span");
    icon.className = "start-menu-icon icon-ss";
    icon.setAttribute("aria-hidden", "true");
    const caret = document.createElement("span");
    caret.className = "start-menu-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "\u25B8";
    parent.append(icon, document.createTextNode(" Screen Savers"), caret);
    parent.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.toggle("open");
    });
    const fly = document.createElement("ul");
    fly.className = "start-menu-flyout";
    fly.setAttribute("role", "menu");
    wrap.append(parent, fly);
    const about = menu.querySelector('[data-open="win-about"]');
    if (about) menu.insertBefore(wrap, about);
    else {
      const shutdown = menu.querySelector("#start-menu-shutdown");
      if (shutdown) menu.insertBefore(wrap, shutdown);
      else menu.appendChild(wrap);
    }
    return fly;
  }

  function addStartItem(menu, label, onClick) {
    if (!menu) return;
    const fly = saverFlyout(menu);
    const item = document.createElement("li");
    item.setAttribute("role", "menu-item");
    item.className = "start-menu-item";
    const icon = document.createElement("span");
    icon.className = "start-menu-icon icon-ss";
    icon.setAttribute("aria-hidden", "true");
    item.append(icon, document.createTextNode(" " + label));
    item.addEventListener("click", () => {
      menu.hidden = true;
      const wrap = menu.querySelector("#start-ss-submenu");
      if (wrap) wrap.classList.remove("open");
      onClick();
    });
    fly.appendChild(item);
  }

  function bindAccessory(el, start) {
    if (!el) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    el.addEventListener("click", () => {
      if (coarse) start();
    });
    if (!coarse) el.addEventListener("dblclick", start);
  }

  function boot() {
    const theme = themeKey();
    if (!theme) return;
    document.body.classList.add("theme-" + theme);

    if (theme === "win31") {
      const host = attach({ src: vendor("flying-windows"), idleMs: 45000 });
      const group = document.querySelector("#win-group-acc .group-icons");
      const win31Ids = {
        "flying-windows": "acc-ss",
        mystify: "acc-ss-mystify",
        starfield: "acc-ss-starfield",
        marquee: "acc-ss-marquee",
        beziers: "acc-ss-beziers",
        "flying-toasters": "acc-ss-toasters",
      };
      const savers = catalogEntries("win31", [
        ["flying-windows", "Flying Windows"],
        ["mystify", "Mystify"],
        ["starfield", "Starfield"],
        ["marquee", "Marquee"],
        ["beziers", "Beziers"],
        ["flying-toasters", "Flying Toasters"],
      ]).map(function (entry) {
        return [win31Ids[entry[0]], entry[1], entry[0]];
      });
      savers.forEach(function (row) {
        const id = row[0];
        const label = row[1];
        const name = row[2];
        if (!group || document.getElementById(id)) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "prog-icon";
        btn.id = id;
        btn.innerHTML =
          '<span class="prog-icon-glyph icon-ss" aria-hidden="true"></span>' +
          '<span class="prog-icon-label">' + label + "</span>";
        const about = document.getElementById("acc-about");
        if (about) group.insertBefore(btn, about);
        else group.appendChild(btn);
        bindAccessory(btn, function () {
          host.setSrc(vendor(name));
          host.start();
        });
      });
      return;
    }

    if (theme === "win98") {
      const host = attach({ src: vendor("aquarium"), idleMs: 45000 });
      const menu = document.getElementById("start-menu");
      const extra = document.createElement("script");
      extra.src = "start-extra.js?v=1";
      extra.onload = function () {
        if (window.OqWin98Start) window.OqWin98Start(menu);
      };
      document.head.appendChild(extra);
      addStartItem(menu, "Aquarium", () => {
        host.setSrc(vendor("aquarium"));
        host.start();
      });
      addStartItem(menu, "3D Pipes", () => {
        host.setSrc(vendor("pipes"));
        host.start();
      });
      addStartItem(menu, "3D Maze", () => {
        host.setSrc(vendor("maze"));
        host.start();
      });
      addStartItem(menu, "Backrooms", () => {
        host.setSrc(vendor("maze-backrooms"));
        host.start();
      });
      return;
    }

    if (theme === "xp") {
      const host = attach({ src: vendor("pipes"), idleMs: 45000 });
      const menu = document.getElementById("start-menu");
      addStartItem(menu, "3D Pipes", () => {
        host.setSrc(vendor("pipes"));
        host.start();
      });
      addStartItem(menu, "Backrooms II", () => {
        host.setSrc(vendor("backrooms-ii"));
        host.start();
      });
      return;
    }

    if (theme === "win7") {
      const host = attach({ src: vendor("maze"), idleMs: 45000 });
      addStartItem(document.getElementById("start-menu"), "3D Maze", () => {
        host.setSrc(vendor("maze"));
        host.start();
      });
      return;
    }

    if (theme === "kde") {
      var kdeGl = catalogEntries("kde", [
        ["flux", "Flux (GL)"],
        ["euphoria", "Euphoria (GL)"],
        ["solarwinds", "Solar Winds (GL)"],
        ["helios", "Helios (GL)"],
        ["lattice", "Lattice (GL)"],
        ["hyperspace", "Hyperspace (GL)"],
        ["cyclone", "Cyclone (GL)"],
        ["fieldlines", "Field Lines (GL)"],
        ["flocks", "Flocks (GL)"],
        ["pixelcity", "Pixel City (GL)"],
        ["lorenz", "Lorenz (GL)"],
        ["glmatrix", "GL Matrix (GL)"],
        ["skyrocket", "Skyrocket (GL)"]
      ]);
      var host = attach({
        src: function () {
          return vendor(kdeGl[Math.floor(Math.random() * kdeGl.length)][0]);
        },
        idleMs: 45000
      });
      global.OqScreensaver.kde = host;
      return;
    }
    if (theme === "mac8") {
      attach({ src: vendor("afterdark-night"), idleMs: 45000 });
      return;
    }
    if (theme === "aqua") {
      // Early OS X Screen Effects: abstract GL savers (flux / field lines /
      // solar winds) — period-plausible, no trademarked Apple Flurry clones.
      var aquaGl = catalogEntries("aqua", [
        ["flux", "Flux"], ["fieldlines", "Field Lines"], ["solarwinds", "Solar Winds"]
      ]).map(function (entry) { return entry[0]; });
      var aquaReduced = false;
      try {
        aquaReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}
      var aquaHost = attach({
        src: function () {
          return vendor(aquaGl[Math.floor(Math.random() * aquaGl.length)]);
        },
        // Peers use 45s; Aqua idles a bit longer (~75s). Reduced motion → no idle.
        idleMs: aquaReduced ? 0 : 75000
      });
      global.OqScreensaver.aqua = aquaHost;
      return;
    }
    if (theme === "mac1984") {
      attach({ src: vendor("mac-stars"), idleMs: 45000 });
      return;
    }
    if (theme === "amiga") {
      attach({ src: vendor("boing"), idleMs: 45000 });
      return;
    }
    if (theme === "next") {
      attach({ src: vendor("backspace"), idleMs: 45000 });
      return;
    }
    if (theme === "dos") {
      attach({ src: vendor("cga-stars"), idleMs: 45000 });
      return;
    }
    if (theme === "c64") {
      attach({ src: vendor("raster-stars"), idleMs: 45000 });
      return;
    }
  }

  global.OqScreensaver = global.OqScreensaver || { attach };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
