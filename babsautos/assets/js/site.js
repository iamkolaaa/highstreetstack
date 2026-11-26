/* Babs Auto Logistics: reel progress, stock filter, entrances, email fit. No libraries. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- hero reel: scroll position moves the strip, holding on each photograph ---- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var track = hero.querySelector('.reel__track');
    var frames = hero.querySelectorAll('.frame:not(.frame--lead)');
    var stage = hero.querySelector('.hero__stage');
    var steps = frames.length - 1;
    var last = -1;
    var ease = function (t) { return t * t * (3 - 2 * t); };
    var update = function () {
      var run = hero.offsetHeight - stage.offsetHeight;
      if (run <= 0) { track.style.setProperty('--p', '0'); return; }
      var u = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / run));
      var s = u * steps, i = Math.min(steps - 1, Math.floor(s)), f = s - i;
      if (u >= 1) { i = steps; f = 0; }
      var p = i + ease(Math.min(1, Math.max(0, (f - 0.28) / 0.44)));
      var on = Math.round(p);
      if (on !== last) {
        last = on;
        for (var k = 0; k < frames.length; k++) frames[k].classList.toggle('is-on', k === on);
      }
      track.style.setProperty('--p', p.toFixed(4));
    };
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /* ---- reel photographs after the first start small; fetch the right size once the page has settled ---- */
  var upgrade = function () {
    document.querySelectorAll('img[data-up]').forEach(function (im) {
      im.sizes = window.innerWidth <= 700 ? '92vw' : '35vw';
      im.removeAttribute('data-up');
    });
  };
  var upgraded = false;
  var once = function () { if (upgraded) return; upgraded = true; upgrade(); };
  window.addEventListener('scroll', once, { passive: true, once: true });
  setTimeout(once, 4000);

  /* ---- entrances: once, as each part comes into view ---- */
  var targets = document.querySelectorAll('[data-reveal], .gallery__rise');
  if (targets.length) {
    if (!('IntersectionObserver' in window) || reduce) {
      for (var a = 0; a < targets.length; a++) targets[a].classList.add('is-in');
    } else {
      var io = new IntersectionObserver(function (list) {
        list.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
      for (var b = 0; b < targets.length; b++) io.observe(targets[b]);
    }
  }

  /* ---- stock filter: instant, from the keyboard too, all cars shown without script ---- */
  var form = document.querySelector('.filters');
  var grid = document.getElementById('grid');
  if (form && grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    var count = document.getElementById('count');
    var none = document.getElementById('none');
    var apply = function () {
      var want = {};
      ['where', 'body', 'band'].forEach(function (n) {
        var el = form.querySelector('input[name="' + n + '"]:checked');
        want[n] = el ? el.value : 'all';
      });
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (want.where === 'all' || c.dataset.where === want.where) &&
                 (want.body === 'all' || c.dataset.body === want.body) &&
                 (want.band === 'all' || c.dataset.band === want.band);
        c.hidden = !ok;
        if (ok) shown++;
      });
      count.textContent = shown === cards.length ? 'Showing all ' + cards.length + ' cars' : 'Showing ' + shown + ' of ' + cards.length + ' cars';
      none.hidden = shown !== 0;
    };
    form.addEventListener('change', apply);
    apply();
  }

  /* ---- stock row: previous / next ---- */
  var srow = document.querySelector('.stock__row');
  if (srow) {
    document.querySelectorAll('.stock__nav button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = srow.querySelector('.card');
        srow.scrollBy({ left: Number(btn.dataset.dir) * (c.offsetWidth + 24), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---- contact: fit the address from margin to margin ---- */
  var mail = document.querySelector('.contact__mail');
  if (mail) {
    var fit = function () {
      var w = mail.parentElement.clientWidth - parseFloat(getComputedStyle(mail.parentElement).paddingLeft) * 2;
      mail.style.fontSize = '100px';
      var stacked = getComputedStyle(mail.querySelector('.fit')).display === 'block';
      var spans = mail.querySelectorAll('.fit');
      var need = 0;
      for (var i = 0; i < spans.length; i++) {
        var sw = spans[i].getBoundingClientRect().width;
        need = stacked ? Math.max(need, sw) : need + sw;
      }
      if (need) mail.style.fontSize = Math.floor(100 * w / need * 0.995) + 'px';
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
    window.addEventListener('resize', fit);
  }
})();
