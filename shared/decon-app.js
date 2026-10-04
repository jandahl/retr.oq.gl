// Shared DECON (word deconstruction) search/abort/order-toggle core --
// classic script, matching this repo's convention (see CLAUDE.md): exposes
// window.OqDecon rather than exporting, loaded before any theme's own
// app.js the same way shared/redmond/window-manager.js already is.
//
// Extracted out of dos/app.js the first time a second consumer (win98/,
// then xp/) was actually on the table -- same precedent as
// shared/redmond/window-manager.js's own extraction (see that file's own
// comment). What's genuinely shared: calling shared/oq-analysis.js's
// analyzeWord() with abort-on-supersede, the "Root first"/"Final first"
// order toggle persisted to localStorage, and waiting for the async
// window.OqAnalysis module to finish loading. What stays theme-specific:
// the DOM structure of a rendered result (dos/'s text-mode `.`-padded
// rows vs. win98's/xp's own window-styled markup) and each theme's own
// router wiring / open-close chrome -- this module renders nothing itself,
// it only calls back into a `render` function the caller supplies.
(() => {
  "use strict";

  const ROOT_FIRST_STORAGE_KEY = "retr-oq:decon-root-first";

  function getStoredRootFirst() {
    try {
      const stored = localStorage.getItem(ROOT_FIRST_STORAGE_KEY);
      return stored === null ? true : stored === "1";
    } catch {
      return true; // localStorage can throw in a sandboxed iframe -- default to root-first
    }
  }

  function setStoredRootFirst(value) {
    try {
      localStorage.setItem(ROOT_FIRST_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // sandboxed iframe or storage disabled -- the toggle still applies for this visit, just doesn't persist
    }
  }

  // window.OqAnalysis is set by shared/oq-analysis.js, a type="module"
  // script -- deferred by the platform until after any classic script's
  // own top-level code has already run, so it can be missing at the exact
  // moment a deep link fires. oq-analysis.js dispatches "oq-analysis-ready"
  // on window right after setting the global, so this just waits for
  // whichever already happened.
  function waitForOqAnalysis(signal) {
    if (signal && signal.aborted) {
      return Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }
    if (window.OqAnalysis) return Promise.resolve(window.OqAnalysis);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener("oq-analysis-ready", onReady);
        reject(new Error("oq-analysis.js did not load"));
      }, 8000);
      function onReady() {
        clearTimeout(timer);
        resolve(window.OqAnalysis);
      }
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          window.removeEventListener("oq-analysis-ready", onReady);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }, { once: true });
      }
      window.addEventListener("oq-analysis-ready", onReady, { once: true });
    });
  }

  /**
   * @param {{
   *   isRootFirst: () => boolean,          // reads the caller's own order toggle state
   *   onStatus: (text: string) => void,    // called with a status line ("Analyzing...", the result count, an error)
   *   onRender: (analysis: {matches, dictMatch}) => void, // called with a fresh (or re-ordered) result to render
   *   onClear: () => void,                 // called to blank out any previously rendered results
   * }} config
   */
  function createController({ isRootFirst, onStatus, onRender, onClear }) {
    // Cached so toggling "Root first" can re-render the existing results in
    // the new order without re-running the search itself.
    let lastAnalysis = null;
    // Cancels a still-running search when a newer one supersedes it -- an
    // unparseable word can take real seconds against the full grammarian
    // set (shared/oq-analysis.js's own comment), so without this every
    // keystroke would pile up abandoned searches finishing out of order.
    let searchAbort = null;

    function abort() {
      if (searchAbort) searchAbort.abort();
    }

    function reset() {
      abort();
      lastAnalysis = null;
      onClear();
    }

    function reRenderLast() {
      if (lastAnalysis) onRender(lastAnalysis);
    }

    async function search(word) {
      abort();
      const trimmed = word.trim();
      onClear();
      lastAnalysis = null;
      if (trimmed === "") {
        onStatus("Type a word, press Enter.");
        return;
      }
      searchAbort = new AbortController();
      const { signal } = searchAbort;
      onStatus("Analyzing...");
      try {
        const analysis = await waitForOqAnalysis(signal);
        if (signal.aborted) return;
        const analyzeFn = analysis.analyzeInput || analysis.analyzeWord;
        const result = await analyzeFn(trimmed, { signal });
        if (signal.aborted) return; // a newer search already took over
        lastAnalysis = result;
        onRender(result);
        if (result.type === "sentence") {
          const tokenCount = result.tokens ? result.tokens.length : 0;
          const mode = result.clause?.mode ? `mode: ${result.clause.mode}` : "sentence";
          onStatus(
            `${tokenCount} token${tokenCount === 1 ? "" : "s"} (${mode}) in ${Math.round(result.elapsedMs)}ms.`,
          );
        } else {
          const found = (result.matches && result.matches.length) || result.dictMatch;
          const evalCount = typeof result.evalCount === "number" ? result.evalCount.toLocaleString() : "0";
          onStatus(
            found
              ? `${evalCount} combinations tried in ${Math.round(result.elapsedMs)}ms.`
              : `No parse found (${evalCount} combinations tried in ${Math.round(result.elapsedMs)}ms).`,
          );
        }
      } catch (err) {
        if (err && err.name === "AbortError") return; // superseded, not a real failure
        const message = err && err.message ? err.message : String(err);
        onStatus(`Could not analyze (${message}).`);
      }
    }

    return { search, abort, reset, reRenderLast, getLastAnalysis: () => lastAnalysis };
  }

  window.OqDecon = { getStoredRootFirst, setStoredRootFirst, createController };
})();
