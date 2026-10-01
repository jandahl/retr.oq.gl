// Node-only regression tests for shared/morph-puzzles.js, shared/morph-game.js,
// and shared/klax-game.js -- no browser needed, unlike the rest of tests/
// (Playwright against a real theme page). These three files are pure logic
// with no DOM, so they're loaded directly into a vm sandbox and exercised as
// data/state machines.
//
// Written after a real shipped bug (see git history: klax-game.js used to
// flatten every step of a multi-step MORPH! puzzle into its own KLAX round,
// using a naively string-concatenated "word-so-far" as that round's root
// tile -- e.g. "illu" + "qaq" -> "illuqaq", rendered with the exact same
// tile styling as a real verified root, silently vouching for a string that
// was neither a real standalone word nor even correctly spelled, since
// Kalaallisut sandhi at these boundaries is exactly what shared/morph-puzzles.js's
// own `resultWord` field exists to correct). Nothing before this file would
// have caught that: the Playwright suites never drive KLAX far enough to
// see a specific tile's text, and none of them run at all for a shared/-only
// change until this file's own CI wiring (theme-tests.yml's `shared` filter).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadSharedScripts(...files) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const file of files) {
    const code = readFileSync(path.join(repoRoot, "shared", file), "utf8");
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

// klax-game.js's spawnActive() is Math.random-driven; a KLAX test that
// drives thousands of spawns off real Math.random (as this file's own
// first version did) is asserting over a genuine coin flip -- "expected to
// observe at least one root tile spawn" failed for real in CI, not from a
// bug, just an unlucky draw. createGame's injectable `rng` (same 0..1
// contract as Math.random) exists so a test can hand it a seeded PRNG
// instead: same spawn logic, but a fixed, reproducible sequence every run.
//
// This one IS id Software's actual DOOM (m_random.c) rndtable, byte for
// byte -- a fixed 256-entry LUT walked by a cycling index, source-released
// under the DOOM Source Code License. Any fixed table would have de-flaked
// this test equally well; this one's here purely because a console-theme
// retro-game repo gets to have a little fun. See:
// https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/m_random.c
const DOOM_RNDTABLE = [
  0, 8, 109, 220, 222, 241, 149, 107, 75, 248, 254, 140, 16, 66, 74, 21, 211, 47, 80, 242, 154, 27, 205, 128, 161, 89,
  77, 36, 95, 110, 85, 48, 212, 140, 211, 249, 22, 79, 200, 50, 28, 188, 52, 140, 202, 120, 68, 145, 62, 70, 184, 190,
  91, 197, 152, 224, 149, 104, 25, 178, 252, 182, 202, 182, 141, 197, 4, 81, 181, 242, 145, 42, 39, 227, 156, 198, 225,
  193, 219, 93, 122, 175, 249, 0, 175, 143, 70, 239, 46, 246, 163, 53, 163, 109, 168, 135, 2, 235, 25, 92, 20, 145,
  138, 77, 69, 166, 78, 176, 173, 212, 166, 113, 94, 161, 41, 50, 239, 49, 111, 164, 70, 60, 2, 37, 171, 75, 136, 156,
  11, 56, 42, 146, 138, 229, 73, 146, 77, 61, 98, 196, 135, 106, 63, 197, 195, 86, 96, 203, 113, 101, 170, 247, 181,
  113, 80, 250, 108, 7, 255, 237, 129, 226, 79, 107, 112, 166, 103, 241, 24, 223, 239, 120, 198, 58, 60, 82, 128, 3,
  184, 66, 143, 224, 145, 224, 81, 206, 163, 45, 63, 90, 168, 114, 59, 33, 159, 95, 28, 139, 123, 98, 125, 196, 15, 70,
  194, 253, 54, 14, 109, 226, 71, 17, 161, 93, 186, 87, 244, 138, 20, 52, 123, 251, 26, 36, 17, 46, 52, 231, 232, 76,
  31, 221, 84, 37, 216, 165, 212, 106, 197, 242, 98, 43, 39, 175, 254, 145, 190, 84, 118, 222, 187, 136, 120, 163, 236,
  249,
];

function doomRandom(seed = 0) {
  let index = seed & 0xff;
  return function rng() {
    index = (index + 1) & 0xff;
    return DOOM_RNDTABLE[index] / 256;
  };
}

const sandbox = loadSharedScripts("morph-puzzles.js", "morph-game.js", "klax-game.js");
const { puzzles } = sandbox.window.OqMorphPuzzles;

