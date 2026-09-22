window.OqWin98Start = function (menu) {
  if (!menu || menu.querySelector(".start-menu-banner")) return;
  if (!document.querySelector('link[href*="start-extra.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "start-extra.css?v=1";
    document.head.appendChild(link);
  }
  const banner = document.createElement("li");
  banner.className = "start-menu-banner";
  banner.setAttribute("aria-hidden", "true");
  banner.innerHTML = '<span class="start-menu-banner-text"><strong>Oq!</strong>98</span>';
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

  const shutdown = menu.querySelector("#start-menu-shutdown");
  const firstReal = menu.querySelector(".start-menu-item");
  const update = addItem("Windows Update", "icon-update", {
    onClick: function () {
      window.open("https://www.debian.org/", "_blank", "noopener");
    },
  });
  const div0 = document.createElement("li");
  div0.className = "start-menu-divider";
  menu.insertBefore(div0, firstReal);
  menu.insertBefore(update, div0);

  const programs = menu.querySelector(".icon-programs");
  const programsItem = programs && programs.closest("li");
  const settings = menu.querySelector('[data-open="win-settings"]');
  const afterPrograms = programsItem && programsItem.nextSibling;
  menu.insertBefore(addItem("Favorites", "icon-favorites", { disabled: true }), afterPrograms || settings || shutdown);
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
        window.alert("retr-oq Windows 98 prototype. Shut Down returns to the theme picker.");
      },
    }),
    shutdown
  );
};
