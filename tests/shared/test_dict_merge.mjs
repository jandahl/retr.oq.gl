// Node-only unit tests for Chicago + katersat Option C merge.
// Mocked fetch only — never download the real ~4MB lexicon in CI.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test, { beforeEach, afterEach } from "node:test";
import vm from "node:vm";
import { gunzipSync, gzipSync } from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadSharedScripts(sandbox, ...files) {
  for (const file of files) {
    const code = readFileSync(path.join(repoRoot, "shared", file), "utf8");
    vm.runInContext(code, sandbox, { filename: file });
  }
}

function makeSandbox(fetchImpl) {
  const sandbox = {
    window: {},
    console,
    fetch: fetchImpl,
    // Node 20+ may expose DecompressionStream; provide a minimal gzip one
    // when missing so the gzip path can be exercised in CI.
    DecompressionStream:
      typeof globalThis.DecompressionStream === "function"
        ? globalThis.DecompressionStream
        : class DecompressionStream {
            constructor(format) {
              if (format !== "gzip") throw new Error(`unsupported ${format}`);
              const chunks = [];
              this.readable = new ReadableStream({
                start(controller) {
                  this._c = controller;
                },
              });
              // Use TransformStream polyfill via Response path below instead.
              // Simpler: expose a flag that decode uses Response+gunzip in tests
              // by fulfilling with already-decoded JSON for non-gz URLs.
              throw new Error("use uncompressed fallback in this Node build");
            }
          },
    Response: globalThis.Response,
    ReadableStream: globalThis.ReadableStream,
  };
  // Prefer real DecompressionStream when Node has it (20.12+/22+).
  if (typeof globalThis.DecompressionStream === "function") {
    sandbox.DecompressionStream = globalThis.DecompressionStream;
  } else {
    delete sandbox.DecompressionStream;
  }
  vm.createContext(sandbox);
  loadSharedScripts(
    sandbox,
    "dict-source.js",
    "katersat-source.js",
    "dict-merge.js",
  );
  return sandbox;
}

const CHICAGO_FIXTURE = {
  dictionary_entries: [
    { id: "C1", lexeme: "illu", gloss_en: "house" },
    { id: "C2", lexeme: "aalajavoq", gloss_en: "" }, // empty → backfill candidate
    { id: "C3", lexeme: "nuna", gloss_en: "land" },
  ],
};

const KATERSAT_FIXTURE = {
  meta: { test: true },
  lexemes: [
    {
      id: "lex_illu",
      kalaallisut: "illu",
      english: ["house", "building"],
      danish: ["hus"],
    },
    {
      id: "lex_aalajavoq",
      kalaallisut: "aalajavoq",
      english: ["is determined", "is resolved"],
      danish: ["er beslutsom"],
    },
    {
      id: "lex_kujannippoq",
      kalaallisut: "kujannippoq",
      english: ["is horny"],
      danish: [],
    },
    {
      id: "lex_qulluk",
      kalaallisut: "qulluk",
      english: ["lamp"],
      danish: ["lampe"],
    },
    {
      id: "lex_usuk",
      kalaallisut: "usuk",
      english: ["penis"],
      danish: [],
    },
    {
      // Empty english — gloss_en stays ""
      id: "lex_empty_en",
      kalaallisut: "taamaallaat",
      english: [],
      danish: ["kun"],
    },
  ],
};

function mockFetch(routes) {
  return async (url) => {
    const href = String(url);
    for (const [needle, body] of Object.entries(routes)) {
      if (href.includes(needle)) {
        if (body === null) {
          return { ok: false, status: 404, json: async () => ({}), body: null };
        }
        if (needle.endsWith(".gz") || href.endsWith(".gz")) {
          const json = typeof body === "string" ? body : JSON.stringify(body);
          const gz = gzipSync(Buffer.from(json, "utf8"));
          const u8 = new Uint8Array(gz);
          return {
            ok: true,
            status: 200,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(u8);
                controller.close();
              },
            }),
            json: async () => {
              throw new Error("gzip response has no json()");
            },
          };
        }
        return {
          ok: true,
          status: 200,
          body: null,
          json: async () => body,
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}), body: null };
  };
}

let sandbox;

