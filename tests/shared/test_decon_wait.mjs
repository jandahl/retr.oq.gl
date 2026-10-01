// DECON's wait for oq-analysis.js used to ignore abort and hang forever
// if the module never arrived.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(path.join(repoRoot, "shared/decon-app.js"), "utf8");

function load() {
  const listeners = [];
  const timeouts = [];
  let seq = 1;
  const sandbox = {
    localStorage: { getItem() { return null; }, setItem() {} },
    AbortController,
    setTimeout(fn, ms) {
      const id = seq++;
      timeouts.push({ id, fn, ms });
      return id;
    },
    clearTimeout(id) {
      const i = timeouts.findIndex((item) => item.id === id);
      if (i >= 0) timeouts.splice(i, 1);
    },
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, fn) => listeners.push({ type, fn });
  sandbox.removeEventListener = (type, fn) => {
    const i = listeners.findIndex((item) => item.type === type && item.fn === fn);
    if (i >= 0) listeners.splice(i, 1);
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "decon-app.js" });
  return { sandbox, listeners, timeouts };
}

function controller(sandbox) {
  const statuses = [];
  let rendered = 0;
  const ctl = sandbox.OqDecon.createController({
    isRootFirst: () => true,
    onStatus: (text) => statuses.push(text),
    onRender: () => { rendered += 1; },
    onClear: () => {},
  });
  return { ctl, statuses, rendered: () => rendered };
}

test("abort during the oq-analysis wait does not analyze", async () => {
  const host = load();
  const { ctl, statuses, rendered } = controller(host.sandbox);
  const pending = ctl.search("illu");
  assert.equal(statuses.at(-1), "Analyzing...");
  ctl.abort();
  await pending;
  assert.equal(rendered(), 0);
  assert.equal(statuses.some((text) => text.startsWith("Could not analyze")), false);
});

test("a missing oq-analysis module fails instead of hanging", async () => {
  const host = load();
  const { ctl, statuses } = controller(host.sandbox);
  const pending = ctl.search("illu");
  const hang = host.timeouts.find((item) => item.ms === 8000);
  assert.ok(hang, "wait should arm a timeout");
  hang.fn();
  await pending;
  assert.match(statuses.at(-1), /oq-analysis\.js did not load/);
});

test("a non-Error rejection is still reported", async () => {
  const host = load();
  host.sandbox.OqAnalysis = {
    analyzeWord() { return Promise.reject("nope"); },
  };
  const { ctl, statuses } = controller(host.sandbox);
  await ctl.search("illu");
  assert.match(statuses.at(-1), /Could not analyze \(nope\)/);
});
