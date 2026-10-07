/* Shared controller for the native-looking Classic Cupertino Time Machine. */
(() => {
  "use strict";
  const registry = window.OqCupertino;
  if (!registry) return;
  const classic = document.body.classList.contains("mac8") ? "mac8" : "system1";
  const menu = document.querySelector('.desktop-menu-bar [role="menu"], .mac8-menu-bar [role="menu"]');
  if (!menu) return;

  const item = document.createElement("li");
  item.className = "divider";
  item.setAttribute("role", "menu-item");
  item.innerHTML = '<a href="#" id="cupertino-classic-time-machine">Time Machine…</a>';
  menu.appendChild(item);

  const overlay = document.createElement("div");
  overlay.className = `cupertino-classic-tm ${classic}`;
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="cupertino-classic-tm__panel" role="dialog" aria-modal="true" aria-labelledby="cupertino-classic-tm-title">
      <h1 class="cupertino-classic-tm__title" id="cupertino-classic-tm-title">Time Machine</h1>
      <p class="cupertino-classic-tm__hint">Browse the Cupertino desk through the years.</p>
      <div class="cupertino-classic-tm__timeline" role="listbox" aria-label="Cupertino eras"></div>
      <div class="cupertino-classic-tm__preview" aria-live="polite"></div>
      <div class="cupertino-classic-tm__actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="restore">Restore</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  const timeline = overlay.querySelector(".cupertino-classic-tm__timeline");
  const preview = overlay.querySelector(".cupertino-classic-tm__preview");
  const eras = registry.eras;
  let selected = registry.migrateStoredEra("classic") || "system1";
  let previous = selected;

  function render() {
    timeline.replaceChildren();
    for (const era of eras) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cupertino-classic-tm__era" + (era.id === selected ? " is-selected" : "");
      button.dataset.era = era.id;
      button.dataset.family = era.family;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(era.id === selected));
      button.innerHTML = `<span class="cupertino-classic-tm__era-year">${era.year}</span><span class="cupertino-classic-tm__era-name">${era.name}</span><span class="cupertino-classic-tm__era-blurb">${era.blurb}</span>`;
      button.addEventListener("click", () => { selected = era.id; render(); });
      timeline.appendChild(button);
    }
    const era = eras.find((entry) => entry.id === selected) || eras[0];
    preview.textContent = `${era.name} · ${era.family === "classic" ? "native Classic preview" : "future OS X preview"}`;
  }
  function close() { overlay.hidden = true; document.body.classList.remove("cupertino-classic-tm-open"); }
  function open(event) { event.preventDefault(); previous = selected; render(); overlay.hidden = false; document.body.classList.add("cupertino-classic-tm-open"); }
  item.querySelector("a").addEventListener("click", open);
  overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => { selected = previous; close(); });
  overlay.querySelector('[data-action="restore"]').addEventListener("click", () => {
    localStorage.setItem(registry.storageKey, selected);
    if (registry.eras.find((era) => era.id === selected)?.family === "osx") {
      window.location.href = `../cupertino/?era=${encodeURIComponent(selected)}`;
    } else {
      close();
    }
  });
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden) close(); });
  window.__cupertinoClassicTimeMachine = { open, close, get selected() { return selected; }, eras };
})();
