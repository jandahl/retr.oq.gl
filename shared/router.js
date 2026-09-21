// Tiny, theme-agnostic URL router -- classic script, not type="module",
// matching today's convention across this repo's theme files (see
// CLAUDE.md; not a file:// requirement -- this repo targets http(s)
// hosting).
//
// Deliberately query-string based, not real path segments like jandahl/oq's
// docs/router.js (which this is modeled on): these are static files served
// from GitHub Pages with no server-side rewrite rule behind them --
// "dos/dict/" resolving to anything meaningful needs a server that oq has
// (a real app host) and this repo doesn't (plain static hosting). A query
// string needs no such rule, so "share a link that opens to the same
// state" always works.
//
// Each theme's app.js owns what its own params mean (dos/app.js uses
// "screen"/"filter" for DICT.EXE's open/closed state and filter text) --
// this file only owns reading/writing the query string and telling
// listeners when it changed, the same generic job router.js does in oq
// before any view-specific logic layers on top.
//
// Shared desk params (Redmond and anyone else with a #boot-screen):
//   ?nosplash=1  skip the boot overlay
//   ?run=backrooms   Start → Run that command (win98/xp/win7)
//   ?run=            just open the Run dialog

(() => {
  "use strict";

  /** @returns {URLSearchParams} the current query string, read fresh every call -- never cached, since history navigation can change it out from under a stale copy. */
  function getParams() {
    return new URLSearchParams(location.search);
  }

  /**
   * Merges `updates` into the current query string (a key set to `null` or
   * `undefined` is removed rather than stringified to "null") and pushes or
   * replaces that as the new URL. Fires "oq-route-change" either way, since
   * pushState/replaceState never fire "popstate" on their own -- listeners
   * need one consistent event for "the route changed" regardless of how.
   * @param {Record<string, string|null|undefined>} updates
   * @param {{replace?: boolean}} [options] replace: true for in-place
   *   refinements (e.g. typing into a filter field) that shouldn't each get
   *   their own back-button stop; omit/false for a real navigation (e.g.
   *   opening or closing a full-screen app) that should.
   */
  function navigate(updates, options = {}) {
    const params = getParams();
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    const url = location.pathname + (query ? `?${query}` : "") + location.hash;
    const method = options.replace ? "replaceState" : "pushState";
    try {
      history[method](null, "", url);
    } catch {
      // pushState/replaceState can fail in sandboxed iframes -- the route
      // change event below still fires, so in-page state stays consistent
      // even if the address bar itself can't be updated.
    }
    window.dispatchEvent(new CustomEvent("oq-route-change", { detail: { params } }));
  }

  /**
   * @param {(params: URLSearchParams) => void} callback invoked once
   *   immediately with the current params, then again on every future route
   *   change (back/forward navigation, or any navigate() call above --
   *   including ones from other listeners, same as oq's applyRoute pattern).
   */
  function onChange(callback) {
    callback(getParams());
    window.addEventListener("popstate", () => callback(getParams()));
    window.addEventListener("oq-route-change", (event) => callback(event.detail.params));
  }

  window.OqRouter = { getParams, navigate, onChange };

  function loadNextToRouter(name) {
    const s = document.createElement("script");
    const src = document.currentScript && document.currentScript.src;
    s.src = src ? src.replace(/router\.js.*$/, name) : "../shared/" + name;
    // These two scripts are a dependency chain: the catalog must exist
    // before the saver host boots. Dynamic scripts are async by default.
    s.async = false;
    document.head.appendChild(s);
  }

  function applyDeskParams() {
    const params = getParams();
    if (params.has("nosplash")) {
      const boot = document.getElementById("boot-screen");
      if (boot) {
        boot.classList.add("is-done");
        boot.setAttribute("hidden", "");
      }
    }
    if (!params.has("run")) return;
    const cmd = params.get("run") || "";
    let tries = 0;
    function kick() {
      const api = window.OqRedmondRun;
      if (api) {
        if (cmd) api.run(cmd);
        else api.open();
        return;
      }
      if (tries++ < 40) window.setTimeout(kick, 50);
    }
    kick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDeskParams);
  } else {
    applyDeskParams();
  }

  // Desktop + text-mode themes: load the screensaver host from next to this file.
  if (/\/(win31|win98|xp|win7|kde|mac8|mac1984|aqua|amiga|next|dos|c64)(\/|$)/.test(location.pathname)) {
    loadNextToRouter("redmond/screensaver-catalog.js?v=1");
    loadNextToRouter("redmond/screensaver.js?v=33");
  }
  if (/\/(win98|xp|win7)(\/|$)/.test(location.pathname)) {
    loadNextToRouter("redmond/run.js?v=8");
  }
})();