beforeEach(() => {
  // Default: Chicago OK; katersat via uncompressed JSON (gzip may be unavailable).
  sandbox = makeSandbox(
    mockFetch({
      "all_entries.json": CHICAGO_FIXTURE,
      "lexicon.json.gz": null,
      "lexicon.json": KATERSAT_FIXTURE,
    }),
  );
});

afterEach(() => {
  sandbox = null;
});

test("mergeDictEntries backfills empty Chicago gloss from katersat", () => {
  const { mergeDictEntries } = sandbox.window.OqDictMerge;
  const { normalizeKatersatLexeme } = sandbox.window.OqKatersatSource;
  const kat = KATERSAT_FIXTURE.lexemes
    .map(normalizeKatersatLexeme)
    .filter(Boolean);
  const { entries, katersatLoaded } = mergeDictEntries(
    CHICAGO_FIXTURE.dictionary_entries,
    kat,
  );
  assert.equal(katersatLoaded, true);
  const aalajavoq = entries.find((e) => e.lexeme === "aalajavoq");
  assert.ok(aalajavoq);
  assert.equal(aalajavoq.gloss_en, "is determined; is resolved");
  assert.equal(aalajavoq.glossSource, "katersat");
  assert.equal(JSON.stringify(aalajavoq.sources), JSON.stringify(["chicago", "katersat"]));
});

test("mergeDictEntries appends katersat-only headwords", () => {
  const { mergeDictEntries } = sandbox.window.OqDictMerge;
  const { normalizeKatersatLexeme } = sandbox.window.OqKatersatSource;
  const kat = KATERSAT_FIXTURE.lexemes
    .map(normalizeKatersatLexeme)
    .filter(Boolean);
  const { entries } = mergeDictEntries(CHICAGO_FIXTURE.dictionary_entries, kat);
  const kuj = entries.find((e) => e.lexeme === "kujannippoq");
  assert.ok(kuj, "katersat-only kujannippoq appended");
  assert.equal(kuj.source, "katersat");
  assert.equal(kuj.gloss_en, "is horny");
  const qulluk = entries.find((e) => e.lexeme === "qulluk");
  assert.ok(qulluk);
  assert.equal(qulluk.source, "katersat");
});

test("mergeDictEntries Chicago-only when katersat is null", () => {
  const { mergeDictEntries } = sandbox.window.OqDictMerge;
  const { entries, katersatLoaded } = mergeDictEntries(
    CHICAGO_FIXTURE.dictionary_entries,
    null,
  );
  assert.equal(katersatLoaded, false);
  assert.equal(entries.length, 3);
  assert.ok(entries.every((e) => e.source === "chicago"));
  assert.ok(!entries.some((e) => e.lexeme === "kujannippoq"));
});

test("normalizeKatersatLexeme leaves empty english as empty gloss_en", () => {
  const { normalizeKatersatLexeme } = sandbox.window.OqKatersatSource;
  const n = normalizeKatersatLexeme({
    id: "lex_x",
    kalaallisut: "aalajavoq",
    english: [],
    danish: ["er beslutsom"],
  });
  assert.equal(n.gloss_en, "");
  assert.equal(n.gloss_da, "er beslutsom");
});

test("loadMergedDictEntries integrates mocked Chicago + katersat", async () => {
  const merged = await sandbox.window.OqDictMerge.loadMergedDictEntries();
  assert.equal(merged.katersatLoaded, true);
  assert.ok(merged.attributions.chicago.includes("CC-BY-SA"));
  assert.ok(merged.attributions.katersat.includes("GPL"));
  assert.ok(merged.entries.some((e) => e.lexeme === "kujannippoq"));
  const a = merged.entries.find((e) => e.lexeme === "aalajavoq");
  assert.equal(a.glossSource, "katersat");
});

test("loadDictEntries choke point returns merged entries + attributions", async () => {
  const entries = await sandbox.window.OqDictSource.loadDictEntries();
  assert.ok(entries.some((e) => e.lexeme === "kujannippoq"));
  assert.equal(sandbox.window.OqDictSource.wasKatersatLoaded(), true);
  const attrs = sandbox.window.OqDictSource.getLastAttributions();
  assert.ok(attrs.chicago.includes("CC-BY-SA"));
  assert.ok(attrs.katersat.includes("GPL"));
  const text = sandbox.window.OqDictSource.formatDictAttribution();
  assert.ok(text.includes("CC-BY-SA") && text.includes("GPL"));
});

