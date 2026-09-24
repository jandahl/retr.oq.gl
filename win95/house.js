// Mikisoq's house. Optional fullscreen shell inside the Windows 95 theme.
// The book uses OqDictSource. Its filter stays on ?screen=mikisoq.
// Do not navigate the desktop dictionary from here — that closes the house.
// Original paintings. Not a Microsoft Bob asset.

import { KNOCK_SPOT, ROOMS, THINGS, pickQuestion, t, tourLines } from "./house-data.mjs?v=2";

const STORE = "retr-oq-win95-mikisoq";
const LIGHTS = ["day", "lamp", "evening"];
const ROOM_IDS = ["family", "study", "kitchen", "den"];

const $ = (id) => document.getElementById(id);

let locale = "en";
let users = [];
let activeId = null;
let room = null;
let step = "idle";
let nameKind = "askName";
let speech = null;
let sheet = null;
let sheetBuilt = "";
let menuOpen = false;
let move = false;
let marks = false;
let muted = false;
let houseOpen = false;
let routedRoom = undefined;
let pendingArrival = null;
let dictQuery = "";
let dictState = "idle";
let quiz = null;
let quizScore = { ok: 0, n: 0 };
let quizNote = "";
let cal = new Date();
let calDay = "";
let letterId = null;

function uid() {
  return crypto.randomUUID();
}

function current() {
  return users.find((u) => u.id === activeId) || null;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!raw || typeof raw !== "object") return;
    if (raw.locale === "da" || raw.locale === "en") locale = raw.locale;
    muted = !!raw.muted;
    if (Array.isArray(raw.users)) users = raw.users;
  } catch {
    /* ignore a broken save */
  }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify({ users, locale, muted }));
}

function pose() {
  const img = $("bob-dog");
  const which = speech ? "house/dog-talk.png?v=1" : "house/dog-idle.png?v=1";
  if (img.getAttribute("src") !== which) img.src = which;
}

function sayKeys(keys, blocking) {
  speech = { keys, texts: null, i: 0, blocking: !!blocking };
  menuOpen = false;
  renderSpeech();
  renderMenu();
}

function sayTexts(texts, blocking) {
  speech = { keys: null, texts, i: 0, blocking: !!blocking };
  menuOpen = false;
  renderSpeech();
  renderMenu();
}

function clearSpeech() {
  speech = null;
  renderSpeech();
}

function lineAt(i) {
  if (!speech) return "";
  if (speech.texts) return speech.texts[i];
  return t(locale, speech.keys[i]);
}

function advance() {
  if (!speech) return;
  if (speech.i < (speech.texts || speech.keys).length - 1) {
    speech.i += 1;
    renderSpeech();
    return;
  }
  speech = null;
  renderSpeech();
}

function greet() {
  step = "idle";
  sayKeys([users.length ? "greet.named" : "greet.empty"], false);
}

function renderSpeech() {
  const el = $("bob-balloon");
  el.replaceChildren();
  const blocking = !!(speech && speech.blocking && !sheet);
  $("bob-blocker").hidden = !blocking;
  if (!speech) {
    el.hidden = true;
    pose();
    return;
  }
  el.hidden = false;
  const p = document.createElement("p");
  p.textContent = lineAt(speech.i);
  el.appendChild(p);
  if (step === "name") nameForm(el);
  else if (step === "pick") nameList(el);
  else if (step === "room" || step === "rooms") roomButtons(el);
  else if (speech.blocking || speech.i < (speech.texts || speech.keys).length - 1) {
    const b = document.createElement("button");
    b.type = "button";
    const last = speech.i >= (speech.texts || speech.keys).length - 1;
    b.textContent = last ? t(locale, "ok") : t(locale, "goOn");
    b.addEventListener("click", advance);
    el.appendChild(b);
  }
  pose();
}

