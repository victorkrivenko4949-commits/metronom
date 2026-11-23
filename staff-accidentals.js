/**
 * staff-accidentals.js — знаки альтерации (диез ♯ и бемоль ♭) на нотном стане раздела «Тренировка».
 *
 * Подключается из melody-data.js (только в браузере). index.html рисует на стане одну головку ноты,
 * поэтому До и До♯ выглядели одинаково. Скрипт следит за появлением стана (svg.tr-staff) и дорисовывает:
 *   диез   — знак ♯ слева от ноты (нота остаётся на своей ступени);
 *   бемоль — нота переносится на ступень выше и получает знак ♭ (Ля♯ → Си♭).
 * Мелодии в бемольных тональностях пишутся с бемолями, остальные — с диезами;
 * в «Случайных нотах» чёрные клавиши записываются то диезом, то бемолем.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__staffAccidentals) return;
  window.__staffAccidentals = true;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SHARP_NAMES = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];
  var FLAT_NAMES = { 1: 'Ре♭', 3: 'Ми♭', 6: 'Соль♭', 8: 'Ля♭', 10: 'Си♭' };
  var FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
  var STEP = 7; // одна ступень стана в единицах viewBox
  var seed = Math.floor(Math.random() * 1e9);

  // Стабильный «жребий» диез/бемоль для задания: не меняется при перерисовке той же ноты
  function coin(a, b) {
    var h = (seed ^ Math.imul(a + 1, 0x9E3779B1) ^ Math.imul(b + 1, 0x85EBCA6B)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
    return ((h >>> 16) & 1) === 1;
  }

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function glyphGroup() {
    return el('g', { 'class': 'tr-acc', stroke: 'currentColor', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  }
  function sharpGlyph(y) {
    var g = glyphGroup();
    g.appendChild(el('path', { d: 'M63.5 ' + (y - 15) + 'V' + (y + 19) + 'M69.5 ' + (y - 19) + 'V' + (y + 15), 'stroke-width': 1.5 }));
    g.appendChild(el('path', { d: 'M59 ' + (y - 3.5) + 'L74 ' + (y - 7.5) + 'M59 ' + (y + 7.5) + 'L74 ' + (y + 3.5), 'stroke-width': 3.2 }));
    return g;
  }
  function flatGlyph(y) {
    var g = glyphGroup();
    g.appendChild(el('path', { d: 'M63 ' + (y - 25) + 'V' + (y + 7), 'stroke-width': 1.5 }));
    g.appendChild(el('path', { d: 'M63 ' + (y - 3) + 'C67 ' + (y - 8) + ' 74 ' + (y - 7) + ' 73 ' + (y - 1) + 'C72 ' + (y + 3) + ' 67 ' + (y + 5) + ' 63 ' + (y + 7), 'stroke-width': 2.2 }));
    return g;
  }

  function useFlat(core, stage, pc) {
    var chip = core.querySelector('.tr-chip');
    if (chip) { // мелодия: запись зависит от тональности
      var list = (window.MelodyData && window.MelodyData.melodies) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].title === chip.textContent) return FLAT_KEYS.indexOf(list[i].key) !== -1;
      }
      return false;
    }
    var prog = stage.querySelector('[data-role="progress"]');
    var idx = prog ? parseInt(prog.textContent, 10) || 0 : 0;
    return coin(idx, pc);
  }

  function decorate(svg, stage) {
    svg.setAttribute('data-acc', 'none');
    var core = svg.closest('[data-role="core"]');
    if (!core) return;
    var m = /Нота\s+(\S+)\s+—/.exec(core.getAttribute('aria-label') || '');
    if (!m) return;
    var pc = SHARP_NAMES.indexOf(m[1]);
    if (!(pc in FLAT_NAMES)) return; // белая клавиша — знак не нужен
    var head = svg.querySelector('ellipse');
    if (!head) return;
    var y = Number(head.getAttribute('cy'));
    if (!isFinite(y)) return;
    var flat = useFlat(core, stage, pc);
    if (flat) {
      y -= STEP;
      head.setAttribute('cy', y);
      var stem = svg.querySelector('line[x1="100"]');
      if (stem) { stem.setAttribute('y1', y - 5); stem.setAttribute('y2', y - 50); }
      svg.appendChild(flatGlyph(y));
      var nameEl = core.querySelector('.tr-note-name');
      if (nameEl && !nameEl.classList.contains('muted')) {
        nameEl.textContent = FLAT_NAMES[pc] + ' (= ' + SHARP_NAMES[pc] + ')';
      }
    } else {
      if (pc === 1) { // До♯ стоит на добавочной линейке, как и До
        var lines = svg.querySelector('g');
        if (lines) lines.appendChild(el('line', { x1: 76, x2: 108, y1: y, y2: y }));
      }
      svg.appendChild(sharpGlyph(y));
    }
    svg.setAttribute('data-acc', flat ? 'flat' : 'sharp');
  }

  function scan(stage) {
    var list = stage.querySelectorAll('svg.tr-staff:not([data-acc])');
    for (var i = 0; i < list.length; i++) {
      try { decorate(list[i], stage); } catch (e) { /* стан остаётся как был */ }
    }
  }
  function init() {
    var stage = document.getElementById('trStage');
    if (!stage || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () { scan(stage); }).observe(stage, { childList: true, subtree: true });
    scan(stage);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
