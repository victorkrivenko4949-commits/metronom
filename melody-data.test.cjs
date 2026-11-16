/**
 * melody-data.test.cjs — структурные тесты модуля melody-data.js.
 * Запуск: node melody-data.test.cjs  (из каталога metronom/)
 * Контракт: MelodyData.melodies — 15+ мелодий с нотами строго "C4".."B4".
 * Проверки: структура октавы, имена/частоты, сверка в клавишу, уровни дрилла,
 * детерминированная генерация, прогрессия уровней, каталог мелодий
 * (уникальность, диапазон, длительности, наличие обязательных песен).
 */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const MelodyData = require(path.join(__dirname, 'melody-data.js'));

const VALID_NOTES = new Set(MelodyData.MAIN_OCTAVE_NOTES.map((n) => n.id));
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ok: ' + name);
}

console.log('Модуль melody-data.js — тесты');

/* ---------- Основная октава ---------- */

check('12 нот основной октавы C4..B4', () => {
  assert.equal(MelodyData.MAIN_OCTAVE_NOTES.length, 12);
  assert.deepEqual(
    MelodyData.MAIN_OCTAVE_NOTES.map((n) => n.letter),
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  );
  assert.deepEqual(
    MelodyData.MAIN_OCTAVE_NOTES.map((n) => n.id),
    ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4']
  );
});

check('русские имена сольфеджио в правильном порядке', () => {
  assert.deepEqual(
    MelodyData.MAIN_OCTAVE_NOTES.map((n) => n.name),
    ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си']
  );
  assert.deepEqual(MelodyData.KEYBOARD_LABELS, MelodyData.MAIN_OCTAVE_NOTES.map((n) => n.name));
});

check('чёрные клавиши на правильных позициях', () => {
  const black = MelodyData.MAIN_OCTAVE_NOTES.filter((n) => n.isBlack).map((n) => n.index);
  assert.deepEqual(black, [1, 3, 6, 8, 10]);
});

/* ---------- Функции нот ---------- */

check('toKeyIndex сворачивает любые ноты в 0..11', () => {
  assert.equal(MelodyData.toKeyIndex(0), 0);
  assert.equal(MelodyData.toKeyIndex(11), 11);
  assert.equal(MelodyData.toKeyIndex(12), 0); // C5 -> клавиша До
  assert.equal(MelodyData.toKeyIndex(-5), 7); // G3 -> клавиша Соль
  assert.equal(MelodyData.toKeyIndex(-12), 0);
  assert.equal(MelodyData.toKeyIndex(19), 7); // G5 -> клавиша Соль
});

check('noteToSemitone разбирает строки нот', () => {
  assert.equal(MelodyData.noteToSemitone('C4'), 0);
  assert.equal(MelodyData.noteToSemitone('A#4'), 10);
  assert.equal(MelodyData.noteToSemitone('B4'), 11);
  assert.throws(() => MelodyData.noteToSemitone('C5'));
  assert.throws(() => MelodyData.noteToSemitone('H4'));
});

check('noteName возвращает имя с номером октавы', () => {
  assert.equal(MelodyData.noteName(0), 'До4');
  assert.equal(MelodyData.noteName(9), 'Ля4');
  assert.equal(MelodyData.noteName(12), 'До5');
  assert.equal(MelodyData.noteName(-5), 'Соль3');
});

check('noteFrequency: Ля4 = 440, До4 ≈ 261.63', () => {
  assert.ok(Math.abs(MelodyData.noteFrequency(9) - 440) < 1e-9);
  assert.ok(Math.abs(MelodyData.noteFrequency(9, 442) - 442) < 1e-9);
  assert.ok(Math.abs(MelodyData.noteFrequency(0) - 261.6256) < 0.001);
  assert.ok(MelodyData.noteFrequency(12) > MelodyData.noteFrequency(0) * 1.9);
});

check('keyInfo отдаёт данные клавиши по классу высоты', () => {
  assert.equal(MelodyData.keyInfo(-5).name, 'Соль');
  assert.equal(MelodyData.keyInfo(12).name, 'До');
  assert.equal(MelodyData.keyInfo(19).letter, 'G');
});

/* ---------- Дрилл нот ---------- */

