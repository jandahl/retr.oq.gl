// Renders the hub tiles from window.OqHubMachines (hub-data.js, loaded
// first) and runs the boot-screen intro. Classic script, not a module --
// same load-order convention as the theme app.js files.
(function () {
  "use strict";

  // Single source of truth for how long the boot screen holds before the
  // hub is revealed. Set as a CSS custom property so the fade animation's
  // duration and this timeout can never drift apart into two numbers that
  // used to match.
  var BOOT_SCREEN_MS = 700;
  document.documentElement.style.setProperty(
    "--boot-duration",
    BOOT_SCREEN_MS + "ms"
  );

  function renderTile(machine) {
    var li = document.createElement("li");
    li.className = "entry";

    var a = document.createElement("a");
    a.className = "tile";
    a.href = machine.href;
    a.target = "_top";

    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");

    var info = document.createElement("span");
    info.className = "info";

    var icon = document.createElement("span");
    icon.className = "icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      "<!-- " +
      machine.iconNote +
      ' --><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      machine.icon +
      "</svg>";

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = machine.name;

    var year = document.createElement("span");
    year.className = "year";
    year.textContent = machine.year;

    var meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = machine.meta;

    info.append(icon, name, year, meta);
    a.append(dot, info);
    li.appendChild(a);
    return li;
  }

  function matchesFilter(machine, filter) {
    return filter === "all" ||
      (filter === "games" ? machine.hasGames : machine.category === filter ||
        (machine.tags || []).indexOf(filter) !== -1);
  }

  var RING_HREFS = ["nes/", "snes/", "c64/", "amiga/"];

  function machineIcon(machine) {
    var icons = {
      "nes/": '<path d="m4 16 5-5h15l4 4-3 10-18 1z" fill="#bfc3c2" stroke="#25282a" stroke-width="1"/><path d="m9 11 3-5h12l4 5z" fill="#d9ddda" stroke="#25282a"/><path d="m7 17 21-1-2 6-18 1z" fill="#747b7d"/><path d="m13 12 9-1 2 3-11 1z" fill="#22262a"/><path d="m10 20 4-1v3h-4z" fill="#c92b30"/>',
      "snes/": '<path d="m3 18 5-7h18l5 6-4 9-20 1z" fill="#c4c8cc" stroke="#25282a"/><path d="m8 11 4-5h12l5 5z" fill="#e4e6e5" stroke="#25282a"/><path d="m7 18 24-1-2 6-22 1z" fill="#777d82"/><path d="m12 15h13v3H12z" fill="#353a40"/><path d="m21 21h2v2h-2zm3 0h2v2h-2zm-1 3h2v2h-2z" fill="#d03440"/>',
      "c64/": '<path d="m3 17 5-8 21 2 3 9-7 5-18-2z" fill="#9c8b70" stroke="#251b16"/><path d="m8 9 4-5h17l-1 7z" fill="#c9b99d" stroke="#251b16"/><path d="m11 6h15l-1 4-15-1z" fill="#3d3b91"/><path d="m8 17 22 1-6 5-17-2z" fill="#6e5d49"/><path d="m12 18h14" stroke="#d6c8af" stroke-width="1"/><circle cx="27" cy="13" r="1" fill="#a7e0e3"/>',
      "amiga/": '<path d="m3 16 5-7 21 2 2 9-7 6-18-3z" fill="#d7d3c4" stroke="#292721"/><path d="m8 9 4-5h18l-1 7z" fill="#ece9da" stroke="#292721"/><path d="m12 6h15l-1 4-15-1z" fill="#1762a0"/><path d="m9 17 21 1-6 5-17-3z" fill="#a19d91"/><path d="m13 18h14" stroke="#ffffff"/><path d="m25 21 4-3v4l-4 3z" fill="#d3543e"/>',
    };
    return '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="ring-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      (icons[machine.href] || icons["nes/"]) + '<path d="m5 15 23-2" stroke="url(#ring-light)" stroke-width="1" opacity=".8"/></svg>';
  }

  function exitIcon() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 4h14v5h-3V7H8v18h8v-2h3v5H5z" fill="#5b3121"/>' +
      '<path d="M17 14h7l-3-3 2-2 7 7-7 7-2-2 3-3h-7z" fill="#d5b36b"/>' +
      '<path d="M6 5h12v2H8v18h10v2H6z" fill="#d6c18a" opacity=".75"/></svg>';
  }

  function renderInventoryRing() {
    var root = document.querySelector(".inventory-ring");
    var items = root.querySelector(".inventory-ring__items");
    var machines = RING_HREFS.map(function (href) {
      return (window.OqHubMachines || []).find(function (machine) {
        return machine.href === href;
      });
    }).filter(Boolean);
    items.replaceChildren();
    machines.forEach(function (machine, index) {
      var item = document.createElement("a");
      item.className = "inventory-item";
      item.href = machine.href;
      item.dataset.index = index;
      item.setAttribute("role", "option");
      item.style.setProperty("--slot", index);
      item.innerHTML = '<span class="inventory-item__model"><span class="inventory-item__icon">' +
        machineIcon(machine) + '</span></span><span class="inventory-item__label">' +
        machine.name + '</span><span class="inventory-item__year">' + machine.year + "</span>";
      items.appendChild(item);
    });
    var exit = document.createElement("button");
    exit.className = "inventory-item inventory-item--exit";
    exit.type = "button";
    exit.dataset.index = machines.length;
    exit.setAttribute("role", "option");
    exit.style.setProperty("--slot", machines.length);
    exit.innerHTML = '<span class="inventory-item__model"><span class="inventory-item__icon">' +
      exitIcon() + '</span></span><span class="inventory-item__label">Exit</span>' +
      '<span class="inventory-item__year">Return to hub</span>';
    items.appendChild(exit);
    root.querySelector(".inventory-ring__count").textContent = (machines.length + 1) + " items / ring 01";
  }

  function enableInventoryRing() {
    var root = document.querySelector(".inventory-ring");
    var track = root.querySelector(".inventory-ring__items");
    var selected = 0;
    var ringTurn = 0;
    root.tabIndex = 0;
    function allItems() { return root.querySelectorAll(".inventory-item"); }
    function select(next, focus) {
      var all = allItems();
      var target = (next + all.length) % all.length;
      var delta = target - selected;
      if (delta > all.length / 2) delta -= all.length;
      if (delta < -all.length / 2) delta += all.length;
      selected = target;
      ringTurn -= delta * 72;
      track.style.setProperty("--ring-turn", ringTurn + "deg");
      all.forEach(function (item, index) {
        item.classList.toggle("is-selected", index === selected);
        item.setAttribute("aria-selected", String(index === selected));
      });
      root.querySelector(".inventory-ring__selection").textContent =
        all[selected].querySelector(".inventory-item__label").textContent;
      if (focus) all[selected].focus();
    }
    root.onkeydown = function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault(); select(selected - 1, true);
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault(); select(selected + 1, true);
      } else if (event.key === "Escape") {
        event.preventDefault(); window.location.hash = "all";
      }
    };
    root.onclick = function (event) {
      var item = event.target.closest(".inventory-item");
      if (!item) return;
      var index = Number(item.dataset.index);
      if (index !== selected) {
        event.preventDefault(); select(index, false);
      } else if (item.classList.contains("inventory-item--exit")) {
        event.preventDefault(); window.location.hash = "all";
      }
    };
    select(0, false);
    root.focus({ preventScroll: true });
  }

  function route(filter) {
    var validFilters = ["all", "games", "console", "handheld", "home-computer", "workstation"];
    if (validFilters.indexOf(filter) === -1) filter = "all";
    var isRing = filter === "console";
    document.body.classList.toggle("inventory-mode", isRing);
    document.querySelector(".timeline-viewport").hidden = isRing;
    document.querySelector(".inventory-ring").hidden = !isRing;
    document.querySelector("footer").hidden = isRing;
    if (isRing) {
      renderInventoryRing();
      enableInventoryRing();
    } else {
      renderHub(filter || "all");
      updateNavigation(document.querySelector(".timeline"));
    }
    document.querySelectorAll("[data-filter]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === (filter || "all")));
    });
    var machines = window.OqHubMachines || [];
    var visibleCount = isRing ? RING_HREFS.length : machines.filter(function (machine) {
      return matchesFilter(machine, filter || "all");
    }).length;
    document.querySelector(".result-count").textContent = visibleCount + " of " + machines.length + " machines";
  }

  function renderHub(filter) {
    var timeline = document.querySelector(".timeline");
    var machines = window.OqHubMachines || [];
    var visibleMachines = machines.filter(function (machine) {
      return matchesFilter(machine, filter || "all");
    });
    var fragment = document.createDocumentFragment();
    timeline.replaceChildren();
    visibleMachines.forEach(function (machine) {
      fragment.appendChild(renderTile(machine));
    });
    timeline.appendChild(fragment);
    var line = document.createElement("span");
    line.className = "timeline-line";
    line.setAttribute("aria-hidden", "true");
    timeline.appendChild(line);
    syncTimelineGeometry(timeline);
    return visibleMachines.length;
  }

  function enableFilters() {
    var buttons = document.querySelectorAll("[data-filter]");

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        window.location.hash = button.getAttribute("data-filter");
      });
    });
  }

  // Desktop-only: the timeline is visually horizontal, so a vertical
  // mouse-wheel scroll should pan it left/right instead of doing nothing
  // (the page has no vertical scroll of its own to consume it). Trackpad
  // horizontal swipes already arrive as deltaX and are left alone -- only
  // deltaY-dominant events get redirected. Matches the >640px breakpoint
  // where the CSS switches the timeline from a vertical mobile column to
  // the horizontal alternating layout.
  var DESKTOP_QUERY = "(min-width: 641px)";
  var TILE_WIDTH = 132;

  function syncTimelineGeometry(timeline) {
    var line = timeline.querySelector(".timeline-line");
    if (!line) return;
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      timeline.style.setProperty(
        "--timeline-edge-padding",
        Math.max(64, (timeline.clientWidth - TILE_WIDTH) / 2) + "px"
      );
      line.style.width = timeline.scrollWidth + "px";
    } else {
      timeline.style.removeProperty("--timeline-edge-padding");
      line.style.width = "";
    }
  }

  function enableWheelPan(timeline) {
    var isDesktop = window.matchMedia(DESKTOP_QUERY);
    timeline.addEventListener(
      "wheel",
      function (event) {
        if (!isDesktop.matches) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        timeline.scrollLeft += event.deltaY;
      },
      { passive: false }
    );
  }

  function enableNavigation(timeline) {
    var previous = document.querySelector(".timeline-nav--prev");
    var next = document.querySelector(".timeline-nav--next");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function page(direction) {
      var amount = 0.8;
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        timeline.scrollBy({
          left: direction * timeline.clientWidth * amount,
          behavior: reducedMotion.matches ? "auto" : "smooth"
        });
      } else {
        window.scrollBy({
          top: direction * window.innerHeight * amount,
          behavior: reducedMotion.matches ? "auto" : "smooth"
        });
      }
    }

    previous.addEventListener("click", function () { page(-1); });
    next.addEventListener("click", function () { page(1); });
    timeline.addEventListener("scroll", function () { updateNavigation(timeline); });
    window.addEventListener("scroll", function () { updateNavigation(timeline); }, { passive: true });
    window.addEventListener("resize", function () { updateNavigation(timeline); });
    updateNavigation(timeline);
  }

  function updateNavigation(timeline) {
    var previous = document.querySelector(".timeline-nav--prev");
    var next = document.querySelector(".timeline-nav--next");
    var isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    var canGoBack;
    var canGoForward;
    var icons = timeline.querySelectorAll(".icon");
    var bounds = isDesktop
      ? timeline.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };

    function hasUnseenIcon(direction) {
      return Array.prototype.some.call(icons, function (icon) {
        var rect = icon.getBoundingClientRect();
        return direction < 0
          ? (isDesktop ? rect.left < bounds.left - 1 : rect.top < bounds.top - 1)
          : (isDesktop ? rect.right > bounds.right + 1 : rect.bottom > bounds.bottom + 1);
      });
    }

    if (isDesktop) {
      canGoBack = hasUnseenIcon(-1);
      canGoForward = hasUnseenIcon(1);
      previous.setAttribute("aria-label", "Scroll timeline left");
      next.setAttribute("aria-label", "Scroll timeline right");
      previous.textContent = "<";
      next.textContent = ">";
    } else {
      canGoBack = hasUnseenIcon(-1);
      canGoForward = hasUnseenIcon(1);
      previous.setAttribute("aria-label", "Scroll page up");
      next.setAttribute("aria-label", "Scroll page down");
      previous.textContent = "↑";
      next.textContent = "↓";
    }
    previous.hidden = !canGoBack;
    next.hidden = !canGoForward;
  }

  function runBootScreen() {
    var boot = document.getElementById("boot-screen");
    var main = document.getElementById("hub-main");
    if (!boot || !main) return;

    var skip = boot.querySelector(".skip-intro");
    var finished = false;

    function completeBoot() {
      if (finished) return;
      finished = true;
      boot.classList.add("boot-screen--done");
      main.classList.add("hub-main--ready");
      boot.addEventListener(
        "transitionend",
        function () {
          boot.hidden = true;
        },
        { once: true }
      );
      window.setTimeout(function () { boot.hidden = true; }, 900);
    }

    skip.addEventListener("click", completeBoot);
    var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : BOOT_SCREEN_MS;
    window.setTimeout(completeBoot, delay);
  }

  document.querySelector(".inventory-ring").hidden = true;
  window.addEventListener("hashchange", function () {
    route(window.location.hash.slice(1) || "all");
  });
  route(window.location.hash.slice(1) || "all");
  enableFilters();
  enableWheelPan(document.querySelector(".timeline"));
  enableNavigation(document.querySelector(".timeline"));
  window.addEventListener("resize", function () {
    var timeline = document.querySelector(".timeline");
    syncTimelineGeometry(timeline);
    updateNavigation(timeline);
  });
  runBootScreen();
})();
