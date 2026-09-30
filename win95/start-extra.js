window.OqWin95Start = function (menu) {
  if (!menu || menu.querySelector(".start-menu-banner")) return;
  if (!document.querySelector('link[href*="start-extra.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "start-extra.css?v=2";
    document.head.appendChild(link);
  }
  const banner = document.createElement("li");
  banner.className = "start-menu-banner";
  banner.setAttribute("aria-hidden", "true");
  banner.innerHTML = '<span class="start-menu-banner-text"><strong>OQ!</strong>95</span>';
  menu.insertBefore(banner, menu.firstChild);

  function addItem(label, className, opts) {
    const li = document.createElement("li");
    li.setAttribute("role", "menu-item");
    li.className = "start-menu-item" + (opts.disabled ? " start-menu-item--disabled" : "");
    const icon = document.createElement("span");
    icon.className = "start-menu-icon " + className;
    icon.setAttribute("aria-hidden", "true");
    li.append(icon, document.createTextNode(" " + label));
    if (opts.onClick && !opts.disabled) {
      li.addEventListener("click", function () {
        menu.hidden = true;
        opts.onClick();
      });
    }
    return li;
  }

  // Classic Win95 Start shape: Programs, Documents, Settings, Find, Help,
  // Run, Shut Down. Favorites / Windows Update belong to IE4 / Win98 — do
  // not inject them here. Run is inserted by shared/redmond/run.js.
  const shutdown = menu.querySelector("#start-menu-shutdown");
  const settings = menu.querySelector('[data-open="win-settings"]');

  menu.insertBefore(addItem("Documents", "icon-documents", { disabled: true }), settings || shutdown);

  const afterSettings = settings && settings.nextSibling;
  menu.insertBefore(
    addItem("Find", "icon-find", {
      onClick: function () {
        window.alert("Find is a stub — there is no file system to search.");
      },
    }),
    afterSettings || shutdown
  );
  menu.insertBefore(
    addItem("Help", "icon-help", {
      onClick: function () {
        window.alert("retr-oq OQ!95 prototype. Shut Down returns to the theme picker.");
      },
    }),
    shutdown
  );
};
