import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

test("Cupertino registry covers Classic and OS X milestones in chronology", () => {
  const source = read("shared/cupertino/era-registry.js");
  const ids = [...source.matchAll(/id: "([a-z0-9]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["system1", "mac8", "aqua", "tiger", "leopard", "lion", "yosemite", "bigsur", "glass"]);
  assert.match(source, /family: "classic"/);
  assert.match(source, /family: "osx"/);
  assert.match(source, /retr-oq:cupertino-era/);
  assert.match(source, /retr-oq:aqua-osx-era/);
});

test("Aqua Time Machine consumes only OS X eras from the shared registry", () => {
  const source = read("aqua/timemachine.js");
  assert.match(source, /window\.OqCupertino\?\.eras/);
  assert.match(source, /era\.family === "osx"/);
  assert.match(source, /migrateStoredEra\("osx"\)/);
});

test("Aqua entry point loads the registry before its Time Machine adapter", () => {
  const html = read("aqua/index.html");
  const registry = html.indexOf("shared/cupertino/era-registry.js?v=1");
  const timeMachine = html.indexOf('src="timemachine.js?v=11"');
  assert.ok(registry >= 0 && timeMachine > registry);
});

test("Classic Mac entry points load the native Time Machine adapter", () => {
  for (const [file, marker] of [["mac1984/index.html", "classic-time-machine.js?v=1"], ["mac8/index.html", "classic-time-machine.js?v=1"]]) {
    const html = read(file);
    assert.match(html, /shared\/cupertino\/era-registry\.js\?v=1/);
    assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /classic-time-machine\.css\?v=1/);
  }
});
