(() => {
  "use strict";

  // Plain classic script, matching this repo's convention (see CLAUDE.md):
  // exposes window.OqRedmond rather than exporting, so it loads before any
  // theme's own app.js the same way shared/dict-source.js and
  // shared/hyphenation.js already do.
  //
  // "Redmond" names the window-chrome family this belongs to, not a single
  // theme: 98.css and xp.css (same author lineage) share the same DOM
  // conventions for a window (.title-bar, .win-minimize/.win-maximize/
  // .win-close, a resize-handle-per-edge growbox, a taskbar button per
  // open window, a Start menu) even though Luna's visual style is a world
  // apart from Win98's. What's genuinely reusable across that family is
  // this behavior layer -- drag, resize, focus/z-order, minimize/maximize/
  // close, taskbar buttons, desktop icon selection, the Start menu -- not
  // a real theming engine (XP's own msstyles engine is native-app-level;
  // no CSS framework replicates it, xp.css just ships Luna as static CSS
  // the same way 98.css ships Win98). Extracted out of win98/app.js the
  // first time a second consumer of it was actually on the table, not
  // preemptively -- see that file's own comment on what's still
  // theme-specific (OQ!, Display Properties/Hot Dog Stand, the taskbar
  // clock, the Shut Down dialog).
  //
  // mac1984/ deliberately does NOT use this: its own drag/resize is
  // genuinely different (smooth pixel dragging is the point, there's no
  // taskbar or Start menu, a single top-of-screen menu bar replaces
  // per-window title-bar controls) -- forcing it through this module would
  // fight the abstraction, not share it.
  window.OqRedmond = window.OqRedmond || {};

  // ---------- Window manager (drag/resize/focus/minimize/maximize/close/taskbar) ----------
  //
  // `windows`: the .window elements to manage (already queried by the
  // caller -- this module doesn't own the selector, since a future theme
  // might scope it differently).
  // `desktop`: the positioning container windows drag/resize within, and
  // whose own box is what clampToViewport measures against.
  // `taskbarWindows`: where per-window taskbar buttons get appended.
  // `resizeHandleSelector`: class name of each window's 8 resize-handle
  // elements (data-dir on each says which edge(s) it moves).
  // `minWidth`/`minHeight`: floor for both the viewport clamp and resize.
  // `onOpen(win)`: optional hook run every time a window actually opens
  // (desktop icon, Start menu, taskbar restore all funnel through the one
  // openWindow() below) -- this is where a theme hooks its own
  // lazy-loaded content, e.g. win98/app.js's OQ! dictionary fetch.
  //
  // Returns the functions a theme's own UI (desktop icons, Start menu
  // items, taskbar buttons it builds itself) needs to trigger against
  // this window set.
  // `routeOpen(win)`: optional -- for a window whose open/closed state is
  // owned by a router (win98/'s and xp's own OQ!/DECON windows, wired
  // through shared/router.js the same way dos/app.js already owns DICT.EXE/
  // DECON.EXE's state), every user trigger that would otherwise open a
  // window directly (a desktop icon, a Start menu item, restoring from the
  // taskbar) should instead ask the router to navigate and let its own
  // onChange callback be the one thing that actually opens it -- exactly
  // dos/app.js's own "one onChange callback, plain UI functions with no URL
  // knowledge" pattern (see its own comment). Returning true from
  // `routeOpen` for a given window makes the returned `openWindow` skip
  // opening it directly (the caller is expected to have just called
  // OqRouter.navigate() instead); the router's own onChange handler then
  // reaches this window's real, unrouted open via `forceOpenWindow` below,
  // which bypasses `routeOpen` entirely so this can't loop back on itself.
  // `animation`: optional per-theme tuning for minimize/maximize/restore --
  // { geometryMs, geometryEasing, minimizeMs, minimizeEasing, minimizeScale }.
  // Not a single hardcoded feel on purpose: win98/app.js, xp/app.js and
  // win7/app.js each pass their own values (see those files' own comments)
  // so a snappy flat-chrome minimize doesn't have to look like Aero's
  // softer one. Unset fields fall back to the defaults below.
  function initWindowManager({ desktop, taskbarWindows, windows, resizeHandleSelector, minWidth, minHeight, onOpen, routeOpen, routeClose, animation, pointerScale = 1 }) {
    let zTop = 10;
    const pointerScaleValue = Number(pointerScale) || 1;

    // Real Windows never showed a browser's own right-click menu over the
    // desktop -- capture it here for every Redmond theme so the illusion
    // doesn't break even where a theme has no custom context menu of its
    // own (win98/xp/win7's own app.js each add a real one on top of this
    // for the bare desktop; this still runs first and just suppresses the
    // native menu). win31/ deliberately stays suppress-only forever, not
    // just until someone gets around to it: Program Manager is the 3.1
    // shell, not a desktop with icons on it (see win31/style.css's own
    // "3.1 vs 95/98, on purpose" comment) -- there's no bare-desktop
    // surface a real 3.1 user could even right-click, so there's nothing
    // period-accurate to build here (tracked as intentionally out of
    // scope in issue #100).
    desktop.addEventListener("contextmenu", (event) => {
      if (event.target === desktop) event.preventDefault();
    });

    const anim = Object.assign(
      {
        geometryMs: 160,
        geometryEasing: "ease",
        minimizeMs: 160,
        minimizeEasing: "ease-in",
        minimizeScale: 0.05,
        // "outline": the real Win9x/XP minimize/restore animation --  an
        // animated rectangle *outline* flies between the window's rect and
        // its taskbar button, while the window itself just appears/
        // disappears at either end. It never scales or fades the window's
        // own content, which is what actually reads as "genie"/macOS-Dock-
        // like -- flat Windows chrome never had that. "genie": scale+fade
        // the real window toward the taskbar button (win7/app.js's own
        // choice, matching Aero's softer glass feel). Default "outline"
        // since it's the authentic behavior for the rest of this lineage;
        // win7 opts into "genie" explicitly.
        minimizeStyle: "outline",
      },
      animation,
    );

    // Real Windows itself skips these animations under "reduce motion"-
    // equivalent settings; prefers-reduced-motion is the web's version of
    // that same user preference, so honor it rather than forcing every
    // visitor through a scale/fade they've asked to avoid.
    function reduceMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Shared by maximize and un-maximize (restore-to-previous-rect): both
    // just change top/left/width/height (one via the .maximized class's own
    // !important rule, the other via inline styles) and want the same
    // "animate between old and new rect" treatment. Setting `transition`
    // and forcing a reflow before `mutate()` runs (rather than right after)
    // ensures the browser commits the *old* geometry as the transition's
    // start point -- ordering it the other way around risks the browser
    // coalescing both style changes into one recalculation with nothing to
    // transition from.
    function withGeometryTransition(win, mutate) {
      if (reduceMotion()) {
        mutate();
        return;
      }
      win.style.transition =
        `top ${anim.geometryMs}ms ${anim.geometryEasing}, left ${anim.geometryMs}ms ${anim.geometryEasing}, ` +
        `width ${anim.geometryMs}ms ${anim.geometryEasing}, height ${anim.geometryMs}ms ${anim.geometryEasing}`;
      void win.offsetWidth; // force the reflow described above
      mutate();
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        win.style.transition = "";
        win.removeEventListener("transitionend", onEnd);
      }
      function onEnd(event) {
        if (event.target === win) finish();
      }
      win.addEventListener("transitionend", onEnd);
      // Fallback in case nothing actually changed size/position (no
      // transitionend ever fires) -- e.g. un-maximizing back to the exact
      // rect it started at.
      setTimeout(finish, anim.geometryMs + 80);
    }

    // Minimize/restore fly the window toward (or out of) its own taskbar
    // button -- real Windows' "genie"-ish minimize animation -- rather than
    // just the plain fade a generic shrink-in-place would give. `taskbarBtn`
    // is optional: a window minimized before its button exists (shouldn't
    // happen in practice, since toggleMinimize below always has one) falls
    // back to shrinking toward its own bottom edge.
    function targetCenterFor(win, taskbarBtn) {
      const wr = win.getBoundingClientRect();
      if (!taskbarBtn) return { x: wr.left + wr.width / 2, y: wr.bottom };
      const tr = taskbarBtn.getBoundingClientRect();
      return { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
    }

    function animateMinimizeOut(win, taskbarBtn, onDone) {
      if (reduceMotion()) {
        onDone();
        return;
      }
      const wr = win.getBoundingClientRect();
      const target = targetCenterFor(win, taskbarBtn);
      const dx = target.x - (wr.left + wr.width / 2);
      const dy = target.y - (wr.top + wr.height / 2);
      win.style.transformOrigin = "center center";
      win.style.transition = `transform ${anim.minimizeMs}ms ${anim.minimizeEasing}, opacity ${anim.minimizeMs}ms ${anim.minimizeEasing}`;
      requestAnimationFrame(() => {
        win.style.transform = `translate(${dx}px, ${dy}px) scale(${anim.minimizeScale})`;
        win.style.opacity = "0";
      });
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        win.style.transition = "";
        win.style.transform = "";
        win.style.opacity = "";
        win.removeEventListener("transitionend", onEnd);
        onDone();
      }
      function onEnd(event) {
        if (event.target === win) finish();
      }
      win.addEventListener("transitionend", onEnd);
      setTimeout(finish, anim.minimizeMs + 80);
    }

    // Reverse of the above: the window has just had .minimized removed (so
    // it's visible at its real rect again) -- jump it instantly to the
    // small/faded "at the taskbar button" state with no transition, force a
    // reflow to commit that as the start point, then transition back to its
    // normal transform/opacity.
    function animateRestoreFromTaskbar(win, taskbarBtn) {
      if (reduceMotion()) return;
      const wr = win.getBoundingClientRect();
      const origin = targetCenterFor(win, taskbarBtn);
      const dx = origin.x - (wr.left + wr.width / 2);
      const dy = origin.y - (wr.top + wr.height / 2);
      win.style.transition = "none";
      win.style.transformOrigin = "center center";
      win.style.transform = `translate(${dx}px, ${dy}px) scale(${anim.minimizeScale})`;
      win.style.opacity = "0";
      void win.offsetWidth;
      win.style.transition = `transform ${anim.minimizeMs}ms ${anim.minimizeEasing}, opacity ${anim.minimizeMs}ms ${anim.minimizeEasing}`;
      requestAnimationFrame(() => {
        win.style.transform = "";
        win.style.opacity = "";
      });
      function onEnd(event) {
        if (event.target !== win) return;
        win.style.transition = "";
        win.removeEventListener("transitionend", onEnd);
      }
      win.addEventListener("transitionend", onEnd);
    }

    // ---------- "outline" minimize style (win98/xp's own default) ----------
    //
    // A single fixed-position bordered box (no fill, no content) animates
    // between two rects; the real window is toggled instantly at either
    // end, never itself scaled or faded. This is what the real Windows
    // minimize/restore animation actually is -- an outline rectangle, not
    // a shrinking copy of the window's own content.
    function animateOutlineBox(fromRect, toRect, onDone) {
      const box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      Object.assign(box.style, {
        position: "fixed",
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        boxSizing: "border-box",
        border: "1px solid #000000",
        background: "transparent",
        pointerEvents: "none",
        zIndex: "999999",
        transition:
          `left ${anim.minimizeMs}ms ${anim.minimizeEasing}, top ${anim.minimizeMs}ms ${anim.minimizeEasing}, ` +
          `width ${anim.minimizeMs}ms ${anim.minimizeEasing}, height ${anim.minimizeMs}ms ${anim.minimizeEasing}`,
      });
      document.body.appendChild(box);
      void box.offsetWidth; // commit fromRect as the transition's start point before mutating below
      requestAnimationFrame(() => {
        box.style.left = `${toRect.left}px`;
        box.style.top = `${toRect.top}px`;
        box.style.width = `${toRect.width}px`;
        box.style.height = `${toRect.height}px`;
      });
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        box.remove();
        onDone();
      }
      function onEnd(event) {
        if (event.target === box) finish();
      }
      box.addEventListener("transitionend", onEnd);
      setTimeout(finish, anim.minimizeMs + 80);
    }

    // `hide()` is called once the outline box has finished flying from the
    // window's rect to its taskbar button -- the caller's cue to actually
    // add .minimized (the window itself never visibly animates).
    function minimizeOutOutline(win, taskbarBtn, hide) {
      if (reduceMotion()) {
        hide();
        return;
      }
      const wr = win.getBoundingClientRect();
      const tr = taskbarBtn ? taskbarBtn.getBoundingClientRect() : wr;
      animateOutlineBox(wr, tr, hide);
    }

    // Reverse: the window stays hidden (.minimized) for the whole flight:
    // measuring its real target rect needs a momentary, paint-free class
    // toggle (removing .minimized to measure, then re-adding it before the
    // browser has a chance to render that in-between state) since
    // getBoundingClientRect() on a display:none element is always zero --
    // this also automatically gets a maximized window's real full-screen
    // target rect right, without this code needing to special-case that.
    // `show()` is called once the box lands, the caller's cue to actually
    // remove .minimized/focus the window.
    function minimizeInOutline(win, taskbarBtn, show) {
      if (reduceMotion()) {
        show();
        return;
      }
      win.classList.remove("minimized");
      const wr = win.getBoundingClientRect();
      win.classList.add("minimized");
      const tr = taskbarBtn ? taskbarBtn.getBoundingClientRect() : wr;
      animateOutlineBox(tr, wr, show);
    }

    function minimizeOut(win, taskbarBtn, hide) {
      if (anim.minimizeStyle === "outline") minimizeOutOutline(win, taskbarBtn, hide);
      else animateMinimizeOut(win, taskbarBtn, hide);
    }

    function minimizeIn(win, taskbarBtn, show) {
      if (anim.minimizeStyle === "outline") {
        minimizeInOutline(win, taskbarBtn, show);
      } else {
        // Genie style needs the window visible (at its real rect) before it
        // can compute/animate the transform back from taskbar-sized to
        // normal -- see animateRestoreFromTaskbar's own comment.
        show();
        animateRestoreFromTaskbar(win, taskbarBtn);
      }
    }

    // The markup's starting top/left/width/height (each theme's own inline
    // styles) are sized for a desktop viewport and overflow outright on a
    // phone-width screen -- same class of bug dos/app.js's own viewport
    // clamp exists to fix, just pixel-based here instead of character-grid
    // based. Without this a window's own title-bar buttons (close/
    // minimize/maximize) can end up entirely off-screen with no way to
    // reach them, since dragging only works from a titlebar that's at
    // least partly visible and tappable. Clamped against `desktop`'s own
    // box, not window.innerWidth/innerHeight -- a theme's own .desktop
    // rule already excludes its fixed taskbar's height, so clamping
    // against it keeps a window's bottom edge above the taskbar too.
    function clampToViewport(win) {
      if (win.classList.contains("maximized")) return; // fills the viewport by its own CSS rule, nothing to clamp
      const deskRect = desktop.getBoundingClientRect();
      const rect = win.getBoundingClientRect();

      const width = Math.min(rect.width, Math.max(minWidth, deskRect.width));
      const height = Math.min(rect.height, Math.max(minHeight, deskRect.height));
      if (width !== rect.width) win.style.width = `${width}px`;
      if (height !== rect.height) win.style.height = `${height}px`;

      const maxLeft = Math.max(0, deskRect.width - width);
      const maxTop = Math.max(0, deskRect.height - height);
      const left = Math.min(Math.max(0, rect.left - deskRect.left), maxLeft);
      const top = Math.min(Math.max(0, rect.top - deskRect.top), maxTop);
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
    }

    // Per-window state, keyed by element -- the pre-maximize rect so
    // "restore" can put a window back exactly where it was, and this
    // window's own taskbar button.
    const state = new Map();

    function focus(win) {
      if (win.classList.contains("minimized")) win.classList.remove("minimized");
      zTop += 1;
      win.style.zIndex = String(zTop);
      for (const w of windows) {
        const s = state.get(w);
        // A closed window has no taskbar button at all (see closeWindow) --
        // skip it rather than toggling .active on a null element.
        if (s && s.taskbarButton) s.taskbarButton.classList.toggle("active", w === win);
      }
    }

    function isTopmost(win) {
      return win.style.zIndex === String(zTop);
    }

    function forceOpenWindow(win) {
      const wasMinimized = win.classList.contains("minimized");
      const s = state.get(win);
      // Only animate the "restoring from the taskbar" transition for a
      // window that's genuinely being restored -- one the user minimized,
      // whose taskbar button has sat there the whole time to fly to/from.
      // Neither this window's very first-ever open (every window starts
      // life with the .minimized class already on it, see this module's
      // own "boot to a bare desktop" comment below) nor a reopen after
      // closeWindow (which throws the taskbar button away entirely) has a
      // real button to restore from -- both are captured by "did this
      // window already have a taskbar button", checked *before*
      // taskbarButtonFor() below rebuilds one for either of those cases.
      const shouldAnimate = wasMinimized && !!s.taskbarButton;
      if (!s.taskbarButton) taskbarButtonFor(win);
      function reveal() {
        win.classList.remove("minimized");
        focus(win);
        if (onOpen) onOpen(win);
      }
      if (shouldAnimate) minimizeIn(win, s.taskbarButton, reveal);
      else reveal();
    }

    function openWindow(win) {
      if (routeOpen && routeOpen(win)) return; // a router owns this window's open state -- it will call forceOpenWindow itself
      forceOpenWindow(win);
    }

    function toggleMinimize(win) {
      const willMinimize = !win.classList.contains("minimized");
      const s = state.get(win);
      if (willMinimize) {
        s.taskbarButton.classList.remove("active");
        minimizeOut(win, s.taskbarButton, () => {
          win.classList.add("minimized");
        });
      } else {
        minimizeIn(win, s.taskbarButton, () => {
          win.classList.remove("minimized");
          focus(win);
        });
      }
    }

    function toggleMaximize(win) {
      const s = state.get(win);
      if (win.classList.contains("maximized")) {
        withGeometryTransition(win, () => {
          win.classList.remove("maximized");
          if (s.preMaximizeRect) {
            win.style.top = s.preMaximizeRect.top;
            win.style.left = s.preMaximizeRect.left;
            win.style.width = s.preMaximizeRect.width;
            win.style.height = s.preMaximizeRect.height;
          }
        });
      } else {
        s.preMaximizeRect = {
          top: win.style.top,
          left: win.style.left,
          width: win.style.width,
          height: win.style.height,
        };
        withGeometryTransition(win, () => {
          win.classList.add("maximized");
        });
      }
      focus(win);
    }

    function closeWindow(win) {
      // Real Windows behavior: closing a window removes it from the
      // taskbar entirely, not just minimizes it -- the taskbar only ever
      // shows currently-running windows. Reusing .minimized for "hidden"
      // is still fine visually, but the taskbar button itself has to go
      // too; openWindow() rebuilds a fresh one on next launch.
      const s = state.get(win);
      if (!s.taskbarButton) return; // already closed -- a routed window's own onChange handler can reach an already-closed window (see routeClose), this makes that a safe no-op
      win.classList.add("minimized");
      win.classList.remove("maximized");
      s.taskbarButton.remove();
      s.taskbarButton = null;
    }

    // Drag/resize both use pointer capture the same way mac1984/app.js and
    // dos/app.js's makeDraggable/makeResizable do -- pixel-level movement
    // (not dos/'s character-grid snapping), since a GUI desktop, unlike a
    // text-mode one, never had in-between positions to avoid.
    function makeDraggable(handle, target) {
      let activePointerId = null;
      let startX = 0, startY = 0, origX = 0, origY = 0;

      function onPointerDown(event) {
        if (event.button !== 0) return;
        if (activePointerId !== null) return;
        if (target.classList.contains("maximized")) return;
        if (event.target.closest("button, a, input, select, textarea")) return;
        activePointerId = event.pointerId;
        origX = target.offsetLeft;
        origY = target.offsetTop;
        startX = event.clientX;
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      }

      function onPointerMove(event) {
        if (event.pointerId !== activePointerId) return;
        const dx = (event.clientX - startX) / pointerScaleValue;
        const dy = (event.clientY - startY) / pointerScaleValue;
        target.style.left = `${Math.max(0, origX + dx)}px`;
        target.style.top = `${Math.max(0, origY + dy)}px`;
      }

      function onPointerEnd(event) {
        if (event.pointerId !== activePointerId) return;
        activePointerId = null;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      }

      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerEnd);
      handle.addEventListener("pointercancel", onPointerEnd);
      handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
    }

    // One resize implementation shared by all 8 handles -- `dir` (n/s/e/w
    // and the 4 corners) says which edges move. Unlike mac1984's/dos's
    // growbox (bottom-right only), a north/west drag has to move top/left
    // *and* shrink width/height in the same gesture, not just grow from a
    // fixed top-left corner.
    function makeResizable(handle, target, dir, minW, minH) {
      let activePointerId = null;
      let startX = 0, startY = 0, startW = 0, startH = 0, startTop = 0, startLeft = 0;

      function onPointerDown(event) {
        if (event.button !== 0) return;
        if (activePointerId !== null) return;
        if (target.classList.contains("maximized")) return;
        activePointerId = event.pointerId;
        startW = target.offsetWidth;
        startH = target.offsetHeight;
        startTop = target.offsetTop;
        startLeft = target.offsetLeft;
        startX = event.clientX;
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      }

      function onPointerMove(event) {
        if (event.pointerId !== activePointerId) return;
        const dx = (event.clientX - startX) / pointerScaleValue;
        const dy = (event.clientY - startY) / pointerScaleValue;

        if (dir.includes("e")) {
          target.style.width = `${Math.max(minW, startW + dx)}px`;
        }
        if (dir.includes("s")) {
          target.style.height = `${Math.max(minH, startH + dy)}px`;
        }
        if (dir.includes("w")) {
          const newW = Math.max(minW, startW - dx);
          target.style.width = `${newW}px`;
          target.style.left = `${startLeft + (startW - newW)}px`;
        }
        if (dir.includes("n")) {
          const newH = Math.max(minH, startH - dy);
          target.style.height = `${newH}px`;
          target.style.top = `${startTop + (startH - newH)}px`;
        }
      }

      function onPointerEnd(event) {
        if (event.pointerId !== activePointerId) return;
        activePointerId = null;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      }

      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerEnd);
      handle.addEventListener("pointercancel", onPointerEnd);
      handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
    }

    function taskbarButtonFor(win) {
      const s = state.get(win);
      const label = win.querySelector(".title-bar-text").textContent;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "taskbar-window-button";
      // Same icon art as this window's own desktop icon (a theme's own
      // markup names a shared .icon-<name> class in its style.css,
      // rendered as a real SVG background rather than an emoji glyph),
      // left of the title -- a real Windows taskbar button always carries
      // the app's own small icon inside the same rectangle as its title,
      // not just plain text.
      const icon = win.dataset.icon;
      if (icon) {
        const iconEl = document.createElement("span");
        iconEl.className = `taskbar-window-icon icon-${icon}`;
        iconEl.setAttribute("aria-hidden", "true");
        btn.appendChild(iconEl);
      }
      const labelEl = document.createElement("span");
      labelEl.className = "taskbar-window-label";
      labelEl.textContent = label;
      btn.appendChild(labelEl);
      btn.addEventListener("click", () => {
        if (win.classList.contains("minimized")) {
          openWindow(win);
        } else if (isTopmost(win)) {
          toggleMinimize(win);
        } else {
          focus(win);
        }
      });
      taskbarWindows.appendChild(btn);
      s.taskbarButton = btn;
      return btn;
    }

    for (const win of windows) {
      state.set(win, { preMaximizeRect: null, taskbarButton: null });
      // No taskbarButtonFor(win) here -- every window starts closed (see
      // the "start closed" block below), and a closed window has no
      // taskbar button at all, same as one closed via its own close
      // button. One is built on demand by openWindow() the first time
      // each window is actually opened.

      const titlebar = win.querySelector(".title-bar");
      makeDraggable(titlebar, win);
      win.addEventListener("pointerdown", () => focus(win));

      win.querySelector(".win-minimize").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMinimize(win);
      });
      win.querySelector(".win-maximize").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMaximize(win);
      });
      win.querySelector(".win-close").addEventListener("click", (e) => {
        e.stopPropagation();
        // Same routeOpen reasoning in reverse: a router-owned window's own
        // close button should navigate away rather than hide the window
        // directly, so the URL and the visible chrome can't disagree. A
        // routed window still gets hidden here too (routeClose doesn't
        // prevent that, unlike routeOpen) -- the router's own onChange
        // handler reaching the same already-closed window back is a no-op
        // by construction (see forceCloseWindow's callers).
        closeWindow(win);
        if (routeClose) routeClose(win);
      });
      titlebar.addEventListener("dblclick", (e) => {
        if (e.target.closest("button")) return;
        toggleMaximize(win);
      });

      for (const handle of win.querySelectorAll(resizeHandleSelector)) {
        makeResizable(handle, win, handle.dataset.dir, minWidth, minHeight);
      }
    }

    for (const win of windows) clampToViewport(win);

    // Every window needs its own explicit z-index from the start, not
    // just whichever one ends up focused -- a window left at the default
    // z-index:auto paints at the same stacking level as ordinary in-flow
    // content, which is BELOW a theme's own .desktop-icons z-index (see
    // its style.css). Without this, any window that had never yet been
    // clicked/focused would render behind the desktop icons -- an
    // impossible state on a real desktop, where icons always sit under
    // every window. Stacked in DOM order here, then focus() below both
    // raises the last one in front of that stack and gets its taskbar
    // button highlighted.
    for (const win of windows) {
      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    // Real Windows boots to a bare desktop -- no windows open, an empty
    // taskbar apart from Start/clock. Marking every window .minimized here
    // (after clampToViewport() above, which needs each window's real
    // pre-hide layout to measure against -- getBoundingClientRect() on a
    // display:none element returns an all-zero rect) hides them the same
    // way closing one does, with no taskbar button (none was built
    // above), consistent with the closed state closeWindow()/openWindow()
    // already handle. No window is auto-focused either -- there's nothing
    // to focus until the visitor opens one themselves.
    for (const win of windows) win.classList.add("minimized");

    // Re-clamp on viewport changes -- a phone rotated from portrait to
    // landscape (or back) can otherwise leave a window that fit a moment
    // ago suddenly overflowing again, same reasoning as the initial clamp
    // above.
    window.addEventListener("resize", () => {
      for (const win of windows) clampToViewport(win);
    });

    return { openWindow, forceOpenWindow, closeWindow, toggleMinimize, toggleMaximize, focus, isTopmost, clampToViewport, state };
  }

  window.OqRedmond.initWindowManager = initWindowManager;

  // ---------- Desktop icon selection/open ----------
  //
  // Single-select-on-click always (matching the rest of a real desktop's
  // selection feel -- click elsewhere on the desktop clears it), but
  // *opening* forks on pointer type. A real Windows desktop opens an icon
  // on double-click; a touchscreen has no reliable double-tap (and no
  // hover to preview "selected" first), so touch opens on a single tap
  // instead. (pointer: coarse) is evaluated once at load, same reasoning
  // as a theme's own resize-handle touch-target sizing -- true for
  // touchscreens, false for a mouse/trackpad including a touch-capable
  // laptop with a mouse attached.
  //
  // `iconSelector` should already scope to icons carrying data-open (the
  // id of the window to launch).
  // `resolveOpen(icon)`: optional. Return the real window element when a
  // data-open id should open a different shell (e.g. a leftover win-decon
  // id mapping onto #win-oq). Returning null/undefined falls back to
  // getElementById(data-open).
  function initDesktopIcons({ desktop, iconSelector, openWindow, resolveOpen }) {
    const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
    let selectedIcon = null;
    function targetFor(icon) {
      if (typeof resolveOpen === "function") {
        const resolved = resolveOpen(icon);
        if (resolved) return resolved;
      }
      return document.getElementById(icon.dataset.open);
    }
    for (const icon of desktop.querySelectorAll(iconSelector)) {
      icon.addEventListener("click", () => {
        if (selectedIcon) selectedIcon.classList.remove("selected");
        icon.classList.add("selected");
        selectedIcon = icon;
        if (opensOnSingleClick) {
          const target = targetFor(icon);
          if (target) openWindow(target);
        }
      });
      if (!opensOnSingleClick) {
        icon.addEventListener("dblclick", () => {
          const target = targetFor(icon);
          if (target) openWindow(target);
        });
      }
      icon.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const target = targetFor(icon);
        if (target) openWindow(target);
      });
    }
    desktop.addEventListener("pointerdown", (event) => {
      if (event.target === desktop && selectedIcon) {
        selectedIcon.classList.remove("selected");
        selectedIcon = null;
      }
    });
  }

  window.OqRedmond.initDesktopIcons = initDesktopIcons;

  // ---------- Start menu ----------
  //
  // Open/close plus the three ways a real Start menu closes itself: an
  // outside click, Escape, and clicking any item that opens something
  // (data-open items only -- a theme's own non-launching items, like Shut
  // Down, handle their own close timing since opening a dialog afterward
  // needs the menu gone first, not simultaneously).
  function initStartMenu({ startButton, startMenu }) {
    function close() {
      startMenu.hidden = true;
      startButton.setAttribute("aria-expanded", "false");
    }
    function open() {
      startMenu.hidden = false;
      startButton.setAttribute("aria-expanded", "true");
    }
    startButton.addEventListener("click", () => {
      if (startMenu.hidden) open();
      else close();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
        close();
      }
    });
    for (const item of startMenu.querySelectorAll(".start-menu-item[data-open]")) {
      item.addEventListener("click", close);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !startMenu.hidden) close();
    });
    return { open, close };
  }

  window.OqRedmond.initStartMenu = initStartMenu;
})();
