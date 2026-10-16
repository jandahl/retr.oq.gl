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

  const ICON_SETUP_31 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' shape-rendering='crispEdges'%3E%3Crect x='3' y='4' width='16' height='24' fill='%23c0c0c0' stroke='%23000000' stroke-width='1'/%3E%3Crect x='6' y='7' width='10' height='3' fill='%23ffffff' stroke='%23000000' stroke-width='1'/%3E%3Crect x='8' y='8' width='6' height='1' fill='%23000000'/%3E%3Crect x='6' y='12' width='10' height='3' fill='%23ffffff' stroke='%23000000' stroke-width='1'/%3E%3Crect x='8' y='13' width='6' height='1' fill='%23000000'/%3E%3Crect x='13' y='18' width='3' height='3' fill='%2300ff00'/%3E%3Crect x='7' y='19' width='4' height='1' fill='%23808080'/%3E%3Crect x='15' y='11' width='14' height='14' fill='%23000080' stroke='%23000000' stroke-width='1'/%3E%3Crect x='18' y='11' width='8' height='5' fill='%23c0c0c0' stroke='%23000000' stroke-width='1'/%3E%3Crect x='20' y='12' width='4' height='3' fill='%23ffffff'/%3E%3Crect x='17' y='18' width='10' height='6' fill='%23ffffff' stroke='%23000000' stroke-width='1'/%3E%3Crect x='19' y='20' width='6' height='1' fill='%23c00000'/%3E%3C/svg%3E`;

  const ICON_SETUP_9X = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' shape-rendering='crispEdges'%3E%3Cpolygon points='3,8 15,2 29,7 17,14' fill='%23d4b184' stroke='%23000000' stroke-width='1'/%3E%3Cpolygon points='3,8 17,14 17,29 3,21' fill='%239e7247' stroke='%23000000' stroke-width='1'/%3E%3Cpolygon points='29,7 17,14 17,29 29,20' fill='%23b88958' stroke='%23000000' stroke-width='1'/%3E%3Crect x='7' y='10' width='6' height='2' fill='%23ffffff'/%3E%3Ccircle cx='21' cy='19' r='8' fill='%23ffffff' stroke='%23808080' stroke-width='1'/%3E%3Ccircle cx='21' cy='19' r='6' fill='%23e0e0e0'/%3E%3Ccircle cx='21' cy='19' r='2.5' fill='%23b88958' stroke='%23808080' stroke-width='1'/%3E%3Cpath d='M16 16 L20 18 L19 22 Z' fill='%2300ffff' opacity='0.7'/%3E%3Cpath d='M22 17 L25 21 L22 22 Z' fill='%23ff00ff' opacity='0.7'/%3E%3C/svg%3E`;

  const ICON_SETUP_XP = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='xpc' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%236bb5ff'/%3E%3Cstop offset='100%25' stop-color='%231952a8'/%3E%3C/linearGradient%3E%3ClinearGradient id='xpd' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ffffff'/%3E%3Cstop offset='50%25' stop-color='%23d0e0f0'/%3E%3Cstop offset='100%25' stop-color='%23a0b8d8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='3' y='4' width='22' height='16' rx='2' fill='url(%23xpc)' stroke='%230f3675' stroke-width='1.5'/%3E%3Crect x='5' y='6' width='18' height='11' rx='1' fill='%23e8f2fe'/%3E%3Cpath d='M5 13 C8 11 15 15 23 11 L23 17 L5 17 Z' fill='%235aa834'/%3E%3Ccircle cx='20' cy='21' r='9' fill='url(%23xpd)' stroke='%236688aa' stroke-width='1.5'/%3E%3Ccircle cx='20' cy='21' r='3' fill='%23e8f2fe' stroke='%236688aa' stroke-width='1'/%3E%3C/svg%3E`;

  const ICON_SETUP_7 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='w7b' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%2300b4f0'/%3E%3Cstop offset='100%25' stop-color='%23006bb0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='4' y='6' width='24' height='20' rx='3' fill='%23f4f8fc' stroke='%237090b0' stroke-width='1.5'/%3E%3Crect x='6' y='8' width='20' height='6' rx='1' fill='url(%23w7b)'/%3E%3Ccircle cx='22' cy='22' r='8' fill='%2340b030' stroke='%23ffffff' stroke-width='1.5'/%3E%3Cpolygon points='19,22 21,24 25,19 26,20 21,26 18,23' fill='%23ffffff'/%3E%3C/svg%3E`;

  function injectWizardStyles() {
    if (document.getElementById("oq-wizard-style")) return;
    const style = document.createElement("style");
    style.id = "oq-wizard-style";
    style.textContent = `
      .icon-wizard-31 {
        background-image: url("${ICON_SETUP_31}");
      }
      .icon-wizard-9x {
        background-image: url("${ICON_SETUP_9X}");
      }
      .icon-wizard-modern {
        background-image: url("${ICON_SETUP_XP}");
      }
      .icon-wizard-7 {
        background-image: url("${ICON_SETUP_7}");
      }
      .icon-wizard {
        background-image: url("${ICON_SETUP_9X}");
        background-repeat: no-repeat;
        background-size: contain;
      }
      .oq-wizard-overlay {
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(0, 0, 0, 0.45) !important;
        z-index: 99999 !important;
      }
      .oq-wizard-overlay[hidden] {
        display: none !important;
      }
      .oq-wizard-dialog {
        width: min(34rem, calc(100vw - 20px)) !important;
        max-height: min(34rem, calc(100vh - 30px));
        display: flex;
        flex-direction: column;
        user-select: none;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 100000 !important;
      }
      .oq-wizard-body {
        padding: 0 !important;
        margin: 0 !important;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Wizard 97 Layout (Win95, Win98, XP, Win7) */
      .oq-wizard-main-layout {
        display: flex;
        flex-direction: row;
        min-height: 250px;
        background: inherit;
      }
      .oq-wizard-watermark {
        width: 140px;
        flex: 0 0 140px;
        background: #000080;
        background: linear-gradient(180deg, #000080 0%, #000050 60%, #004080 100%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 16px 12px;
        color: #ffffff;
        box-shadow: inset -1px 0 0 #808080, inset -2px 0 0 #dfdfdf;
        position: relative;
        overflow: hidden;
      }
      .oq-wizard-watermark-art {
        width: 48px;
        height: 48px;
        margin: 0 auto;
        background-repeat: no-repeat;
        background-size: contain;
        image-rendering: pixelated;
      }
      .oq-wizard-watermark-title {
        font-weight: bold;
        font-size: 14px;
        line-height: 1.2;
        letter-spacing: 0.5px;
        color: #ffffff;
        text-shadow: 1px 1px 0 #000000;
        margin-top: 10px;
      }
      .oq-wizard-watermark-foot {
        font-size: 10px;
        opacity: 0.8;
        line-height: 1.3;
      }

      /* XP Watermark */
      .oq-wizard-xp .oq-wizard-watermark {
        background: linear-gradient(180deg, #0055ea 0%, #083c9c 100%);
        box-shadow: inset -1px 0 0 rgba(0,0,0,0.15);
      }
      /* Win 7 Watermark */
      .oq-wizard-win7 .oq-wizard-watermark {
        background: linear-gradient(180deg, #1e3a5f 0%, #0e1e35 100%);
        box-shadow: inset -1px 0 0 rgba(255,255,255,0.2);
      }

      .oq-wizard-content-pane {
        flex: 1;
        padding: 12px 14px 10px;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .oq-wizard-page-title {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: bold;
      }
      .oq-wizard-page-desc {
        margin: 0 0 8px;
        font-size: 11px;
        line-height: 1.3;
      }
      .oq-wizard-fieldset {
        flex: 1;
        border: 1px solid #808080;
        box-shadow: inset 1px 1px 0 #dfdfdf, 1px 1px 0 #ffffff;
        padding: 6px 10px 8px;
        margin: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        max-height: 195px;
        background: inherit;
      }
      .oq-wizard-fieldset legend {
        padding: 0 4px;
        font-size: 11px;
        font-weight: bold;
      }
      .oq-wizard-era-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 0;
        padding: 0;
      }
      .oq-wizard-era-option {
        display: flex;
        flex-direction: column;
        margin-bottom: 2px;
        cursor: pointer;
      }
      .oq-wizard-era-label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 11px;
        font-weight: bold;
      }
      .oq-wizard-era-label input[type="radio"] {
        cursor: pointer;
        margin: 0;
      }
      .oq-wizard-era-desc {
        margin: 2px 0 0 20px;
        font-size: 10px;
        line-height: 1.3;
        opacity: 0.85;
      }
      .oq-wizard-current-tag {
        font-size: 10px;
        font-weight: normal;
        opacity: 0.75;
      }

      /* Divider & Actions */
      .oq-wizard-divider {
        height: 2px;
        border-top: 1px solid #808080;
        border-bottom: 1px solid #ffffff;
        margin: 0;
      }
      .oq-wizard-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: inherit;
      }
      .oq-wizard-actions button {
        min-width: 72px;
        min-height: 22px;
      }

      /* Win 95 Title Bar: solid Navy */
      .oq-wizard-win95 .title-bar {
        background: #000080 !important;
      }

      /* Win 3.1 Dialog overrides */
      .oq-wizard-win31 {
        width: min(23rem, calc(100vw - 16px)) !important;
        background: #c0c0c0 !important;
        border: 1px solid #000000 !important;
        box-shadow: inset -1px -1px 0 #000000, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #808080, inset 2px 2px 0 #c0c0c0 !important;
        padding: 3px !important;
      }
      .oq-wizard-win31 .win31-dialog-body {
        background: #c0c0c0 !important;
        padding: 8px 10px !important;
        gap: 8px !important;
      }
      .oq-wizard-win31 .title-bar {
        background: #000080 !important;
        color: #ffffff !important;
        height: 18px !important;
        padding: 2px !important;
      }
      .oq-wizard-win31 .oq-wizard-w31-header {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      .oq-wizard-win31 .oq-wizard-w31-icon {
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        background-repeat: no-repeat;
        background-size: contain;
        image-rendering: pixelated;
      }
      .oq-wizard-win31 .oq-wizard-w31-desc {
        font-size: 11px;
        line-height: 1.35;
      }
      .oq-wizard-win31 .oq-wizard-w31-listbox {
        background: #ffffff;
        box-shadow: inset 1px 1px 0 #000000, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #808080, inset -2px -2px 0 #c0c0c0;
        padding: 3px 2px;
        max-height: 140px;
        overflow-y: auto;
      }
      .oq-wizard-win31 .oq-wizard-era-option {
        padding: 2px 4px;
        margin: 0;
      }
      .oq-wizard-win31 .oq-wizard-era-option.selected {
        background: #000080;
        color: #ffffff;
      }
      .oq-wizard-win31 .oq-wizard-era-option.selected .oq-wizard-era-desc {
        color: #ffffff;
        opacity: 0.9;
      }
      .oq-wizard-win31 .oq-wizard-era-label {
        font-size: 10px;
      }
      .oq-wizard-win31 .oq-wizard-era-desc {
        font-size: 9px;
        margin-left: 18px;
      }
      .oq-wizard-win31 .win31-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 4px;
      }
      .oq-wizard-win31 .win31-dialog-actions button {
        min-width: 68px;
        min-height: 22px;
        font-size: 11px;
      }

      /* Progress Step */
      .oq-wizard-progress-pane {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px 8px;
        flex: 1;
      }
      .oq-wizard-progress-box {
        height: 18px;
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
      .oq-wizard-status-line {
        font-size: 11px;
        min-height: 1.2rem;
      }
      .oq-wizard-time-rem {
        font-size: 10px;
        opacity: 0.8;
        font-style: italic;
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

    const isWin31 = (theme === "win31");
    const watermarkIcon = isWin31
      ? ICON_SETUP_31
      : (theme === "win95" || theme === "win98")
      ? ICON_SETUP_9X
      : (theme === "xp")
      ? ICON_SETUP_XP
      : ICON_SETUP_7;

    if (isWin31) {
      // Windows 3.1 Authentic Program Manager Setup Dialog
      overlay.innerHTML = `
        <section id="oq-wizard-dialog" class="${c.dialog}" role="dialog" aria-modal="true" aria-labelledby="oq-wizard-title">
          <div class="title-bar">
            <button type="button" class="win-sysmenu" aria-label="System menu" id="oq-wizard-x-btn"></button>
            <div class="title-bar-text" id="oq-wizard-title">Windows Setup</div>
          </div>
          <div class="${c.body}">
            <div class="oq-wizard-step" id="oq-wizard-step-pick">
              <div class="oq-wizard-w31-header">
                <div class="oq-wizard-w31-icon icon-wizard-31" aria-hidden="true"></div>
                <div class="oq-wizard-w31-desc">
                  Select the Windows environment you want to warp to, then click Continue.
                </div>
              </div>
              <div style="font-size: 10px; font-weight: bold; margin: 6px 0 2px;">Target Version:</div>
              <div class="oq-wizard-w31-listbox oq-wizard-era-list" role="radiogroup" aria-label="Windows versions">
                ${ERAS.map((era) => `
                  <div class="oq-wizard-era-option ${era.id === theme ? 'current' : ''}" data-era="${era.id}" role="radio" tabindex="0" aria-checked="${era.id === theme}">
                    <label class="oq-wizard-era-label">
                      <input type="radio" name="w31_target_era" value="${era.id}" ${era.id === theme ? 'checked' : ''}>
                      <span>${era.name} (${era.year}) ${era.id === theme ? '<span class="oq-wizard-current-tag">[Current]</span>' : ''}</span>
                    </label>
                    <div class="oq-wizard-era-desc">${era.tagline}</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="oq-wizard-step" id="oq-wizard-step-progress" hidden>
              <div class="oq-wizard-progress-pane">
                <p style="margin:0;font-size:11px;">Please wait while Setup updates your system configuration...</p>
                <div class="oq-wizard-progress-box" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                  <div class="oq-wizard-progress-fill" id="oq-wizard-pbar"></div>
                </div>
                <div class="oq-wizard-status-line" id="oq-wizard-status">Checking SYSTEM.INI...</div>
                <div class="oq-wizard-time-rem" id="oq-wizard-time">Copying files...</div>
              </div>
            </div>

            <div class="win31-dialog-actions ${c.buttonRow}">
              <button type="button" id="oq-wizard-next" class="${c.btnDefault}">Continue</button>
              <button type="button" id="oq-wizard-cancel">Cancel</button>
            </div>
          </div>
        </section>
      `;
    } else {
      // Classic Wizard 97 Setup Layout for Win 95, Win 98, XP, Win 7
      overlay.innerHTML = `
        <section id="oq-wizard-dialog" class="${c.dialog}" role="dialog" aria-modal="true" aria-labelledby="oq-wizard-title">
          <div class="title-bar">
            <div class="title-bar-text" id="oq-wizard-title">Windows Upgrade Wizard</div>
            <div class="title-bar-controls">
              <button type="button" aria-label="Close" class="win-close" id="oq-wizard-x-btn"></button>
            </div>
          </div>
          <div class="${c.body}">
            <div class="oq-wizard-main-layout">
              <div class="oq-wizard-watermark" aria-hidden="true">
                <div class="oq-wizard-watermark-art" style="background-image: url('${watermarkIcon}');"></div>
                <div class="oq-wizard-watermark-title">Windows<br>Setup</div>
                <div class="oq-wizard-watermark-foot">Time-Warp &amp; Upgrade Subsystem</div>
              </div>

              <div class="oq-wizard-content-pane">
                <div class="oq-wizard-step" id="oq-wizard-step-pick">
                  <h2 class="oq-wizard-page-title" id="oq-wizard-step-title">Select Target Windows Era</h2>
                  <p class="oq-wizard-page-desc" id="oq-wizard-step-desc">Choose which version of Windows you want Setup to install.</p>

                  <fieldset class="oq-wizard-fieldset">
                    <legend>Available Operating Systems</legend>
                    <div class="oq-wizard-era-list" role="radiogroup" aria-label="Windows versions">
                      ${ERAS.map((era) => `
                        <div class="oq-wizard-era-option ${era.id === theme ? 'current' : ''}" data-era="${era.id}" role="radio" tabindex="0" aria-checked="${era.id === theme}">
                          <label class="oq-wizard-era-label">
                            <input type="radio" name="target_era" value="${era.id}" ${era.id === theme ? 'checked' : ''}>
                            <span>${era.name} (${era.year}) ${era.id === theme ? '<span class="oq-wizard-current-tag">[Current]</span>' : ''}</span>
                          </label>
                          <div class="oq-wizard-era-desc">${era.desc}</div>
                        </div>
                      `).join("")}
                    </div>
                  </fieldset>
                </div>

                <div class="oq-wizard-step" id="oq-wizard-step-progress" hidden>
                  <div class="oq-wizard-progress-pane">
                    <p style="margin:0;font-size:11px;">Please wait while the Wizard prepares to transition your operating system...</p>
                    <div class="oq-wizard-progress-box" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                      <div class="oq-wizard-progress-fill" id="oq-wizard-pbar"></div>
                    </div>
                    <div class="oq-wizard-status-line" id="oq-wizard-status">Checking system configuration...</div>
                    <div class="oq-wizard-time-rem" id="oq-wizard-time">Estimated time remaining: 39 minutes</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="oq-wizard-divider" aria-hidden="true"></div>

            <div class="${c.buttonRow}">
              <button type="button" id="oq-wizard-back" disabled>&lt; Back</button>
              <button type="button" id="oq-wizard-next" class="${c.btnDefault}">Next &gt;</button>
              <button type="button" id="oq-wizard-cancel">Cancel</button>
            </div>
          </div>
        </section>
      `;
    }

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
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = isMatch;
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
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.hidden = true;
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
      icon.className = `start-menu-icon icon-wizard icon-wizard-${theme === "win31" ? "31" : theme === "win7" ? "7" : theme === "xp" ? "modern" : "9x"}`;
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
        <span class="desktop-icon-glyph icon-wizard icon-wizard-${theme === "win7" ? "7" : theme === "xp" ? "modern" : "9x"}" aria-hidden="true"></span>
        <span class="desktop-icon-label">Upgrade Wizard</span>
      `;

      // Single click selects (and deselects other icons). Open on dblclick (fine pointer) or click (touch/coarse)
      iconEl.addEventListener("click", () => {
        const desktop = iconEl.closest("#desktop") || document;
        desktop.querySelectorAll(".desktop-icon.selected").forEach((el) => {
          if (el !== iconEl) el.classList.remove("selected");
        });
        iconEl.classList.add("selected");
        if (window.matchMedia("(pointer: coarse)").matches) {
          openWizard();
        }
      });
      iconEl.addEventListener("dblclick", () => {
        openWizard();
      });
      iconEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openWizard();
        }
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
          <span class="prog-icon-glyph icon-wizard icon-wizard-31" aria-hidden="true"></span>
          <span class="prog-icon-label">Upgrade Wizard</span>
        `;
        progBtn.addEventListener("click", () => {
          const winMain = progBtn.closest("#win-group-main") || document;
          winMain.querySelectorAll(".prog-icon.selected").forEach((b) => {
            if (b !== progBtn) b.classList.remove("selected");
          });
          progBtn.classList.add("selected");
          if (window.matchMedia("(pointer: coarse)").matches) {
            openWizard();
          }
        });
        progBtn.addEventListener("dblclick", () => {
          openWizard();
        });
        progBtn.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openWizard();
          }
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
