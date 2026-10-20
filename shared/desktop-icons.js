// shared/desktop-icons.js -- shared desktop icon drag-and-drop repositioning,
// boundary clamping on window resize, and localStorage layout persistence.
// Fits the authentic desktop paradigms across Amiga, Redmond, Classic Mac/Aqua,
// CDE, BeOS, OS/2, NeXT, and KDE.

(() => {
  "use strict";

  function initDesktopIcons(options = {}) {
    const desktop = options.desktop || document.getElementById("desktop");
    if (!desktop) return null;

    const storageKey = options.storageKey || null;
    const iconsSelector = options.iconsSelector || ".desktop-icon";
    const dragThreshold = options.dragThreshold || 5;
    const cleanUpTrigger = options.cleanUpTrigger || null;
    const onSelect = options.onSelect || null;
    const getZoom = options.getZoom || (() => parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
    const bottomReserve = options.bottomReserve || 0; // extra padding for bottom taskbar/strip

    const initialParents = new Map();
    for (const icon of document.querySelectorAll(iconsSelector)) {
      if (icon.parentElement) {
        initialParents.set(icon, {
          parent: icon.parentElement,
          nextSibling: icon.nextSibling,
        });
      }
    }

    function loadPositions() {
      if (!storageKey) return null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }

    function savePositions(map) {
      if (!storageKey) return;
      try {
        if (Object.keys(map).length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(map));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* sandboxed / quota */
      }
    }

    function getIconId(icon) {
      return icon.dataset.open || icon.dataset.app || icon.id || icon.getAttribute("aria-label") || icon.textContent.trim();
    }

    function persistCurrentPositions() {
      const map = {};
      for (const icon of document.querySelectorAll(`${iconsSelector}.is-placed`)) {
        const left = parseFloat(icon.style.left);
        const top = parseFloat(icon.style.top);
        const id = getIconId(icon);
        if (Number.isFinite(left) && Number.isFinite(top) && id) {
          map[id] = { left, top };
        }
      }
      savePositions(map);
    }

    function applyStoredPositions() {
      const stored = loadPositions();
      if (!stored) return;
      for (const icon of document.querySelectorAll(iconsSelector)) {
        const id = getIconId(icon);
        const pos = stored[id];
        if (!pos || typeof pos.left !== "number" || typeof pos.top !== "number") continue;
        desktop.appendChild(icon);
        icon.classList.add("is-placed");
        icon.style.position = "absolute";
        icon.style.left = `${pos.left}px`;
        icon.style.top = `${pos.top}px`;
        icon.style.right = "auto";
        icon.style.bottom = "auto";
      }
    }

    function cleanUp() {
      for (const [icon, loc] of initialParents.entries()) {
        icon.classList.remove("is-selected", "is-placed", "is-dragging", "selected");
        icon.style.position = "";
        icon.style.top = "";
        icon.style.left = "";
        icon.style.right = "";
        icon.style.bottom = "";
        if (loc.nextSibling && loc.nextSibling.parentNode === loc.parent) {
          loc.parent.insertBefore(icon, loc.nextSibling);
        } else {
          loc.parent.appendChild(icon);
        }
      }
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
    }

    function clampPlacedIcons() {
      const deskW = desktop.clientWidth;
      const deskH = desktop.clientHeight - bottomReserve;
      let changed = false;
      for (const icon of document.querySelectorAll(`${iconsSelector}.is-placed`)) {
        const iconW = icon.offsetWidth;
        const iconH = icon.offsetHeight;
        const currentL = parseFloat(icon.style.left);
        const currentT = parseFloat(icon.style.top);
        if (Number.isFinite(currentL) && Number.isFinite(currentT)) {
          const clampedL = Math.max(0, Math.min(currentL, Math.max(0, deskW - iconW)));
          const clampedT = Math.max(0, Math.min(currentT, Math.max(0, deskH - iconH)));
          if (Math.abs(clampedL - currentL) > 0.5 || Math.abs(clampedT - currentT) > 0.5) {
            icon.style.left = `${clampedL}px`;
            icon.style.top = `${clampedT}px`;
            changed = true;
          }
        }
      }
      if (changed) {
        persistCurrentPositions();
      }
    }

    applyStoredPositions();
    clampPlacedIcons();

    window.addEventListener("resize", clampPlacedIcons);

    for (const icon of document.querySelectorAll(iconsSelector)) {
      icon.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest("a, input, select, textarea, button:not(.desktop-icon)")) return;
        const zoom = getZoom();
        const startX = event.clientX;
        const startY = event.clientY;
        let dragging = false;
        let originLeft = 0;
        let originTop = 0;
        const pointerId = event.pointerId;

        function onMove(ev) {
          const dx = (ev.clientX - startX) / zoom;
          const dy = (ev.clientY - startY) / zoom;
          if (!dragging) {
            if (Math.hypot(dx, dy) < dragThreshold) return;
            dragging = true;
            const iconRect = icon.getBoundingClientRect();
            const deskRect = desktop.getBoundingClientRect();
            originLeft = (iconRect.left - deskRect.left) / zoom;
            originTop = (iconRect.top - deskRect.top) / zoom;
            desktop.appendChild(icon);
            icon.classList.add("is-placed", "is-dragging");
            icon.style.position = "absolute";
            icon.style.left = `${originLeft}px`;
            icon.style.top = `${originTop}px`;
            icon.style.right = "auto";
            icon.style.bottom = "auto";
            try {
              icon.setPointerCapture(pointerId);
            } catch {
              /* ignore */
            }
            if (onSelect) {
              onSelect(icon);
            }
          }
          const deskW = desktop.clientWidth;
          const deskH = desktop.clientHeight - bottomReserve;
          const iconW = icon.offsetWidth;
          const iconH = icon.offsetHeight;
          let nextL = originLeft + dx;
          let nextT = originTop + dy;
          nextL = Math.max(0, Math.min(nextL, Math.max(0, deskW - iconW)));
          nextT = Math.max(0, Math.min(nextT, Math.max(0, deskH - iconH)));
          icon.style.left = `${nextL}px`;
          icon.style.top = `${nextT}px`;
        }

        function onUp() {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          window.removeEventListener("pointercancel", onUp, true);
          if (dragging) {
            icon.classList.remove("is-dragging");
            persistCurrentPositions();
            const swallow = (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              icon.removeEventListener("click", swallow, true);
            };
            icon.addEventListener("click", swallow, true);
          }
        }

        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
        window.addEventListener("pointercancel", onUp, true);
      });
    }

    if (cleanUpTrigger) {
      const triggerEl = typeof cleanUpTrigger === "string" ? document.querySelector(cleanUpTrigger) : cleanUpTrigger;
      if (triggerEl) {
        triggerEl.addEventListener("click", (event) => {
          event.preventDefault();
          cleanUp();
        });
      }
    }

    return {
      cleanUp,
      clampPlacedIcons,
      persistCurrentPositions,
    };
  }

  window.OqDesktopIcons = {
    init: initDesktopIcons,
  };
})();
