import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deconSource = readFileSync(path.join(repoRoot, "shared/decon-app.js"), "utf8");

function createDeconSandbox(mockAnalysis) {
  const listeners = [];
  const sandbox = {
    localStorage: { getItem() { return null; }, setItem() {} },
    AbortController,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, fn) => listeners.push({ type, fn });
  sandbox.removeEventListener = (type, fn) => {
    const idx = listeners.findIndex((item) => item.type === type && item.fn === fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
  if (mockAnalysis) {
    sandbox.OqAnalysis = mockAnalysis;
  }
  vm.createContext(sandbox);
  vm.runInContext(deconSource, sandbox, { filename: "decon-app.js" });
  return sandbox;
}

test("[api-feature:sentence-analysis] deconController routes sentence inputs through analyzeInput and formats sentence status", async () => {
  let renderedResult = null;
  const statuses = [];

  const mockAnalysis = {
    async analyzeInput(input, { signal }) {
      if (input.includes(" ")) {
        return {
          type: "sentence",
          query: input,
          tokens: [
            { surface: "sava", reading: { headline: "sheep", band: "gold" } },
            { surface: "suppa", reading: { headline: "soup", band: "gold" } },
            { surface: "nerivara", reading: { headline: "I eat it", band: "gold" } },
          ],
          clause: { ok: true, mode: "clause", text: "I eat sheep soup" },
          elapsedMs: 42,
        };
      }
      return {
        type: "word",
        query: input,
        matches: [{ word: input, approximate: false, meaning: "house", breakdown: [] }],
        evalCount: 15,
        elapsedMs: 12,
      };
    },
  };

  const sandbox = createDeconSandbox(mockAnalysis);
  const controller = sandbox.OqDecon.createController({
    isRootFirst: () => true,
    onStatus: (st) => statuses.push(st),
    onRender: (res) => { renderedResult = res; },
    onClear: () => { renderedResult = null; },
  });

  await controller.search("sava suppa nerivara");
  assert.equal(renderedResult.type, "sentence");
  assert.equal(renderedResult.tokens.length, 3);
  assert.equal(renderedResult.clause.text, "I eat sheep soup");
  assert.match(statuses.at(-1), /3 tokens \(mode: clause\) in 42ms/);

  // Single word query
  await controller.search("illu");
  assert.equal(renderedResult.type, "word");
  assert.match(statuses.at(-1), /15 combinations tried in 12ms/);
});

test("reRenderLast preserves the last sentence analysis result", async () => {
  let renderCount = 0;
  const mockAnalysis = {
    async analyzeInput(input) {
      return {
        type: "sentence",
        query: input,
        tokens: [{ surface: "sava", reading: { headline: "sheep" }, breakdown: [] }],
        clause: { ok: true, mode: "serial", text: "sheep" },
        elapsedMs: 20,
      };
    },
  };

  const sandbox = createDeconSandbox(mockAnalysis);
  const controller = sandbox.OqDecon.createController({
    isRootFirst: () => true,
    onStatus: () => {},
    onRender: () => { renderCount += 1; },
    onClear: () => {},
  });

  await controller.search("sava suppa");
  assert.equal(renderCount, 1);
  controller.reRenderLast();
  assert.equal(renderCount, 2);
  assert.equal(controller.getLastAnalysis().type, "sentence");
});
