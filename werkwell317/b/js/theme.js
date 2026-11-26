/* Appearance: Auto follows the device setting; Light and Dark are a saved choice. */
(function () {
  'use strict';
  var KEY = 'werkwell-theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var fadeTimer = 0;
  var current = 'auto';
  try { var saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') current = saved; } catch (e) {
    var q = /[?&]theme=(light|dark)\b/.exec(location.search); if (q) current = q[1];
  }

  function resolved() { return current === 'dark' || (current !== 'light' && mq && mq.matches) ? 'dark' : 'light'; }

  function sync() {
    var r = resolved();
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-label', r === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    var sets = document.querySelectorAll('[data-theme-set]');
    for (var k = 0; k < sets.length; k++) sets[k].setAttribute('aria-pressed', sets[k].getAttribute('data-theme-set') === current ? 'true' : 'false');
    var segs = document.querySelectorAll('[data-theme-seg]');
    for (var s = 0; s < segs.length; s++) segs[s].setAttribute('data-mode', current);
  }

  function paint(animate) {
    var r = resolved();
    if (root.getAttribute('data-theme') !== r) {
      var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (animate && !still) {
        root.classList.add('theme-fade');
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () { root.classList.remove('theme-fade'); }, 420);
      }
      root.setAttribute('data-theme', r);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = r === 'dark' ? '#150c13' : '#f8f6f2';
    }
    sync();
  }

  function set(mode) {
    current = mode === 'light' || mode === 'dark' ? mode : 'auto';
    try { localStorage.setItem(KEY, current); } catch (e) {}
    paint(true);
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-theme-toggle]');
    if (t) { set(resolved() === 'dark' ? 'light' : 'dark'); return; }
    var b = e.target.closest('[data-theme-set]');
    if (b) set(b.getAttribute('data-theme-set'));
  });
  if (mq) {
    var onSystem = function () { if (current === 'auto') paint(true); };
    if (mq.addEventListener) mq.addEventListener('change', onSystem); else if (mq.addListener) mq.addListener(onSystem);
  }
  window.WerkTheme = { get: function () { return current; }, set: set, resolved: resolved, sync: sync };
  paint(false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
})();