function nameForm(el) {
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.maxLength = 40;
  input.autocomplete = "name";
  input.required = true;
  input.setAttribute("aria-label", t(locale, "yourName"));
  const go = document.createElement("button");
  go.type = "submit";
  go.textContent = t(locale, "thatsMe");
  form.append(input, go);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitName(input.value);
  });
  el.appendChild(form);
  queueMicrotask(() => input.focus());
}

function nameList(el) {
  for (const user of users) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = user.name;
    b.addEventListener("click", () => chooseUser(user.id));
    el.appendChild(b);
  }
  const neu = document.createElement("button");
  neu.type = "button";
  neu.textContent = t(locale, "someoneNew");
  neu.addEventListener("click", () => {
    step = "name";
    nameKind = "askNameNew";
    sayKeys(["askNameNew"], true);
  });
  el.appendChild(neu);
}

function roomButtons(el) {
  for (const id of ROOM_IDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(locale, "room." + id);
    b.addEventListener("click", () => (step === "room" ? finishSignup(id) : goRoom(id)));
    el.appendChild(b);
  }
  if (step === "rooms") {
    const stay = document.createElement("button");
    stay.type = "button";
    stay.textContent = t(locale, "stayHere");
    stay.addEventListener("click", () => {
      step = "idle";
      clearSpeech();
    });
    el.appendChild(stay);
  }
}

function blankUser(name, privateRoom) {
  return {
    id: uid(),
    name,
    password: "",
    helpfulness: "helpful",
    privateRoom,
    tourDone: false,
    seen: {},
    lights: {},
    sprites: {},
    letters: [],
    lists: [
      { id: uid(), name: t(locale, "list.lookup"), items: [] },
      {
        id: uid(),
        name: t(locale, "list.house"),
        items: [{ id: uid(), text: t(locale, "list.knock"), done: true }],
      },
    ],
    notes: [],
    contacts: [],
  };
}

function knock() {
  if (room || (speech && speech.blocking)) return;
  tap();
  if (!users.length) {
    step = "name";
    nameKind = "askName";
    sayKeys(["askName"], true);
    return;
  }
  step = "pick";
  sayKeys(["who"], false);
}

function submitName(raw) {
  const name = raw.trim();
  if (!name) return;
  const existing = users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    chooseUser(existing.id);
    return;
  }
  step = "room";
  speech = { keys: ["whichRoom"], texts: null, i: 0, blocking: true, pendingName: name };
  renderSpeech();
}

function finishSignup(privateRoom) {
  const name = speech && speech.pendingName;
  if (!name) return;
  const user = blankUser(name, privateRoom);
  users.push(user);
  save();
  enter(user, true);
}

function chooseUser(id) {
  const user = users.find((u) => u.id === id);
  if (!user) return;
  enter(user, false);
}

function validRoom(id) {
  return ROOM_IDS.includes(id) ? id : null;
}

function enter(user, first) {
  activeId = user.id;
  pendingArrival = first || !user.tourDone ? "tour" : "back";
  if (pendingArrival === "tour") {
    user.tourDone = true;
    save();
  }
  window.OqRouter.navigate({ screen: "mikisoq", room: "family", filter: null });
}

function goRoom(id) {
  window.OqRouter.navigate({ screen: "mikisoq", room: id, filter: null });
}

function stepOutside() {
  window.OqRouter.navigate({ screen: "mikisoq", room: null, filter: null });
}

function leaveWindows() {
  if (typeof window.OqBobExit === "function") window.OqBobExit();
}

function thingPos(thing, user) {
  const saved = user && user.sprites[thing.id];
  return saved || { x: thing.x, y: thing.y };
}

