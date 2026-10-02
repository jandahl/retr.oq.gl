import assert from "node:assert/strict";
import test from "node:test";
import { restoreGlossItemPresetReferences } from "../../shared/oq-api-compat.mjs";

test("oq-api cloned gloss items reconnect to their sequence entries by seqIndex", () => {
  const first = { id: "stem" };
  const ending = { id: "ending" };
  const seq = [first, ending];
  const clonedItems = [
    { seqIndex: 0, marker: "", preset: { ...first } },
    { seqIndex: 1, marker: "+", preset: { ...ending } },
  ];

  const restored = restoreGlossItemPresetReferences(clonedItems, seq);

  assert.notEqual(restored, clonedItems);
  assert.equal(restored[0].preset, first);
  assert.equal(restored[1].preset, ending);
  assert.equal(restored[1].marker, "+");
});

test("seqIndex preserves duplicate sequence entries and skips invalid indexes", () => {
  const repeated = { id: "repeated" };
  const seq = [repeated, { id: "other" }, repeated];
  const items = [
    { seqIndex: 0, preset: {} },
    { seqIndex: 2, preset: {} },
    { seqIndex: 9, preset: { id: "untouched" } },
  ];

  const restored = restoreGlossItemPresetReferences(items, seq);

  assert.equal(restored[0].preset, repeated);
  assert.equal(restored[1].preset, repeated);
  assert.equal(restored[2], items[2]);
});
