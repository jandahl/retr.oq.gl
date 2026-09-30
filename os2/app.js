(() => {
  "use strict";
  let z = 10;
  const desktop = document.getElementById("desktop");
  const DRAG_THRESHOLD = 4;
  const miniTray = document.getElementById("minimized-tray");

  function focus(win) {
    if (!win) return;
    z += 1;
    win.style.zIndex = z;
    for (const other of desktop.querySelectorAll(".os2-window")) {
      other.classList.toggle("active", other === win);
    }
  }

  function removeMini(win) {
    if (!miniTray || !win) return;
    const btn = miniTray.querySelector('[data-restore="' + win.id + '"]');
    if (btn) btn.remove();
  }

  function ensureMini(win) {
    if (!miniTray || !win || !win.id) return;
    removeMini(win);
    const title =
      (win.querySelector(".os2-titlebar .os2-caption") || win.querySelector(".os2-titlebar span"))?.textContent?.trim() ||
      win.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "minimized-object";
    btn.dataset.restore = win.id;
    btn.title = title;
    const icon = win.querySelector(".os2-titlebar .pm-icon");
    if (icon) {
      const clone = icon.cloneNode(true);
      btn.appendChild(clone);
    }
    const label = document.createElement("span");
    label.textContent = title;
    btn.appendChild(label);
    btn.addEventListener("click", () => open(win.id));
    btn.addEventListener("dblclick", () => open(win.id));
    miniTray.appendChild(btn);
  }

  function open(id) {
    const win = document.getElementById(id);
    if (!win) return;
    win.hidden = false;
    win.classList.remove("is-minimized");
    removeMini(win);
    focus(win);
  }

  function close(win) {
    if (!win) return;
    win.hidden = true;
    win.classList.remove("is-minimized");
    removeMini(win);
  }

  // Warp Hide: window stays an object — iconified into the desktop tray
  // so it can be restored. Close removes it from the session entirely.
  function minimize(win) {
    if (!win || win.hidden) return;
    win.hidden = true;
    win.classList.add("is-minimized");
    ensureMini(win);
  }

  function leaveToHub() {
    window.location.href = "../";
  }

  function setFolderView(mode) {
    const folder = document.querySelector("#system-window .folder-view");
    if (!folder) return;
    folder.classList.toggle("details-view", mode === "details");
    for (const btn of document.querySelectorAll("[data-view]")) {
      btn.classList.toggle("is-checked", btn.dataset.view === mode);
    }
  }

  desktop.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open]");
    if (opener) {
      open(opener.dataset.open);
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = true;
      return;
    }

    if (event.target.closest("[data-shutdown]")) {
      leaveToHub();
      return;
    }

    const viewBtn = event.target.closest("[data-view]");
    if (viewBtn) {
      setFolderView(viewBtn.dataset.view);
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = true;
      return;
    }

    if (event.target.closest("[data-help]")) {
      window.alert(
        "OQ!2 Warp 4 Workplace Shell prototype.\n\nOpen desktop objects to run dictionary guests.\nShut down returns to the theme picker."
      );
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = true;
      return;
    }

    const win = event.target.closest(".os2-window");
    if (win) focus(win);

    if (event.target.closest(".minimize")) {
      minimize(win);
      return;
    }
    if (event.target.closest(".close-window") || event.target.closest("[data-close-window]")) {
      close(event.target.closest(".os2-window") || win);
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = true;
      return;
    }

    const menuButton = event.target.closest("[data-menu]");
    if (menuButton) {
      const menu = document.getElementById(menuButton.dataset.menu);
      const wasHidden = !menu || menu.hidden;
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = other !== menu;
      if (menu) menu.hidden = !wasHidden;
      return;
    }

    if (!event.target.closest(".os2-dropdown") && !event.target.closest(".os2-menu")) {
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = true;
    }
  });

  // Drag: wait for a move past threshold, then track on window (CLAUDE.md).
  for (const win of desktop.querySelectorAll(".os2-window")) {
    const bar = win.querySelector(".os2-titlebar");
    let drag = null;
    let pending = null;

    bar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      if (event.button !== undefined && event.button !== 0) return;
      focus(win);
      pending = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origLeft: win.offsetLeft,
        origTop: win.offsetTop,
      };
    });

    window.addEventListener("pointermove", (event) => {
      if (pending && event.pointerId === pending.pointerId && !drag) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag = pending;
        pending = null;
        try {
          bar.setPointerCapture(event.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      if (!drag || event.pointerId !== drag.pointerId) return;
      win.style.left = `${Math.max(0, event.clientX - (drag.startX - drag.origLeft))}px`;
      win.style.top = `${Math.max(0, event.clientY - (drag.startY - drag.origTop))}px`;
    });

    window.addEventListener("pointerup", (event) => {
      if (pending && event.pointerId === pending.pointerId) pending = null;
      if (drag && event.pointerId === drag.pointerId) {
        try {
          bar.releasePointerCapture(event.pointerId);
        } catch (_) {
          /* ignore */
        }
        drag = null;
      }
    });
    window.addEventListener("pointercancel", (event) => {
      if (pending && event.pointerId === pending.pointerId) pending = null;
      if (drag && event.pointerId === drag.pointerId) drag = null;
    });
  }

  setFolderView("icon");
})();