function renderRoom() {
  const stage = $("bob-stage");
  const bg = $("bob-bg");
  const door = $("bob-door");
  const host = $("bob-sprites");
  host.replaceChildren();
  const user = current();
  const light = (user && room && user.lights[room]) || "day";
  stage.dataset.light = light;
  stage.classList.toggle("is-marks", marks);
  stage.classList.toggle("is-stoop", !room);
  stage.style.setProperty("--bob-door-right", String((KNOCK_SPOT.x + KNOCK_SPOT.w) / 100));
  if (!room) {
    bg.src = "house/stoop.png?v=1";
    door.hidden = false;
    door.style.left = KNOCK_SPOT.x + "%";
    door.style.top = KNOCK_SPOT.y + "%";
    door.style.width = KNOCK_SPOT.w + "%";
    door.style.height = KNOCK_SPOT.h + "%";
    door.setAttribute("aria-label", t(locale, "knock"));
    return;
  }
  door.hidden = true;
  const painting = ROOMS.find((r) => r.id === room);
  bg.src = painting.src;
  for (const thing of THINGS) {
    if (thing.room !== room) continue;
    const pos = thingPos(thing, user);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = thing.kind === "baked" ? "bob-hit" : "bob-sprite";
    btn.dataset.id = thing.id;
    btn.style.left = pos.x + "%";
    btn.style.top = pos.y + "%";
    btn.style.width = thing.w + "%";
    if (thing.h) btn.style.height = thing.h + "%";
    btn.setAttribute("aria-label", t(locale, "thing." + thing.program));
    if (thing.kind === "sprite") {
      const img = document.createElement("img");
      img.alt = "";
      img.src = "house/" + thing.sprite + ".png?v=1";
      btn.appendChild(img);
    }
    btn.addEventListener("click", () => {
      if (move) return;
      openThing(thing.program);
    });
    if (thing.kind === "sprite") wireDrag(btn, thing);
    host.appendChild(btn);
  }
}

