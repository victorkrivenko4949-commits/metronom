/**
 * melody-data.js — данные и логика прогрессии для раздела «Тренировка» (дрилл «Отработка нот»).
 *
 * Чистые данные и функции: без DOM, console и аудио.
 * Браузер: <script src="melody-data.js"></script> → window.MelodyData (и глобальная MelodyData).
 * Node (тесты): const MelodyData = require('./melody-data.js');
 *
 * ## Главный контракт
 * MelodyData.melodies — массив из 15+ мелодий, каждая:
 *   { id, title, subtitle, difficulty (1..3), key, beatsPerBar, tempoHint,
 *     notes: ["C4","C#4",...], durations: [...], phraseLengths: [...] }
 * НОТЫ — строки ровно в диапазоне основной октавы C4..B4 (с диезом: "C#4".."A#4"),
 * т.е. любая мелодия играется на 12-клавишной клавиатуре дрилла без выходов за октаву.
 * Оригинальные мелодии транспонированы/приведены в основную октаву (по классу высоты,
 * без изменения тональности), поэтому все песни остаются узнаваемыми.
 *
 * durations — длительности в долях (1 = четверть, 0.5 = восьмушка), приблизительные:
 * задают ритм воспроизведения, но не обязаны совпадать с нотной записью нота в ноту.
 * phraseLengths — число нот в каждой строке текста (прогресс «строка 1 из 4»).
 *
 * ## Вспомогательные функции
 * toKeyIndex/noteName/noteFrequency работают с индексом полутона относительно C4
 * (0 = C4, -1 = B3, 12 = C5) — на случай расширения клавиатуры за октаву.
 * noteToSemitone("C4") → 0; noteFrequency(9) = 440 Гц (Ля4, камертон настраивается).
 *
 * Источники мелодий (сверены по нескольким независимым записям «нотами цифрами/буквами»):
 * упрощённые фортепианные записи (jliza.ru, proza.ru, livejournal), табулатуры
 * Ultimate Guitar, калимбовые расшифровки kalimbanotes.ru; классические темы
 * (Ода к радости, Twinkle, Братец Яков) — по каноническим нотам.
 *
 * @version 2.0.0
 */

/* ============================ Основная октава ============================ */

/** Английские имена клавиш основной октавы (совпадают с NOTE_NAMES тюнера). */
const KEY_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 12 нот основной октавы C4..B4.
 * @property {number} index — индекс полутона 0..11 (0 = C4, MIDI 60).
 * @property {string} name — русское сольфеджио (подписи клавиш).
 * @property {string} letter — английское обозначение ("C".."B").
 * @property {string} id — строка ноты вида "C4" (используется в melodies[].notes).
 * @property {boolean} isBlack — чёрная клавиша.
 */
const MAIN_OCTAVE_NOTES = [
  { index: 0,  name: 'До',    letter: 'C',  id: 'C4',  isBlack: false },
  { index: 1,  name: 'До♯',   letter: 'C#', id: 'C#4', isBlack: true },
  { index: 2,  name: 'Ре',    letter: 'D',  id: 'D4',  isBlack: false },
  { index: 3,  name: 'Ре♯',   letter: 'D#', id: 'D#4', isBlack: true },
  { index: 4,  name: 'Ми',    letter: 'E',  id: 'E4',  isBlack: false },
  { index: 5,  name: 'Фа',    letter: 'F',  id: 'F4',  isBlack: false },
  { index: 6,  name: 'Фа♯',   letter: 'F#', id: 'F#4', isBlack: true },
  { index: 7,  name: 'Соль',  letter: 'G',  id: 'G4',  isBlack: false },
  { index: 8,  name: 'Соль♯', letter: 'G#', id: 'G#4', isBlack: true },
  { index: 9,  name: 'Ля',    letter: 'A',  id: 'A4',  isBlack: false },
  { index: 10, name: 'Ля♯',   letter: 'A#', id: 'A#4', isBlack: true },
  { index: 11, name: 'Си',    letter: 'B',  id: 'B4',  isBlack: false },
];

/** Частота камертона Ля4 по умолчанию (Гц). */
const A4_DEFAULT = 440;

/** MIDI-номер C4 (среднее До) — для пересчёта в частоту. */
const C4_MIDI = 60;

/** Русские подписи клавиш (ярлыки для клавиатуры дрилла). */
const KEYBOARD_LABELS = MAIN_OCTAVE_NOTES.map((n) => n.name);