test("morph-puzzles.js: every puzzle's steps end on a terminal 'suffix', never mid-chain", () => {
  for (const puzzle of puzzles) {
    assert.ok(puzzle.steps.length >= 1, `${puzzle.root}: needs at least one step`);
    const last = puzzle.steps[puzzle.steps.length - 1];
    assert.equal(last.correct.type, "suffix", `${puzzle.root}: last step must be type "suffix"`);
    for (const step of puzzle.steps.slice(0, -1)) {
      assert.equal(step.correct.type, "affix", `${puzzle.root}: non-final step must be type "affix"`);
    }
  }
});

test("morph-puzzles.js: every puzzle declares a resultWord/resultGloss (no consumer should ever need to concatenate one itself)", () => {
  for (const puzzle of puzzles) {
    assert.ok(puzzle.resultWord && puzzle.resultWord.length > 0, `${puzzle.root}: missing resultWord`);
    assert.ok(puzzle.resultGloss && puzzle.resultGloss.length > 0, `${puzzle.root}: missing resultGloss`);
  }
});

test("morph-game.js: playing every puzzle's correct chain wins with the puzzle's own resultWord", () => {
  for (const puzzle of puzzles) {
    // One puzzle per game so beginPuzzle()/beginStep()'s shuffled option
    // list unambiguously belongs to this puzzle.
    const game = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle] });
    let state = game.start();
    for (const step of puzzle.steps) {
      const correctIndex = state.options.findIndex((opt) => opt.marker === step.correct.marker);
      assert.ok(correctIndex !== -1, `${puzzle.root}: correct marker "${step.correct.marker}" missing from options`);
      const result = game.choose(correctIndex);
      if (step.correct.type === "suffix") {
        assert.equal(result.outcome, "win");
        assert.equal(result.word, puzzle.resultWord);
      } else {
        assert.equal(result.outcome, "continue");
        state = game.advanceStep();
      }
    }
  }
});

test("morph-game.js: a step's wrong option costs a life and never wins", () => {
  for (const puzzle of puzzles) {
    for (let targetStepIndex = 0; targetStepIndex < puzzle.steps.length; targetStepIndex++) {
      const targetStep = puzzle.steps[targetStepIndex];
      if (targetStep.wrong.length === 0) continue; // nothing to test for a step with no distractor

      const game = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle] });
      let state = game.start();
      // Walk correctly through every prior step so `state.options` really
      // belongs to targetStep before picking a wrong one from it.
      for (let i = 0; i < targetStepIndex; i++) {
        const correctIndex = state.options.findIndex((opt) => opt.marker === puzzle.steps[i].correct.marker);
        game.choose(correctIndex);
        state = game.advanceStep();
      }

      const wrongIndex = state.options.findIndex((opt) => opt.marker !== targetStep.correct.marker);
      assert.ok(wrongIndex !== -1, `${puzzle.root} step ${targetStepIndex}: expected a wrong option among this step's options`);
      const result = game.choose(wrongIndex);
      assert.equal(result.outcome, "wrong");
      assert.equal(result.lives, 2); // startLives (3) - 1
      const again = game.choose(wrongIndex);
      assert.equal(again.outcome, "ignored");
      assert.equal(game.getState().lives, 2);
    }
  }
});

test("morph-game.js: a second choose or a choose after timeout does not apply twice", () => {
  const puzzle = puzzles.find((p) => p.steps[0].wrong.length > 0 && p.steps[0].correct.type !== "suffix");
  assert.ok(puzzle, "need a puzzle whose first step continues");
  const game = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle], deterministicOrder: true });
  const state = game.start();
  const correctIndex = state.options.findIndex((opt) => opt.marker === puzzle.steps[0].correct.marker);
  const first = game.choose(correctIndex);
  assert.equal(first.outcome, "continue");
  const word = game.getState().word;
  const second = game.choose(correctIndex);
  assert.equal(second.outcome, "ignored");
  assert.equal(game.getState().word, word);
  assert.equal(game.getState().score, 0);

  const timed = sandbox.window.OqMorphGame.createGame({ puzzles: [puzzle], deterministicOrder: true });
  timed.start();
  const timeout = timed.timeout();
  assert.equal(timeout.outcome, "timeout");
  assert.equal(timeout.lives, 2);
  const after = timed.choose(0);
  assert.equal(after.outcome, "ignored");
  assert.equal(timed.getState().lives, 2);
  const retried = timed.retryStep();
  const idx = retried.options.findIndex((opt) => opt.marker === puzzle.steps[0].correct.marker);
  assert.equal(timed.choose(idx).outcome, "continue");
});