function wireDrag(btn, thing) {
  btn.addEventListener("pointerdown", (event) => {
    if (!move) return;
    event.preventDefault();
    const stage = $("bob-stage").getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    function onMove(ev) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        dragging = true;
      }
      const x = ((ev.clientX - stage.left) / stage.width) * 100;
      const y = ((ev.clientY - stage.top) / stage.height) * 100;
      const px = Math.min(96, Math.max(4, x));
      const py = Math.min(96, Math.max(8, y));
      btn.style.left = px + "%";
      btn.style.top = py + "%";
      const user = current();
      if (user) user.sprites[thing.id] = { x: px, y: py };
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dragging) save();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function openThing(program) {
  const user = current();
  if (user && user.helpfulness !== "quiet") {
    const first = !user.seen[program];
    if (user.helpfulness === "chatty" || first) {
      user.seen[program] = true;
      save();
      sayKeys(["tip." + program], false);
    }
  }
  if (program === "door") {
    step = "rooms";
    sayKeys(["whereTo"], false);
    return;
  }
  if (program === "dict") {
    openDict();
    return;
  }
  sheet = program;
  sheetBuilt = "";
  if (program === "quiz") quiz = null;
  renderSheet();
}

function openDict() {
  const params = window.OqRouter.getParams();
  dictQuery = params.get("filter") || "";
  sheet = "dict";
  sheetBuilt = "";
  dictState = "loading";
  renderSheet();
  window.OqDictSource.loadDictEntries()
    .then(() => {
      dictState = "ready";
      if (sheet === "dict") fillDict();
    })
    .catch(() => {
      dictState = "error";
      if (sheet === "dict") fillDict();
    });
}

function closeSheet() {
  sheet = null;
  sheetBuilt = "";
  $("bob-sheet").hidden = true;
  $("bob-sheet").replaceChildren();
}

function dismissSheet() {
  const was = sheet;
  closeSheet();
  if (was !== "dict") return;
  dictQuery = "";
  const params = window.OqRouter.getParams();
  if (params.get("screen") === "mikisoq" && params.has("filter")) {
    window.OqRouter.navigate({ filter: null }, { replace: true });
  }
}

function renderSheet() {
  const host = $("bob-sheet");
  if (!sheet) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  if (sheetBuilt === sheet) return;
  sheetBuilt = sheet;
  host.replaceChildren();
  const head = document.createElement("div");
  head.className = "bob-row";
  const title = document.createElement("h2");
  title.textContent = t(locale, "thing." + sheet);
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = t(locale, "back");
  back.addEventListener("click", () => {
    dismissSheet();
    clearSpeech();
  });
  head.append(title, back);
  host.appendChild(head);
  const body = document.createElement("div");
  body.id = "bob-sheet-body";
  host.appendChild(body);
  if (sheet === "dict") fillDict();
  else if (sheet === "finder") fillFinder(body);
  else if (sheet === "letter") fillLetter(body);
  else if (sheet === "lists") fillLists(body);
  else if (sheet === "calendar") fillCalendar(body);
  else if (sheet === "clock") fillClock(body);
  else if (sheet === "address") fillAddress(body);
  else if (sheet === "about") fillAbout(body);
  else if (sheet === "quiz") fillQuiz(body);
}

function fillDict() {
  const body = $("bob-sheet-body");
  if (!body) return;
  body.replaceChildren();
  const label = document.createElement("label");
  label.textContent = t(locale, "dict.prompt");
  const input = document.createElement("input");
  input.value = dictQuery;
  input.placeholder = t(locale, "dict.placeholder");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", t(locale, "dict.prompt"));
  const status = document.createElement("p");
  const results = document.createElement("div");
  input.addEventListener("input", () => {
    dictQuery = input.value;
    const screen = window.OqRouter.getParams().get("screen");
    if (screen === "mikisoq" || screen === "oq") {
      window.OqRouter.navigate({ filter: dictQuery || null }, { replace: true });
    }
    paintDict(status, results);
  });
  body.append(label, input, status, results);
  paintDict(status, results);
}

function paintDict(status, results) {
  results.replaceChildren();
  if (dictState === "loading") {
    status.textContent = t(locale, "dict.loading");
    return;
  }
  if (dictState === "error") {
    status.textContent = t(locale, "dict.error");
    return;
  }
  const q = dictQuery.trim();
  const { filterDictEntries, formatDictAttribution, getLastAttributions } = window.OqDictSource;
  window.OqDictSource.loadDictEntries()
    .then((entries) => {
      if (sheet !== "dict" || dictQuery.trim() !== q) return;
      if (!q) {
        status.textContent = t(locale, "dict.empty", { count: entries.length });
        return;
      }
      const rows = filterDictEntries(entries, q).slice(0, 40);
      status.textContent = rows.length
        ? formatDictAttribution(getLastAttributions())
        : t(locale, "nothing");
      const table = document.createElement("table");
      for (const row of rows) {
        const tr = document.createElement("tr");
        const a = document.createElement("td");
        const b = document.createElement("td");
        a.textContent = row.lexeme;
        b.textContent = row.gloss_en || "";
        tr.append(a, b);
        table.appendChild(tr);
      }
      results.replaceChildren(table);
    })
    .catch(() => {
      status.textContent = t(locale, "dict.error");
    });
}

function fillFinder(body) {
  const input = document.createElement("input");
  input.placeholder = t(locale, "stem.placeholder");
  input.setAttribute("aria-label", t(locale, "stem.prompt"));
  input.autocomplete = "off";
  input.spellcheck = false;
  const status = document.createElement("p");
  status.textContent = t(locale, "stem.empty");
  const results = document.createElement("div");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (!q) {
      status.textContent = t(locale, "stem.empty");
      return;
    }
    window.OqDictSource.loadDictEntries()
      .then((entries) => {
        const rows = entries
          .filter((e) => String(e.lexeme || "").toLowerCase().startsWith(q) || String(e.stem || "").toLowerCase().startsWith(q))
          .slice(0, 40);
        status.textContent = rows.length ? "" : t(locale, "nothing");
        const table = document.createElement("table");
        for (const row of rows) {
          const tr = document.createElement("tr");
          const a = document.createElement("td");
          const b = document.createElement("td");
          a.textContent = row.lexeme;
          b.textContent = row.stem ? t(locale, "stemLabel", { stem: row.stem }) : row.gloss_en || "";
          tr.append(a, b);
          table.appendChild(tr);
        }
        results.replaceChildren(table);
      })
      .catch(() => {
        status.textContent = t(locale, "dict.error");
      });
  });
  body.append(input, status, results);
}