/**
 * Разобрать строку ноты ("C4", "A#4") в индекс полутона относительно C4.
 * @param {string} noteId — например "C4" или "G#4".
 * @returns {number} 0..11.
 */
function noteToSemitone(noteId) {
  const i = MAIN_OCTAVE_NOTES.findIndex((n) => n.id === noteId);
  if (i < 0) throw new Error('Неизвестная нота основной октавы: ' + noteId);
  return i;
}

/**
 * Свести любой индекс полутона к клавише основной октавы (0..11) по классу высоты.
 * Примеры: toKeyIndex(-5) = 7 (G3 → клавиша Соль), toKeyIndex(12) = 0 (C5 → клавиша До).
 * @param {number} semitone — индекс полутона относительно C4 (может быть вне 0..11).
 * @returns {number} индекс клавиши 0..11.
 */
function toKeyIndex(semitone) {
  const n = Math.trunc(Number(semitone) || 0);
  return ((n % 12) + 12) % 12;
}

/**
 * Информация о клавише основной октавы для любой ноты (по классу высоты).
 * @param {number} semitone — индекс полутона относительно C4.
 * @returns {object} элемент MAIN_OCTAVE_NOTES.
 */
function keyInfo(semitone) {
  return MAIN_OCTAVE_NOTES[toKeyIndex(semitone)];
}

/**
 * Имя ноты с номером октавы (научная запись, C4 = среднее До).
 * Примеры: noteName(0) = 'До4', noteName(-5) = 'Соль3', noteName(12) = 'До5'.
 * @param {number} semitone — индекс полутона относительно C4.
 * @returns {string} например 'До♯4'.
 */
function noteName(semitone) {
  const n = Math.trunc(Number(semitone) || 0);
  const octave = 4 + Math.floor(n / 12);
  return MAIN_OCTAVE_NOTES[toKeyIndex(n)].name + octave;
}

/**
 * Частота ноты в Гц (равномерно-темперированный строй).
 * @param {number} semitone — индекс полутона относительно C4 (можно вне 0..11).
 * @param {number} [a4=A4_DEFAULT] — частота Ля4 (камертон, по умолчанию 440).
 * @returns {number} noteFrequency(9) = 440 при a4 = 440; noteFrequency(0) ≈ 261.63.
 */
function noteFrequency(semitone, a4 = A4_DEFAULT) {
  const n = Math.trunc(Number(semitone) || 0);
  return a4 * Math.pow(2, (C4_MIDI + n - 69) / 12);
}

/* ============================ Дрилл «ноты» ============================ */

/**
 * Уровни дрилла одиночных нот: от белых клавиш к хроматике.
 * @property {number} level — номер уровня (1 — самый простой).
 * @property {string} id — стабильный идентификатор.
 * @property {string} title — подпись для карточки дрилла.
 * @property {string} hint — краткое пояснение для пользователя.
 * @property {number[]} notePool — индексы нот (0..11) для заданий уровня.
 */
