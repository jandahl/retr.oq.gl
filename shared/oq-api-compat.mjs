// oq-api 0.4.4+ clones glossSummaryItems() results, including each item's
// preset. computeMorphemeBreakdownRows() still locates those presets in
// seq by reference, so restore that link through the documented seqIndex.
export function restoreGlossItemPresetReferences(items, seq) {
  if (!Array.isArray(items) || !Array.isArray(seq)) return [];
  return items.map((item) => {
    const index = item?.seqIndex;
    if (!Number.isInteger(index) || index < 0 || index >= seq.length) return item;
    return { ...item, preset: seq[index] };
  });
}