test("loadChicagoOnly does not include katersat-only headwords", async () => {
  sandbox.window.OqDictSource.resetDictState();
  // Re-bind fetch after reset
  const entries = await sandbox.window.OqDictSource.loadChicagoOnly();
  assert.ok(entries.some((e) => e.lexeme === "illu"));
  assert.ok(!entries.some((e) => e.lexeme === "kujannippoq"));
});

test("loadMergedDictEntries survives katersat failure", async () => {
  const sb = makeSandbox(
    mockFetch({
      "all_entries.json": CHICAGO_FIXTURE,
      "lexicon.json.gz": null,
      "lexicon.json": null,
      "by-letter/": null,
    }),
  );
  // Force katersat fetch to fail hard (no shards match).
  sb.window.OqKatersatSource.resetKatersatState();
  const merged = await sb.window.OqDictMerge.loadMergedDictEntries();
  assert.equal(merged.katersatLoaded, false);
  assert.ok(merged.attributions.chicago);
  assert.equal(merged.attributions.katersat, undefined);
  assert.ok(merged.entries.every((e) => e.source === "chicago"));

  let calls = 0;
  sb.window.OqKatersatSource.loadKatersatLexemes = () => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error("blip"));
    return Promise.resolve([{ id: "k", lexeme: "kujannippoq", gloss_en: "is happy" }]);
  };
  sb.window.OqDictMerge.resetMergeState();
  const first = await sb.window.OqDictMerge.loadMergedDictEntries();
  assert.equal(first.katersatLoaded, false);
  assert.equal(calls, 1);
  const second = await sb.window.OqDictMerge.loadMergedDictEntries();
  assert.equal(calls, 2);
  assert.equal(second.katersatLoaded, true);
  assert.ok(second.entries.some((e) => e.lexeme === "kujannippoq"));
});

test("loadKatersatLexemes rejects promptly when every URL 404s", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const sb = makeSandbox(async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    return { ok: false, status: 404, json: async () => ({}), body: null };
  });
  sb.window.OqKatersatSource.resetKatersatState();
  await assert.rejects(
    () => sb.window.OqKatersatSource.loadKatersatLexemes(),
    /HTTP 404|unavailable/,
  );
  assert.ok(maxInFlight > 8, `letter shards must overlap, saw max ${maxInFlight}`);
});

test("TM preferred four are selectable from merged entries", () => {
  // Mirrors aqua/timemachine.js pickPreviewEntries preference order.
  const PREFERRED = ["kujannippoq", "qulluk", "usuk", "aalajavoq"];
  const { mergeDictEntries } = sandbox.window.OqDictMerge;
  const { normalizeKatersatLexeme } = sandbox.window.OqKatersatSource;
  const kat = KATERSAT_FIXTURE.lexemes
    .map(normalizeKatersatLexeme)
    .filter(Boolean);
  // aalajavoq backfilled; usuk/qulluk/kujannippoq appended
  const chicago = [
    ...CHICAGO_FIXTURE.dictionary_entries,
    { lexeme: "usuk", gloss_en: "" }, // empty chicago → backfill if kat has it
  ];
  const { entries } = mergeDictEntries(chicago, kat);
  const byKey = new Map(
    entries.map((e) => [String(e.lexeme).toLowerCase(), e]),
  );
  const picked = [];
  for (const want of PREFERRED) {
    const e = byKey.get(want);
    assert.ok(e, `expected ${want} in merged set`);
    picked.push(e.lexeme);
  }
  assert.deepEqual(picked, PREFERRED);
});

test("filterDictEntries handles empty gloss_en", () => {
  const { filterDictEntries } = sandbox.window.OqDictSource;
  const rows = [
    { lexeme: "illu", gloss_en: "house" },
    { lexeme: "aalajavoq", gloss_en: "" },
  ];
  assert.equal(filterDictEntries(rows, "illu").length, 1);
  assert.equal(filterDictEntries(rows, "aalajavoq").length, 1);
  assert.equal(filterDictEntries(rows, "house").length, 1);
});
