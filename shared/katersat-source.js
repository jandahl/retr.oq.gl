// Shared katersat lexicon loader for retr-oq themes that want Option C
// enrichment (Chicago primary + katersat extras / gloss backfill).
//
// Runtime HTTP fetch only — do NOT vendor the published JSON into this MIT
// repo. Published katersat JSON is GPL-3.0-or-later (no CC-BY-SA grant);
// fetching over HTTP and displaying with attribution matches jandahl/oq's
// pattern (see jandahl/oq docs/SOURCES.md §3 — authoritative over the
// mermaid slip that still says CC-BY-SA for katersat data).
//
// Classic script → window.OqKatersatSource. Load after nothing in particular;
// dict-merge.js expects this global when merging.
(() => {
  "use strict";

  const KATERSAT_BASE = "https://jandahl.github.io/Oqaasileriffik-katersat";
  const KATERSAT_LEXICON_GZ = `${KATERSAT_BASE}/lexicon.json.gz`;
  const KATERSAT_LEXICON_JSON = `${KATERSAT_BASE}/lexicon.json`;

  // Letters published beside lexicon.json by the exporter (a–z + æ ø å).
  const KATERSAT_LETTERS = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
    "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "æ", "ø", "å",
  ];

  // Attribution required wherever katersat data is shown (GPL-3.0-or-later).
  const KATERSAT_ATTRIBUTION =
    "Oqaasileriffik / Greenland Language Secretariat — katersat lexicon (GPL-3.0-or-later)";

  /**
   * The exporter has used both string arrays and arrays of translation
   * records over time. Keep the loader tolerant of either shape (and of a
   * keyed translation object) so a schema-only upstream change cannot turn
   * every Kater gloss into an empty string.
   * @param {any} value
   * @returns {string[]}
   */
  function translationStrings(value) {
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.flatMap(translationStrings);
    if (!value || typeof value !== "object") return [];

    for (const key of ["text", "value", "translation", "gloss", "meaning"]) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const strings = translationStrings(value[key]);
        if (strings.length) return strings;
      }
    }
    return Object.values(value).flatMap(translationStrings);
  }

  function uniqueTranslationStrings(value) {
    return [...new Set(translationStrings(value))];
  }

  /**
   * Join non-empty English senses with "; " (same choice as jandahl/oq's
   * entryToPreset). Empty english[] → gloss_en "" (e.g. aalajavoq). We do
   * **not** fall back to danish for gloss_en — danish stays optional on
   * gloss_da only.
   * @param {any} lex
   * @returns {{ id: string, lexeme: string, gloss_en: string, gloss_da?: string, source: 'katersat' } | null}
   */
  function normalizeKatersatLexeme(lex) {
    const lexeme = String(lex?.kalaallisut ?? "").trim();
    if (!lexeme) return null;
    const english = uniqueTranslationStrings(lex?.english);
    const gloss_en = english.join("; ");
    const danish = uniqueTranslationStrings(lex?.danish);
    const gloss_da = danish.join("; ");
    const out = {
      id: lex?.id != null ? String(lex.id) : lexeme,
      lexeme,
      gloss_en,
      source: /** @type {const} */ ("katersat"),
    };
    if (gloss_da) out.gloss_da = gloss_da;
    return out;
  }

  /**
   * @param {any} data
   * @returns {boolean}
   */
  function isLexiconShape(data) {
    return Array.isArray(data?.lexemes);
  }

  /**
   * @param {Response} res
   * @returns {Promise<any>}
   */
  async function decodeGzipResponse(res) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("DecompressionStream unavailable");
    }
    if (!res.body) throw new Error("Response body missing for gzip decode");
    const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  /**
   * Prefer lexicon.json.gz via fetch + DecompressionStream('gzip'); fall back
   * to uncompressed lexicon.json; then to by-letter/{letter}.json(.gz) shards.
   * @returns {Promise<any>}
   */
  async function fetchKatersatDocument() {
    // 1) Full gzip (preferred ~3.9MB)
    try {
      const res = await fetch(KATERSAT_LEXICON_GZ);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await decodeGzipResponse(res);
      if (!isLexiconShape(data)) throw new Error("Unrecognized gzip lexicon shape");
      return data;
    } catch (_gzErr) {
      // continue
    }

    // 2) Full uncompressed JSON
    try {
      const res = await fetch(KATERSAT_LEXICON_JSON);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isLexiconShape(data)) throw new Error("Unrecognized lexicon.json shape");
      return data;
    } catch (_jsonErr) {
      // continue
    }

    // Letter shards in parallel. Sequential 404s through 29×2 URLs is
    // what made Aqua's "katersat is down" Time Machine preview sit on
    // "Loading dictionary…" past Playwright's 5s wait: Chicago was
    // already in memory, but Promise.all waited on this whole walk.
    let lastErr;
    const shardResults = await Promise.all(
      KATERSAT_LETTERS.map(async (letter) => {
        const urls = [
          `${KATERSAT_BASE}/by-letter/${letter}.json.gz`,
          `${KATERSAT_BASE}/by-letter/${letter}.json`,
        ];
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = url.endsWith(".gz")
              ? await decodeGzipResponse(res)
              : await res.json();
            if (!isLexiconShape(data)) throw new Error(`Bad shard shape ${url}`);
            return data.lexemes;
          } catch (err) {
            lastErr = err;
          }
        }
        return null;
      }),
    );
    const all = [];
    let anyOk = false;
    for (const lexemes of shardResults) {
      if (!lexemes) continue;
      anyOk = true;
      all.push(...lexemes);
    }
    if (!anyOk) {
      throw lastErr || new Error("katersat lexicon unavailable");
    }
    return { meta: { source: "by-letter" }, lexemes: all };
  }

  let loaded = null;
  let loading = null;

  /**
   * Fetches and caches normalized katersat lexemes. Concurrent callers share
   * one in-flight promise (same dedupe pattern as shared/dict-source.js).
   * @returns {Promise<Array<{ id: string, lexeme: string, gloss_en: string, gloss_da?: string, source: 'katersat' }>>}
   */
  function loadKatersatLexemes() {
    if (loaded) return Promise.resolve(loaded);
    if (loading) return loading;
    loading = fetchKatersatDocument()
      .then((data) => {
        const out = [];
        for (const lex of data.lexemes) {
          const n = normalizeKatersatLexeme(lex);
          if (n) out.push(n);
        }
        loaded = out;
        return loaded;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  /** Test helper — clears in-memory cache between unit tests. */
  function resetKatersatState() {
    loaded = null;
    loading = null;
  }

  window.OqKatersatSource = {
    KATERSAT_ATTRIBUTION,
    KATERSAT_LEXICON_GZ,
    KATERSAT_LEXICON_JSON,
    loadKatersatLexemes,
    normalizeKatersatLexeme,
    translationStrings,
    resetKatersatState,
  };
})();