const NOTE_DRILL_LEVELS = [
  {
    level: 1,
    id: 'white_core',
    title: 'Белые клавиши: До–Соль',
    hint: 'Самые простые ноты — до, ре, ми, фа, соль.',
    notePool: [0, 2, 4, 5, 7],
  },
  {
    level: 2,
    id: 'white_all',
    title: 'Все белые клавиши',
    hint: 'Добавляются ля и си — вся гамма До-мажор.',
    notePool: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    level: 3,
    id: 'black_keys',
    title: 'Чёрные клавиши',
    hint: 'До♯, Ре♯, Фа♯, Соль♯, Ля♯ — случайные чёрные клавиши.',
    notePool: [1, 3, 6, 8, 10],
  },
  {
    level: 4,
    id: 'chromatic',
    title: 'Все 12 нот',
    hint: 'Любая клавиша октавы — белый и чёрный перемешаны.',
    notePool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
];

/** Уровень дрилла по номеру. @param {number} level @returns {object|undefined} */
function getDrillLevel(level) {
  return NOTE_DRILL_LEVELS.find((l) => l.level === Number(level));
}

/**
 * Фиксированные учебные последовательности нот («прогрессия нот» для новичка).
 * @property {string} id
 * @property {string} title — подпись для интерфейса.
 * @property {number[]} notes — индексы полутонов 0..11 по порядку игры.
 */
const NOTE_PATTERNS = [
  { id: 'scale_up',   title: 'Гамма До-мажор вверх', notes: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'scale_down', title: 'Гамма До-мажор вниз',  notes: [11, 9, 7, 5, 4, 2, 0] },
  { id: 'thirds',     title: 'Терции',              notes: [0, 4, 2, 5, 4, 7, 5, 9, 7, 11] },
  { id: 'arpeggio',   title: 'Арпеджио До-мажор',    notes: [0, 4, 7, 11, 7, 4, 0] },
  { id: 'chromatic',  title: 'Хроматическая гамма',  notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

/**
 * Детерминированный генератор псевдослучайных чисел (mulberry32).
 * Одинаковый seed → одинаковая последовательность нот (повторы и статистика).
 * @param {number} seed
 * @returns {function():number} функция, возвращающая числа 0..1.
 */
function mulberry32(seed) {
  let a = (Math.trunc(Number(seed) || 0) >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Сгенерировать последовательность нот заданного уровня дрилла.
 * Детерминирована seed; подряд одинаковые ноты не повторяются.
 * @param {number} level — уровень 1..4.
 * @param {number} [length=8] — сколько нот.
 * @param {number} [seed=42] — зерно генератора.
 * @returns {{level:number, seed:number, notes:number[]}} индексы 0..11.
 */
function createNoteSequence(level, length = 8, seed = 42) {
  const lvl = getDrillLevel(level);
  const pool = lvl ? lvl.notePool.slice() : [0, 2, 4, 5, 7, 9, 11];
  const count = Math.max(1, Math.trunc(Number(length) || 8));
  const rnd = mulberry32(seed);
  const notes = [];
  for (let i = 0; i < count; i++) {
    let next = pool[Math.floor(rnd() * pool.length)];
    if (pool.length > 1) {
      while (next === notes[notes.length - 1]) {
        next = pool[Math.floor(rnd() * pool.length)];
      }
    }
    notes.push(next);
  }
  return { level: lvl ? lvl.level : 1, seed, notes };
}

/**
 * Рекомендация следующего уровня дрилла нот по статистике.
 * Меньше 8 попыток — не меняем; точность ≥ 90% — повышаем; < 50% — понижаем.
 * @param {{attempts:number, correct:number, level:number}} stats
 * @returns {number} уровень 1..4.
 */
function nextNoteDrillLevel(stats) {
  const maxLevel = NOTE_DRILL_LEVELS[NOTE_DRILL_LEVELS.length - 1].level;
  const attempts = Math.max(0, Math.trunc(Number(stats && stats.attempts) || 0));
  const correct = Math.max(0, Math.trunc(Number(stats && stats.correct) || 0));
  const level = Math.min(maxLevel, Math.max(1, Math.trunc(Number(stats && stats.level) || 1)));
  if (attempts < 8) return level;
  const accuracy = correct / attempts;
  if (accuracy >= 0.9) return Math.min(level + 1, maxLevel);
  if (accuracy < 0.5) return Math.max(level - 1, 1);
  return level;
}

/* ============================ Мелодии ============================ */

/**
 * Каталог мелодий (15+). Все ноты — строки основной октавы "C4".."B4".
 * @property {string} id — стабильный идентификатор (латиница).
 * @property {string} title — название для карточки.
 * @property {string} subtitle — известная строка/часть песни.
 * @property {number} difficulty — 1 (простая) .. 3 (сложная).
 * @property {string} key — тональность оригинала (для отображения).
 * @property {number} beatsPerBar — размер такта в долях.
 * @property {number} tempoHint — рекомендуемый темп воспроизведения, уд/мин.
 * @property {string[]} notes — последовательность нот "C4".."B4" (12 клавиш).
 * @property {number[]} durations — длительности в долях (параллельно notes).
 * @property {number[]} phraseLengths — число нот в каждой строке текста.
 */
const MELODIES = [
  {
    id: 'happy_birthday',
    title: 'С днём рождения',
    subtitle: 'Happy Birthday (куплет)',
    difficulty: 1,
    key: 'F',
    beatsPerBar: 3,
    tempoHint: 100,
    notes: [
      'C4', 'C4', 'D4', 'C4', 'F4', 'E4',
      'C4', 'C4', 'D4', 'C4', 'G4', 'F4',
      'C4', 'C4', 'C4', 'A4', 'F4', 'E4', 'D4',
      'A#4', 'A#4', 'A4', 'F4', 'G4', 'F4',
    ],
    durations: [
      0.5, 0.5, 1, 1, 1.5, 0.5,
      0.5, 0.5, 1, 1, 1.5, 0.5,
      0.5, 0.5, 1, 1, 1, 1, 1,
      0.75, 0.25, 1, 1, 1, 2,
    ],
    phraseLengths: [6, 6, 7, 6],
  },
  {
    id: 'kuznechik',
    title: 'В траве сидел кузнечик',
    subtitle: 'Куплет (Шаинский)',
    difficulty: 2,
    key: 'Am',
    beatsPerBar: 2,
    tempoHint: 120,
    notes: [
      'A4', 'E4', 'A4', 'E4', 'A4', 'G#4', 'G#4', 'G#4',
      'G#4', 'E4', 'G#4', 'E4', 'G#4', 'A4', 'A4', 'A4',
      'B4', 'B4', 'B4', 'B4', 'C4', 'C4', 'C4',
      'C4', 'B4', 'A4', 'G#4', 'A4', 'A4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 1, 1.5,
    ],
    phraseLengths: [8, 8, 7, 6],
  },
  {
    id: 'yolochka',
    title: 'В лесу родилась ёлочка',
    subtitle: 'Первый куплет',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 2,
    tempoHint: 96,
    notes: [
      'G4', 'E4', 'E4', 'D4', 'E4', 'C4', 'G4', 'G4',
      'G4', 'E4', 'E4', 'F4', 'D4', 'G4',
      'G4', 'A4', 'A4', 'F4', 'F4', 'E4', 'D4', 'C4',
      'G4', 'E4', 'E4', 'D4', 'E4', 'C4',
    ],
    durations: [
      0.75, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.75, 0.25, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.75, 0.25, 0.5, 0.5, 0.5, 1.5,
    ],
    phraseLengths: [8, 6, 8, 6],
  },
  {
    id: 'malenkaya_elochka',
    title: 'Маленькой ёлочке',
    subtitle: 'Холодно зимой (куплет)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 100,
    notes: [
      'G4', 'E4', 'E4', 'G4', 'E4', 'E4',
      'G4', 'F4', 'E4', 'D4', 'C4',
      'A4', 'C4', 'A4', 'G4', 'E4', 'E4',
      'G4', 'F4', 'E4', 'D4', 'C4',
    ],
    durations: [
      0.5, 0.5, 1, 0.5, 0.5, 1,
      0.5, 0.5, 0.5, 0.5, 2,
      0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 2,
    ],
    phraseLengths: [6, 5, 6, 5],
  },
  {
    id: 'krokodil_geny',
    title: 'Пусть бегут неуклюже',
    subtitle: 'Песенка крокодила Гены (куплет)',
    difficulty: 2,
    key: 'Am',
    beatsPerBar: 4,
    tempoHint: 104,
    notes: [
      'E4', 'F4', 'E4', 'A4', 'B4', 'C4', 'A4',
      'E4', 'F4', 'E4', 'G4', 'A4', 'B4', 'G4',
      'E4', 'F4', 'E4', 'G4', 'A4', 'B4', 'E4', 'F4', 'E4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2,
    ],
    phraseLengths: [7, 7, 9],
  },
  {
    id: 'goluboy_vagon',
    title: 'Голубой вагон',
    subtitle: 'Медленно минуты (куплет)',
    difficulty: 2,
    key: 'Am',
    beatsPerBar: 4,
    tempoHint: 88,
    notes: [
      'E4', 'A4', 'G4', 'A4', 'B4', 'A4', 'G4', 'A4', 'G4', 'F4', 'F4',
      'D4', 'G4', 'F4', 'G4', 'A4', 'A4', 'G4', 'F4', 'E4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 1, 1,
      0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 2,
    ],
    phraseLengths: [11, 9],
  },
  {
    id: 'korobeiniki',
    title: 'Коробейники',
    subtitle: 'Тема «Тетриса» (первая фраза)',
    difficulty: 3,
    key: 'Am',
    beatsPerBar: 4,
    tempoHint: 149,
    notes: [
      'E4', 'B4', 'C4', 'D4', 'C4', 'B4', 'A4', 'A4', 'C4',
      'E4', 'D4', 'C4', 'B4', 'C4', 'D4', 'E4', 'C4', 'A4', 'A4',
    ],
    durations: [
      2, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5,
      1, 0.5, 0.5, 1.5, 0.5, 1, 1, 1, 1, 2,
    ],
    phraseLengths: [10, 9],
  },
  {
    id: 'ulybka',
    title: 'От улыбки',
    subtitle: 'Улыбка (куплет)',
    difficulty: 2,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 108,
    notes: [
      'C4', 'A4', 'D4', 'C4', 'G4', 'B4', 'A4', 'G4', 'F4',
      'A4', 'C4', 'D4', 'D4', 'D4', 'E4', 'G4', 'F4', 'E4', 'D4', 'F4', 'C4',
      'D4', 'E4', 'F4', 'E4', 'D4', 'A4', 'C4', 'B4', 'D4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2,
    ],
    phraseLengths: [9, 12, 9],
  },
  {
    id: 'spat_ustalye',
    title: 'Спят усталые игрушки',
    subtitle: 'Колыбельная (начало)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 72,
    notes: [
      'G4', 'E4', 'G4', 'E4', 'G4', 'G4', 'F4', 'E4', 'D4', 'E4', 'G4',
      'D4', 'E4', 'D4', 'E4', 'G4', 'G4', 'D4', 'G4', 'D4', 'G4', 'F4', 'E4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
    ],
    phraseLengths: [11, 12],
  },
  {
    id: 'pust_budet_solntse',
    title: 'Пусть всегда будет солнце',
    subtitle: 'Припев',
    difficulty: 2,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 100,
    notes: [
      'G4', 'G4', 'C4', 'D4', 'E4', 'D4', 'C4',
      'G4', 'G4', 'C4', 'D4', 'E4', 'E4',
      'D4', 'G4', 'G4', 'D4', 'E4', 'F4', 'G4',
      'D4', 'D4', 'E4', 'F4', 'C4', 'D4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 1, 1,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2,
      0.5, 0.5, 0.5, 0.5, 1, 1.5,
    ],
    phraseLengths: [7, 6, 7, 6],
  },
  {
    id: 'nepriyatnost',
    title: 'Песенка кота Леопольда',
    subtitle: 'Неприятность эту мы переживём',
    difficulty: 2,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 112,
    notes: [
      'C4', 'A4', 'E4', 'C4', 'A4', 'E4', 'A4', 'B4', 'C4', 'D4', 'C4', 'B4',
      'B4', 'G4', 'D4', 'B4', 'G4', 'D4', 'G4', 'B4', 'D4', 'E4', 'D4', 'C4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5,
    ],
    phraseLengths: [12, 12],
  },
  {
    id: 'dva_veselyh_gusya',
    title: 'Два весёлых гуся',
    subtitle: 'Жили у бабуси (куплет)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 2,
    tempoHint: 116,
    notes: [
      'G4', 'F4', 'E4', 'D4', 'A4', 'A4',
      'G4', 'F4', 'E4', 'D4', 'A4', 'A4',
      'F4', 'A4', 'A4', 'F4', 'E4', 'G4', 'G4', 'E4',
      'G4', 'F4', 'E4', 'D4', 'C4', 'C4',
    ],
    durations: [
      0.5, 0.5, 0.5, 0.5, 1, 1,
      0.5, 0.5, 0.5, 0.5, 1, 1,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1,
      0.5, 0.5, 0.5, 0.5, 1, 1,
    ],
    phraseLengths: [6, 6, 8, 6],
  },
  {
    id: 'ode_to_joy',
    title: 'Ода к радости',
    subtitle: 'Бетховен, 9-я симфония (тема)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 120,
    notes: [
      'E4', 'E4', 'F4', 'G4',
      'G4', 'F4', 'E4', 'D4',
      'C4', 'C4', 'D4', 'E4',
      'E4', 'D4', 'D4',
      'E4', 'E4', 'F4', 'G4',
      'G4', 'F4', 'E4', 'D4',
      'C4', 'C4', 'D4', 'E4',
      'D4', 'C4', 'C4',
    ],
    durations: [
      1, 1, 1.5, 0.5,
      1.5, 0.5, 1, 1,
      1, 1, 1, 1,
      1.5, 0.5, 2,
      1, 1, 1.5, 0.5,
      1.5, 0.5, 1, 1,
      1, 1, 1, 1,
      1.5, 0.5, 2,
    ],
    phraseLengths: [4, 4, 4, 3, 4, 4, 4, 3],
  },
  {
    id: 'twinkle',
    title: 'Звёздочка',
    subtitle: 'Twinkle, Twinkle, Little Star (первая половина)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 100,
    notes: [
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
      'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
    ],
    durations: [
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
    ],
    phraseLengths: [7, 7, 7],
  },
  {
    id: 'frere_jacques',
    title: 'Братец Яков',
    subtitle: 'Frère Jacques (куплет)',
    difficulty: 1,
    key: 'C',
    beatsPerBar: 4,
    tempoHint: 100,
    notes: [
      'C4', 'D4', 'E4', 'C4',
      'C4', 'D4', 'E4', 'C4',
      'E4', 'F4', 'G4',
      'E4', 'F4', 'G4',
      'G4', 'A4', 'G4', 'F4', 'E4', 'C4',
      'G4', 'A4', 'G4', 'F4', 'E4', 'C4',
      'C4', 'G4', 'C4',
      'C4', 'G4', 'C4',
    ],
    durations: [
      1, 1, 1, 1,
      1, 1, 1, 1,
      1.5, 0.5, 2,
      1.5, 0.5, 2,
      0.75, 0.25, 0.5, 0.5, 1, 1,
      0.75, 0.25, 0.5, 0.5, 1, 1,
      1, 0.5, 1.5,
      1, 0.5, 1.5,
    ],
    phraseLengths: [4, 4, 3, 3, 6, 6, 3, 3],
  },
];

/** Диапазон каталога: все ноты внутри основной октавы C4..B4. */
const MELODY_RANGE = { min: 0, max: 11 };

/** Найти мелодию по id. @param {string} id @returns {object|undefined} */
function getMelody(id) {
  return MELODIES.find((m) => m.id === id);
}

/** Мелодии заданной сложности. @param {number} difficulty @returns {object[]} */
function getMelodiesByDifficulty(difficulty) {
  const d = Number(difficulty);
  return MELODIES.filter((m) => m.difficulty === d);
}

/**
 * Сводка по мелодии: количество нот, суммарная длина в долях.
 * @param {object} melody — запись из MELODIES.
 * @returns {{id:string, noteCount:number, totalBeats:number}}
 */
function melodyStats(melody) {
  return {
    id: melody.id,
    noteCount: melody.notes.length,
    totalBeats: melody.durations.reduce((s, d) => s + d, 0),
  };
}

/**
 * Рекомендация следующей сложности мелодий по статистике прохождений.
 * @param {{played:number, completed:number, accuracy:number, currentDifficulty:number}} stats
 * @returns {number} сложность 1..3.
 */
function nextMelodyDifficulty(stats) {
  const max = 3;
  const played = Math.max(0, Math.trunc(Number(stats && stats.played) || 0));
  const completed = Math.max(0, Math.trunc(Number(stats && stats.completed) || 0));
  const accuracy = Math.min(1, Math.max(0, Number(stats && stats.accuracy) || 0));
  const current = Math.min(max, Math.max(1, Math.trunc(Number(stats && stats.currentDifficulty) || 1)));
  if (played < 3) return current;
  if (completed >= 3 && accuracy >= 0.85) return Math.min(current + 1, max);
  if (accuracy < 0.5) return Math.max(current - 1, 1);
  return current;
}

/* ============================ Экспорт ============================ */

const MelodyData = {
  version: '2.0.0',
  A4_DEFAULT,
  C4_MIDI,
  KEY_LETTERS,
  MAIN_OCTAVE_NOTES,
  KEYBOARD_LABELS,
  NOTE_DRILL_LEVELS,
  NOTE_PATTERNS,
  melodies: MELODIES,
  MELODY_RANGE,
  noteToSemitone,
  toKeyIndex,
  keyInfo,
  noteName,
  noteFrequency,
  getDrillLevel,
  mulberry32,
  createNoteSequence,
  nextNoteDrillLevel,
  getMelody,
  getMelodiesByDifficulty,
  melodyStats,
  nextMelodyDifficulty,
};

if (typeof module !== 'undefined') {
  module.exports = MelodyData;
}
if (typeof window !== 'undefined') {
  window.MelodyData = MelodyData;
  // Знаки альтерации (♯/♭) на нотном стане — отдельный браузерный модуль с DOM-логикой.
  import('./staff-accidentals.js').catch(() => {});
}
