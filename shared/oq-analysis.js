// A real ES module -- not a classic script, unlike every other shared/*.js
// in this repo. Per CLAUDE.md: that's a deliberate exception, not a
// convention break. This is the one file that actually needs it --
// consuming the standalone jandahl/oq-api public-api.js "properly" (a real `import`,
// not re-fetching raw upstream data the way shared/dict-source.js does)
// means the module itself has to be an ES module, since public-api.js only
// documents itself as importable that way ("consume by importing this file
// directly (browser ES module or Node)"). This repo targets http(s)
// hosting, not file://, so that's not a constraint here.
//
// Imported from oq-api's pinned 0.3 release rather than vendored —
// public-api.js's whole point is to be a stable import boundary;
// vendoring a copy would defeat that and silently drift stale.
//
// The 0.3 API is the first release that exposes the standardized example
// catalog consumed below. Keep this pinned so the catalog and its schema do
// not silently drift.
//
// Dynamic import(), not a static top-level `import` -- a static import
// that fails (network error, CORS, the target host 404ing/reshaping)
// would throw before ANY of this module's own code runs, including a
// top-level try/catch, which would leave window.OqAnalysis unset and
// "oq-analysis-ready" never dispatched -- dos/app.js's waitForOqAnalysis()
// would then hang forever with no error surfaced, since nothing ever
// settles the promise it's awaiting. Wrapping the whole thing in an async
// IIFE lets a genuine load failure be caught and turned into a real error
// state instead.
(async () => {
  let api;
  try {
    // Pin the deployed oq-api release so this app does not silently drift.
    api = await import("https://jandahl.github.io/api.oq.gl/api/v0.3.0/public-api.js");
  } catch (err) {
    // window.OqAnalysis.analyzeWord still exists and is still a function
    // that returns a rejected Promise -- callers (dos/app.js's
    // searchDecon()) already have a catch path for a rejected
    // analyzeWord() call, so this reuses that instead of needing a
    // separate "module failed to load" branch on every caller.
    window.OqAnalysis = {
      API_VERSION: null,
      analyzeWord: () => Promise.reject(new Error(`oq public API failed to load (${err.message})`)),
    };
    window.dispatchEvent(new Event("oq-analysis-ready"));
    return;
  }

  const {
    API_VERSION,
    analyzeWordAsync,
    mergeMorphemeSources,
    glossSummaryItems,
    findExactDictMatch,
    computeMorphemeBreakdownRows,
    GRAMMAR_MORPHEMES_URL,
    SCHEMA_MAJOR_VERSION,
    STANDARD_EXAMPLES,
    getStandardExamples,
  } = api;

  // oq's own gloss text can contain real single-glyph Unicode punctuation
  // CP437 never had: an em/en dash (e.g. a mood-label phrase like
  // "exclamation — he/she/it") and a single "…" ellipsis character (e.g.
  // "that … he/she/it"). A dash has no period-accurate substitute other
  // than a plain "-" (real DOS software just used one), but "…" isn't
  // being dropped, only transposed to what it always actually was under
  // the hood on a real DOS box: three separate "." characters, not one
  // glyph -- CP437 has no dedicated ellipsis code point either. Applied at
  // the source here rather than in each theme's own rendering code, so
  // every consumer of this module gets DOS-safe text for free instead of
  // needing to remember to sanitize it.
  function toDosPunctuation(text) {
    return text.replace(/[–—]/g, "-").replace(/…/g, "...");
  }

  // Grammarian only for MORPHEMES, not katersat affixes -- oq's own
  // Deconstruct view merges both morpheme sources, but grammarian alone is
  // the authoritative "buildable" set here. Lexeme/gloss lists (OQ!) are a
  // separate path: shared/dict-source.js loadDictEntries() merges Chicago +
  // katersat at runtime (Option C; see shared/SOURCES.md).
  const GRAMMAR_SOURCE_CONFIG = {
    source: "grammarian",
    buildable: true,
    schemaMajorVersion: SCHEMA_MAJOR_VERSION,
  };

  let presetsPromise = null; // in-flight/settled Promise<preset[]> or null

  function loadPresets() {
    if (!presetsPromise) {
      presetsPromise = fetch(GRAMMAR_MORPHEMES_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((value) => {
          const { presets, anyOk } = mergeMorphemeSources(
            [{ status: "fulfilled", value }],
            [GRAMMAR_SOURCE_CONFIG],
          );
          if (!anyOk) throw new Error("grammarian morpheme source failed");
          return presets;
        })
        .catch((err) => {
          presetsPromise = null; // let a retry actually retry, not replay the same rejection
          throw err;
        });
    }
    return presetsPromise;
  }

  /**
   * Deconstructs `word` into its constituent morphemes via oq's real
   * analysis engine, plus a same-spelling dictionary cross-reference.
   * Cancels a still-running search when `signal` fires (an unparseable
   * word can take real seconds against the full grammarian set) -- the
   * caller is expected to abort a stale search itself on every new
   * keystroke, same as oq's own Deconstruct view does. Presets and the
   * dictionary lookup are independent of each other -- kicked off
   * together, not one after the other, so a cold-cache first search
   * doesn't pay for both fetches back-to-back.
   * @param {string} word
   * @param {{ signal?: AbortSignal }} [opts]
   * @returns {Promise<{
   *   query: string,
   *   matches: Array<{
   *     word: string, approximate: boolean, meaning: string, presentationVariants: object|null,
   *     breakdown: Array<{ marker: string, text: string, gloss: string, leftPad: number, rightPad: number }>,
   *   }>,
   *   dictMatch: any | null,
   *   elapsedMs: number,
   *   evalCount: number,
   * }>}
   */
  async function analyzeWord(word, { signal } = {}) {
    const [{ query, matches, elapsedMs, evalCount }, dictMatch] = await Promise.all([
      loadPresets().then((presets) => analyzeWordAsync(word, presets, {}, { signal })),
      findExactDictMatch(word),
    ]);
    return {
      query,
      matches: matches.map((m) => {
        const items = glossSummaryItems(m.seq);
        // The last item's shortGloss usually already reads as the whole
        // word's composed meaning (oq's own chain-glossing threads the
        // running stem through each step) -- but not always the truly last
        // one: a word-closing item derived through a category shift (or a
        // trailing Ø ending -- jandahl/oq#592 lets analyzeWord return the
        // explicit zero-ending chain as its own distinct match, alongside
        // the bare root) can have an honestly-unfilled template with
        // nothing to compose forward onto. Checked against the raw
        // scholarly `gloss` field specifically -- exactly what oq's own
        // renderMatchCard checks for the identical reason -- NOT
        // shortGloss/rawShortGloss: a Ø item's OWN gloss has no preceding
        // stem to thread through in the first place, so its shortGloss/
        // rawShortGloss can read as a plain, blank-free "one (basic
        // form)"-style phrase (nothing looks "unfilled" about it) even
        // though the exact same item's `gloss` still literally reads "one
        // ___ (the basic form: ...)" -- checking the wrong field here
        // would make the walk stop AT the Ø item instead of skipping past
        // it. Skip back past any item whose `gloss` is still unfilled to
        // the last one with a real composed sense.
        const meaningItem = [...items].reverse().find((item) => item.gloss && !item.gloss.includes("___")) ?? items[items.length - 1];

        // Column-aligned padding via oq's own real algorithm (jandahl/oq#831),
        // not the from-scratch prefix-diff approximation this file used to
        // have, which was off by one/two columns in cases oq's own real
        // step-replay logic already handled correctly.
        const rows = computeMorphemeBreakdownRows(items, m.word, m.seq);

        return {
          word: m.word,
          approximate: m.approximate,
          presentationVariants: items.find((item) => item.presentationVariants)?.presentationVariants ?? null,
          // gloss (filled, fully composed), not shortGloss -- shortGloss is
          // each item's own compact, per-row contribution ("statement - I"
          // for a mood ending in isolation); gloss is the running-composed
          // sense threaded through fillStemSlot() as each step builds on
          // the last ("to have a(n) dog" -> "I have a dog"), matching
          // exactly what oq's own Deconstruct view promotes as the headline
          // (docs/deconstruct.js's renderMatchCard: `last.gloss`).
          meaning: meaningItem ? toDosPunctuation(meaningItem.gloss) : "",
          // rawShortGloss for the per-morpheme rows, not shortGloss --
          // deliberately UNFILLED ("someone looks for ___", not "someone
          // looks for birthday"): the per-morpheme breakdown is showing
          // what EACH morpheme contributes in isolation, and filling the
          // blank in with a value that only exists once the whole chain is
          // composed misrepresents that. Only the whole-word `meaning`
          // above should be filled in.
          //
          // rows already drops Ø items itself (computeMorphemeBreakdownRows()).
          // text + changedRanges kept as-is (not flattened/pre-sliced) so a
          // caller can style just the changed letters differently --
          // jandahl/oq#833 generalized this to cover BOTH a row's own
          // TRAILING letters the next boundary replaces/drops (e.g. -qaq's
          // own final "q" before -vunga) AND its own LEADING letters an
          // allomorph pick changes (e.g. -vunga's own "v" resolving to "p")
          // -- same distinction oq's own UI draws with its
          // ".result-gloss-truncated" color, just no longer trailing-only.
          breakdown: rows.map((row) => ({
            marker: row.marker,
            text: row.text,
            changedRanges: row.changedRanges,
            gloss: toDosPunctuation(row.item.rawShortGloss),
            leftPad: row.leftPad,
            rightPad: row.rightPad,
          })),
        };
      }),
      // .expected/.gloss_en specifically, not the whole object -- dictMatch
      // is oq's own NormalizedEntry shape (see dos/app.js's own comment on
      // it), only these two fields ever reach a DOS screen.
      dictMatch: dictMatch ? { ...dictMatch, expected: toDosPunctuation(dictMatch.expected), gloss_en: toDosPunctuation(dictMatch.gloss_en) } : null,
      elapsedMs,
      evalCount,
    };
  }

  // Keep the canonical public catalog behind the API boundary too. Consumers
  // that enrich or annotate examples must use getStandardExamples(), which
  // returns a defensive copy; STANDARD_EXAMPLES is the immutable source.
  window.OqAnalysis = {
    API_VERSION,
    analyzeWord,
    STANDARD_EXAMPLES,
    getStandardExamples,
  };
  // type="module" scripts are deferred until after classic scripts (like
  // dos/app.js) have already run their own top-level code, so a classic
  // script can't just destructure window.OqAnalysis at parse time the way
  // it does with window.OqDictSource. This lets a caller that ran before
  // this line (e.g. a deep-link ?screen=decon&word=... firing OqRouter's
  // onChange immediately on registration) wait for the module to actually
  // finish instead of seeing undefined.
  window.dispatchEvent(new Event("oq-analysis-ready"));
})();
