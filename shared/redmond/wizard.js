(() => {
  "use strict";

  // Shared Chameleon Upgrade Wizard for the Redmond family
  // (win31, win95, win98, xp, win7).
  // Automatically adopts the visual chrome, typography, and controls of its host OS.

  const STORAGE_KEY = "retr-oq:redmond-era";

  const ERAS = [
    {
      id: "win31",
      path: "../win31/",
      name: "Windows 3.1",
      year: "1992",
      tagline: "Program Manager & 16-bit multimedia",
      desc: "Teal canvas, 3D gray dialog bevels, system-menu close, and standalone Program Manager groups.",
      badge: "3.1"
    },
    {
      id: "win95",
      path: "../win95/",
      name: "Windows 95",
      year: "1995",
      tagline: "The Start button revolution",
      desc: "Where do you want to go today? Authentic Start menu, taskbar, Explorer shell, and 32-bit multitasking.",
      badge: "95"
    },
    {
      id: "win98",
      path: "../win98/",
      name: "Windows 98",
      year: "1998",
      tagline: "An easier, more reliable Windows",
      desc: "The polished classic desktop: Active Desktop heritage, Quick Launch, single-column Start, and Hot Dog Stand.",
      badge: "98"
    },
    {
      id: "xp",
      path: "../xp/",
      name: "Windows XP",
      year: "2001",
      tagline: "Experience the best of the digital age",
      desc: "Luna Blue chrome, rolling green Bliss hills, rich tabs, rounded window crowns, and rock-solid NT stability.",
      badge: "XP"
    },
    {
      id: "win7",
      path: "../win7/",
      name: "Windows 7",
      year: "2009",
      tagline: "Simpler, faster, and more attractive",
      desc: "Aero Glass translucency, glowing taskbar orb, rounded titlebar buttons, and refined window composition.",
      badge: "7"
    }
  ];

  function detectTheme() {
    const p = location.pathname;
    if (p.includes("/win31/")) return "win31";
    if (p.includes("/win95/")) return "win95";
    if (p.includes("/win98/")) return "win98";
    if (p.includes("/xp/")) return "xp";
    if (p.includes("/win7/")) return "win7";
    return null;
  }

  function getTargetUrl(targetEraId) {
    const era = ERAS.find(e => e.id === targetEraId);
    if (!era) return null;
    const currentParams = new URLSearchParams(location.search);
    // Keep router state if any, e.g. screen=oq, filter=..., word=...
    const passParams = new URLSearchParams();
    if (currentParams.has("screen")) passParams.set("screen", currentParams.get("screen"));
    if (currentParams.has("filter")) passParams.set("filter", currentParams.get("filter"));
    if (currentParams.has("word")) passParams.set("word", currentParams.get("word"));
    if (currentParams.has("order")) passParams.set("order", currentParams.get("order"));
    passParams.set("nosplash", "1");
    const q = passParams.toString();
    return era.path + (q ? ("?" + q) : "");
  }

  function themeClasses(theme) {
    if (theme === "win31") {
      return {
        overlay: "win31-dialog-overlay oq-wizard-overlay",
        dialog: "win31-dialog oq-wizard-dialog oq-wizard-win31",
        body: "win31-dialog-body oq-wizard-body",
        buttonRow: "win31-dialog-actions oq-wizard-actions",
        btnDefault: "default",
        btnClass: ""
      };
    }
    if (theme === "win95") {
      return {
        overlay: "win95-dialog-overlay oq-wizard-overlay",
        dialog: "window win95-dialog oq-wizard-dialog oq-wizard-win95",
        body: "window-body win95-window-body oq-wizard-body",
        buttonRow: "win95-dialog-actions oq-wizard-actions",
        btnDefault: "default",
        btnClass: ""
      };
    }
    if (theme === "win98") {
      return {
        overlay: "win98-dialog-overlay oq-wizard-overlay",
        dialog: "window win98-dialog oq-wizard-dialog oq-wizard-win98",
        body: "window-body win98-window-body oq-wizard-body",
        buttonRow: "win98-dialog-actions oq-wizard-actions",
        btnDefault: "default",
        btnClass: ""
      };
    }
    if (theme === "xp") {
      return {
        overlay: "xp-dialog-overlay oq-wizard-overlay",
        dialog: "window xp-dialog oq-wizard-dialog oq-wizard-xp",
        body: "window-body xp-window-body oq-wizard-body",
        buttonRow: "xp-dialog-actions oq-wizard-actions",
        btnDefault: "default",
        btnClass: ""
      };
    }
    if (theme === "win7") {
      return {
        overlay: "win7-dialog-overlay oq-wizard-overlay",
        dialog: "window win7-dialog glass oq-wizard-dialog oq-wizard-win7",
        body: "window-body win7-window-body oq-wizard-body",
        buttonRow: "win7-dialog-actions oq-wizard-actions",
        btnDefault: "default",
        btnClass: ""
      };
    }
    return {
      overlay: "win98-dialog-overlay oq-wizard-overlay",
      dialog: "window win98-dialog oq-wizard-dialog",
      body: "window-body win98-window-body oq-wizard-body",
      buttonRow: "win98-dialog-actions oq-wizard-actions",
      btnDefault: "default",
      btnClass: ""
    };
  }

  const WIZARD_ICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath d='M1 11 L1 15 L5 15 L14 6 L10 2 Z' fill='%23c0c0c0' stroke='%23000000'/%3E%3Cpath d='M10 2 L14 6 L15 5 L11 1 Z' fill='%23000080' stroke='%23000000'/%3E%3Crect x='1' y='11' width='4' height='4' fill='%23ffcc00'/%3E%3Cpath d='M3 2 L4 2 L4 5 L3 5 Z' fill='%23ffcc00'/%3E%3Cpath d='M2 3 L5 3 L5 4 L2 4 Z' fill='%23ffcc00'/%3E%3Cpath d='M8 1 L9 1 L9 3 L8 3 Z' fill='%23ffcc00'/%3E%3Cpath d='M7 2 L10 2 L10 2.5 L7 2.5 Z' fill='%23ffcc00'/%3E%3Cpath d='M14 9 L15 9 L15 11 L14 11 Z' fill='%23ffcc00'/%3E%3Cpath d='M13 10 L16 10 L16 10.5 L13 10.5 Z' fill='%23ffcc00'/%3E%3C/svg%3E`;

  function injectWizardStyles() {
    if (document.getElementById("oq-wizard-style")) return;
    const style = document.createElement("style");
    style.id = "oq-wizard-style";
    style.textContent = `
      .icon-wizard {
        background-image: url("${WIZARD_ICON_SVG}");
      }
      .oq-wizard-dialog {
        width: min(32rem, calc(100vw - 20px)) !important;
        max-height: min(34rem, calc(100vh - 40px));
        display: flex;
        flex-direction: column;
        user-select: none;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .oq-wizard-win31 {
        width: min(30rem, calc(100vw - 16px)) !important;
      }
      .oq-wizard-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(128, 128, 128, 0.4);
        margin-bottom: 10px;
      }
      .oq-wizard-header-icon {
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        background-image: url("${WIZARD_ICON_SVG}");
        background-repeat: no-repeat;
        background-size: contain;
        image-rendering: pixelated;
      }
      .oq-wizard-header-text h2 {
        margin: 0;
        font-size: 13px;
        font-weight: bold;
        line-height: 1.2;
      }
      .oq-wizard-header-text p {
        margin: 2px 0 0;
        font-size: 11px;
        opacity: 0.85;
      }
      .oq-wizard-steps-container {
        flex: 1;
        min-height: 15rem;
        display: flex;
        flex-direction: column;
      }
      .oq-wizard-step {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .oq-wizard-era-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 8px 0;
        overflow-y: auto;
        max-height: 14rem;
        padding-right: 4px;
      }
      .oq-wizard-era-option {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 5px 6px;
        cursor: pointer;
        border: 1px solid transparent;
        border-radius: 2px;
      }
      .oq-wizard-era-option:hover {
        background: rgba(0, 0, 128, 0.08);
      }
      .oq-wizard-era-option.selected {
        background: rgba(0, 0, 128, 0.15);
        border-color: rgba(0, 0, 128, 0.35);
      }
      .oq-wizard-era-badge {
        font-weight: bold;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 10px;
        min-width: 2.2rem;
        text-align: center;
        background: #000080;
        color: #ffffff;
      }
      .oq-wizard-xp .oq-wizard-era-badge {
        background: #0055ea;
      }
      .oq-wizard-win7 .oq-wizard-era-badge {
        background: #1a6cb0;
      }
      .oq-wizard-era-details {
        flex: 1;
        line-height: 1.25;
      }
      .oq-wizard-era-title {
        font-weight: bold;
        font-size: 11px;
      }
      .oq-wizard-era-tagline {
        font-size: 10px;
        opacity: 0.8;
      }
      .oq-wizard-era-desc {
        font-size: 10px;
        margin-top: 2px;
        opacity: 0.7;
      }
      .oq-wizard-progress-pane {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px 0;
      }
      .oq-wizard-status-line {
        font-size: 11px;
        font-family: inherit;
        min-height: 1.2rem;
      }
      .oq-wizard-time-rem {
        font-size: 10px;
        opacity: 0.8;
        font-style: italic;
      }
      .oq-wizard-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid rgba(128, 128, 128, 0.3);
      }
      .oq-wizard-actions button {
        min-width: 72px;
      }
      /* Win 3.1 specific adjustments */
      .oq-wizard-win31 .oq-wizard-actions {
        justify-content: flex-end;
      }
      .oq-wizard-win31 .oq-wizard-era-option.selected {
        background: #000080;
        color: #ffffff;
      }
      .oq-wizard-win31 .oq-wizard-era-option.selected .oq-wizard-era-badge {
        background: #ffffff;
        color: #000080;
      }
      /* Custom simulated progress bar for win31 / general fallbacks */
      .oq-wizard-progress-box {
        height: 20px;
        border: 1px solid #000000;
        background: #ffffff;
        box-shadow: inset 1px 1px 0 #808080;
        position: relative;
        overflow: hidden;
      }
      .oq-wizard-progress-fill {
        height: 100%;
        width: 0%;
        background: #000080;
        transition: width 150ms linear;
      }
      .oq-wizard-xp .oq-wizard-progress-fill {
        background: linear-gradient(180deg, #30c830, #189818);
      }
      .oq-wizard-win7 .oq-wizard-progress-fill {
        background: linear-gradient(180deg, #0bd82c, #05a020);
      }
    `;
    document.head.appendChild(style);
  }

  function createWizardDialog(theme) {
    const existing = document.getElementById("oq-wizard-overlay");
    if (existing) return existing;

    injectWizardStyles();
    const c = themeClasses(theme);

    const overlay = document.createElement("div");
    overlay.id = "oq-wizard-overlay";
    overlay.className = c.overlay;
    overlay.hidden = true;

    overlay.innerHTML = `
      <section id="oq-wizard-dialog" class="${c.dialog}" role="dialog" aria-modal="true" aria-labelledby="oq-wizard-title">
        <div class="title-bar">
          <div class="title-bar-text" id="oq-wizard-title">Windows Upgrade &amp; Time Warp Wizard</div>
          <div class="title-bar-controls">
            <button type="button" aria-label="Close" class="win-close" id="oq-wizard-x-btn"></button>
          </div>
        </div>
        <div class="${c.body}">
          <div class="oq-wizard-header">
            <div class="oq-wizard-header-icon" aria-hidden="true"></div>
            <div class="oq-wizard-header-text">
              <h2 id="oq-wizard-step-title">Select Target Windows Era</h2>
              <p id="oq-wizard-step-desc">Choose which version of Windows you want to warp to.</p>
            </div>
          </div>

          <div class="oq-wizard-steps-container">
            <!-- Step 1: Era Picker -->
            <div class="oq-wizard-step" id="oq-wizard-step-pick">
              <div class="oq-wizard-era-list" role="radiogroup" aria-label="Windows versions">
                ${ERAS.map((era) => `
                  <div class="oq-wizard-era-option ${era.id === theme ? 'current' : ''}" data-era="${era.id}" role="radio" tabindex="0" aria-checked="${era.id === theme}">
                    <span class="oq-wizard-era-badge">${era.badge}</span>
                    <div class="oq-wizard-era-details">
                      <div class="oq-wizard-era-title">${era.name} (${era.year}) ${era.id === theme ? '<small style="opacity:0.75">[Current]</small>' : ''}</div>
                      <div class="oq-wizard-era-tagline">${era.tagline}</div>
                      <div class="oq-wizard-era-desc">${era.desc}</div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Step 2: Preparing / Installing -->
            <div class="oq-wizard-step" id="oq-wizard-step-progress" hidden>
              <div class="oq-wizard-progress-pane">
                <p>Please wait while the Wizard prepares to transition your system...</p>
                <div class="oq-wizard-progress-box" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                  <div class="oq-wizard-progress-fill" id="oq-wizard-pbar"></div>
                </div>
                <div class="oq-wizard-status-line" id="oq-wizard-status">Checking system configuration...</div>
                <div class="oq-wizard-time-rem" id="oq-wizard-time">Estimated time remaining: 39 minutes</div>
              </div>
            </div>
          </div>

          <div class="${c.buttonRow}">
            <button type="button" id="oq-wizard-back" disabled>&lt; Back</button>
            <button type="button" id="oq-wizard-next" class="${c.btnDefault}">Next &gt;</button>
            <button type="button" id="oq-wizard-cancel">Cancel</button>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    let selectedEra = theme || "win98";
    let isInstalling = false;

    const stepPick = overlay.querySelector("#oq-wizard-step-pick");
    const stepProgress = overlay.querySelector("#oq-wizard-step-progress");
    const stepTitle = overlay.querySelector("#oq-wizard-step-title");
    const stepDesc = overlay.querySelector("#oq-wizard-step-desc");
    const btnNext = overlay.querySelector("#oq-wizard-next");
    const btnBack = overlay.querySelector("#oq-wizard-back");
    const btnCancel = overlay.querySelector("#oq-wizard-cancel");
    const btnX = overlay.querySelector("#oq-wizard-x-btn");
    const pbar = overlay.querySelector("#oq-wizard-pbar");
    const statusLine = overlay.querySelector("#oq-wizard-status");
    const timeLine = overlay.querySelector("#oq-wizard-time");

    function updateSelection(eraId) {
      selectedEra = eraId;
      overlay.querySelectorAll(".oq-wizard-era-option").forEach((opt) => {
        const isMatch = opt.dataset.era === eraId;
        opt.classList.toggle("selected", isMatch);
        opt.setAttribute("aria-checked", String(isMatch));
      });
      try {
        localStorage.setItem(STORAGE_KEY, eraId);
      } catch (_) {}
    }

    // Default select another era if current, or current if none
    const defaultSelect = ERAS.find(e => e.id !== theme) ? (ERAS.find(e => e.id !== theme).id) : (theme || "win98");
    updateSelection(defaultSelect);

    overlay.querySelectorAll(".oq-wizard-era-option").forEach((opt) => {
      opt.addEventListener("click", () => updateSelection(opt.dataset.era));
      opt.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          updateSelection(opt.dataset.era);
        }
      });
    });

    function close() {
      if (isInstalling) return;
      overlay.hidden = true;
      resetToPick();
    }

    function resetToPick() {
      isInstalling = false;
      stepPick.hidden = false;
      stepProgress.hidden = true;
      stepTitle.textContent = "Select Target Windows Era";
      stepDesc.textContent = "Choose which version of Windows you want to warp to.";
      btnBack.disabled = true;
      btnNext.disabled = false;
      btnNext.textContent = "Next >";
      btnCancel.disabled = false;
      pbar.style.width = "0%";
    }

    function startWarp() {
      if (selectedEra === theme) {
        // Already here
        window.alert(`You are already running ${ERAS.find(e => e.id === theme).name}. Pick a different era to time-warp!`);
        return;
      }

      isInstalling = true;
      stepPick.hidden = true;
      stepProgress.hidden = false;
      stepTitle.textContent = `Upgrading to ${ERAS.find(e => e.id === selectedEra).name}...`;
      stepDesc.textContent = "Setup is copying files and initializing the new operating system.";
      btnBack.disabled = true;
      btnNext.disabled = true;
      btnCancel.disabled = true;

      const target = ERAS.find(e => e.id === selectedEra);
      const steps = [
        { pct: 15, msg: "Formatting virtual installation media...", time: "Estimated time remaining: 39 minutes" },
        { pct: 35, msg: "Calibrating retro flux capacitor & time gates...", time: "Estimated time remaining: 24 minutes" },
        { pct: 60, msg: `Unpacking ${target.name} shell & desktop drivers...`, time: "Estimated time remaining: 8 minutes" },
        { pct: 85, msg: "Updating SYSTEM.INI & registry hives...", time: "Estimated time remaining: 1 minute" },
        { pct: 100, msg: "Restarting computer in target era...", time: "Restarting now..." }
      ];

      let idx = 0;
      function tick() {
        if (idx < steps.length) {
          const item = steps[idx];
          pbar.style.width = item.pct + "%";
          statusLine.textContent = item.msg;
          timeLine.textContent = item.time;
          idx++;
          setTimeout(tick, 240);
        } else {
          // Navigate to target
          const targetUrl = getTargetUrl(selectedEra);
          if (targetUrl) {
            location.href = targetUrl;
          }
        }
      }
      setTimeout(tick, 100);
    }

    btnNext.addEventListener("click", startWarp);
    btnCancel.addEventListener("click", close);
    if (btnX) btnX.addEventListener("click", close);

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function openWizard() {
    const theme = detectTheme();
    if (!theme) return;
    const overlay = createWizardDialog(theme);
    overlay.hidden = false;
  }

  // Setup Start menu item and Desktop icon on Win9x, XP, Win7, Win31
  function installAffordances() {
    const theme = detectTheme();
    if (!theme) return;

    injectWizardStyles();

    // 1. Start Menu (Win95, Win98, XP, Win7)
    const startMenu = document.getElementById("start-menu");
    if (startMenu && !startMenu.querySelector("#start-menu-wizard")) {
      const li = document.createElement("li");
      li.id = "start-menu-wizard";
      li.setAttribute("role", "menu-item");
      li.className = "start-menu-item";
      
      const icon = document.createElement("span");
      icon.className = "start-menu-icon icon-wizard";
      icon.setAttribute("aria-hidden", "true");

      li.append(icon, document.createTextNode(" Upgrade Wizard…"));
      li.addEventListener("click", () => {
        startMenu.hidden = true;
        openWizard();
      });

      // Insert logically before Help / Run / Shutdown
      const shutdown = startMenu.querySelector("#start-menu-shutdown");
      const run = startMenu.querySelector("#start-menu-run");
      const target = run || shutdown;
      if (target) startMenu.insertBefore(li, target);
      else startMenu.appendChild(li);
    }

    // 2. Desktop Icon (Win95, Win98, XP, Win7)
    const desktopIcons = document.querySelector(".desktop-icons");
    if (desktopIcons && !desktopIcons.querySelector('[data-open="wizard"]')) {
      // In Win95, desktop-icon is a div with role="button"; in Win98/XP/Win7 it's button.desktop-icon
      let iconEl;
      if (theme === "win95") {
        iconEl = document.createElement("div");
        iconEl.className = "desktop-icon";
        iconEl.setAttribute("role", "button");
        iconEl.setAttribute("tabindex", "0");
      } else {
        iconEl = document.createElement("button");
        iconEl.type = "button";
        iconEl.className = "desktop-icon";
      }
      iconEl.setAttribute("data-open", "wizard");
      iconEl.innerHTML = `
        <span class="desktop-icon-glyph icon-wizard" aria-hidden="true"></span>
        <span class="desktop-icon-label">Upgrade Wizard</span>
      `;

      // Open on dblclick (fine pointer) or click (touch/coarse)
      iconEl.addEventListener("click", () => {
        if (window.matchMedia("(pointer: coarse)").matches) {
          openWizard();
        }
      });
      iconEl.addEventListener("dblclick", openWizard);
      iconEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openWizard();
      });

      desktopIcons.appendChild(iconEl);
    }

    // 3. Program Manager (Win31)
    if (theme === "win31") {
      const groupMain = document.querySelector("#win-group-main .group-icons");
      if (groupMain && !groupMain.querySelector('[data-open="wizard"]')) {
        const progBtn = document.createElement("button");
        progBtn.type = "button";
        progBtn.className = "prog-icon";
        progBtn.setAttribute("data-open", "wizard");
        progBtn.innerHTML = `
          <span class="prog-icon-glyph icon-wizard" aria-hidden="true"></span>
          <span class="prog-icon-label">Upgrade Wizard</span>
        `;
        progBtn.addEventListener("click", () => {
          groupMain.querySelectorAll(".prog-icon").forEach(b => b.classList.remove("selected"));
          progBtn.classList.add("selected");
          if (window.matchMedia("(pointer: coarse)").matches) {
            openWizard();
          }
        });
        progBtn.addEventListener("dblclick", openWizard);
        progBtn.addEventListener("keydown", (e) => {
          if (e.key === "Enter") openWizard();
        });
        groupMain.appendChild(progBtn);
      }
    }
  }

  window.OqRedmondWizard = {
    open: openWizard,
    boot: installAffordances,
    eras: ERAS
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAffordances);
  } else {
    installAffordances();
  }
})();