function fillLetter(body) {
  const user = current();
  if (!user) return;
  const list = document.createElement("div");
  const editor = document.createElement("div");
  function draw() {
    list.replaceChildren();
    const neu = document.createElement("button");
    neu.type = "button";
    neu.textContent = t(locale, "newLetter");
    neu.addEventListener("click", () => {
      const letter = { id: uid(), title: "", body: "" };
      user.letters.unshift(letter);
      letterId = letter.id;
      save();
      draw();
    });
    list.appendChild(neu);
    if (!user.letters.length) {
      const p = document.createElement("p");
      p.textContent = t(locale, "deskEmpty");
      list.appendChild(p);
    }
    for (const letter of user.letters) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = letter.title || t(locale, "untitled");
      b.addEventListener("click", () => {
        letterId = letter.id;
        draw();
      });
      list.appendChild(b);
    }
    editor.replaceChildren();
    const letter = user.letters.find((item) => item.id === letterId);
    if (!letter) {
      const p = document.createElement("p");
      p.textContent = t(locale, "pickLetter");
      editor.appendChild(p);
      return;
    }
    const title = document.createElement("input");
    title.value = letter.title;
    title.setAttribute("aria-label", t(locale, "title"));
    const text = document.createElement("textarea");
    text.value = letter.body;
    text.setAttribute("aria-label", t(locale, "letter"));
    const drop = document.createElement("button");
    drop.type = "button";
    drop.textContent = t(locale, "throwOut");
    title.addEventListener("input", () => {
      letter.title = title.value;
      save();
    });
    text.addEventListener("input", () => {
      letter.body = text.value;
      save();
    });
    drop.addEventListener("click", () => {
      user.letters = user.letters.filter((item) => item.id !== letter.id);
      letterId = null;
      save();
      draw();
    });
    editor.append(title, text, drop);
  }
  body.append(list, editor);
  draw();
}

function fillLists(body) {
  const user = current();
  if (!user) return;
  function draw() {
    body.replaceChildren();
    const neu = document.createElement("button");
    neu.type = "button";
    neu.textContent = t(locale, "newList");
    neu.addEventListener("click", () => {
      user.lists.push({ id: uid(), name: t(locale, "newList"), items: [] });
      save();
      draw();
    });
    body.appendChild(neu);
    for (const list of user.lists) {
      const wrap = document.createElement("div");
      const name = document.createElement("input");
      name.value = list.name;
      name.setAttribute("aria-label", t(locale, "name"));
      name.addEventListener("input", () => {
        list.name = name.value;
        save();
      });
      wrap.appendChild(name);
      for (const item of list.items) {
        const row = document.createElement("label");
        row.className = "bob-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = item.done;
        const span = document.createElement("span");
        span.textContent = item.text;
        box.addEventListener("change", () => {
          item.done = box.checked;
          save();
        });
        row.append(box, span);
        wrap.appendChild(row);
      }
      const add = document.createElement("form");
      add.className = "bob-row";
      const line = document.createElement("input");
      line.placeholder = t(locale, "addLine");
      line.setAttribute("aria-label", t(locale, "addLine"));
      const go = document.createElement("button");
      go.type = "submit";
      go.textContent = t(locale, "add");
      add.append(line, go);
      add.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = line.value.trim();
        if (!text) return;
        list.items.push({ id: uid(), text, done: false });
        save();
        draw();
      });
      wrap.appendChild(add);
      body.appendChild(wrap);
    }
  }
  draw();
}

