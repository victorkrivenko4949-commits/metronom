const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// ——— 1. Все inline-скрипты компилируются ———
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
test("все inline-скрипты синтаксически валидны", () => {
  assert.ok(scripts.length >= 4, `ожидалось >=4 скриптов, найдено ${scripts.length}`);
  scripts.forEach((code, i) => {
    assert.doesNotThrow(() => new Function(code), `синтаксическая ошибка в скрипте #${i}`);
  });
});

// ——— 2. Разметка вкладки ———
test("разметка вкладки «Тренировка»", () => {
  assert.match(html, /id="tabTraining"[^>]*aria-controls="trainingView"/);
  assert.match(html, /<main[^>]*id="trainingView"[^>]*role="tabpanel"/);
  assert.match(html, /id="trCards"/);
  assert.match(html, /id="trDrill"/);
  assert.match(html, /id="trStage"/);
  assert.match(html, /id="trBack"/);
});

// ——— 3. Чистая логика упражнения (через window.__TR_TEST__) ———
const trScript = scripts.find(s => s.includes("__TR_TEST__"));
assert.ok(trScript, "не найден скрипт тренировки");
const api = (() => {
  const win = {};
  const doc = { getElementById: () => null };
  new Function("window", "document", trScript)(win, doc);
  return win.__TR_TEST__;
})();

test("noteName и staffY: позиции на стане", () => {
  assert.equal(api.noteName(60), "До");
  assert.equal(api.noteName(71), "Си");
  assert.equal(api.noteName(66), "Фа♯");
  assert.equal(api.staffY(64), 100, "E4 — нижняя линейка");
  assert.equal(api.staffY(60), 114, "C4 — добавочная линейка");
  assert.equal(api.staffY(71), 72, "B4 — средняя линейка");
  assert.equal(api.staffY(67), 86, "G4 — вторая линейка");
});

test("noteToMidi4 и midiFreq", () => {
  assert.equal(api.noteToMidi4("C4"), 60);
  assert.equal(api.noteToMidi4("B4"), 71);
  assert.equal(api.noteToMidi4("C#4"), 61);
  assert.ok(Math.abs(api.midiFreq(69) - 440) < 1e-9);
});

test("filterMelodyNotes: только C4..B4", () => {
  assert.deepEqual(
    api.filterMelodyNotes(["C4", "X9", "D#4", "C5", "E4.", null, "g4"]),
    ["C4", "D#4", "G4"],
  );
});

test("normalizeMelodies: контракт MelodyData (массив и {melodies})", () => {
  const arr = api.normalizeMelodies([{ id: "x", title: "T", notes: ["C4", "bad", "D4", "E4", "F4"] }, { notes: ["C4"] }]);
  assert.equal(arr.length, 1);
  assert.deepEqual(arr[0].notes, ["C4", "D4", "E4", "F4"]);
  const obj = api.normalizeMelodies({ melodies: [{ title: "M", notes: ["C4", "D4", "E4", "F4"] }] });
  assert.equal(obj.length, 1);
  assert.equal(obj[0].title, "M");
  assert.deepEqual(api.normalizeMelodies(null), []);
});

test("genNotesRound: 12 нот без повторов подряд", () => {
  const r = api.genNotesRound(12);
  assert.equal(r.length, 12);
  for (let i = 0; i < r.length; i++) {
    assert.ok(r[i].answer >= 60 && r[i].answer <= 71, "нота вне C4..B4");
    if (i) assert.notEqual(r[i].answer, r[i - 1].answer, "повтор подряд");
  }
});

test("genIntervalsRound: ответ = база + интервал, в пределах октавы", () => {
  const r = api.genIntervalsRound(10);
  assert.equal(r.length, 10);
  for (const p of r) {
    assert.ok(p.answer >= 60 && p.answer <= 71);
    assert.equal(p.answer - p.base, p.iv.semi);
    assert.ok(api.INTERVALS.includes(p.iv));
  }
});

test("mergeRecord: обновление рекордов", () => {
  const prev = { bestTimeMs: 50000, bestAcc: 0.5, bestStreak: 3 };
  const res = api.mergeRecord(prev, { timeMs: 40000, acc: 0.6, bestStreak: 2 });
  assert.equal(res.next.bestTimeMs, 40000);
  assert.equal(res.next.bestAcc, 0.6);
  assert.equal(res.next.bestStreak, 3);
  assert.ok(res.isNewTime && res.isNewAcc && !res.isNewStreak);
  const first = api.mergeRecord(null, { timeMs: 1, acc: 0.1, bestStreak: 0 });
  assert.ok(first.isNewTime && first.isNewAcc && first.isNewStreak);
  const worse = api.mergeRecord(prev, { timeMs: 90000, acc: 0.2, bestStreak: 1 });
  assert.deepEqual(worse.next, prev);
});

test("fmtTime", () => {
  assert.equal(api.fmtTime(0), "0:00");
  assert.equal(api.fmtTime(65000), "1:05");
  assert.equal(api.fmtTime(3599000), "59:59");
});

test("staffSVG: svg-разметка и добавочная линейка для C4", () => {
  const s = api.staffSVG(60);
  assert.match(s, /<svg class="tr-staff"/);
  assert.match(s, /<ellipse cx="92" cy="114"/);
  const s2 = api.staffSVG(71);
  assert.doesNotMatch(s2, /x1="76" x2="108"/, "лишняя добавочная линейка");
});

// ——— 4. Зачёт раунда: каждое задание считается один раз ———
function st3() { // три задания: 60, 62, 64
  return api.makeRoundState([{ answer: 60 }, { answer: 62 }, { answer: 64 }]);
}

