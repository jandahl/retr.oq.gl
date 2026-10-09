// Shared KLAX! game engine -- Klax turned upside down: one morpheme tile at
// a time rises from the well floor instead of dropping from the sky. Line
// the paddle up under its column before it reaches the top and it's caught
// automatically -- miss the column and it overflows. The catcher can hold
// up to 4 caught tiles at once, LIFO -- catching doesn't pause the well, so
// the player can keep reading and catching while deciding where to place
// them. Pressing place() pops the most recently caught tile and puts it
// atop a stacking lane (the same four lanes, at the ceiling above the
// well). Placing a root or its correct affix next to its other half --
// wherever in the stacks it is -- clears the pair and scores. A rare
// (1 in 20) spawn is a Dr. Mario-style pill instead of a real morpheme
// tile: caught and carried the same as anything else, but placing one
// clears a whole lane or the whole board instead of stacking. Classic
// script exposing window.OqKlaxGame, same convention as
// shared/morph-game.js: this file owns pure game state and renders nothing
// itself -- no DOM, no canvas, no timers. A theme's own app.js drives
// tick()/place()/discard() from its own input handling and render loop,
// the same split morph-game.js uses.
//
// Reuses shared/morph-puzzles.js puzzle data as-is (real, verified
// Kalaallisut morphemes) rather than inventing new tile text. Only a
// puzzle's FIRST step becomes a round, using the puzzle's own `root` --
// never a later step, whose "root" half would have to be a synthesized
// word-so-far string instead. An earlier
// version of this file built one round per step (root+affix1,
// (root+affix1)+affix2, ...), reasoning that reusing already-verified
// markers "fabricates nothing new" -- but the *concatenation* itself is
// new and unverified: Kalaallisut has real sandhi at these boundaries
// (illu+qaq surfaces as illo-, with the stem vowel lowered, not a bare
// "illuqaq"; qimmeq+qaq surfaces as qimmeqar-, not "qimmeqqaq";
// inuuik+sior assimilates to inuuissior-, not "inuuiksior" -- see
// shared/morph-puzzles.js's own `resultWord` overrides, which exist
// exactly because naive string-joins get this wrong). A plain
// `wordSoFar += marker` join has none of that, so a second-step round's
// "root" tile was both misspelled AND not a real standalone word at all
// (illu+qaq alone isn't a complete, inflected word) -- yet rendered on
// screen with the exact same tile styling as a real verified root like
// "illu" or "nuna", implicitly vouching for it as legitimate. First
// steps don't have this problem: their "root" is always the puzzle's own
// already-verified `root` string. A live spatial match needs a fixed
// tile size (Klax matches 3 in a row; this catches a fixed-size pair),
// not the multi-step chain MORPH! builds one option-menu at a time --
// this file's own first-step-only round is what lets it reuse that same
// chain data (safely) instead of forking it.
(() => {
  "use strict";

  // Spawn-weighting constants -- named so a tuning pass never has to go
  // hunting through spawnActive() for a bare 0.6 or 0.05 to figure out
  // what it actually controls.
  const PILL_CHANCE = 1 / 20; // how often a spawn is a pill instead of a real morpheme tile
  // Three pill kinds now, not an even split of two -- 1-UP is the rarest
  // (it's a straight life back, no strategic cost like the other two have
  // in giving up a lane's progress), lane and screen wipe share what's left.
  const PILL_KIND_WEIGHTS = { "power-lane": 0.45, "power-screen": 0.35, "power-1up": 0.2 };
  const PITY_AFFIX_CHANCE = 0.6; // odds a spawn is forced to be a pending root's correct affix
  const ROOT_VS_AFFIX_CHANCE = 0.5; // odds a non-pity, non-pill spawn is the round's root (vs. an affix)
  const CORRECT_VS_WRONG_AFFIX_CHANCE = 0.55; // odds that affix is the correct one (vs. a real wrong one)

  /**
   * Helper computing structured slot notation for debug mode:
   * e.g. root "illu" -> "A1", affix "qaq" -> "ABCDEF2".
   * A letter represents which word/root chain it belongs to, and the number
   * represents the slot position (1 for root, 2 for first affix, etc.).
   */
  function buildDebugLabels(puzzles) {
    const rootOrder = [];
    for (const p of puzzles) {
      if (!rootOrder.includes(p.root)) rootOrder.push(p.root);
    }
    const rootLetters = {};
    rootOrder.forEach((r, idx) => {
      rootLetters[r] = String.fromCharCode(65 + idx);
    });

    const markerSlots = {};
    puzzles.forEach((p) => {
      p.steps.forEach((step, sIdx) => {
        const slot = sIdx + 2;
        const m = step.correct.marker;
        if (!markerSlots[m]) markerSlots[m] = {};
        if (!markerSlots[m][slot]) markerSlots[m][slot] = new Set();
        markerSlots[m][slot].add(p.root);
      });
    });

    const labels = {};
    // Position 1: roots
    rootOrder.forEach((r) => {
      labels[r] = `${rootLetters[r]}1`;
    });
    // Position 2+: affixes/suffixes
    for (const [m, slots] of Object.entries(markerSlots)) {
      for (const [slot, rSet] of Object.entries(slots)) {
        const letters = [...rSet].map((r) => rootLetters[r]).sort().join("");
        labels[m] = `${letters}${slot}`;
      }
    }
    return labels;
  }

  /**
   * @param {{
   *   puzzles: Array<{ root: string, steps: Array<{ correct: { marker: string }, wrong: Array<{ marker: string }> }> }>,
   *   columns?: number,
   *   stackCap?: number,
   *   paddleCap?: number,
   *   startLives?: number,
   *   riseSpeed?: number, // 0..1 well progress per second
   *   debug?: boolean, // debug mode: replace morphemes with slot notation (A1, A2, BCDEF2...)
   *   rng?: () => number, // 0..1, same contract as Math.random -- injectable so a
   *     // test can drive spawnActive() with a fixed, reproducible sequence
   *     // instead of asserting over thousands of real-random draws.
   * }} config
   */
  function createGame({
    puzzles,
    columns = 4,
    stackCap = 5,
    paddleCap = 4,
    startLives = 3,
    riseSpeed = 0.22,
    debug = false,
    rng = Math.random,
  }) {
    if (!puzzles || puzzles.length === 0) throw new Error("createGame requires at least one puzzle");

    const debugLabels = buildDebugLabels(puzzles);
    function toDisplayMarker(m) {
      return (debug && debugLabels[m]) ? debugLabels[m] : m;
    }

    // One round per puzzle, built from its first step only: a tile pair
    // (the puzzle's own verified root and its one correct first marker),
    // plus that step's real-but-wrong markers. See the header comment for
    // why later steps aren't flattened into their own rounds too.
    const rounds = puzzles.map((p, i) => ({
      id: i,
      root: p.root,
      correct: p.steps[0].correct.marker,
      wrong: p.steps[0].wrong.map((w) => w.marker),
    }));

    // A single rising tile at a time -- not one per column -- is the whole
    // fix for "getting 8 at once": the player reads and reacts to one
    // block, resolves it (caught or missed), then the next one spawns.
    let active = null;
    let paddle = []; // tiles the catcher is currently carrying, LIFO -- paddle[paddle.length-1] is the one place()/discard() acts on
    let stacks = []; // stacks[c] = array of placed tiles in lane c, bottom to top
    // roundId -> how many unmatched roots of that round are on the board.
    // A Set collapsed two copies of the same root, so matching one stopped
    // the pity spawn while the other was still stacked.
    let pendingRoots = new Map();
    let lives = startLives;
    let score = 0;
    let gameOver = false;

    function pickPillKind() {
      const entries = Object.entries(PILL_KIND_WEIGHTS);
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = rng() * total;
      for (const [kind, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return kind;
      }
      return entries[entries.length - 1][0];
    }

    const PILL_MARKER = { "power-lane": "LANE", "power-screen": "ALL", "power-1up": "1UP" };

    function spawnActive() {
      // Dr. Mario-style pill: 1 in 20 spawns, unrelated to the round pity
      // logic below. Caught and carried in the paddle just like any other
      // tile -- "stored for later" falls out of that for free -- but
      // placing one never occupies a lane: power-lane/power-screen clear
      // one instead, and power-1up (see place()) just gives a life back.
      if (rng() < PILL_CHANCE) {
        const kind = pickPillKind();
        active = { roundId: null, kind, marker: PILL_MARKER[kind], col: Math.floor(rng() * columns), y: 0 };
        return;
      }
      // Fairness: blind uniform spawning could -- and did, in testing --
      // hand the player a long run of tiles that can't complete anything
      // they're already holding. Once a root is on the board waiting for
      // its affix, most spawns bias toward finally giving it to them.
      if (pendingRoots.size > 0 && rng() < PITY_AFFIX_CHANCE) {
        const ids = Array.from(pendingRoots.keys());
        const roundId = ids[Math.floor(rng() * ids.length)];
        const round = rounds[roundId];
        active = { roundId, kind: "affix-correct", marker: toDisplayMarker(round.correct), col: Math.floor(rng() * columns), y: 0 };
        return;
      }
      const round = rounds[Math.floor(rng() * rounds.length)];
      // Every other spawn is a coin flip between the round's root and one
      // of its affixes (correct or a real wrong one) -- the player never
      // knows which half of a pair they're catching until they read it.
      const wantsRoot = rng() < ROOT_VS_AFFIX_CHANCE;
      const marker = wantsRoot
        ? round.root
        : rng() < CORRECT_VS_WRONG_AFFIX_CHANCE
          ? round.correct
          : round.wrong[Math.floor(rng() * round.wrong.length)];
      active = {
        roundId: round.id,
        kind: wantsRoot ? "root" : marker === round.correct ? "affix-correct" : "affix-wrong",
        marker: toDisplayMarker(marker),
        col: Math.floor(rng() * columns),
        y: 0,
      };
    }

    function start() {
      lives = startLives;
      score = 0;
      gameOver = false;
      paddle = [];
      pendingRoots = new Map();
      stacks = Array.from({ length: columns }, () => []);
      active = null;
      spawnActive();
      return getState();
    }

    /**
     * Looks for a root + its correct affix anywhere across the stacking
     * lanes (not necessarily the same lane or adjacent) and clears both if
     * found. Runs after every placement. Returns each cleared tile's
     * pre-removal (lane, row) too -- a theme's renderer can't otherwise
     * say where the match happened once these are spliced out of `stacks`.
     */
    function tryMatch() {
      for (let c = 0; c < stacks.length; c++) {
        for (let ri = 0; ri < stacks[c].length; ri++) {
          const tile = stacks[c][ri];
          if (tile.kind !== "root") continue;
          for (let d = 0; d < stacks.length; d++) {
            const i = stacks[d].findIndex((t) => t.roundId === tile.roundId && t.kind === "affix-correct");
            if (i === -1) continue;
            const affix = stacks[d][i];
            stacks[c] = stacks[c].filter((t) => t !== tile);
            stacks[d] = stacks[d].filter((t) => t !== affix);
            pendingRoots.set(tile.roundId, (pendingRoots.get(tile.roundId) || 1) - 1);
            if (pendingRoots.get(tile.roundId) <= 0) pendingRoots.delete(tile.roundId);
            score += 20;
            return {
              marker: tile.marker,
              other: affix.marker,
              cells: [
                { col: c, row: ri, marker: tile.marker, kind: tile.kind },
                { col: d, row: i, marker: affix.marker, kind: affix.kind },
              ],
            };
          }
        }
      }
      return null;
    }

    /**
     * Advances the one active tile by `dtSeconds` worth of well progress,
     * scaled by `speedMultiplier` (holding a fast-forward input passes >1
     * here). The well never pauses, catching or not: the catcher can hold
     * up to `paddleCap` tiles at once, so a full paddle -- not "anything
     * currently held" -- is the only thing that turns a catch into a miss.
     * @param {number} paddleCol which column the paddle is currently over
     * @param {number} [speedMultiplier]
     */
    function tick(dtSeconds, paddleCol, speedMultiplier = 1) {
      if (gameOver) return { event: "gameover" };
      if (!active) {
        spawnActive();
        return { event: "spawned" };
      }
      active.y = Math.min(1, active.y + riseSpeed * speedMultiplier * dtSeconds);
      if (active.y < 1) return { event: "rising" };

      if (active.col === paddleCol && paddle.length < paddleCap) {
        paddle.push(active);
        const tile = active;
        active = null;
        spawnActive();
        return { event: "caught", tile: { marker: tile.marker, kind: tile.kind } };
      }

      active = null;
      lives -= 1;
      if (lives <= 0) gameOver = true;
      spawnActive();
      return { event: "missed", lives, gameOver };
    }

    /**
     * Pops the most recently caught tile (LIFO). A wrong affix can never
     * complete a match (only a root + its correct affix can), so placing
     * one doesn't occupy a lane at all -- it's just discarded, freeing the
     * paddle slot. Without this, a caught dud would sit in a stack forever
     * with no way to ever clear it, since match-by-meaning (unlike Klax's
     * match-by-color) gives it no path to completing anything. A root or
     * correct affix still needs an actual open lane -- no-ops if the
     * chosen one is already full, same as before.
     */
    function place(col) {
      if (!paddle.length || gameOver) return { placed: false };
      if (!stacks[col]) return { placed: false };
      const tile = paddle[paddle.length - 1];
      if (tile.kind === "power-lane") {
        paddle.pop();
        for (const t of stacks[col]) {
          if (t.kind !== "root") continue;
          pendingRoots.set(t.roundId, (pendingRoots.get(t.roundId) || 1) - 1);
          if (pendingRoots.get(t.roundId) <= 0) pendingRoots.delete(t.roundId);
        }
        const cleared = stacks[col].map((t) => t.marker);
        const cells = stacks[col].map((t, row) => ({ col, row, marker: t.marker, kind: t.kind }));
        stacks[col] = [];
        return { placed: true, event: "power-lane", col, cleared, cells };
      }
      if (tile.kind === "power-screen") {
        paddle.pop();
        const cleared = stacks.flat().map((t) => t.marker);
        const cells = stacks.flatMap((lane, c) => lane.map((t, row) => ({ col: c, row, marker: t.marker, kind: t.kind })));
        stacks = stacks.map(() => []);
        pendingRoots = new Map();
        return { placed: true, event: "power-screen", cleared, cells };
      }
      if (tile.kind === "power-1up") {
        paddle.pop();
        lives += 1;
        return { placed: true, event: "power-1up", lives };
      }
      if (tile.kind === "affix-wrong") {
        paddle.pop();
        return { placed: true, event: "discarded", tile: { marker: tile.marker, kind: tile.kind } };
      }
      if (stacks[col].length >= stackCap) return { placed: false, full: true };
      paddle.pop();
      stacks[col].push(tile);
      if (tile.kind === "root") pendingRoots.set(tile.roundId, (pendingRoots.get(tile.roundId) || 0) + 1);
      const matched = tryMatch();
      return matched
        ? { placed: true, event: "match", cleared: [matched.marker, matched.other], cells: matched.cells, score }
        : { placed: true, event: "placed" };
    }

    /** Drops the most recently caught tile (LIFO) with no penalty -- the escape hatch for a piece that isn't useful right now. */
    function discard() {
      if (!paddle.length) return getState();
      paddle.pop();
      return getState();
    }

    function getState() {
      return {
        lives,
        score,
        gameOver,
        paddle: paddle.map((t) => ({ marker: t.marker, kind: t.kind })),
        paddleCap,
        stacks: stacks.map((lane) => lane.map((t) => ({ marker: t.marker, kind: t.kind }))),
        stackCap,
        active: active && { marker: active.marker, kind: active.kind, col: active.col, y: active.y },
      };
    }

    return { start, tick, place, discard, getState };
  }

  window.OqKlaxGame = { createGame, buildDebugLabels };
})();
