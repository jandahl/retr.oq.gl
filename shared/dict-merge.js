// Chicago (CC-BY-SA 4.0) primary + katersat (GPL-3.0-or-later) enrichment.
// Option C — runtime HTTP fetch only; never vendor katersat JSON.
// See shared/SOURCES.md.
//
// Classic script → window.OqDictMerge. Load order:
//   dict-source.js → katersat-source.js → dict-merge.js
//
// Themes should keep calling OqDictSource.loadDictEntries() (the public
// choke point); that delegates here when this script is present.
(() => {
  "use strict";

  /**
   * Merge rules (oq-inspired, kept simple):
   * 1. Index both by lowercased surface form (lexeme / kalaallisut).
   * 2. Chicago rows always stay (source 'chicago').
   * 3. Empty Chicago gloss_en + katersat english → backfill, mark
   *    glossSource: 'katersat' and sources: ['chicago','katersat'].
   * 4. Katersat headwords not in Chicago → append (source: 'katersat').
   * 5. Homographs / multi-sense: english senses joined with "; " (deduped),
   *    same choice as jandahl/oq. No danish→english gloss fallback.
   */

  function surfaceKey(lexeme) {
    return String(lexeme || "").trim().toLowerCase();
  }

  /**
   * @param {Array<{ lexeme: string, gloss_en?: string, gloss_da?: string, id?: string }>} katRows
   */
  function indexKatersatBySurface(katRows) {
    /** @type {Map<string, { id: string, lexeme: string, gloss_en: string, gloss_da?: string, _enParts: string[] }>} */
    const map = new Map();
    for (const row of katRows) {
      const key = surfaceKey(row.lexeme);
      if (!key) continue;
      const existing = map.get(key);
      const enParts = String(row.gloss_en || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!existing) {
        map.set(key, {
          id: row.id != null ? String(row.id) : row.lexeme,
          lexeme: row.lexeme,
          gloss_en: "",
          gloss_da: row.gloss_da || undefined,
          _enParts: [...enParts],
        });
      } else {
        for (const p of enParts) existing._enParts.push(p);
        if (!existing.gloss_da && row.gloss_da) existing.gloss_da = row.gloss_da;
      }
    }
    for (const entry of map.values()) {
      entry.gloss_en = [...new Set(entry._enParts)].join("; ");
      delete entry._enParts;
    }
    return map;
  }

  /**
   * Pure merge (unit-testable). Pass katersat=null for Chicago-only.
   * @param {Array<{ lexeme: string, gloss_en?: string, [k: string]: any }>} chicago
   * @param {Array<{ id?: string, lexeme: string, gloss_en?: string, gloss_da?: string }>|null} katersat
   */
  function mergeDictEntries(chicago, katersat) {
    const chicagoList = Array.isArray(chicago) ? chicago : [];
    const katList = Array.isArray(katersat) ? katersat : null;
    const katersatLoaded = katList !== null;

    if (!katersatLoaded) {
      const entries = chicagoList.map((e) => ({
        ...e,
        lexeme: e.lexeme,
        gloss_en: e.gloss_en != null ? String(e.gloss_en) : "",
        source: "chicago",
        sources: ["chicago"],
      }));
      return { entries, katersatLoaded: false };
    }

    const katIndex = indexKatersatBySurface(katList);
    const chicagoKeys = new Set();
    const entries = [];

    for (const e of chicagoList) {
      const lexeme = String(e.lexeme || "").trim();
      if (!lexeme) continue;
      const key = surfaceKey(lexeme);
      chicagoKeys.add(key);
      let gloss_en = e.gloss_en != null ? String(e.gloss_en) : "";
      const sources = ["chicago"];
      /** @type {object} */
      const row = {
        ...e,
        lexeme,
        gloss_en,
        source: "chicago",
        sources,
      };
      const kat = katIndex.get(key);
      if (!gloss_en.trim() && kat && kat.gloss_en.trim()) {
        row.gloss_en = kat.gloss_en;
        row.glossSource = "katersat";
        sources.push("katersat");
        if (kat.gloss_da && !row.gloss_da) row.gloss_da = kat.gloss_da;
      }
      entries.push(row);
    }

    for (const [key, kat] of katIndex) {
      if (chicagoKeys.has(key)) continue;
      /** @type {object} */
      const extra = {
        id: kat.id,
        lexeme: kat.lexeme,
        gloss_en: kat.gloss_en,
        source: "katersat",
        sources: ["katersat"],
      };
      if (kat.gloss_da) extra.gloss_da = kat.gloss_da;
      entries.push(extra);
    }

    return { entries, katersatLoaded: true };
  }

  let loaded = null;
  let loading = null;

  /**
   * Load Chicago via loadChicagoOnly + katersat in parallel; merge.
   * Katersat failure is non-blocking.
   */
  function loadMergedDictEntries() {
    if (loaded) return Promise.resolve(loaded);
    if (loading) return loading;

    const dict = window.OqDictSource;
    const kat = window.OqKatersatSource;
    if (!dict || typeof dict.loadChicagoOnly !== "function") {
      return Promise.reject(new Error("OqDictSource.loadChicagoOnly missing"));
    }

    const chicagoPromise = dict.loadChicagoOnly();
    const katPromise =
      kat && typeof kat.loadKatersatLexemes === "function"
        ? kat.loadKatersatLexemes().then(
            (lexemes) => ({ ok: true, lexemes }),
            (err) => ({ ok: false, err }),
          )
        : Promise.resolve({ ok: false, err: new Error("OqKatersatSource missing") });

    loading = Promise.all([chicagoPromise, katPromise])
      .then(([chicago, katResult]) => {
        const attributions = { chicago: dict.DICT_ATTRIBUTION };
        let katRows = null;
        if (katResult.ok) {
          katRows = katResult.lexemes;
          if (kat && kat.KATERSAT_ATTRIBUTION) {
            attributions.katersat = kat.KATERSAT_ATTRIBUTION;
          }
        }
        const { entries, katersatLoaded } = mergeDictEntries(chicago, katRows);
        const result = { entries, attributions, katersatLoaded };
        // A failed katersat fetch must not stick. Chicago is already cached
        // by loadChicagoOnly, so the next call retries the lexicon only.
        if (katResult.ok) loaded = result;
        return result;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  function resetMergeState() {
    loaded = null;
    loading = null;
  }

  function filterDictEntries(entries, query) {
    const dict = window.OqDictSource;
    if (dict && typeof dict.filterDictEntries === "function") {
      return dict.filterDictEntries(entries, query);
    }
    const q = String(query || "").trim().toLowerCase();
    if (q === "") return entries;
    return entries.filter(
      (e) =>
        String(e.lexeme || "")
          .toLowerCase()
          .includes(q) ||
        String(e.gloss_en || "")
          .toLowerCase()
          .includes(q),
    );
  }

  window.OqDictMerge = {
    loadMergedDictEntries,
    mergeDictEntries,
    filterDictEntries,
    resetMergeState,
  };
})();