test("makeRoundState + roundAnswer: идеальный раунд", () => {
  const st = st3();
  assert.deepEqual([st.idx, st.done, st.correct], [0, 0, 0]);
  for (const m of [60, 62, 64]) {
    const r = api.roundAnswer(st, m);
    assert.equal(r.type, "ok");
    assert.ok(r.advance);
  }
  assert.equal(st.idx, 3);
  assert.deepEqual([st.done, st.correct], [3, 3]);
  assert.equal(st.bestStreak, 3);
  assert.equal(api.roundAcc(st), 1);
});

test("roundAnswer: ошибка снимает firstTry, верный ответ после ошибки не в зачёт", () => {
  const st = st3();
  assert.equal(api.roundAnswer(st, 61).type, "bad"); // промах
  assert.equal(st.streak, 0);
  const r = api.roundAnswer(st, 60); // верно, но со второй попытки
  assert.equal(r.type, "ok");
  assert.equal(st.done, 1);
  assert.equal(st.correct, 0, "верный ответ после ошибки не даёт зачёт");
  assert.equal(api.roundAcc(st), 0);
});

test("roundNav: пропуск вперёд учитывает задание один раз", () => {
  const st = st3();
  assert.equal(api.roundNav(st, 1), true); // пропустили первое
  assert.deepEqual([st.idx, st.done, st.correct], [1, 1, 0]);
  assert.equal(api.roundNav(st, -1), true); // вернулись — повтор не считается
  assert.deepEqual([st.idx, st.done], [0, 1]);
  assert.equal(api.roundNav(st, -1), false, "за пределами нельзя назад");
  const r = api.roundAnswer(st, 60); // доиграли пропущенное — только практика
  assert.equal(r.type, "repeat-ok");
  assert.equal(st.idx, 1);
  assert.deepEqual([st.done, st.correct], [1, 0], "повтор не меняет статистику");
  // остальные два — идеально
  api.roundAnswer(st, 62); api.roundAnswer(st, 64);
  assert.deepEqual([st.done, st.correct], [3, 2]);
  assert.ok(Math.abs(api.roundAcc(st) - 2 / 3) < 1e-12);
});

test("roundNav: назад по сыгранному не позволяет перепройти для зачёта", () => {
  const st = st3();
  api.roundAnswer(st, 60); // задание 1 сыграно верно
  assert.deepEqual([st.idx, st.done, st.correct], [1, 1, 1]);
  assert.equal(api.roundNav(st, -1), true); // назад к сыгранному
  const rep = api.roundAnswer(st, 60); // повтор сыгранного
  assert.equal(rep.type, "repeat-ok");
  assert.deepEqual([st.done, st.correct, st.streak], [1, 1, 1], "повтор не влияет на статистику");
  assert.equal(st.idx, 1);
  // оставшиеся два — в зачёт
  api.roundAnswer(st, 62); api.roundAnswer(st, 64);
  assert.deepEqual([st.done, st.correct], [3, 3]);
  assert.equal(api.roundAcc(st), 1);
});

test("recordKey: у каждой мелодии свой ключ рекорда", () => {
  assert.equal(api.recordKey("notes", "notes", null), "notes.notes");
  assert.equal(api.recordKey("notes", "melody", { id: "m1", title: "T" }), "notes.melody.m1");
  assert.equal(api.recordKey("notes", "melody", null), "notes.melody", "без мелодии — общий ключ");
  assert.equal(api.recordKey("intervals", "l1", null), "intervals.l1");
});

test("melodyRecordList / bestAcrossMelodies / topMelodyRecords", () => {
  const records = {
    "notes.notes": { bestTimeMs: 100, bestAcc: 1, bestStreak: 5 },
    "notes.melody.m1": { bestTimeMs: 41000, bestAcc: 0.95, bestStreak: 9, title: "Первая" },
    "notes.melody.m2": { bestTimeMs: 52000, bestAcc: 0.93, bestStreak: 7, title: "Вторая" },
    "notes.melody.m3": { bestTimeMs: 47000, bestAcc: 0.90, bestStreak: 6 },
  };
  const list = api.melodyRecordList(records);
  assert.equal(list.length, 3, "общие ключи не попадают в список мелодий");
  const best = api.bestAcrossMelodies(records);
  assert.equal(best.bestTimeMs, 41000, "лучшее время по всем мелодиям");
  assert.equal(best.bestAcc, 0.95);
  assert.equal(best.bestStreak, 9);
  assert.equal(api.bestAcrossMelodies({}), null);
  const top = api.topMelodyRecords(records, 2);
  assert.deepEqual(top.map(m => m.id), ["m1", "m2"], "сортировка по точности");
  assert.equal(top[0].title, "Первая");
  assert.equal(top[1].title, "Вторая", "заголовок из записи");
  const top3 = api.topMelodyRecords(records);
  assert.equal(top3.length, 3);
  assert.equal(top3[2].title, "m3", "без title — id");
});

test("index.html: подключение melody-data.js с defer", () => {
  assert.match(html, /<script src="melody-data\.js" defer><\/script>/);
  // фолбэк на встроенный набор остаётся
  assert.match(trScript, /BUILTIN_MELODIES/);
  assert.match(trScript, /s\.onerror/);
});

test("index.html: метроном глушится при входе во вкладку тренировки", () => {
  assert.match(trScript, /if \(state\.playing\) stop\(\)/);
});

test("index.html: aria-label на карточке задания и роль group", () => {
  assert.match(trScript, /role="group"/);
  assert.match(trScript, /setAttribute\("aria-label", a11y\)/);
  assert.match(trScript, /Нота " \+ noteName\(p\.answer\)/);
});