check('4 уровня дрилла с корректными пулами нот', () => {
  assert.ok(MelodyData.NOTE_DRILL_LEVELS.length >= 4);
  for (const lvl of MelodyData.NOTE_DRILL_LEVELS) {
    assert.ok(typeof lvl.id === 'string' && lvl.id.length > 0);
    assert.ok(typeof lvl.title === 'string' && lvl.title.length > 0);
    assert.ok(lvl.notePool.length > 0);
    for (const n of lvl.notePool) {
      assert.ok(n >= 0 && n <= 11 && Number.isInteger(n));
    }
  }
  const l1 = MelodyData.getDrillLevel(1);
  assert.ok(l1.notePool.every((n) => !MelodyData.MAIN_OCTAVE_NOTES[n].isBlack));
  const black = MelodyData.NOTE_DRILL_LEVELS.find((l) =>
    l.notePool.every((n) => MelodyData.MAIN_OCTAVE_NOTES[n].isBlack)
  );
  assert.ok(black, 'должен быть уровень только с чёрными клавишами');
  const last = MelodyData.NOTE_DRILL_LEVELS[MelodyData.NOTE_DRILL_LEVELS.length - 1];
  assert.equal(last.notePool.length, 12);
});

check('учебные последовательности (паттерны) корректны', () => {
  assert.ok(MelodyData.NOTE_PATTERNS.length >= 4);
  for (const p of MelodyData.NOTE_PATTERNS) {
    assert.ok(typeof p.id === 'string' && p.title);
    assert.ok(p.notes.length >= 5);
    for (const n of p.notes) assert.ok(n >= 0 && n <= 11);
  }
  const up = MelodyData.NOTE_PATTERNS.find((p) => p.id === 'scale_up');
  assert.deepEqual(up.notes, [0, 2, 4, 5, 7, 9, 11]);
});

check('createNoteSequence детерминирован и использует пул уровня', () => {
  const a = MelodyData.createNoteSequence(1, 12, 7);
  const b = MelodyData.createNoteSequence(1, 12, 7);
  assert.deepEqual(a.notes, b.notes, 'одинаковый seed — одинаковая последовательность');
  assert.equal(a.notes.length, 12);
  const pool = MelodyData.getDrillLevel(1).notePool;
  assert.ok(a.notes.every((n) => pool.includes(n)));
  const c = MelodyData.createNoteSequence(4, 30, 3);
  assert.equal(c.notes.length, 30);
  const c2 = MelodyData.createNoteSequence(4, 30, 4);
  assert.notDeepEqual(c.notes, c2.notes, 'разные seed — разные последовательности');
  // подряд одинаковые ноты не повторяются
  for (let i = 1; i < c.notes.length; i++) assert.notEqual(c.notes[i], c.notes[i - 1]);
});

check('nextNoteDrillLevel повышает/понижает уровень по точности', () => {
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 4, correct: 4, level: 1 }), 1);
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 10, correct: 10, level: 1 }), 2);
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 10, correct: 9, level: 2 }), 3);
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 10, correct: 10, level: 4 }), 4, 'максимум 4');
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 10, correct: 2, level: 3 }), 2);
  assert.equal(MelodyData.nextNoteDrillLevel({ attempts: 10, correct: 6, level: 2 }), 2);
});

/* ---------- Мелодии (строковый контракт) ---------- */

check('в каталоге не меньше 15 мелодий', () => {
  assert.ok(MelodyData.melodies.length >= 15, 'нужно ≥ 15, есть ' + MelodyData.melodies.length);
  assert.ok(Array.isArray(MelodyData.melodies), 'melodies — массив');
});