// --- deterministicOrder (2026-08) -------------------------------------------
//
// Added because tests/test_gb.py::test_morph_worst_case_no_overflow needed
// to reliably land on ONE specific puzzle (the only one with 3 options) and
// was doing it by reloading the real page and hoping a real shuffle would
// eventually land there -- fine at a ~7-puzzle set, a near coin flip once
// the reuse pass grew the set to ~19 (see morph-puzzles.js's header
// comment), which is exactly what flaked GB's CI job. `deterministicOrder`
// lets a caller (a theme's own app.js, gated on navigator.webdriver so this
// never fires for a real player) skip the shuffle and always draw puzzles
// in the array's own order -- "the same safe sequence every time" instead
// of a statistical argument about retry counts.
test("morph-game.js: deterministicOrder draws puzzles in array order, repeatably, across full cycles", () => {
  const game = sandbox.window.OqMorphGame.createGame({ puzzles, deterministicOrder: true });

  // Two full passes back to back: deterministicOrder should reproduce the
  // exact same sequence both times, not just the first (a shuffle-once,
  // repeat-forever bug would still pass a single-pass check). `state` is
  // carried ACROSS passes rather than re-drawn at the top of pass 2 -- the
  // last win of pass 1 already advances into pass 2's first puzzle, so
  // calling advancePuzzle() again there would skip one.
  let state = game.start();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < puzzles.length; i++) {
      const expected = puzzles[i];
      assert.equal(state.root, expected.root, `pass ${pass}, draw ${i}: expected puzzle order to match the array`);
      // Walk this puzzle's correct chain to completion so the next draw
      // comes from advancePuzzle(), the same way a real playthrough would.
      for (const step of expected.steps) {
        const correctIndex = state.options.findIndex((opt) => opt.marker === step.correct.marker);
        const result = game.choose(correctIndex);
        // advancePuzzle() draws the NEXT puzzle immediately -- harmless to
        // call one extra time after the very last draw of the second pass,
        // since nothing reads `state` again after this loop ends.
        state = result.outcome === "win" ? game.advancePuzzle() : game.advanceStep();
      }
    }
  }
});

test("klax-game.js: builds exactly one round per puzzle, using each puzzle's own verified root untouched", () => {
  const realRoots = new Set(puzzles.map((p) => p.root));
  const game = sandbox.window.OqKlaxGame.createGame({ puzzles, riseSpeed: 1, rng: doomRandom(1) });
  let state = game.start();
  const seenRootTiles = new Set();
  for (let i = 0; i < 4000 && !state.gameOver; i++) {
    if (state.active && state.active.kind === "root") seenRootTiles.add(state.active.marker);
    game.tick(1, state.active ? state.active.col : 0, 1);
    state = game.getState();
  }

  assert.ok(seenRootTiles.size > 0, "expected to observe at least one root tile spawn");
  for (const tile of seenRootTiles) {
    assert.ok(
      realRoots.has(tile),
      `root tile "${tile}" is not one of the puzzles' own verified roots -- looks like a synthesized word-so-far string`,
    );
  }
});

test("klax-game.js: matching one of two copies of a root still pities the leftover", () => {
  const puzzle = puzzles[0];
  const correct = puzzle.steps[0].correct.marker;
  // Each spawn consumes a fixed rng prefix. A pending root adds a pity roll.
  const rngValues = [
    // start: root, nothing pending
    1, 0, 0, 0,
    // catch 1 spawns root 2 before that root is placed
    1, 0, 0, 0,
    // catch 2, one root already placed: pity affix
    1, 0, 0, 0,
    // catch of that affix, both roots still stacked: not a pity spawn
    1, 1, 0, 0, 0,
    // miss after the match. Pity must still feed the leftover root.
    // A Set would have deleted the round id, and these same rolls spawn a root.
    1, 0, 0, 0,
  ];
  let rngAt = 0;
  const game = sandbox.window.OqKlaxGame.createGame({
    puzzles: [puzzle],
    columns: 2,
    riseSpeed: 1,
    rng() {
      if (rngAt >= rngValues.length) throw new Error(`rng exhausted at ${rngAt}`);
      return rngValues[rngAt++];
    },
  });
  game.start();
  assert.equal(game.tick(1, game.getState().active.col, 1).event, "caught");
  assert.equal(game.place(9).placed, false);
  assert.equal(game.getState().paddle.length, 1);
  assert.equal(game.place(0).event, "placed");
  assert.equal(game.tick(1, game.getState().active.col, 1).event, "caught");
  assert.equal(game.place(1).event, "placed");
  assert.equal(game.getState().active.kind, "affix-correct");
  assert.equal(game.tick(1, game.getState().active.col, 1).event, "caught");
  const matched = game.place(0);
  assert.equal(matched.event, "match");
  const rootsLeft = game.getState().stacks.flat().filter((tile) => tile.kind === "root");
  assert.equal(rootsLeft.length, 1);
  const active = game.getState().active;
  const missed = game.tick(1, active.col === 0 ? 1 : 0, 1);
  assert.equal(missed.event, "missed");
  const next = game.getState().active;
  assert.equal(next.kind, "affix-correct");
  assert.equal(next.marker, correct);
});