function fillCalendar(body) {
  const user = current();
  if (!user) return;
  function iso(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function draw() {
    body.replaceChildren();
    const bar = document.createElement("div");
    bar.className = "bob-row";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = t(locale, "prev");
    prev.setAttribute("aria-label", t(locale, "prevMonth"));
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = t(locale, "next");
    next.setAttribute("aria-label", t(locale, "nextMonth"));
    const label = document.createElement("strong");
    label.textContent = cal.toLocaleString(locale === "da" ? "da-DK" : "en", { month: "long", year: "numeric" });
    prev.addEventListener("click", () => {
      cal = new Date(cal.getFullYear(), cal.getMonth() - 1, 1);
      draw();
    });
    next.addEventListener("click", () => {
      cal = new Date(cal.getFullYear(), cal.getMonth() + 1, 1);
      draw();
    });
    bar.append(prev, label, next);
    const grid = document.createElement("div");
    grid.className = "bob-cal";
    for (let i = 0; i < 7; i++) {
      const h = document.createElement("span");
      h.textContent = t(locale, "week." + i);
      grid.appendChild(h);
    }
    const first = new Date(cal.getFullYear(), cal.getMonth(), 1);
    const pad = (first.getDay() + 6) % 7;
    for (let i = 0; i < pad; i++) grid.appendChild(document.createElement("span"));
    const days = new Date(cal.getFullYear(), cal.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const date = new Date(cal.getFullYear(), cal.getMonth(), day);
      const key = iso(date);
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(day);
      if (key === calDay) b.className = "is-on";
      b.addEventListener("click", () => {
        calDay = key;
        draw();
      });
      grid.appendChild(b);
    }
    body.append(bar, grid);
    if (!calDay) return;
    const note = user.notes.find((item) => item.date === calDay);
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.value = note ? note.text : "";
    input.placeholder = t(locale, "notePh");
    input.setAttribute("aria-label", t(locale, "notePh"));
    const go = document.createElement("button");
    go.type = "submit";
    go.textContent = t(locale, "add");
    form.append(input, go);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      user.notes = user.notes.filter((item) => item.date !== calDay);
      if (text) user.notes.push({ id: uid(), date: calDay, text });
      save();
    });
    body.appendChild(form);
  }
  draw();
}

function fillClock(body) {
  const p = document.createElement("p");
  function tick() {
    if (sheet !== "clock") return;
    const now = new Date();
    p.textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    window.setTimeout(tick, 1000);
  }
  tick();
  body.appendChild(p);
}

function fillAddress(body) {
  const user = current();
  if (!user) return;
  function draw() {
    body.replaceChildren();
    const form = document.createElement("form");
    const name = document.createElement("input");
    name.placeholder = t(locale, "name");
    name.setAttribute("aria-label", t(locale, "name"));
    const note = document.createElement("input");
    note.placeholder = t(locale, "noteAny");
    note.setAttribute("aria-label", t(locale, "note"));
    const go = document.createElement("button");
    go.type = "submit";
    go.textContent = t(locale, "keep");
    form.append(name, note, go);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!name.value.trim()) return;
      user.contacts.push({ id: uid(), name: name.value.trim(), note: note.value.trim() });
      save();
      draw();
    });
    body.appendChild(form);
    if (!user.contacts.length) {
      const p = document.createElement("p");
      p.textContent = t(locale, "nobody");
      body.appendChild(p);
    }
    for (const contact of user.contacts) {
      const row = document.createElement("div");
      row.className = "bob-row";
      const span = document.createElement("span");
      span.textContent = contact.note ? contact.name + " — " + contact.note : contact.name;
      const drop = document.createElement("button");
      drop.type = "button";
      drop.textContent = t(locale, "remove");
      drop.addEventListener("click", () => {
        user.contacts = user.contacts.filter((item) => item.id !== contact.id);
        save();
        draw();
      });
      row.append(span, drop);
      body.appendChild(row);
    }
  }
  draw();
}