check('id мелодий уникальны', () => {
  const ids = MelodyData.melodies.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

check('обязательные песни присутствуют', () => {
  const required = [
    'happy_birthday', // С днём рождения
    'kuznechik', // В траве сидел кузнечик
    'ode_to_joy', // Ода к радости
    'twinkle', // Twinkle, Twinkle
    'frere_jacques', // Братец Яков
    'yolochka', // В лесу родилась ёлочка
  ];
  for (const id of required) {
    assert.ok(MelodyData.getMelody(id), 'нет мелодии ' + id);
  }
});

check('у каждой мелодии заполнены все поля', () => {
  for (const m of MelodyData.melodies) {
    assert.ok(typeof m.id === 'string' && m.id.length > 0, 'id у ' + JSON.stringify(m.id));
    assert.ok(typeof m.title === 'string' && m.title.length > 0, 'title у ' + m.id);
    assert.ok(m.difficulty >= 1 && m.difficulty <= 3, 'difficulty у ' + m.id);
    assert.ok(typeof m.key === 'string' && m.key.length > 0, 'key у ' + m.id);
    assert.ok([2, 3, 4].includes(m.beatsPerBar), 'размер такта у ' + m.id);
    assert.ok(m.tempoHint > 40 && m.tempoHint < 220, 'tempoHint у ' + m.id);
    assert.ok(Array.isArray(m.notes) && m.notes.length >= 8, 'минимум нот у ' + m.id);
    assert.ok(Array.isArray(m.phraseLengths) && m.phraseLengths.length > 0, 'phraseLengths у ' + m.id);
  }
});

check('все ноты — строки строго C4..B4 (без выходов за октаву)', () => {
  const noteRe = /^(C|C#|D|D#|E|F|F#|G|G#|A|A#|B)4$/;
  let total = 0;
  for (const m of MelodyData.melodies) {
    for (const n of m.notes) {
      assert.ok(typeof n === 'string', 'нота-строка у ' + m.id);
      assert.ok(noteRe.test(n), 'нота "' + n + '" вне C4..B4 у ' + m.id);
      assert.ok(VALID_NOTES.has(n), 'неизвестная нота ' + n + ' у ' + m.id);
      total++;
    }
  }
  assert.ok(total > 150, 'достаточно суммарных нот, есть ' + total);
});

check('durations соответствуют notes: длина и положительные длительности', () => {
  for (const m of MelodyData.melodies) {
    assert.equal(m.durations.length, m.notes.length, 'длина durations у ' + m.id);
    let sum = 0;
    for (const d of m.durations) {
      assert.ok(typeof d === 'number' && d > 0 && d <= 4, 'длительность у ' + m.id);
      sum += d;
    }
    assert.ok(sum > 4, 'суммарная длина у ' + m.id);
  }
});

check('phraseLengths сходятся с числом нот', () => {
  for (const m of MelodyData.melodies) {
    assert.equal(
      m.phraseLengths.reduce((a, b) => a + b, 0),
      m.notes.length,
      'phraseLengths не сходится у ' + m.id
    );
  }
});

check('известные мелодии начинаются с правильных нот', () => {
  const hb = MelodyData.getMelody('happy_birthday').notes;
  assert.deepEqual(hb.slice(0, 6), ['C4', 'C4', 'D4', 'C4', 'F4', 'E4']);
  const kz = MelodyData.getMelody('kuznechik').notes;
  assert.deepEqual(kz.slice(0, 5), ['A4', 'E4', 'A4', 'E4', 'A4']);
  const yo = MelodyData.getMelody('yolochka').notes;
  assert.deepEqual(yo.slice(0, 4), ['G4', 'E4', 'E4', 'D4']);
  const ode = MelodyData.getMelody('ode_to_joy').notes;
  assert.deepEqual(ode.slice(0, 4), ['E4', 'E4', 'F4', 'G4']);
  const tw = MelodyData.getMelody('twinkle').notes;
  assert.deepEqual(tw.slice(0, 6), ['C4', 'C4', 'G4', 'G4', 'A4', 'A4']);
  const fj = MelodyData.getMelody('frere_jacques').notes;
  assert.deepEqual(fj.slice(0, 4), ['C4', 'D4', 'E4', 'C4']);
  const tetris = MelodyData.getMelody('korobeiniki').notes;
  assert.deepEqual(tetris.slice(0, 4), ['E4', 'B4', 'C4', 'D4']);
});

check('getMelodiesByDifficulty и melodyStats работают', () => {
  for (let d = 1; d <= 3; d++) {
    const list = MelodyData.getMelodiesByDifficulty(d);
    assert.ok(list.length >= 1, 'нет мелодий сложности ' + d);
    assert.ok(list.every((m) => m.difficulty === d));
  }
  const s = MelodyData.melodyStats(MelodyData.getMelody('happy_birthday'));
  assert.equal(s.noteCount, 25);
  assert.ok(s.totalBeats > 20);
});

check('nextMelodyDifficulty повышает сложность после успехов', () => {
  assert.equal(MelodyData.nextMelodyDifficulty({ played: 1, completed: 1, accuracy: 1, currentDifficulty: 1 }), 1);
  assert.equal(MelodyData.nextMelodyDifficulty({ played: 5, completed: 5, accuracy: 0.95, currentDifficulty: 1 }), 2);
  assert.equal(MelodyData.nextMelodyDifficulty({ played: 5, completed: 5, accuracy: 0.95, currentDifficulty: 3 }), 3);
  assert.equal(MelodyData.nextMelodyDifficulty({ played: 5, completed: 2, accuracy: 0.3, currentDifficulty: 2 }), 1);
});

check('исходник не содержит DOM/console (чистые данные)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'melody-data.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\bdocument\b/.test(code), 'упоминается document');
  assert.ok(!/console\s*\./.test(code), 'используется console');
  // window допустим только в блоке экспорта контракта window.MelodyData
  const windowUses = code.match(/window\s*\./g) || [];
  assert.equal(windowUses.length, 1, 'window только в блоке экспорта');
});

console.log('\nИтого: ' + passed + ' проверок пройдено, ошибок нет.');
