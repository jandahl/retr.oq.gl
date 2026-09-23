// Mikisoq's house stays inside win95/: door geometry, Danish strings,
// and the "optional shell, real OQ!" wiring. No browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { catalogs, overlapRatio, KNOCK_SPOT, STOOP_DOOR, pickQuestion } from "../../win95/house-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

test("knock target matches the painted door", () => {
  assert.deepEqual(KNOCK_SPOT, STOOP_DOOR);
  assert.equal(overlapRatio(KNOCK_SPOT, STOOP_DOOR), 1);
  assert.ok(KNOCK_SPOT.x < 35, "the red door is on the left, not the fish racks");
  assert.ok(KNOCK_SPOT.x > 15);
  assert.ok(KNOCK_SPOT.y > 30 && KNOCK_SPOT.y < 55);
  assert.ok(KNOCK_SPOT.h > KNOCK_SPOT.w, "the door is taller than it is wide");
  assert.match(read("win95/house.css"), /\.bob-menu\[hidden\]/);
});

test("Danish catalog covers every English string", () => {
  const en = Object.keys(catalogs.en);
  const da = Object.keys(catalogs.da);
  assert.deepEqual(da.sort(), en.sort());
  for (const key of en) {
    assert.equal(typeof catalogs.da[key], "string");
    assert.ok(catalogs.da[key].length > 0, key);
  }
});

test("quiz deals four choices when the pool allows it", () => {
  const entries = [
    { lexeme: "qimmeq", gloss_en: "sled dog" },
    { lexeme: "siku", gloss_en: "sea ice" },
    { lexeme: "illu", gloss_en: "house" },
    { lexeme: "kaffi", gloss_en: "coffee" },
    { lexeme: "immaqa", gloss_en: "perhaps" },
  ];
  const zeros = () => 0;
  const dealt = pickQuestion(entries, zeros);
  assert.ok(dealt);
  assert.equal(dealt.choices.length, 4);
  assert.ok(dealt.choices.includes(dealt.answer));
  const short = pickQuestion(
    [
      { lexeme: "a", gloss_en: "sled dog" },
      { lexeme: "b", gloss_en: "sea ice" },
      { lexeme: "illu", gloss_en: "house" },
      { lexeme: "kaffi", gloss_en: "coffee" },
    ],
    zeros,
  );
  assert.equal(short, null);
});

test("the house is the optional win95 shell and the book is OQ", () => {
  const html = read("win95/index.html");
  const app = read("win95/app.js");
  const house = read("win95/house.js");
  assert.match(html, /id="win-welcome-desk"/);
  assert.match(html, /class="sled-dog"/);
  assert.match(html, /house\.js\?v=/);
  assert.match(html, /house\.css\?v=/);
  assert.match(html, /id="bob-lang-da"/);
  assert.doesNotMatch(html, /welcome-desk-actions/);
  assert.doesNotMatch(html, /type="password"/);
  assert.match(app, /assistant-fullscreen/);
  assert.match(app, /Escape/);
  assert.match(app, /welcomeDesk\.classList\.remove\("assistant-fullscreen"\)/);
  assert.match(app, /OqBobExit = exitAssistant/);
  assert.match(house, /OqDictSource\.loadDictEntries/);
  assert.match(house, /screen: "mikisoq"/);
  assert.match(house, /room: id/);
  assert.match(app, /screen: "mikisoq"/);
  assert.match(read("win95/house.css"), /42%/);
  assert.doesNotMatch(house, /screen: "oq"/);
  assert.doesNotMatch(house, /type = "password"/);
  assert.match(read("win95/style.css"), /width: 100vw !important;/);
  assert.doesNotMatch(read("win95/style.css"), /sled-dog-bob/);
});