function fillAbout(body) {
  const user = current();
  const roomName = t(locale, "room." + ((user && user.privateRoom) || "den"));
  for (const key of ["about.1", "about.2"]) {
    const p = document.createElement("p");
    p.textContent = t(locale, key);
    body.appendChild(p);
  }
  const p = document.createElement("p");
  p.textContent = t(locale, "about.3", { room: roomName });
  body.appendChild(p);
  const attr = document.createElement("p");
  attr.textContent = window.OqDictSource.DICT_ATTRIBUTION;
  body.appendChild(attr);
}

function fillQuiz(body) {
  const status = document.createElement("p");
  const card = document.createElement("div");
  body.append(status, card);
  status.textContent = t(locale, "quiz.loading");
  window.OqDictSource.loadDictEntries()
    .then((entries) => {
      if (sheet !== "quiz") return;
      deal(entries, status, card);
    })
    .catch(() => {
      status.textContent = t(locale, "quiz.error");
    });
}

function deal(entries, status, card) {
  quiz = pickQuestion(entries);
  card.replaceChildren();
  if (!quiz) {
    status.textContent = t(locale, "quiz.empty");
    return;
  }
  status.textContent = t(locale, "quiz.score", quizScore);
  const p = document.createElement("p");
  p.textContent = t(locale, "quiz.prompt", { gloss: quiz.gloss });
  card.appendChild(p);
  if (quizNote) {
    const note = document.createElement("p");
    note.textContent = quizNote;
    card.appendChild(note);
  }
  for (const choice of quiz.choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = choice;
    b.addEventListener("click", () => {
      quizScore.n += 1;
      if (choice === quiz.answer) {
        quizScore.ok += 1;
        quizNote = t(locale, "quiz.yes");
        $("bob-dog").src = "house/dog-happy.png?v=1";
      } else {
        quizNote = t(locale, "quiz.no", { answer: quiz.answer });
      }
      deal(entries, status, card);
    });
    card.appendChild(b);
  }
}

function renderMenu() {
  const el = $("bob-menu");
  el.replaceChildren();
  if (!menuOpen) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const items = [];
  if (room) items.push(["otherRooms", () => openThing("door")]);
  if (room) items.push([move ? "doneMoving" : "moveThings", toggleMove]);
  items.push([marks ? "hideMarks" : "showClicks", () => {
    marks = !marks;
    $("bob-stage").classList.toggle("is-marks", marks);
    menuOpen = false;
    renderMenu();
  }]);
  if (room) items.push(["changeLight", cycleLight]);
  items.push(["howMuchTalk", talkMenu]);
  if (room) items.push(["showAround", () => sayTexts(tourLines(locale), true)]);
  items.push([muted ? "soundOff" : "soundOn", () => {
    muted = !muted;
    save();
    menuOpen = false;
    renderMenu();
  }]);
  if (room) items.push(["stepOutside", stepOutside]);
  items.push(["toWindows", leaveWindows]);
  for (const [key, fn] of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(locale, key);
    b.addEventListener("click", fn);
    el.appendChild(b);
  }
}

function toggleMove() {
  move = !move;
  menuOpen = false;
  renderMenu();
  if (move) sayKeys(["moveSay"], false);
  else clearSpeech();
}

function cycleLight() {
  const user = current();
  if (!user || !room) return;
  const cur = user.lights[room] || "day";
  const next = LIGHTS[(LIGHTS.indexOf(cur) + 1) % LIGHTS.length];
  user.lights[room] = next;
  save();
  $("bob-stage").dataset.light = next;
  menuOpen = false;
  renderMenu();
  sayTexts([t(locale, "lightSay", { light: t(locale, "light." + next) })], false);
}

function talkMenu() {
  menuOpen = false;
  renderMenu();
  const el = $("bob-balloon");
  speech = { keys: ["talk.title"], texts: null, i: 0, blocking: false };
  renderSpeech();
  for (const level of ["chatty", "helpful", "quiet"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(locale, "talk." + level);
    b.addEventListener("click", () => {
      const user = current();
      if (user) {
        user.helpfulness = level;
        save();
      }
      sayKeys(["talk.say." + level], false);
    });
    el.appendChild(b);
  }
}

function tap() {
  if (muted) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = tap.ctx || (tap.ctx = new Ctx());
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 160;
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.07);
}