test("klax-game.js: multi-step puzzles (illu/qimmeq/inuuik) never leak a synthesized intermediate word as a tile", () => {
  const multiStepPuzzles = puzzles.filter((p) => p.steps.length > 1);
  assert.ok(multiStepPuzzles.length > 0, "expected at least one multi-step puzzle to exercise this regression");

  const game = sandbox.window.OqKlaxGame.createGame({ puzzles, riseSpeed: 1, rng: doomRandom(1) });
  let state = game.start();
  const seenMarkers = new Set();
  for (let i = 0; i < 4000 && !state.gameOver; i++) {
    if (state.active) seenMarkers.add(state.active.marker);
    game.tick(1, state.active ? state.active.col : 0, 1);
    state = game.getState();
  }

  for (const puzzle of multiStepPuzzles) {
    const fakeIntermediate = puzzle.root + puzzle.steps[0].correct.marker;
    assert.ok(
      !seenMarkers.has(fakeIntermediate),
      `saw synthesized intermediate word "${fakeIntermediate}" as a tile marker -- the exact bug this test guards against`,
    );
  }
});

// --- Reuse/connectivity floor (2026-08) -------------------------------------
//
// Design target from the reuse pass that added most of this file's puzzles
// (see morph-puzzles.js's own header comment): every root and every marker
// should connect to at least 3 OTHER morphemes in the set -- not by adding
// new morphemes, but by giving existing ones more combinations. This isn't
// a rule anyone is required to keep growing forever (a percentage-based
// version of it is explicitly future work), but it should never silently
// regress: a puzzle removed, or a puzzle's marker/root typo'd, could quietly
// drop a morpheme back under the floor with nothing else in this file
// noticing (the other tests above check correctness of what IS here, not
// how connected it is). This test only checks the floor holds; it does not
// enforce HOW a future addition gets there.
test("reuse floor: every root and marker connects to at least 3 DISTINCT others", () => {
  // Sets, not counts: two puzzles that both pair the same root with the
  // same marker (e.g. a second "angut+mi" puzzle added on top of the real
  // one) must NOT count as two connections -- that would let a future edit
  // pad an occurrence count back over the floor by duplicating an existing
  // combination instead of adding a genuinely new one, defeating the whole
  // point of this test.
  const connections = new Map();
  const connect = (a, b) => {
    if (!connections.has(a)) connections.set(a, new Set());
    connections.get(a).add(b);
  };
  for (const puzzle of puzzles) {
    // chainHead tracks what a step's marker actually attaches to: the bare
    // root for the first step, or "root>marker" for a later step in the
    // same chain -- so a root's own connections are exactly the (distinct)
    // markers that attach directly to it, and a marker's connections are
    // exactly the (distinct) roots/chain-heads it's been used with.
    let chainHead = puzzle.root;
    for (const step of puzzle.steps) {
      const marker = step.correct.marker;
      connect(chainHead, marker);
      connect(marker, chainHead);
      chainHead = `${chainHead}>${marker}`;
    }
  }

  const MIN_CONNECTIONS = 3;
  const underFloor = [...connections.entries()]
    .filter(([key]) => !key.includes(">")) // only roots/markers are the "morphemes" this floor is about, not synthetic chain-heads
    .filter(([, others]) => others.size < MIN_CONNECTIONS);
  assert.deepEqual(
    underFloor,
    [],
    `expected every root/marker to connect to >= ${MIN_CONNECTIONS} distinct others; ` +
      `under the floor: ${underFloor.map(([k, others]) => `${k} (${others.size}: ${[...others].join(",")})`).join("; ")}`,
  );
});