function setLocale(next) {
  locale = next;
  save();
  document.documentElement.lang = next === "da" ? "da-DK" : "en";
  $("bob-lang-en").setAttribute("aria-pressed", next === "en" ? "true" : "false");
  $("bob-lang-da").setAttribute("aria-pressed", next === "da" ? "true" : "false");
  if (!current() && !room && step === "idle") greet();
  else renderSpeech();
  renderMenu();
  if (sheet) {
    sheetBuilt = "";
    renderSheet();
  } else renderRoom();
}

function onDog() {
  if (step === "name" || step === "room") return;
  if (speech && speech.blocking) {
    advance();
    return;
  }
  menuOpen = !menuOpen;
  if (menuOpen) {
    speech = null;
    renderSpeech();
  }
  renderMenu();
}

function handleEscape() {
  if (!houseOpen) return false;
  if (menuOpen) {
    menuOpen = false;
    renderMenu();
    return true;
  }
  if (step === "name" || step === "room") return true;
  if (speech) {
    advance();
    return true;
  }
  if (sheet) {
    dismissSheet();
    return true;
  }
  if (room) return true;
  return false;
}

function applyRoute(params) {
  if (!params || params.get("screen") !== "mikisoq") return;
  const rawRoom = params.get("room");
  if (rawRoom && !validRoom(rawRoom)) {
    window.OqRouter.navigate({ room: null }, { replace: true });
    return;
  }
  houseOpen = true;
  document.documentElement.lang = locale === "da" ? "da-DK" : "en";
  $("bob-lang-en").setAttribute("aria-pressed", locale === "en" ? "true" : "false");
  $("bob-lang-da").setAttribute("aria-pressed", locale === "da" ? "true" : "false");
  const next = validRoom(rawRoom);
  const same = routedRoom === next;
  routedRoom = next;
  if (same && !pendingArrival) return;
  room = next;
  step = "idle";
  move = false;
  menuOpen = false;
  closeSheet();
  if (!next) {
    // Keep activeId. Back from the step into a room must still be this
    // person — clearing it here left their sprites and programs behind.
    greet();
  } else if (pendingArrival === "tour") {
    pendingArrival = null;
    sayTexts(tourLines(locale), true);
  } else if (pendingArrival === "back") {
    pendingArrival = null;
    const who = current();
    if (who) sayTexts([t(locale, "welcomeBack", { name: who.name })], false);
    else clearSpeech();
  } else {
    clearSpeech();
  }
  renderRoom();
  renderMenu();
  if (next && params.get("filter")) openDict();
}

function openHouse() {
  applyRoute(window.OqRouter.getParams());
}

function closeHouse() {
  if (!houseOpen && routedRoom === undefined) return;
  houseOpen = false;
  routedRoom = undefined;
  pendingArrival = null;
  sheet = null;
  sheetBuilt = "";
  speech = null;
  menuOpen = false;
  room = null;
  activeId = null;
  step = "idle";
  document.documentElement.lang = "en";
}

function onKey(event) {
  if (!houseOpen) return;
  if (event.key === "F1") {
    event.preventDefault();
    marks = !marks;
    $("bob-stage").classList.toggle("is-marks", marks);
  }
}

load();
$("bob-door").addEventListener("click", knock);
$("sled-dog").addEventListener("click", onDog);
$("bob-lang-en").addEventListener("click", () => setLocale("en"));
$("bob-lang-da").addEventListener("click", () => setLocale("da"));
window.addEventListener("keydown", onKey);
pose();

window.OqBob = { open: openHouse, close: closeHouse, handleEscape, applyRoute };
if (window.OqWin95SyncRoute) window.OqWin95SyncRoute();
