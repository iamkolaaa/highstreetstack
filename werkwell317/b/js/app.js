/* WERK WELL Studio, demo B. One file, no build step. */
(function () {
  'use strict';
  var W = window.WW, doc = document, root = doc.documentElement;
  root.classList.add('js');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = { get matches() { return root.classList.contains('fine') && innerWidth >= 768; } };
  var fineMQ = matchMedia('(pointer: fine)');
  function setFine() { root.classList.toggle('fine', fineMQ.matches || /[?&]fine=1(&|$)/.test(location.search)); }
  setFine(); if (fineMQ.addEventListener) fineMQ.addEventListener('change', setFine);

  /* ---------- storage ---------- */
  var KEY = 'werkwell-b';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  var S = Object.assign({ voice: 'original', bookings: [], requests: [], offerGone: false, purchases: [], plan: 'pass' }, load());
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function $(s, el) { return (el || doc).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function v(b) { if (b == null) return ''; if (typeof b === 'string') return esc(b); return '<span data-v>' + esc(S.voice === 'suggested' ? b.suggested : b.original) + '</span>'; }
  function vt(b) { if (b == null) return ''; return typeof b === 'string' ? b : (S.voice === 'suggested' ? b.suggested : b.original); }
  function paras(b) { return vt(b).split('\n').filter(Boolean).map(function (p) { return '<p data-v>' + esc(p) + '</p>'; }).join(''); }
  function img(name, alt, opts) {
    opts = opts || {};
    var big = 'img/' + name + '-1600.webp', small = 'img/' + name + '-800.webp';
    return '<img src="' + (opts.big ? big : small) + '" srcset="' + small + ' 800w, ' + big + ' 1600w" sizes="' + (opts.sizes || '(max-width: 767px) 100vw, 50vw') + '" alt="' + esc(alt) + '"' + (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" width="' + (opts.w || 1067) + '" height="' + (opts.h || 1600) + '">';
  }
  var DIMS = {
    'millie-portrait': [1067, 1600], 'millie-squat': [1067, 1600], 'two-women-dancing': [1600, 1068], 'dancer-balance': [1068, 1600], 'dancer-reach': [1068, 1600],
    'dancer-forward-bend': [1068, 1600], 'dancer-arm-pose': [1067, 1600], 'group-laughing': [1600, 1067], 'social-brand-graphic': [756, 1326], 'social-high-five': [742, 1334],
    'social-twerk-sweat-repeat': [1600, 879], 'twerkmas-poster': [1080, 1080], 'love-to-wine-still': [1600, 1115]
  };
  function pic(name, alt, cls, opts) {
    opts = opts || {}; var d = DIMS[name] || [1067, 1600];
    opts.w = d[0]; opts.h = d[1];
    return '<figure class="pic ' + (cls || '') + '"' + (opts.pos ? ' style="--pos:' + opts.pos + '"' : '') + '>' + img(name, alt, opts) + (opts.cap ? '<figcaption class="pic__cap">' + esc(opts.cap) + '</figcaption>' : '') + '</figure>';
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function D(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(iso, long) { var d = D(iso); return (long ? DAYS[d.getDay()] : DAYS[d.getDay()].slice(0, 3)) + ' ' + d.getDate() + ' ' + (long ? MONTHS_L : MONTHS)[d.getMonth()] + (long && d.getFullYear() !== 2026 ? ' ' + d.getFullYear() : ''); }
  function time12(t) { var h = +t.slice(0, 2), m = t.slice(3); return (h % 12 || 12) + (m === '00' ? '' : ':' + m) + (h < 12 ? 'am' : 'pm'); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('is-on'); }, 2600); }
  function arrowBtn(label, href, cls, attrs) {
    var inner = '<span class="btn__label">' + label + '</span><span class="btn__arrow" aria-hidden="true">&rarr;</span>';
    return href ? '<a class="btn ' + (cls || '') + '" href="' + href + '"' + (attrs || '') + '>' + inner + '</a>' : '<button type="submit" class="btn ' + (cls || '') + '"' + (attrs || '') + '>' + inner + '</button>';
  }

  /* ---------- data ---------- */
  var CLASSES = W.classes.items, EVENTS = W.events.items;
  function cls(id) { return CLASSES.filter(function (c) { return c.id === id; })[0]; }
  function evt(id) { return EVENTS.filter(function (e) { return e.id === id; })[0]; }
  // Sample places taken (demo data only).
  var TAKEN = {
    'dancehall-twerk|2026-12-02': 11, 'dancehall-twerk|2026-12-09': 7, 'dancehall-twerk|2026-12-16': 9, 'dancehall-twerk|2027-01-06': 5, 'dancehall-twerk|2027-01-13': 3, 'dancehall-twerk|2027-01-20': 2,
    'pelvic-pilates|2026-12-02': 10, 'pelvic-pilates|2026-12-09': 4, 'pelvic-pilates|2026-12-16': 6, 'pelvic-pilates|2027-01-06': 3, 'pelvic-pilates|2027-01-13': 2, 'pelvic-pilates|2027-01-20': 1,
    'twerkmas|2026-12-18': 14, 'love-to-wine|2027-02-28': 4
  };
  function capOf(id) { var c = cls(id) || evt(id); return c ? c.capacity : 0; }
  function taken(id, date) { var n = TAKEN[id + '|' + date] || 0; S.bookings.forEach(function (b) { if (b.item === id && b.date === date && !b.waitlist) n++; }); return n; }
  function left(id, date) { return Math.max(0, capOf(id) - taken(id, date)); }
  function slots() {
    var out = [];
    CLASSES.forEach(function (c) { if (c.status === 'live') c.dates.forEach(function (d) { out.push({ id: c.id, name: c.name, date: d, time: c.timetable.time, len: c.length_minutes, kind: 'class' }); }); });
    return out.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  }
  function isMember() { return S.plan === 'member'; }
  function weekList() { var w = []; slots().forEach(function (s) { if (w.indexOf(s.date) < 0) w.push(s.date); }); return w; }
  function openDates() { return weekList().slice(0, isMember() ? 4 : 2); }
  function earlyDate(d) { var i = weekList().indexOf(d); return isMember() && i >= 2 && i < 4; }
  function visibleSlots() { var o = openDates(); return slots().filter(function (s) { return o.indexOf(s.date) >= 0; }); }
  function creditsLeft() { return Math.max(0, 5 - S.bookings.filter(function (b) { return b.pay === 'wallet' && !b.waitlist; }).length); }
  var EARLY = '<span class="early">Member early access</span>';
  function placesLabel(id, date) {
    var l = left(id, date);
    if (l === 0) return '<span class="tag-full">Full</span>';
    if (l <= 5) return '<span class="left">' + l + (l === 1 ? ' place left' : ' places left') + '</span>';
    return 'Places available';
  }
  var GMAPS = W.meta.google.url, IG = W.meta.socials.instagram.url, TT = W.meta.socials.tiktok.url, FB = W.meta.socials.facebook.url;
  var PRICE = { single: 13, intro: 29, pass5: 58, pass10: 105, four: 44, club: 79, private: 70 };

  /* ---------- shared blocks ---------- */
  function newsletterForm(id, label) {
    return '<form class="field__form" data-form="news" novalidate><label class="vh" for="' + id + '">Email address</label><input id="' + id + '" type="email" required placeholder="' + esc(W.home.newsletter.placeholder) + '" autocomplete="email">' + arrowBtn(label || W.home.newsletter.button, null, 'btn--accent') + '</form>';
  }
  function faqBlock(items, title, sub) {
    return '<section class="band wrap" aria-labelledby="faq-h"><h2 id="faq-h" class="faq__head rv">' + v(title) + '</h2>' + (sub ? '<p class="rv" style="--d:1;max-width:44ch;margin-top:20px">' + v(sub) + '</p>' : '') +
      '<div class="faq__list"><div class="faq__items">' + items.map(function (it, i) {
        return '<details class="qa rv" style="--d:' + Math.min(i, 6) + '"><summary>' + v(it.q) + '<span class="chev" aria-hidden="true"></span></summary><div class="qa__a"><p>' + v(it.a) + '</p></div></details>';
      }).join('') + '</div></div></section>';
  }

  /* ================= VIEWS ================= */
  var views = {};

  /* ----- Home ----- */
  views.home = function () {
    var H = W.home, next = slots()[0], nc = cls(next.id), tw = evt('twerkmas'), lw = evt('love-to-wine');
    var nextLeft = left(next.id, next.date), cap = nc.capacity, tk = cap - nextLeft;
    var dots = ''; for (var i = 0; i < cap; i++) dots += '<i class="place' + (i >= tk ? ' is-free' : '') + '"></i>';
    var rows = visibleSlots().slice(0, 6).map(function (s, i) {
      var full = left(s.id, s.date) === 0;
      return '<li' + (i === 2 || i === 4 ? ' class="group"' : '') + '><a href="#/book?c=' + s.id + '&d=' + s.date + '"><span class="when">' + fmtDate(s.date) + ', ' + time12(s.time) + '</span><span class="what">' + esc(s.name) + (earlyDate(s.date) ? ' ' + EARLY : '') + '</span><span class="val">' + (full ? 'Join waitlist' : placesLabel(s.id, s.date)) + '<span class="go" aria-hidden="true">&rarr;</span></span></a></li>';
    }).join('');
    return '' +
    '<section class="hero" aria-labelledby="h1">' +
      pic('two-women-dancing', 'Two women dancing close together in a Werk Well class', 'hero__land pic--hover', { eager: true, sizes: '(max-width: 767px) 60vw, 34vw' }) +
      '<h1 id="h1" class="hero__title" data-v><span class="l1">Your Body' + (S.voice === 'suggested' ? '.' : '') + '</span><span class="l2">Your Bounce' + (S.voice === 'suggested' ? '.' : '') + '</span></h1>' +
      '<div class="pic hero__tall fade-stack" id="fade">' +
        img('dancer-balance', 'A dancer in a red top balancing on one leg on the studio floor', { eager: true, big: true, sizes: '(max-width: 767px) 75vw, 32vw', w: 1068, h: 1600 }) +
        img('dancer-reach', 'A dancer reaching one arm high, back arched', { sizes: '(max-width: 767px) 75vw, 32vw', w: 1068, h: 1600 }) +
        img('millie-squat', 'Millie crouched low in her orange Werk Well tee', { sizes: '(max-width: 767px) 75vw, 32vw' }) +
        img('dancer-arm-pose', 'A dancer mid-move with one arm raised and one foot lifted', { sizes: '(max-width: 767px) 75vw, 32vw' }) +
      '</div>' +
      '<div class="hero__note"><p>' + v(H.one_line) + '</p><div class="hero__acts">' + arrowBtn('Book a class', '#/book', 'btn--accent') + '<a class="btn btn--ghost" href="#/club"><span class="btn__label">The Werk Club</span></a></div></div>' +
      '<p class="hero__next"><span><strong>Next class</strong> ' + esc(nc.name) + '</span><span>' + fmtDate(next.date, true) + ', ' + time12(next.time) + '</span><span>' + esc(W.meta.venue.name) + ', ' + esc(W.meta.venue.area) + '</span></p>' +
    '</section>' +

    '<section class="band wrap story" aria-labelledby="story-h">' +
      '<div class="grid story__row"><h2 id="story-h" class="story__title rv">Our story, in her words</h2><p class="story__note rv" style="--d:1">Millie made this film about why Werk Well exists and who it is for. Five minutes, with captions on when you tap for sound.</p></div>' +
      '<div class="story__slot rv-pic" id="storySlot">' + playerHTML() + '</div>' +
      '<div class="facts">' +
        '<div class="fact rv" style="--d:0"><b>Wednesdays</b><span>Every week, from 2 December</span></div>' +
        '<div class="fact rv" style="--d:1"><b>6:15 and 7:15pm</b><span>Dancehall &amp; Twerk, then Pelvic Pilates</span></div>' +
        '<div class="fact rv" style="--d:2"><b>15 places</b><span>A small room, women only</span></div>' +
        '<div class="fact rv" style="--d:3"><b>£13</b><span>A single class. Your first three are £29</span></div>' +
      '</div>' +
    '</section>' +

    '<section class="band band--sand wrap" aria-labelledby="list-h">' +
      '<h2 id="list-h" class="list__head rv"><span>Put your name on</span><span>Wednesday\'s list</span></h2>' +
      '<div class="grid list__body">' +
        '<div class="list__side"><p class="rv">Fifteen places on the wood floor, every Wednesday. Put your first name down and the next free place is yours to hold.</p>' +
        pic('millie-portrait', 'Millie sitting cross-legged on the wood floor, smiling', 'list__pic rv-pic pic--hover') + '</div>' +
        '<div class="list__table">' +
          '<div class="guest rv" id="guest" data-cap="' + cap + '" data-taken="' + tk + '">' +
            '<div class="guest__title"><h3>' + esc(nc.name) + '</h3><span class="small">' + fmtDate(next.date, true) + ', ' + time12(next.time) + '</span></div>' +
            '<div class="places" aria-hidden="true">' + dots + '</div>' +
            '<p class="guest__count">' + placesLabel(next.id, next.date) + ' of ' + cap + '. Sample numbers for the demo.</p>' +
            '<p class="guest__you" id="guestYou" aria-live="polite">Type your first name to hold a place.</p>' +
            '<form class="field-row" id="guestForm"><label class="vh" for="guestName">Your first name</label><input id="guestName" type="text" autocomplete="given-name" placeholder="Your first name" maxlength="24">' + arrowBtn('Hold it', null, 'btn--accent') + '</form>' +
          '</div>' +
          '<ul class="sched rv" style="--d:1" aria-label="Next classes">' + rows + '</ul>' +
          '<div class="ahead-cta rv"><a class="btn btn--ghost" href="#/book?ahead=1"><span class="btn__label">Book ahead</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></a><p class="small">' + (isMember() ? 'Members see four weeks ahead.' : 'Pass holders see two weeks ahead; members see four.') + ' Pick several Wednesdays at once.</p></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="band wrap" aria-labelledby="ways-h">' +
      '<div class="grid menu-prices">' +
        '<div class="menu-prices__side"><h2 id="ways-h" class="rv">Three ways in</h2>' + pic('dancer-forward-bend', 'A dancer bent forward, hands on knees, in trainers', 'menu-prices__pic rv-pic pic--hover', { sizes: '(max-width: 767px) 60vw, 22vw' }) + '</div>' +
        '<div class="menu-prices__list">' +
          '<div class="mgroup rv"><h3>Try a class</h3>' +
            '<a class="mitem" href="#/book?pay=intro"><div class="mitem__row"><b>Intro pass, 3 classes</b><span>£29</span></div><p>For new clients. Use within 14 days.</p><span class="mitem__go">Start here</span></a>' +
            '<a class="mitem" href="#/book"><div class="mitem__row"><b>Single class</b><span>13</span></div><p>Any live class on the timetable.</p></a></div>' +
          '<div class="mgroup rv" style="--d:1"><h3>Class passes</h3>' +
            '<a class="mitem" href="#/club#passes"><div class="mitem__row"><b>5 classes</b><span>£58</span></div><p>£11.60 a class. Use within 6 weeks.</p></a>' +
            '<a class="mitem" href="#/club#passes"><div class="mitem__row"><b>10 classes</b><span>105</span></div><p>£10.50 a class. Use within 12 weeks.</p></a></div>' +
          '<div class="mgroup rv" style="--d:2"><h3>The Werk Club</h3>' +
            '<a class="mitem" href="#/club"><div class="mitem__row"><b>Werk Club Four</b><span>£44 a month</span></div><p>Four classes a month. Booking opens 24 hours early.</p></a>' +
            '<a class="mitem" href="#/club"><div class="mitem__row"><b>The Werk Club</b><span>79 a month</span></div><p>Every weekly class. Founding places are limited to 30.</p><span class="mitem__go">Request your place</span></a></div>' +
          '<div class="mgroup rv" style="--d:3"><h3>Just you and Millie</h3>' +
            '<a class="mitem" href="#/classes#private"><div class="mitem__row"><b>Private 1:1, one hour</b><span>£70</span></div><p>Coaching built around your goals and style.</p></a></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="band wrap" aria-labelledby="ev-h">' +
      '<div class="grid run">' +
        '<div class="run__side"><h2 id="ev-h" class="rv">Twerkmas</h2><p class="rv" style="--d:1;margin-top:12px;font-family:var(--serif);font-size:1.375rem;line-height:1.3">Friday 18 December, 6 to 9pm</p><p class="rv" style="--d:1;margin-top:12px"><a class="tlink is-on" href="#/events">All events</a></p>' +
          '<div class="notes rv" style="--d:2"><p>' + esc(tw.price_label) + ' at Fearless Fit Hub, with karaoke, pole dancing and food.</p><p class="muted">Then Love to Wine, Sunday 28 February, 1pm.</p></div></div>' +
        '<div class="run__frames">' +
          '<a class="frame frame--lift" href="#/book?e=twerkmas">' + pic('twerkmas-poster', 'Twerkmas at WerkWell poster: Friday 18 December, 6 to 9pm, Fearless Fit Hub', 'pic--hover', { sizes: '(max-width: 767px) 92vw, 40vw', cap: 'Book your Twerkmas place \u2192' }) + '<span class="frame__cap"><span>Book Twerkmas</span><span>£25</span></span></a>' +
          '<a class="frame" href="#/book?e=love-to-wine">' + pic('love-to-wine-still', 'Love to Wine workshop still', 'pic--hover', { sizes: '30vw', cap: 'Sun 28 Feb' }) + '<span class="frame__cap"><span>Love to Wine</span><span>£20</span></span></a>' +
          '<a class="frame" href="#/events">' + pic('group-laughing', 'A group of women laughing with their arms up', 'pic--hover', { sizes: '30vw' }) + '<span class="frame__cap"><span>All events</span><span>&rarr;</span></span></a>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="band wrap" aria-labelledby="words-h">' +
      '<div class="grid">' +
        pic('social-high-five', 'Two women high-fiving during a Werk Well class', 'words__pic rv-pic', { sizes: '(max-width: 767px) 72vw, 30vw' }) +
        '<div class="words__main"><h2 id="words-h" class="rv">' + v(H.testimonials_heading) + '</h2>' +
          '<blockquote class="quote rv" style="--d:1"><p>' + esc(W.testimonials[1].quote) + '</p><footer>' + esc(W.testimonials[1].name) + ', ' + esc(W.testimonials[1].place) + '</footer></blockquote>' +
          '<div class="quote-small">' + [0, 2].map(function (i, k) { var t = W.testimonials[i]; return '<blockquote class="quote rv" style="--d:' + (2 + k) + '"><p>' + esc(t.quote) + '</p><footer>' + esc(t.name) + ', ' + esc(t.place) + '</footer></blockquote>'; }).join('') + '</div>' +
          '<a class="google rv" style="--d:4" href="' + GMAPS + '" target="_blank" rel="noopener"><b>5.0</b><span class="tlink is-on">on Google, 38 reviews</span></a>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="rise" id="rise" aria-labelledby="soc-h">' +
      '<div class="rise__stage"><h2 id="soc-h" class="wrap">' + v(H.socials_heading) + '</h2><p class="wrap">' + v(H.socials_sub) + '</p>' +
        '<div class="rise__row">' +
          reel('social-high-five', 'Instagram', W.meta.socials.instagram.handle, IG, 'l') +
          reel('social-brand-graphic', 'TikTok', W.meta.socials.tiktok.handle, TT, 'c') +
          reel('social-twerk-sweat-repeat', 'Facebook', W.meta.socials.facebook.handle, FB, 'r') +
        '</div></div>' +
    '</section>' +

    '<section aria-labelledby="news-h">' +
      '<div class="strip">' + pic('group-laughing', 'Women laughing together outdoors', '', { sizes: '(max-width: 767px) 100vw, 34vw' }) + pic('dancer-reach', 'A dancer reaching high', '', { sizes: '34vw', pos: 'center 20%' }) + pic('two-women-dancing', 'Two women dancing', '', { sizes: '34vw' }) + '</div>' +
      '<div class="field"><div class="field__txt"><h2 id="news-h">' + esc(H.newsletter.heading) + '</h2><p>' + esc(H.newsletter.text) + '</p>' + newsletterForm('newsHome') + '<p class="small" style="margin-top:12px">' + esc(H.newsletter.consent) + '</p></div>' +
        '<div class="field__who">' + pic('millie-portrait', 'Millie', '', { sizes: '150px' }) + '</div></div>' +
    '</section>';
  };
  function reel(name, net, handle, url, pos) {
    return '<a class="reel reel--' + pos + '" href="' + url + '" target="_blank" rel="noopener" data-reel>' + pic(name, net + ': ' + handle, '', { sizes: '(max-width: 767px) 66vw, 36vw' }) + '<span class="reel__label"><span>' + net + '</span><span>' + esc(handle) + ' &nearr;</span></span></a>';
  }

  /* ----- Video player (founder film) ----- */
  var VIMEO = W.meta.video.vimeo_id;
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="M16 8.5c1.6 1.9 1.6 5.1 0 7M18.6 6c3 3.4 3 8.6 0 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function playerHTML() {
    return '<div class="player" id="player">' +
      '<img class="player__poster" src="media/our-story-poster.jpg" alt="Still from Our Story, the Werk Well film" width="1280" height="720" loading="lazy">' +
      '<button type="button" class="player__play" id="playBtn" aria-label="Play Our Story, 5 minutes 12 seconds">' + ICON.play + '</button>' +
      '<button type="button" class="player__sound" id="tapSound">' + ICON.muted + '<span>Tap for sound</span></button>' +
      '<div class="player__bar" role="group" aria-label="Film controls">' +
        '<button type="button" class="pbtn" id="pPlay" aria-label="Pause the film">' + ICON.pause + '</button>' +
        '<button type="button" class="pbtn" id="pMute" aria-label="Turn the sound on">' + ICON.muted + '</button>' +
        '<button type="button" class="pbtn pbtn--dock" id="dockUp" aria-label="Back to the film">' + ICON.up + '</button>' +
        '<button type="button" class="pbtn pbtn--dock" id="dockX" aria-label="Close the player">' + ICON.x + '</button>' +
      '</div>' +
    '</div>';
  }
  var TESTPLAYER = /[?&]player=test(&|$)/.test(location.search);
  var P = { el: null, frame: null, live: false, docked: false, closed: false, io: null, playing: false, muted: true, origin: 'https://player.vimeo.com' };
  function vimeoPost(method, value) { if (P.frame && P.frame.contentWindow) P.frame.contentWindow.postMessage(JSON.stringify(value === undefined ? { method: method } : { method: method, value: value }), P.origin); }
  function syncPlayer() {
    if (!P.el) return;
    var pp = $('#pPlay', P.el), pm = $('#pMute', P.el);
    pp.innerHTML = P.playing ? ICON.pause : ICON.play; pp.setAttribute('aria-label', P.playing ? 'Pause the film' : 'Play the film');
    pm.innerHTML = P.muted ? ICON.muted : ICON.sound; pm.setAttribute('aria-label', P.muted ? 'Turn the sound on' : 'Mute the film');
    P.el.classList.toggle('is-unmuted', !P.muted);
    P.el.classList.toggle('is-paused', !P.playing);
  }
  function setMuted(m) {
    P.muted = m;
    if (m) { vimeoPost('setMuted', true); vimeoPost('setVolume', 0); }
    else { vimeoPost('setMuted', false); vimeoPost('setVolume', 1); vimeoPost('enableTextTrack', 'en'); if (window.WerkIntro && !WerkIntro.isMuted()) { WerkIntro.mute(); syncSound(); } }
    syncPlayer();
  }
  function setupPlayer() {
    P.el = $('#player'); if (!P.el) return;
    P.live = false; P.docked = false; P.closed = false; P.playing = false; P.muted = true; P.frame = null;
    var slot = $('#storySlot');
    function mount(autoplayMuted) {
      if (P.frame) return;
      var f = doc.createElement('iframe');
      if (TESTPLAYER) { f.src = 'media/test-player.html?autoplay=1&muted=' + (autoplayMuted ? 1 : 0); P.origin = location.origin === 'null' ? '*' : location.origin; }
      else { f.src = 'https://player.vimeo.com/video/' + VIMEO + '?autoplay=1&muted=' + (autoplayMuted ? 1 : 0) + '&loop=1&title=0&byline=0&portrait=0&dnt=1&playsinline=1&texttrack=en&api=1'; P.origin = 'https://player.vimeo.com'; }
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.title = 'Our Story, the Werk Well film'; f.setAttribute('loading', 'eager');
      P.el.insertBefore(f, P.el.firstChild); P.frame = f; P.muted = !!autoplayMuted; syncPlayer();
      setTimeout(function () { if (!P.live && P.el) P.el.classList.add('is-fallback'); }, 9000);
    }
    $('#playBtn').addEventListener('click', function () {
      if (P.el.classList.contains('is-fallback')) { window.open('https://vimeo.com/' + VIMEO, '_blank', 'noopener'); return; }
      if (P.frame) { vimeoPost('play'); setMuted(false); } else mount(false);
    });
    $('#tapSound').addEventListener('click', function () { setMuted(false); });
    $('#pPlay').addEventListener('click', function () { vimeoPost(P.playing ? 'pause' : 'play'); P.playing = !P.playing; syncPlayer(); });
    $('#pMute').addEventListener('click', function () { setMuted(!P.muted); });
    $('#dockX').addEventListener('click', function () { vimeoPost('pause'); P.playing = false; undock(true); P.closed = true; P.el.classList.add('is-closed'); });
    $('#dockUp').addEventListener('click', function () { slot.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); });
    // Start muted when the film is near the screen (autoplay muted).
    var started = false;
    P.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !started) { started = true; mount(true); }
        if (!started) return;
        var past = !e.isIntersecting;
        if (past && !P.docked && !P.closed) dock(); else if (!past && P.docked) undock();
      });
    }, { threshold: 0, rootMargin: '0px' });
    P.io.observe(slot);
  }
  window.addEventListener('message', function (e) {
    if (!P.el || !P.frame || e.source !== P.frame.contentWindow) return;
    var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    if (!d) return;
    if (d.event === 'ready') { ['play', 'pause', 'playProgress', 'volumechange'].forEach(function (ev) { vimeoPost('addEventListener', ev); }); }
    if (d.event === 'play' || d.event === 'playProgress') { if (!P.live) { P.live = true; P.el.classList.add('is-live'); P.el.classList.remove('is-fallback'); } if (!P.playing) { P.playing = true; syncPlayer(); } }
    if (d.event === 'pause') { P.playing = false; syncPlayer(); }
    if (d.event === 'volumechange' && d.data) { var m = d.data.muted != null ? !!d.data.muted : d.data.volume === 0; if (m !== P.muted) { P.muted = m; syncPlayer(); } }
  });
  // Dock along a curved path: X and Y travel on different curves.
  function flip(fromRect, toRect) {
    if (reduced) return;
    var dx = fromRect.left - toRect.left, dy = fromRect.top - toRect.top, s = fromRect.width / toRect.width;
    P.el.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' },
      { transform: 'translate(' + (dx * 0.25) + 'px,' + (dy * 0.75) + 'px) scale(' + (1 + (s - 1) * 0.35) + ')', offset: 0.55 },
      { transform: 'none' }
    ], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  function dock() { var a = P.el.getBoundingClientRect(); P.el.classList.add('is-docked'); P.docked = true; flip(a, P.el.getBoundingClientRect()); }
  function undock(noAnim) { if (!P.docked) return; var a = P.el.getBoundingClientRect(); P.el.classList.remove('is-docked'); P.docked = false; if (!noAnim) flip(a, P.el.getBoundingClientRect()); }

  /* ----- Classes ----- */
  views.classes = function () {
    var C = W.classes;
    var cards = CLASSES.map(function (c) {
      var live = c.status === 'live';
      var facts = '<div class="xcard__facts"><span>' + esc(c.length) + '</span><span>' + esc(c.intensity_note) + '</span>' + (c.levels ? '<span>' + esc(c.levels) + '</span>' : '') + (live ? '<span>' + esc(c.timetable.day) + 's ' + esc(c.timetable.time_label) + '</span><span>' + esc(c.price_label) + '</span>' : '') + '</div>';
      var acts = live ? arrowBtn('Book', '#/book?c=' + c.id, 'btn--accent btn--sm') : '<button type="button" class="btn btn--sm" data-tell="' + c.id + '"><span class="btn__label">' + esc(C.tell_me_when.button) + '</span></button>';
      return '<article class="xcard rv" id="c-' + c.id + '" style="--d:' + CLASSES.indexOf(c) + '">' +
        '<div class="xcard__body">' +
          '<button type="button" class="xcard__btn" aria-expanded="false" aria-controls="dr-' + c.id + '"><span class="vh">Show details for ' + esc(c.name) + '</span>' +
          pic(c.photo, c.name, 'xcard__pic', { sizes: '(max-width: 767px) 38vw, 25vw' }) + '</button>' +
          '<div class="xcard__meta"><h3>' + esc(c.name) + '</h3><span>' + (live ? esc(c.timetable.day) + ' ' + esc(c.timetable.time_label) : '<span class="soon">Soon</span>') + '</span><span class="xcard__more t-only" aria-hidden="true"><i class="pm"></i></span></div>' +
          '<div class="xcard__drawer" id="dr-' + c.id + '"><div><div><p class="xcard__name" aria-hidden="true">' + esc(c.name) + '</p><p>' + v(c.description) + '</p>' + facts + '<div class="xcard__acts">' + acts + '</div></div></div></div>' +
        '</div></article>';
    }).join('');
    return '' +
    '<header class="phead phead--split"><h1>' + v(C.heading) + '</h1><p class="lead">' + v(C.sub) + (/[.!?]$/.test(vt(C.sub)) ? ' ' : '. ') + v(C.all_levels) + '.</p></header>' +
    '<section class="wrap" aria-label="The four classes"><div class="xrow" id="xrow">' + cards + '</div></section>' +

    '<section class="band wrap" aria-labelledby="tt-h" id="timetable">' +
      '<h2 id="tt-h" class="tt__head rv">' + esc(C.timetable_heading) + '</h2>' +
      '<div class="grid tt__grid">' +
        '<div class="tt__aside"><p class="rv" style="max-width:34ch">' + esc(C.timetable_note) + ' No classes on 23 or 30 December; back on 6 January.</p>' +
          '<p class="small rv" style="--d:1">Places left are sample numbers for this demo. One class is shown full so you can see the waitlist.</p>' +
          '<p class="rv" style="--d:1">' + (isMember() ? 'You are a member, so you can book four weeks ahead.' : 'You can book two weeks ahead. Werk Club members see four.') + '</p>' +
          '<p class="rv" style="--d:1"><a class="btn btn--ghost btn--sm" href="#/book?ahead=1"><span class="btn__label">Book ahead</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></a></p>' +
          pic('two-women-dancing', 'A Wednesday class in the mirrored studio', 'rv-pic pic--hover', { sizes: '(max-width: 767px) 60vw, 28vw' }) + '</div>' +
        '<div class="tt__list"><div class="daychips" id="days" role="group" aria-label="Choose a Wednesday"><span class="chips__ind" aria-hidden="true"></span></div><div class="slots" id="slots" aria-live="polite"></div>' +
          '<div class="slot" style="margin-top:8px;animation:none"><div><h3>Bounce &amp; Burn, Stretch &amp; Flow</h3><p class="slot__meta">Joining the timetable soon.</p></div><button type="button" class="btn btn--ghost btn--sm" data-tell="soon"><span class="btn__label">' + esc(C.tell_me_when.button) + '</span></button></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="band band--sand wrap" aria-labelledby="pr-h">' +
      '<div class="grid menu-prices"><div class="menu-prices__side"><h2 id="pr-h" class="rv">' + esc(C.prices_heading) + '</h2><p class="rv muted" style="--d:1;margin-top:16px">Knee pads are £10 extra for Dancehall &amp; Twerk, Pelvic Pilates and private sessions.</p></div>' +
      '<div class="menu-prices__list">' + C.prices.map(function (p, i) {
        var href = p.id === 'private' ? '#/classes#private' : p.id === 'dropin' ? '#/book' : '#/book?pay=' + p.id;
        return '<a class="mitem rv" style="--d:' + i + '" href="' + href + '"><div class="mitem__row"><b>' + esc(p.name) + '</b><span>' + esc(p.price_label) + '</span></div><p>' + esc(p.detail) + '</p></a>';
      }).join('') + '<a class="mitem rv" href="#/club"><div class="mitem__row"><b>The Werk Club</b><span>from £44 a month</span></div><p>Two monthly plans. See the club.</p></a></div></div>' +
    '</section>' +

    '<section class="band wrap" aria-labelledby="pv-h" id="private">' +
      '<div class="grid split2">' + pic(C.private.photo, 'Millie on the studio floor', 'split2__pic rv-pic pic--hover', { sizes: '(max-width: 767px) 72vw, 40vw' }) +
        '<div class="split2__txt"><h2 id="pv-h" class="rv">' + esc(C.private.name) + '</h2><p class="price-big rv" style="--d:1">£70</p><p class="small rv" style="--d:1">One hour. Knee pads +£10.</p>' +
        '<p class="rv" style="--d:2">' + v(C.private.description) + '</p><p class="rv" style="--d:2">' + v(C.private.also) + ' ' + esc(C.private.scheduling) + '</p>' +
        '<div class="hero__acts rv" style="--d:3">' + arrowBtn('Book a private session', '#/book?c=private', 'btn--accent') + '<a class="btn btn--ghost" href="#/private-hire"><span class="btn__label">Private hire for groups</span></a></div></div></div>' +
    '</section>' +

    '<section class="band band--sand wrap" aria-labelledby="fv-h"><div class="firstvisit"><h2 id="fv-h" class="rv">Your first visit</h2><dl>' +
      '<div class="rv"><dt>Women only</dt><dd>Classes are for women aged 18 and over. Only booked participants come in, so nobody watches.</dd></div>' +
      '<div class="rv" style="--d:1"><dt>What to wear</dt><dd>Leggings or shorts and a fitted top. Bare feet or trainers. Knee pads help in Dancehall &amp; Twerk.</dd></div>' +
      '<div class="rv" style="--d:2"><dt>No filming</dt><dd>Phones off. Nobody films without permission, and your face is never shown unless you say yes.</dd></div>' +
      '<div class="rv" style="--d:3"><dt>Questions first?</dt><dd>Email <a class="tlink is-on" href="mailto:' + W.meta.email + '">' + W.meta.email + '</a>. Millie replies herself.</dd></div>' +
    '</dl></div></section>' +

    faqBlock(W.faq.items, W.faq.heading, W.faq.sub);
  };
  function renderDays(rootEl) {
    var days = $('#days', rootEl), slotsEl = $('#slots', rootEl); if (!days) return;
    var dates = openDates();
    days.insertAdjacentHTML('beforeend', dates.map(function (d, i) { var x = D(d); return '<button type="button" class="chip' + (earlyDate(d) ? ' chip--early' : '') + '" data-date="' + d + '" aria-pressed="' + (i === 0) + '"><b>' + x.getDate() + '</b><small>' + MONTHS[x.getMonth()] + (earlyDate(d) ? ' &middot; early' : '') + '</small></button>'; }).join(''));
    function pick(d) {
      $$('.chip', days).forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.date === d); });
      var on = $('.chip[data-date="' + d + '"]', days), ind = $('.chips__ind', days);
      ind.style.width = on.offsetWidth + 'px'; ind.style.transform = 'translate(' + on.offsetLeft + 'px,' + on.offsetTop + 'px)';
      slotsEl.innerHTML = slots().filter(function (s) { return s.date === d; }).map(function (s) {
        var l = left(s.id, s.date);
        return '<div class="slot"><h3>' + esc(s.name) + '</h3><p class="slot__meta">' + fmtDate(s.date, true) + ', ' + time12(s.time) + ' &middot; ' + s.len + ' min &middot; ' + placesLabel(s.id, s.date) + (earlyDate(s.date) ? ' &middot; ' + EARLY : '') + '</p>' +
          (l === 0 ? '<button type="button" class="btn btn--ghost btn--sm" data-wait="' + s.id + '|' + s.date + '"><span class="btn__label">Join waitlist</span></button>' : arrowBtn('Book', '#/book?c=' + s.id + '&d=' + s.date, 'btn--accent btn--sm')) + '</div>';
      }).join('');
    }
    days.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) pick(b.dataset.date); });
    requestAnimationFrame(function () { pick(dates[0]); });
  }

  /* ----- Book flow ----- */
  var B = null;
  function newBooking(q) {
    var b = { step: 0, item: null, kind: null, date: null, pay: null, name: '', email: '', mobile: '', ec_name: '', ec_phone: '', injury: '', injury_detail: '', pregnant: '', confirms: false, photo: '', marketing: '', terms: false, knee: false };
    if (q.c === 'private') { b.item = 'private'; b.kind = 'private'; b.step = 1; }
    else if (q.c && cls(q.c)) { b.item = q.c; b.kind = 'class'; b.step = 1; if (q.d) { b.date = q.d; b.step = 2; } }
    if (q.e && evt(q.e)) { b.item = q.e; b.kind = 'event'; b.date = evt(q.e).date; b.step = 2; }
    if (q.pay) b.pay = q.pay;
    if (q.name) b.name = q.name;
    if (q.ahead) { b.ahead = true; b.kind = 'class'; b.step = 1; b.picks = []; b.name = 'Demo member'; b.email = 'demo.member@example.com'; b.mobile = '07700 900123'; }
    return b;
  }
  var STEPS = ['Choose', 'Date', 'Pay', 'Your details', 'Wellness check', 'Photos', 'Confirm'];
  function itemName(b) { if (b.kind === 'private') return 'Private 1:1'; var c = cls(b.item) || evt(b.item); return c ? (c.short_name || c.name) : ''; }
  function itemTime(b) { if (b.kind === 'event') { var e = evt(b.item); return time12(e.start) + ' to ' + time12(e.end); } if (b.kind === 'class') return time12(cls(b.item).timetable.time); return b.time ? time12(b.time) : ''; }
  function itemPrice(b) {
    if (b.kind === 'event') { var e = evt(b.item); return e.price; }
    if (b.kind === 'private') return PRICE.private;
    var pr = { single: 13, intro: 29, pass5: 58, pass10: 105, wallet: 0, four: 0, club: 0, member: 0 }[b.pay]; return pr != null ? pr : 13;
  }
  function payLabel(id) { return { member: 'Included in your Werk Club membership', single: 'Single class, £13', intro: 'Intro pass, 3 classes for £29', pass5: '5 class pass, £58', pass10: '10 class pass, £105', wallet: 'Class pass credit', four: 'Werk Club Four membership', club: 'The Werk Club membership', card: 'Pay on the night is not offered', event: 'Event ticket', private: 'Private session, £70' }[id] || ''; }
  views.book = function (q) {
    B = newBooking(q);
    return '<div class="app"><div class="app__top"><div><h1>Book your place</h1><p style="margin:12px 0 0;max-width:46ch">Wednesday classes, Twerkmas, Love to Wine and private sessions at Fearless Fit Hub, Fenny Stratford.</p></div><a class="tlink is-on" href="#/me">My bookings</a></div>' +
      '<div class="progress" aria-hidden="true"><i id="prog"></i></div><div class="steps" id="steps"></div>' +
      '<div class="booking"><div class="stage" id="stage"></div><aside class="summary" id="summary" aria-label="Your booking so far"></aside></div></div>';
  };
  function bookRender(dir) {
    var st = $('#stage'); if (!st) return;
    var b = B, html = '';
    var steps = b.kind === 'event' || b.kind === 'private' ? STEPS.filter(function (s) { return b.kind === 'private' || s !== 'Date'; }) : STEPS;
    if (b.step < 7) {
      if (b.ahead) { var AS = [[1, 'Pick Wednesdays'], [2, 'Credits or plan'], [6, 'Confirm']]; $('#steps').innerHTML = AS.map(function (x) { return '<span class="' + (x[0] === b.step ? 'is-on' : '') + '">' + x[1] + '</span>'; }).join(''); $('#prog').style.transform = 'scaleX(' + ({ 1: 1, 2: 2, 6: 3 }[b.step] / 3) + ')'; }
      else { $('#steps').innerHTML = STEPS.map(function (s, i) { return '<span class="' + (i === b.step ? 'is-on' : '') + '">' + s + '</span>'; }).join('');
      $('#prog').style.transform = 'scaleX(' + ((b.step + 1) / 7) + ')'; }
    }
    if (b.ahead && (b.step === 1 || b.step === 2 || b.step === 6 || b.step === 7)) html = aheadHTML(b);
    else switch (b.step) {
      case 0:
        html = '<h2>What are you booking?</h2><p><a class="tlink is-on" href="#/book?ahead=1">Book several Wednesdays at once</a></p>' +
          CLASSES.map(function (c) { var live = c.status === 'live'; return '<label class="opt"' + (live ? '' : ' style="opacity:.55"') + '><input type="radio" name="item" value="class:' + c.id + '"' + (b.item === c.id ? ' checked' : '') + (live ? '' : ' disabled') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(c.name) + '</b><small>' + (live ? 'Wednesdays ' + esc(c.timetable.time_label) + ', ' + esc(c.length) : 'Joining the timetable soon') + '</small></span><span class="opt__price">' + (live ? '£13' : '') + '</span></label>'; }).join('') +
          EVENTS.map(function (e) { return '<label class="opt"><input type="radio" name="item" value="event:' + e.id + '"' + (b.item === e.id ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(e.short_name) + '</b><small>' + fmtDate(e.date, true) + ', ' + esc(e.time_label) + ' &middot; ' + placesLabel(e.id, e.date) + '</small></span><span class="opt__price">' + esc(e.price_label) + '</span></label>'; }).join('') +
          '<label class="opt"><input type="radio" name="item" value="private:private"' + (b.kind === 'private' ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>Private 1:1 with Millie</b><small>One hour, times agreed with Millie</small></span><span class="opt__price">£70</span></label>' +
          '<p class="err" id="err"></p><div class="step__nav">' + arrowBtn('Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 1:
        if (b.kind === 'private') {
          html = '<h2>Pick a day for your private session</h2><p class="muted">Choose a day that suits you. Millie confirms the exact time by email.</p>' +
            ['2026-12-05', '2026-12-07', '2026-12-12', '2026-12-14', '2026-12-19'].map(function (d) { return '<label class="opt"><input type="radio" name="date" value="' + d + '"' + (b.date === d ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + fmtDate(d, true) + '</b><small>Morning or afternoon, to agree</small></span></label>'; }).join('');
        } else {
          var c = cls(b.item);
          html = '<h2>Which Wednesday?</h2><p class="muted">' + esc(c.name) + ', ' + esc(c.timetable.time_label) + '. No classes on 23 or 30 December.</p>' +
            c.dates.filter(function (d) { return openDates().indexOf(d) >= 0; }).map(function (d) { var l = left(c.id, d); return '<label class="opt"' + (l === 0 ? ' style="opacity:.7"' : '') + '><input type="radio" name="date" value="' + d + '"' + (b.date === d ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + fmtDate(d, true) + '</b><small>' + (l === 0 ? 'Full. Choosing this joins the waitlist.' : placesLabel(c.id, d) + (l <= 5 ? '' : ', ' + l + ' of ' + c.capacity)) + (earlyDate(d) ? ' &middot; ' + EARLY : '') + '</small></span></label>'; }).join('') + '<p class="small">' + (isMember() ? 'Members can book four weeks ahead.' : 'Booking opens two weeks ahead. Werk Club members can book four weeks ahead.') + '</p>';
        }
        html += '<p class="err" id="err"></p><div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + arrowBtn('Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 2:
        var isWait = b.kind === 'class' && left(b.item, b.date) === 0;
        if (isWait) {
          html = '<h2>Join the waitlist</h2><p>This class is full. Join the waitlist and you get a message the moment a place opens. You only pay if you get in.</p>';
          b.pay = 'waitlist';
        } else if (b.kind === 'event' || b.kind === 'private') {
          var amt = itemPrice(b);
          html = '<h2>How would you like to pay?</h2>' +
            '<label class="opt"><input type="radio" name="pay" value="' + (b.kind === 'event' ? 'event' : 'private') + '" checked><span class="opt__dot"></span><span class="opt__body"><b>' + (b.kind === 'event' ? 'Event ticket' : 'Private session') + '</b><small>' + (b.kind === 'event' ? 'Werk Club members get 10% off; Werk Club Four members get 5%.' : 'Knee pads can be added below.') + '</small></span><span class="opt__price">£' + amt + '</span></label>';
          b.pay = b.kind;
        } else {
          html = '<h2>How would you like to pay?</h2>' +
            (isMember() ? [['member', 'My Werk Club membership', 'Included in your membership', '£0'], ['single', 'Single class', 'This class only', '£13']] :
            [['single', 'Single class', 'This class only', '£13'], ['intro', 'Intro pass', '3 classes for new clients, use within 14 days', '£29'], ['pass5', '5 class pass', '£11.60 a class, use within 6 weeks', '£58'], ['pass10', '10 class pass', '£10.50 a class, use within 12 weeks', '£105'], ['wallet', 'Use my class pass', 'You have ' + creditsLeft() + ' of 5 credits left', '1 credit']]).map(function (o) {
              return '<label class="opt"><input type="radio" name="pay" value="' + o[0] + '"' + (b.pay === o[0] ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + o[1] + '</b><small>' + o[2] + '</small></span><span class="opt__price">' + o[3] + '</span></label>';
            }).join('');
        }
        if (b.kind !== 'event' && !isWait) html += '<label class="opt"><input type="checkbox" name="knee"' + (b.knee ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>Add knee pads</b><small>Yours to keep</small></span><span class="opt__price">+£10</span></label>';
        if (!isWait) html += '<p class="demo-note">' + esc(W.book.demo_note) + '</p><button type="button" class="paybtn" data-next aria-label="Pay with Apple Pay or Google Pay, demo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/></svg>Pay &middot; G Pay</button><p class="or">or continue and pay by card at the end</p>';
        html += '<p class="err" id="err"></p><div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + arrowBtn(isWait ? 'Continue' : 'Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 3:
        html = '<h2>Your details</h2><button type="button" class="btn btn--ghost btn--sm" id="useDemo" style="margin-bottom:20px"><span class="btn__label">Use Demo member\'s saved details</span></button>' +
          '<label class="f rv"><span>' + esc(W.book.details_fields.name) + '</span><input type="text" name="name" autocomplete="name" value="' + esc(b.name) + '" required></label>' +
          '<label class="f rv"><span>' + esc(W.book.details_fields.email) + '</span><input type="email" name="email" autocomplete="email" value="' + esc(b.email) + '" required></label>' +
          '<label class="f rv"><span>Mobile number</span><input type="tel" name="mobile" autocomplete="tel" value="' + esc(b.mobile) + '" required aria-describedby="mob-h"><small class="f-hint" id="mob-h">So Millie can reach you about this booking.</small></label>' +
          '<p class="err" id="err"></p><div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + arrowBtn('Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 4:
        var Wl = W.book.wellness;
        html = '<h2>' + esc(Wl.title) + '</h2><p>' + v(Wl.intro) + '</p>' +
          '<label class="f rv"><span>Emergency contact name</span><input type="text" name="ec_name" value="' + esc(b.ec_name) + '"></label>' +
          '<label class="f rv"><span>Emergency contact phone number</span><input type="tel" name="ec_phone" value="' + esc(b.ec_phone) + '"></label>' +
          yesno('injury', Wl.questions[2].label, b.injury) +
          '<label class="f" id="injDet"' + (b.injury === 'yes' ? '' : ' hidden') + '><span>If yes, please share details</span><textarea name="injury_detail">' + esc(b.injury_detail) + '</textarea></label>' +
          yesno('pregnant', Wl.questions[4].label, b.pregnant) +
          '<details class="qa" style="margin:8px 0 12px"><summary>' + esc(Wl.confirm_heading) + '<span class="chev" aria-hidden="true"></span></summary><div class="qa__a"><ul style="margin:0;padding-left:1.1em">' + Wl.confirmations.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></details>' +
          '<label class="opt"><input type="checkbox" name="confirms"' + (b.confirms ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>I confirm all of the above</b></span></label>' +
          '<p class="err" id="err"></p><div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + arrowBtn('Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 5:
        var Cn = W.book.consent;
        html = '<h2>' + esc(Cn.title) + '</h2><p>' + v(Cn.lead) + ' ' + esc(Cn.optional) + '</p>' +
          '<p style="font-weight:500;margin-bottom:8px">Photos and video</p>' + Cn.photo_options.map(function (o) { return '<label class="opt"><input type="radio" name="photo" value="' + o.id + '"' + (b.photo === o.id ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(o.label) + '</b></span></label>'; }).join('') +
          '<p style="font-weight:500;margin:20px 0 8px">News by email</p>' + Cn.marketing_options.map(function (o) { return '<label class="opt"><input type="radio" name="marketing" value="' + o.id + '"' + (b.marketing === o.id ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(o.label) + '</b></span></label>'; }).join('') +
          '<label class="opt" style="margin-top:20px"><input type="checkbox" name="terms"' + (b.terms ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(W.book.terms_check) + '</b><small>' + v(W.book.cancellation_policy) + '</small></span></label>' +
          '<p class="err" id="err"></p><div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + arrowBtn('Next', null, 'btn--accent', ' data-next') + '</div>';
        break;
      case 6:
        var tot = (b.pay === 'waitlist' ? 0 : itemPrice(b)) + (b.knee ? 10 : 0);
        html = '<h2>Check and confirm</h2><dl class="summary" style="position:static;display:grid;grid-template-columns:auto 1fr;gap:10px 16px;margin:0 0 16px">' +
          row('What', itemName(b)) + row('When', fmtDate(b.date, true) + (itemTime(b) ? ', ' + itemTime(b) : '')) + row('Where', 'Fearless Fit Hub, 31 Wharfside, MK2 2AZ') + row('Name', b.name) + row('Paying with', b.pay === 'waitlist' ? 'Nothing yet: waitlist' : payLabel(b.pay)) + (b.knee ? row('Knee pads', '£10') : '') + row('Total', '£' + tot) + '</dl>' +
          (b.pay === 'waitlist' ? '' : '<p class="demo-note">' + esc(W.book.demo_note) + '</p>') +
          '<p class="small">' + esc(W.book.confirmation.cancel) + '</p>' +
          '<div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button><button type="button" class="btn btn--accent" id="confirmBtn"><span class="btn__label">' + (b.pay === 'waitlist' ? 'Join the waitlist' : 'Confirm booking') + '</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></div>';
        break;
      case 7:
        html = ticketHTML(b.saved);
        break;
    }
    st.innerHTML = '<div class="step' + (dir < 0 ? ' is-back' : '') + '">' + html + '</div>';
    $$('.rv, .rv-pic', st).forEach(function (x) { x.classList.add('is-in'); });
    if (b.step === 7) { $('#steps').innerHTML = ''; $('#prog').style.transform = 'scaleX(1)'; $('#summary').hidden = true; setTimeout(function () { var tw = $('.ticket-wrap'); if (tw) tw.classList.add('is-party'); }, 50); return; }
    $('#summary').hidden = false;
    if (b.ahead) { var np = (b.picks || []).length; $('#summary').innerHTML = '<h3>Booking ahead</h3><dl>' + row('Classes', np ? String(np) : 'None picked yet') + row('Plan', isMember() ? 'Werk Club member' : '5 class pass, ' + creditsLeft() + ' credits left') + row('Where', 'Fearless Fit Hub') + row('Name', b.name) + '</dl>'; return; }
    $('#summary').innerHTML = '<h3>Your booking</h3><dl>' + row('What', itemName(b) || 'Not chosen yet') + row('When', b.date ? fmtDate(b.date, true) + (itemTime(b) ? ', ' + itemTime(b) : '') : 'Not chosen yet') + row('Where', 'Fearless Fit Hub') + (b.pay ? row('Paying', b.pay === 'waitlist' ? 'Waitlist' : payLabel(b.pay)) : '') + (b.name ? row('Name', b.name) : '') + '</dl>';
  }
  function row(k, val) { return '<dt>' + esc(k) + '</dt><dd>' + esc(val) + '</dd>'; }
  function yesno(name, label, val) {
    return '<fieldset style="border:0;padding:0;margin:0 0 18px"><legend style="font-size:.9375rem;margin-bottom:6px">' + esc(label) + '</legend><div class="yn">' +
      ['yes', 'no'].map(function (o) { return '<label class="opt"><input type="radio" name="' + name + '" value="' + o + '"' + (val === o ? ' checked' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + (o === 'yes' ? 'Yes' : 'No') + '</b></span></label>'; }).join('') + '</div></fieldset>';
  }
  function bookCollect() {
    var st = $('#stage'), b = B, err = '', bad = null;
    function val(n) { var el = $('[name="' + n + '"]:checked', st) || $('[name="' + n + '"]', st); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; }
    function fail(msg, name) { if (!err) { err = msg; bad = name; } }
    switch (b.step) {
      case 0: var it = $('[name="item"]:checked', st); if (!it) fail('Choose a class, an event or a private session.', 'item'); else { var p = it.value.split(':'); if (b.item !== p[1]) { b.date = null; b.pay = null; } b.kind = p[0]; b.item = p[1]; if (b.kind === 'event') b.date = evt(b.item).date; } break;
      case 1:
        if (b.ahead) { b.picks = $$('[name="pick"]:checked', st).map(function (x) { return x.value; }); if (!b.picks.length) fail('Pick at least one class.', 'pick'); else if (!isMember() && b.picks.length > creditsLeft()) fail('You have ' + creditsLeft() + ' credits left. Untick some, or buy a pass first.', 'pick'); break; }
        var d = $('[name="date"]:checked', st); if (!d) fail('Choose a date.', 'date'); else b.date = d.value; break;
      case 2: if (b.ahead) { b.pay = isMember() ? 'member' : 'wallet'; break; } var pp = $('[name="pay"]:checked', st); if (b.pay !== 'waitlist') { if (!pp) fail('Choose how to pay.', 'pay'); else b.pay = pp.value; } b.knee = !!val('knee'); break;
      case 3: b.name = val('name').trim(); b.email = val('email').trim(); b.mobile = val('mobile').trim();
        if (!b.name) fail('Add your name.', 'name');
        if (!/^\S+@\S+\.\S+$/.test(b.email)) fail('Add a working email address, like name@example.com.', 'email');
        if (b.mobile.replace(/\D/g, '').length < 10) fail('Add your mobile number, at least 10 digits.', 'mobile');
        break;
      case 4: b.ec_name = val('ec_name').trim(); b.ec_phone = val('ec_phone').trim(); b.injury = val('injury'); b.injury_detail = val('injury_detail'); b.pregnant = val('pregnant'); b.confirms = !!val('confirms');
        if (!b.ec_name) fail('Add the name of someone we can call in an emergency.', 'ec_name');
        if (b.ec_phone.replace(/\D/g, '').length < 10) fail('Add your emergency contact’s phone number.', 'ec_phone');
        if (!b.injury) fail('Answer the question about injuries or conditions.', 'injury');
        if (!b.pregnant) fail('Answer the question about pregnancy.', 'pregnant');
        if (!b.confirms) fail('Tick the box to confirm.', 'confirms');
        break;
      case 5: b.photo = val('photo'); b.marketing = val('marketing'); b.terms = !!val('terms');
        if (!b.photo) fail('Choose an answer for photos and video.', 'photo');
        if (!b.marketing) fail('Choose an answer for news by email.', 'marketing');
        if (!b.terms) fail('Tick the box to agree to the studio policies.', 'terms');
        break;
    }
    $$('[aria-invalid]', st).forEach(function (x) { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
    $$('.field-err', st).forEach(function (x) { x.parentNode.removeChild(x); });
    var e = $('#err', st); if (e) e.textContent = err ? 'Please check: ' + err : '';
    if (bad) {
      var fld = $('[name="' + bad + '"]', st), anchor = fld && (fld.closest('label.f') || fld.closest('fieldset') || fld.closest('.opt'));
      if (fld) {
        var msg = doc.createElement('p'); msg.className = 'field-err'; msg.id = 'fe-' + bad; msg.textContent = err;
        if (anchor) anchor.parentNode.insertBefore(msg, anchor.nextSibling);
        $$('[name="' + bad + '"]', st).forEach(function (x) { x.setAttribute('aria-invalid', 'true'); x.setAttribute('aria-describedby', 'fe-' + bad); });
        (anchor || fld).scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        try { fld.focus({ preventScroll: true }); } catch (x) { fld.focus(); }
      }
    }
    return !err;
  }
  function bookNext() { if (!bookCollect()) return; B.step++; if (B.step === 1 && B.kind === 'event') B.step = 2; if (B.ahead && B.step === 3) B.step = 6; bookRender(1); scrollToTop(); }
  function bookBack() { B.step--; if (B.step === 1 && B.kind === 'event') B.step = 0; if (B.ahead && B.step === 5) B.step = 2; if (B.ahead && B.step < 1) { location.hash = '#/book'; return; } if (B.step < 0) B.step = 0; bookRender(-1); scrollToTop(); }
  function scrollToTop() { var a = $('.app'); if (a && a.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }
  function bookConfirm(btn) {
    btn.classList.add('is-loading');
    setTimeout(function () {
      var b = B, code = 'WW-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      if (b.ahead) {
        b.savedList = b.picks.map(function (pk) { var p = pk.split('|'), c = cls(p[0]); var r = { id: 'WW-' + Math.random().toString(36).slice(2, 6).toUpperCase(), item: c.id, kind: 'class', name: b.name, email: b.email, mobile: b.mobile, date: p[1], time: c.timetable.time, pay: isMember() ? 'member' : 'wallet', knee: false, waitlist: false, photo: 'yes', injury: 'no', at: Date.now(), title: c.name, ahead: true }; S.bookings.push(r); return r; });
        save(); btn.classList.remove('is-loading'); btn.classList.add('is-done'); $('.btn__label', btn).textContent = 'Done';
        setTimeout(function () { b.step = 7; bookRender(1); scrollToTop(); }, 380); return;
      }
      var rec = { id: code, item: b.item, kind: b.kind, name: b.name, email: b.email, mobile: b.mobile, date: b.date, time: b.kind === 'class' ? cls(b.item).timetable.time : b.kind === 'event' ? evt(b.item).start : '10:00', pay: b.pay, knee: b.knee, waitlist: b.pay === 'waitlist', photo: b.photo, injury: b.injury, at: Date.now(), title: itemName(b) };
      S.bookings.push(rec); save();
      btn.classList.remove('is-loading'); btn.classList.add('is-done'); $('.btn__label', btn).textContent = 'Done';
      setTimeout(function () { b.saved = rec; b.step = 7; bookRender(1); scrollToTop(); }, 380);
    }, 900);
  }
  function ticketHTML(r) {
    var nexts = slots().filter(function (s) { return s.date > r.date || (s.date === r.date && s.id !== r.item); }).slice(0, 2);
    return '<div class="ticket-wrap"><div class="ticket-w">' + window.WW_W + '</div>' +
      '<h2 style="font-size:clamp(2rem,1.6rem + 1.6vw,3rem)">' + (r.waitlist ? 'You are on the waitlist' : esc(W.book.confirmation.heading)) + '</h2><p class="muted">' + (r.waitlist ? 'We will message you the moment a place opens.' : esc(W.book.confirmation.sub)) + '</p>' +
      '<div class="ticket" role="group" aria-label="Your ticket"><div class="ticket__top"><h2>' + esc(r.title) + '</h2><p style="margin:0">' + fmtDate(r.date, true) + ', ' + time12(r.time) + '</p></div><div class="ticket__perf"></div>' +
        '<div class="ticket__body"><div><span>Name</span><b>' + esc(r.name) + '</b></div><div><span>Where</span><b>Fearless Fit Hub, MK2 2AZ</b></div><div><span>Arrive</span><b>5 to 7 minutes early</b></div><div><span>Paid with</span><b>' + esc(r.waitlist ? 'Nothing yet' : payLabel(r.pay)) + '</b></div><p class="ticket__code" style="margin:0">' + r.id + '</p></div></div>' +
      '<div class="hero__acts" style="justify-content:center">' + (r.waitlist ? '' : '<button type="button" class="btn btn--accent" data-ics="' + r.id + '"><span class="btn__label">' + esc(W.book.confirmation.add_to_calendar) + '</span><span class="btn__arrow" aria-hidden="true">&darr;</span></button>') + '<a class="btn btn--ghost" href="#/me"><span class="btn__label">See it in Me</span></a></div>' +
      (nexts.length ? '<div class="next2"><h3 style="margin-bottom:8px">Book your next class</h3><ul class="sched" style="margin-top:0">' + nexts.map(function (s) { return '<li><a href="#/book?c=' + s.id + '&d=' + s.date + '"><span class="when">' + fmtDate(s.date) + ', ' + time12(s.time) + '</span><span class="what">' + esc(s.name) + '</span><span class="val">' + placesLabel(s.id, s.date) + '<span class="go" aria-hidden="true">&rarr;</span></span></a></li>'; }).join('') + '</ul></div>' : '') +
      '</div>';
  }
  function aheadHTML(b) {
    var nav = function (label, id) { return '<div class="step__nav"><button type="button" class="btn btn--ghost" data-back><span class="btn__label">Back</span></button>' + (id ? '<button type="button" class="btn btn--accent" id="' + id + '"><span class="btn__label">' + label + '</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button>' : arrowBtn(label, null, 'btn--accent', ' data-next')) + '</div>'; };
    var plan = isMember() ? 'Werk Club member' : '5 class pass, ' + creditsLeft() + ' credits left';
    if (b.step === 1) {
      return '<h2>Book ahead</h2><p>Signed in as Demo member (' + plan + '). Tick every class you want; you confirm once.</p>' +
        '<div class="ahead" id="ahead">' + openDates().map(function (d) {
          return '<fieldset class="ahead__day"><legend>' + fmtDate(d, true) + (earlyDate(d) ? ' ' + EARLY : '') + '</legend>' + slots().filter(function (s) { return s.date === d; }).map(function (s) {
            var l = left(s.id, s.date), val = s.id + '|' + s.date, on = (b.picks || []).indexOf(val) >= 0;
            return '<label class="opt' + (l === 0 ? ' is-off' : '') + '"><input type="checkbox" name="pick" value="' + val + '"' + (on ? ' checked' : '') + (l === 0 ? ' disabled' : '') + '><span class="opt__dot"></span><span class="opt__body"><b>' + esc(s.name) + '</b><small>' + time12(s.time) + ' &middot; ' + (l === 0 ? 'Full' : placesLabel(s.id, s.date)) + '</small></span></label>';
          }).join('') + '</fieldset>';
        }).join('') + '</div>' +
        '<p class="ahead__count" id="aheadCount" aria-live="polite"></p><p class="err" id="err"></p>' + nav('Next');
    }
    var picks = b.picks.map(function (pk) { var p = pk.split('|'); return { c: cls(p[0]), d: p[1] }; });
    var listHTML = '<ul class="ahead__list">' + picks.map(function (x) { return '<li><b>' + fmtDate(x.d, true) + '</b><span>' + esc(x.c.name) + ', ' + time12(x.c.timetable.time) + '</span></li>'; }).join('') + '</ul>';
    var cover = isMember() ? 'Included in your membership' : 'Uses ' + picks.length + ' of your 5 credits';
    if (b.step === 2) return '<h2>' + cover + '</h2>' + listHTML + '<p>' + (isMember() ? 'Your Werk Club plan covers every weekly class, so there is nothing to pay.' : 'You will have ' + (creditsLeft() - picks.length) + ' credits left after this.') + '</p><p class="small">Your details, wellness check and photo answers are already on file.</p>' + nav('Next');
    if (b.step === 6) return '<h2>Check and confirm</h2>' + listHTML + '<dl class="summary" style="position:static;display:grid;grid-template-columns:auto 1fr;gap:10px 16px;margin:0 0 16px">' + row('Name', b.name) + row('Paying with', cover) + row('Total', '£0') + '</dl><p class="small">' + esc(W.book.confirmation.cancel) + '</p>' + nav('Confirm ' + picks.length + (picks.length === 1 ? ' booking' : ' bookings'), 'confirmBtn');
    var L = b.savedList || [];
    return '<div class="ticket-wrap"><div class="ticket-w">' + window.WW_W + '</div><h2 style="font-size:clamp(2rem,1.6rem + 1.6vw,3rem)">You are booked in for ' + L.length + (L.length === 1 ? ' class' : ' classes') + '</h2><p class="muted">One ticket for each Wednesday. ' + esc(cover) + '.</p>' +
      '<div class="tix">' + L.map(function (r, i) { return '<div class="ticket ticket--mini" style="animation-delay:' + (i * 90) + 'ms"><div class="ticket__top"><h2>' + esc(r.title) + '</h2><p style="margin:0">' + fmtDate(r.date, true) + ', ' + time12(r.time) + '</p></div><div class="ticket__perf"></div><div class="ticket__body"><div><span>Name</span><b>' + esc(r.name) + '</b></div><div><span>Paid with</span><b>' + esc(payLabel(r.pay)) + '</b></div><p class="ticket__code" style="margin:0">' + r.id + '</p></div></div>'; }).join('') + '</div>' +
      '<div class="hero__acts" style="justify-content:center"><button type="button" class="btn btn--accent" data-ics-all="' + L.map(function (r) { return r.id; }).join(',') + '"><span class="btn__label">Add all to calendar</span><span class="btn__arrow" aria-hidden="true">&darr;</span></button><a class="btn btn--ghost" href="#/me"><span class="btn__label">See them in Me</span></a></div></div>';
  }
  function vevent(r) {
    var dt = r.date.replace(/-/g, '') + 'T' + r.time.replace(':', '') + '00';
    var end = new Date(D(r.date).getTime()); var hh = +r.time.slice(0, 2), mm = +r.time.slice(3); end.setHours(hh, mm + (r.kind === 'event' ? (r.item === 'twerkmas' ? 180 : 120) : r.kind === 'private' ? 60 : 45));
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var de = r.date.replace(/-/g, '') + 'T' + pad(end.getHours()) + pad(end.getMinutes()) + '00';
    return ['BEGIN:VEVENT', 'UID:' + r.id + '@werkwell', 'DTSTART;TZID=Europe/London:' + dt, 'DTEND;TZID=Europe/London:' + de, 'SUMMARY:' + r.title + ' at Werk Well', 'LOCATION:Fearless Fit Hub\\, 31 Wharfside\\, Fenny Stratford\\, Milton Keynes MK2 2AZ', 'DESCRIPTION:Please arrive 5 to 7 minutes early. Booking ' + r.id, 'END:VEVENT'].join('\r\n');
  }
  function icsMany(list, name) {
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Werk Well Studio//Booking//EN'].concat(list.map(vevent)).concat(['END:VCALENDAR']).join('\r\n');
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    toast(list.length > 1 ? 'One calendar file with ' + list.length + ' classes saved' : 'Calendar file saved');
  }
  function ics(r) { icsMany([r], 'werk-well-' + r.id + '.ics'); }

  /* ----- The Werk Club ----- */
  views.club = function () {
    var Cl = W.club, full = Cl.tiers[0], four = Cl.tiers[1];
    function li(t) { return [t.classes, 'Booking opens ' + t.booking_opens, t.events_discount, t.id === 'club' ? 'One guest place a month: your friend books free with your code' : null, t.extras, t.minimum].filter(Boolean).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); }
    return '' +
      '<header class="phead phead--split"><h1>' + esc(Cl.heading) + '</h1><p class="lead">A list you ask to join. ' + esc(Cl.intro) + '</p></header>' +
      '<section class="wrap" aria-label="Membership plans"><div class="tiers">' +
        '<article class="tier tier--full rv"><h2>' + esc(full.name) + '</h2><p class="tier__price">£79</p><p class="small">a month. Founding places are limited to 30.</p><ul>' + li(full) + '</ul>' +
          '<div class="tier__end">' + '<button type="button" class="btn btn--accent btn--full" data-request><span class="btn__label">Request your place</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button><p class="small" style="margin:12px 0 0">Millie reads every request and replies within a few days.</p></div></article>' +
        '<article class="tier tier--four rv" style="--d:1">' + pic('social-high-five', 'Two members high-fiving in class', 'tier__pic', { sizes: '(max-width: 767px) 100vw, 36vw', pos: 'center 25%' }) + '<h2>' + esc(four.name) + '</h2><p class="tier__price">£44</p><p class="small">a month, so £11 a class.</p><ul>' + li(four) + '</ul>' +
          '<div class="tier__end"><button type="button" class="btn btn--full" data-buy="four"><span class="btn__label">Join now</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></div></article>' +
      '</div></section>' +
      '<section class="band wrap" aria-labelledby="fd-h"><div class="grid founding">' + pic(Cl.photo, 'Werk Well women laughing together', 'founding__pic rv-pic pic--hover', { sizes: '(max-width: 767px) 100vw, 56vw' }) +
        '<div class="founding__txt"><h2 id="fd-h" class="rv">' + esc(Cl.founding.heading) + '</h2><p class="rv" style="--d:1">' + esc(Cl.founding.text) + '</p><p class="rv" style="--d:2">' + v(Cl.poster_line) + '</p><p class="rv" style="--d:3;font-weight:500">' + v(Cl.poster_tagline) + '</p></div></div></section>' +
      '<section class="band band--sand wrap" id="passes" aria-labelledby="ps-h"><div class="grid menu-prices"><div class="menu-prices__side"><h2 id="ps-h" class="rv">' + esc(Cl.passes_heading) + '</h2><p class="rv muted" style="--d:1;margin-top:16px">' + esc(Cl.passes_text) + '</p>' + pic('dancer-arm-pose', 'A dancer mid-move on the studio floor', 'menu-prices__pic rv-pic pic--hover', { sizes: '(max-width: 767px) 60vw, 22vw' }) + '</div>' +
        '<div class="menu-prices__list">' + W.classes.prices.filter(function (p) { return /intro|pass/.test(p.id); }).map(function (p, i) {
          return '<div class="mitem rv" style="--d:' + i + '"><div class="mitem__row"><b>' + esc(p.name) + '</b><span>' + esc(p.price_label) + '</span></div><p>' + esc(p.detail) + '</p><button type="button" class="btn btn--sm" style="margin-top:12px" data-buy="' + p.id + '"><span class="btn__label">Buy now</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></div>';
        }).join('') + '</div></div></section>' +
      '<section class="band wrap" aria-labelledby="cur-h"><div class="grid split2">' + pic('social-brand-graphic', 'A dance community. Built by women. For women.', 'split2__pic rv-pic', { sizes: '(max-width: 767px) 72vw, 36vw' }) +
        '<div class="split2__txt"><h2 id="cur-h" class="rv">Bring a friend</h2><p class="rv" style="--d:1">Members get one guest place a month. Your friend still books and fills in the wellness check, because only booked participants come in. She books free with your code.</p><p class="rv" style="--d:2">Not a member? Share your link and your friend’s first class is £5.</p>' + arrowBtn('See your friend card', '#/me', 'btn--ghost rv') + '</div></div></section>' +
      globeHTML();
  };
  var GALLERY = [
    ['two-women-dancing', 'Two women dancing close in a Wednesday class'], ['millie-portrait', 'Millie sitting cross-legged on the studio floor'], ['dancer-balance', 'A dancer balancing on one leg'],
    ['group-laughing', 'A group of women laughing with their arms up'], ['social-high-five', 'Two women high-fiving in class'], ['dancer-reach', 'A dancer reaching high, back arched'],
    ['twerkmas-poster', 'The Twerkmas poster'], ['millie-squat', 'Millie crouched low in her orange tee'], ['social-brand-graphic', 'A dance community. Built by women. For women.'],
    ['dancer-forward-bend', 'A dancer bent forward, hands on knees'], ['love-to-wine-still', 'Love to Wine workshop'], ['dancer-arm-pose', 'A dancer mid-move, one arm raised'],
    ['social-twerk-sweat-repeat', 'Twerk, sweat, repeat']
  ];
  function globeHTML() {
    return '<section class="globe-band" aria-labelledby="gl-h"><div class="wrap globe-head"><h2 id="gl-h" class="rv">Inside the club</h2><p class="rv" style="--d:1">Wednesday nights, parties and the women who make them. Drag to spin, tap a photo to open it.</p>' +
      '<button type="button" class="btn btn--paper btn--sm rv" style="--d:2" data-gallery="0"><span class="btn__label">View all 13 photos</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></div>' +
      '<div class="globe" id="globe"><div class="globe-row">' + GALLERY.map(function (g, i) { return '<button type="button" class="globe-row__item" data-gallery="' + i + '">' + img(g[0], g[1], { sizes: '200px', w: (DIMS[g[0]] || [1067, 1600])[0], h: (DIMS[g[0]] || [1067, 1600])[1] }) + '</button>'; }).join('') + '</div></div></section>';
  }
  var globeStop = null;
  function setupGlobe() {
    var host = $('#globe'); if (!host) return;
    var probe = doc.createElement('div'); probe.style.transformStyle = 'preserve-3d';
    if (probe.style.transformStyle !== 'preserve-3d') return;
    var phone = innerWidth < 768, R = phone ? Math.min(205, innerWidth * 0.52) : 320;
    var LATS = phone ? [-50, -25, 0, 25, 50] : [-54, -27, 0, 27, 54], COUNTS = [9, 14, 16, 14, 9];
    var tiles = '', k = 0;
    LATS.forEach(function (lat, r) {
      var n = COUNTS[r], circ = 2 * Math.PI * R * Math.cos(lat * Math.PI / 180), w = Math.round(circ / n * 0.84), h = Math.round(Math.min(w * 1.25, R * 0.42));
      for (var i = 0; i < n; i++) {
        var lon = i * 360 / n + (r % 2 ? 180 / n : 0), g = GALLERY[k % GALLERY.length], gi = k % GALLERY.length; k++;
        tiles += '<div class="gtile" data-gallery="' + gi + '" style="width:' + w + 'px;height:' + h + 'px;margin:' + (-h / 2) + 'px 0 0 ' + (-w / 2) + 'px;transform:rotateY(' + lon + 'deg) rotateX(' + (-lat) + 'deg) translateZ(' + R + 'px)"><img src="img/' + g[0] + '-800.webp" alt="" loading="lazy" decoding="async" draggable="false"></div>';
      }
    });
    host.innerHTML = '<div class="globe__stage"><div class="globe__ball" aria-hidden="true">' + tiles + '</div></div>';
    host.classList.add('is-3d');
    var ball = $('.globe__ball', host), stage = $('.globe__stage', host);
    var ang = 20, vel = 0, tilt = -10, auto = !reduced, lastTouch = 0, raf = 0, visible = true, t0 = performance.now();
    function paint() { ball.style.transform = 'translateZ(' + (-R) + 'px) rotateX(' + tilt + 'deg) rotateY(' + ang + 'deg)'; }
    function loop(now) {
      var dt = Math.min(50, now - t0); t0 = now;
      if (!drag) {
        if (Math.abs(vel) > 0.01) { ang += vel; vel *= 0.94; }
        else if (auto && now - lastTouch > 3000) ang += dt * 0.008;
      }
      paint();
      raf = visible && !doc.hidden ? requestAnimationFrame(loop) : 0;
    }
    function kick() { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(loop); } }
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 });
    io.observe(stage);
    var drag = false, decided = false, sx = 0, sy = 0, lx = 0, lt = 0, moved = 0, pid = null;
    stage.addEventListener('pointerdown', function (e) { sx = lx = e.clientX; sy = e.clientY; lt = performance.now(); decided = false; drag = false; moved = 0; pid = e.pointerId; vel = 0; lastTouch = performance.now(); });
    stage.addEventListener('pointermove', function (e) {
      if (pid !== e.pointerId) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; moved = Math.max(moved, Math.abs(dx), Math.abs(dy));
      if (!decided && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) { decided = true; drag = Math.abs(dx) > Math.abs(dy); if (drag) { try { stage.setPointerCapture(e.pointerId); } catch (x) {} stage.classList.add('is-drag'); } }
      if (drag) { var now = performance.now(), step = (e.clientX - lx) * 0.28; ang += step; vel = step / Math.max(1, (now - lt) / 16); lt = now; lx = e.clientX; lastTouch = now; kick(); }
    });
    function end(e) {
      if (pid !== e.pointerId) return;
      if (!drag && moved < 6 && e.type === 'pointerup') { var t = doc.elementFromPoint(e.clientX, e.clientY), tile = t && t.closest('.gtile'); if (tile) openLightbox(+tile.dataset.gallery); }
      drag = false; pid = null; stage.classList.remove('is-drag'); lastTouch = performance.now(); kick();
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    paint(); kick();
    globeStop = function () { cancelAnimationFrame(raf); raf = 0; io.disconnect(); };
  }
  function openLightbox(i) {
    var n = GALLERY.length, el = doc.createElement('div'); el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Photos');
    el.innerHTML = '<figure class="lightbox__fig"><img alt=""><figcaption class="vh"></figcaption></figure><p class="lightbox__count" aria-live="polite"></p>' +
      '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous photo">&larr;</button><button type="button" class="lightbox__btn lightbox__next" aria-label="Next photo">&rarr;</button><button type="button" class="lightbox__btn lightbox__x" aria-label="Close">&times;</button>';
    doc.body.appendChild(el); var last = doc.activeElement, im = $('img', el);
    function show(j, dir) { i = (j + n) % n; var g = GALLERY[i]; im.classList.remove('is-in'); im.style.setProperty('--from', (dir || 0) * 30 + 'px'); im.src = 'img/' + g[0] + '-1600.webp'; im.alt = g[1]; $('figcaption', el).textContent = g[1]; $('.lightbox__count', el).textContent = (i + 1) + ' of ' + n; requestAnimationFrame(function () { requestAnimationFrame(function () { im.classList.add('is-in'); }); }); }
    function close() { el.classList.add('is-closing'); doc.removeEventListener('keydown', key); setTimeout(function () { el.remove(); if (last && last.focus) last.focus(); }, reduced ? 0 : 250); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(i + 1, 1); if (e.key === 'ArrowLeft') show(i - 1, -1); }
    doc.addEventListener('keydown', key);
    $('.lightbox__x', el).addEventListener('click', close);
    $('.lightbox__next', el).addEventListener('click', function () { show(i + 1, 1); });
    $('.lightbox__prev', el).addEventListener('click', function () { show(i - 1, -1); });
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    var sx = null; el.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    el.addEventListener('pointerup', function (e) { if (sx == null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
    show(i, 0); $('.lightbox__x', el).focus();
  }
  function sheet(html, onReady) {
    var el = doc.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="sheet__scrim" data-close></div><div class="sheet__panel"><button type="button" class="sheet__x" data-close aria-label="Close">&times;</button>' + html + '</div>';
    doc.body.appendChild(el);
    $$('.rv, .rv-pic', el).forEach(function (x) { x.classList.add('is-in'); });
    var last = doc.activeElement;
    function close() { el.classList.add('is-closing'); setTimeout(function () { el.remove(); if (last && last.focus) last.focus(); }, reduced ? 0 : 300); doc.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    doc.addEventListener('keydown', onKey);
    el.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    var f = $('input, button:not(.sheet__x)', el); if (f) f.focus();
    if (onReady) onReady(el, close);
    return close;
  }
  function requestSheet() {
    sheet('<div id="reqWrap"><h2>Request your place in The Werk Club</h2><p class="muted">Founding places are limited to 30. Tell Millie a little about you and she will reply by email.</p><form id="reqForm" novalidate>' +
      '<label class="f rv"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label><label class="f"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>' +
      '<label class="f rv"><span>Have you been to a class yet?</span><select name="been"><option>Yes, I come on Wednesdays</option><option>Once or twice</option><option>Not yet</option></select></label>' +
      '<label class="f rv"><span>Anything Millie should know? (optional)</span><textarea name="note"></textarea></label><p class="err" id="reqErr"></p>' +
      '<button type="submit" class="btn btn--accent btn--full"><span class="btn__label">Send my request</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button><p class="small" style="margin-top:10px">' + esc(W.club.join.demo_note) + '</p></form></div>', function (el) {
      $('#reqForm', el).addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target, btn = $('button[type=submit]', f);
        if (!f.name.value.trim() || !/^\S+@\S+\.\S+$/.test(f.email.value)) { $('#reqErr', el).textContent = 'Add your name and a working email.'; return; }
        btn.classList.add('is-loading');
        setTimeout(function () {
          S.requests.push({ name: f.name.value.trim(), email: f.email.value.trim(), been: f.been.value, at: Date.now() }); save();
          $('#reqWrap', el).innerHTML = '<div class="done-screen" style="padding:8px 0;background:none"><div class="ticket-w" style="width:72px">' + window.WW_W + '</div><h2>You’re on the list</h2><p>Thank you, ' + esc(f.name.value.trim().split(' ')[0]) + '. Millie will email you about your founding place. Until then, Wednesday classes are open to book as usual.</p><a class="btn btn--accent" href="#/book" data-close><span class="btn__label">Book a class meanwhile</span></a></div>';
        }, 800);
      });
    });
  }
  function buySheet(id) {
    var names = { four: ['Werk Club Four', '£44 a month', 'Four classes a month. 3-month minimum, then 30 days’ notice.'], intro: ['Intro pass', '£29', '3 classes for new clients. Use within 14 days.'], pass5: ['5 class pass', '£58', 'Use within 6 weeks.'], pass10: ['10 class pass', '£105', 'Use within 12 weeks.'] }[id];
    sheet('<div id="buyWrap"><h2>' + names[0] + '</h2><p class="price-big">' + names[1] + '</p><p>' + names[2] + '</p><p class="demo-note">' + esc(W.club.join.demo_note) + '</p>' +
      '<button type="button" class="paybtn" id="buyNow"><span>Pay &middot; G Pay</span></button><p class="or">or</p><button type="button" class="btn btn--accent btn--full" id="buyCard"><span class="btn__label">Pay by card</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></div>', function (el) {
      function done(btn) {
        btn.classList.add('is-loading');
        setTimeout(function () { S.purchases.push({ id: id, at: Date.now() }); save(); $('#buyWrap', el).innerHTML = '<div class="done-screen" style="padding:8px 0;background:none"><h2>All yours</h2><p>' + names[0] + ' is in your account. You can book straight away.</p><a class="btn btn--accent" href="#/book" data-close><span class="btn__label">Book a class</span></a> <a class="btn btn--ghost" href="#/me" data-close><span class="btn__label">See Me</span></a></div>'; }, 900);
      }
      $('#buyNow', el).addEventListener('click', function () { done(this); });
      $('#buyCard', el).addEventListener('click', function () { done(this); });
    });
  }
  function tellSheet(id) {
    sheet('<div id="tellWrap"><h2>Tell me when it starts</h2><p>' + esc(W.classes.tell_me_when.text) + '</p><form id="tellForm" novalidate><label class="f"><span>Email</span><input type="email" name="email" required autocomplete="email"></label><p class="err" id="tellErr"></p>' +
      '<button type="submit" class="btn btn--accent btn--full"><span class="btn__label">Tell me</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></form></div>', function (el) {
      $('#tellForm', el).addEventListener('submit', function (e) {
        e.preventDefault(); var btn = $('button[type=submit]', this);
        if (!/^\S+@\S+\.\S+$/.test(this.email.value)) { $('#tellErr', el).textContent = 'Add a working email.'; return; }
        btn.classList.add('is-loading'); setTimeout(function () { $('#tellWrap', el).innerHTML = '<div class="done-screen" style="padding:8px 0;background:none"><h2>Done</h2><p>You will get one email the day it joins the timetable.</p></div>'; }, 700);
      });
    });
  }

  /* ----- Events ----- */
  views.events = function () {
    return '<header class="phead phead--split"><h1>' + esc(W.events.heading) + '</h1><p class="lead">' + esc(W.events.sub) + '</p></header>' +
      '<div class="wrap band" style="padding-top:0">' + EVENTS.map(function (e, i) {
        return '<section class="grid event' + (i % 2 ? ' event--alt' : '') + '" aria-labelledby="e-' + e.id + '">' +
          pic(e.photo, e.name, 'event__pic rv-pic pic--hover', { sizes: '(max-width: 767px) 100vw, 50vw' }) +
          '<div class="event__txt"><h2 id="e-' + e.id + '" class="rv">' + esc(e.short_name) + '</h2><p class="event__when rv" style="--d:1">' + fmtDate(e.date, true) + (e.date.indexOf('2027') === 0 ? '' : ', 2026') + '<br>' + (e.end ? time12(e.start) + ' to ' + time12(e.end) : esc(e.time_label)) + ', ' + esc(e.price_label) + '</p>' +
          (e.highlights ? '<ul class="hl rv" style="--d:2">' + e.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
          '<div class="rv" style="--d:2">' + paras(e.description) + '</div><p class="small rv">' + esc(W.events.member_discount_note) + ' ' + placesLabel(e.id, e.date) + '.</p>' +
          '<div class="rv">' + arrowBtn('Book ' + esc(e.short_name), '#/book?e=' + e.id, 'btn--accent') + '</div></div></section>';
      }).join('') + '</div>' +
      '<section aria-labelledby="evx-h"><div class="strip">' + pic('group-laughing', 'The Werk Well community together', '', { sizes: '(max-width: 767px) 100vw, 34vw' }) + pic('social-twerk-sweat-repeat', 'Twerk, sweat, repeat', '', { sizes: '34vw' }) + pic('two-women-dancing', 'Two women dancing', '', { sizes: '34vw' }) + '</div>' +
      '<div class="field"><div class="field__txt"><h2 id="evx-h">Hear about the next one first</h2><p>Parties and workshops are announced to the newsletter before anywhere else. Werk Club members get money off.</p>' + newsletterForm('newsE') + '</div></div></section>';
  };

  /* ----- Journal ----- */
  views.journal = function (q, id) {
    var J = W.journal;
    if (id) {
      var a = J.articles.filter(function (x) { return x.id === id; })[0];
      if (!a) return views.journal({});
      var others = J.articles.filter(function (x) { return x.id !== id; });
      var inl = { 'first-twerk-class': ['two-women-dancing', 'A Wednesday class in full swing'], 'pelvic-pilates': ['dancer-reach', 'A dancer reaching high, back arched'], 'women-only-safe-space': ['social-brand-graphic', 'A dance community. Built by women. For women.'] }[a.id] || ['group-laughing', 'The Werk Well community'];
      var paraN = 0;
      return '<article class="article-view"><header class="phead article" style="max-width:1100px"><h1 style="max-width:20ch">' + esc(a.title) + '</h1><p class="lead">' + esc(a.summary) + '</p><p class="small" style="margin-top:20px"><a class="tlink is-on" href="#/journal">Journal</a>, ' + a.read_minutes + ' minute read, by ' + esc(a.author) + '</p></header>' +
        pic(a.photo, a.title, 'article__pic', { big: true, sizes: '100vw' }) +
        '<div class="article prose">' + a.body.map(function (b, k) { var h = b.type === 'h' ? '<h2 class="rv">' + esc(b.text) + '</h2>' : '<p class="rv">' + esc(b.text) + '</p>'; if (b.type === 'p') paraN++; if (b.type === 'p' && paraN === 4) h += pic(inl[0], inl[1], 'inline-pic rv-pic', { sizes: '(max-width: 767px) 100vw, 720px' }); return h; }).join('') +
        '<p style="margin-top:48px">' + arrowBtn('Book a class', '#/book', 'btn--accent') + '</p></div></article>' +
        '<section class="band wrap" aria-labelledby="more-h"><h2 id="more-h" class="rv" style="font-size:2rem;margin-bottom:24px">Keep reading</h2><div class="reads">' + others.map(function (x, k) { return '<a class="rv" style="--d:' + k + '" href="#/journal/' + x.id + '">' + pic(x.photo, x.title, 'pic--hover', { sizes: '(max-width: 767px) 100vw, 45vw' }) + '<h3>' + esc(x.title) + '</h3><span class="tlink">Read, ' + x.read_minutes + ' minutes</span></a>'; }).join('') + '</div></section>' +
        newsBand(J.newsletter.text, J.newsletter.button);
    }
    return '<header class="phead phead--split"><h1>' + esc(J.heading) + '</h1><p class="lead">' + esc(J.sub) + ' On first classes, Pelvic Pilates and why the studio is women-only.</p></header>' +
      '<section class="wrap" aria-label="Articles"><div class="posts">' + J.articles.map(function (a, i) {
        return '<a class="post" href="#/journal/' + a.id + '">' + pic(a.photo, a.title, 'pic--hover rv-pic', { sizes: '(max-width: 767px) 100vw, 50vw' }) + '<h2 class="rv">' + esc(a.title) + '</h2><p class="rv" style="--d:1">' + esc(a.summary) + '</p><span class="tlink rv" style="--d:2">Read, ' + a.read_minutes + ' minutes</span></a>';
      }).join('') + '</div></section>' + newsBand(J.newsletter.text, J.newsletter.button);
  };
  function newsBand(text, btn) {
    return '<section class="band" aria-labelledby="nb-h"><div class="field"><div class="field__txt"><h2 id="nb-h">Be first to hear</h2><p>' + esc(text) + '</p>' + newsletterForm('newsJ', btn) + '</div><div class="field__who">' + pic('millie-portrait', 'Millie', '', { sizes: '150px' }) + '</div></div></section>';
  }

  /* ----- About ----- */
  views.about = function () {
    var A = W.about;
    return '<header class="phead phead--split"><h1>' + v(A.page_header) + '</h1><p class="lead">' + v(A.experience[0]) + '</p></header>' +
      '<section class="wrap" aria-labelledby="mi-h"><div class="grid about-mission"><h2 id="mi-h" class="rv">' + v(A.mission_heading) + '</h2><p class="lead rv" style="--d:1">' + v(A.mission) + '</p></div>' +
        '<div class="pillars">' + pic(A.photos.hero, 'Women dancing in a Werk Well class', 'rv-pic pic--hover', { sizes: '(max-width: 767px) 100vw, 50vw' }) +
        '<dl>' + A.pillars.map(function (p, i) { return '<div class="rv" style="--d:' + i + '"><dt>' + v(p.title) + '</dt><dd>' + v(p.text) + '</dd></div>'; }).join('') + '</dl></div></section>' +
      '<section class="band wrap" aria-labelledby="ex-h"><div class="grid incl"><h2 id="ex-h" class="rv">' + v(A.experience_heading) + '</h2><div class="incl__txt">' + A.experience.slice(1).map(function (p, i) { return '<p class="rv" style="--d:' + i + '">' + v(p) + '</p>'; }).join('') + '</div></div></section>' +
      '<section class="band band--sand wrap" aria-labelledby="mm-h"><div class="grid millie">' + pic(A.millie_photo, 'Millie, founder of Werk Well, smiling on the studio floor', 'millie__pic', { sizes: '(max-width: 767px) 80vw, 40vw', big: true }) +
        '<div class="millie__txt"><h2 id="mm-h" class="rv">' + v(A.meet_heading) + '</h2>' + A.millie.map(function (p, i) { return '<p class="rv" style="--d:' + Math.min(i, 4) + '">' + v(p) + '</p>'; }).join('') + '</div></div></section>' +
      '<section class="band wrap" aria-labelledby="in-h"><div class="grid incl"><h2 id="in-h" class="rv">' + v(A.inclusivity_heading) + '</h2><div class="incl__txt">' + A.inclusivity.map(function (p, i) { return '<p class="rv" style="--d:' + i + '">' + v(p) + '</p>'; }).join('') + '</div></div></section>' +
      '<section aria-labelledby="cta-h"><div class="strip">' + pic(A.photos.community, 'The Werk Well community', '', { sizes: '(max-width: 767px) 100vw, 34vw' }) + pic(A.photos.banner, 'A dancer balancing', '', { sizes: '34vw' }) + pic('dancer-arm-pose', 'A dancer mid-move', '', { sizes: '34vw' }) + '</div>' +
        '<div class="field"><div class="field__txt"><h2 id="cta-h">' + v(A.cta.heading) + '</h2><p>' + v(A.cta.text) + '</p><div class="hero__acts">' + arrowBtn(vt(A.cta.primary), '#/book?pay=intro', 'btn--accent') + '<a class="btn btn--paper" href="#/contact"><span class="btn__label">' + esc(vt(A.cta.secondary)) + '</span></a></div></div></div></section>';
  };

  /* ----- Contact ----- */
  views.contact = function () {
    var C = W.contact, F = C.form;
    return '<header class="phead phead--split"><h1>' + v(C.heading) + '</h1><p class="lead">' + v(C.sub) + '</p></header>' +
      '<section class="wrap band" style="padding-top:0" aria-labelledby="cf-h"><div class="grid contact"><div class="contact__form"><h2 id="cf-h" class="vh">' + v(F.heading) + '</h2><form id="contactForm" novalidate>' +
        '<label class="f rv"><span>' + esc(F.name) + '</span><input type="text" name="name" autocomplete="name" required></label>' +
        '<label class="f rv"><span>' + esc(F.email) + '</span><input type="email" name="email" autocomplete="email" required></label>' +
        '<label class="f rv"><span>' + esc(F.subject) + '</span><select name="subject">' + F.subject_options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f rv"><span>' + esc(F.message) + '</span><textarea name="message" required></textarea></label><p class="err" id="cErr"></p>' +
        arrowBtn(esc(F.send), null, 'btn--accent') + '<p style="margin-top:12px">' + esc(F.demo_note) + ' Millie usually replies within two days.</p></form></div>' +
        '<div class="contact__info"><h2 class="lead" style="margin-bottom:16px">' + v(C.location_heading) + '</h2><a class="big tlink" href="mailto:' + C.email + '">' + C.email + '</a>' +
          '<address class="addr">Fearless Fit Hub<br>31 Wharfside, Fenny Stratford<br>Milton Keynes MK2 2AZ</address>' +
          '<p><a class="tlink is-on" href="' + GMAPS + '" target="_blank" rel="noopener">Open in Google Maps</a></p>' +
          '<p style="display:flex;gap:20px;flex-wrap:wrap"><a class="tlink" href="' + IG + '" target="_blank" rel="noopener">Instagram</a><a class="tlink" href="' + TT + '" target="_blank" rel="noopener">TikTok</a><a class="tlink" href="' + FB + '" target="_blank" rel="noopener">Facebook</a></p>' +
          pic(C.photo, 'The Werk Well community', 'pic--hover rv-pic', { sizes: '(max-width: 767px) 100vw, 40vw' }) + '</div></div></section>' +
      '<div class="strip" aria-hidden="true">' + pic('dancer-balance', '', '', { sizes: '34vw' }) + pic('millie-portrait', '', '', { sizes: '34vw' }) + pic('dancer-arm-pose', '', '', { sizes: '34vw' }) + '</div>';
  };

  /* ----- Privacy and cookie policies ----- */
  function legalBlock(lines) {
    var out = '', list = [];
    function mark(t) { return esc(t).replace(/\[([^\]]+)\]/g, '<mark class="blank">[$1]</mark>'); }
    function flush() { if (list.length) { out += '<ul>' + list.map(function (l) { return '<li>' + mark(l) + '</li>'; }).join('') + '</ul>'; list = []; } }
    lines.forEach(function (l) { if (l.indexOf('- ') === 0) list.push(l.slice(2)); else { flush(); out += '<p>' + mark(l) + '</p>'; } });
    flush();
    return out;
  }
  function legalPage(kind) {
    var L = window.WW_LEGAL || { privacy: [], cookies: [] }, secs = L[kind], isP = kind === 'privacy';
    return '<header class="phead legal-head"><h1>' + (isP ? 'Privacy policy' : 'Cookie policy') + '</h1>' +
      '<p class="legal-note">Draft for you to check. This is not legal advice.</p>' +
      '<p class="lead">' + (isP ? 'Each section shows your current wording, then my suggested wording for the new site. Words in square brackets are facts only you can fill in.' : 'You do not have a cookie policy yet. This is my suggested one for the new site.') + '</p>' +
      '<p class="legal-links"><a class="tlink is-on" href="#/' + (isP ? 'cookies' : 'privacy') + '">' + (isP ? 'Cookie policy' : 'Privacy policy') + '</a><button type="button" class="tlink is-on tlink--btn" data-cookie-settings>Cookie settings</button></p></header>' +
      '<div class="legal wrap">' + secs.map(function (sec, i) {
        return '<section class="legal-sec rv" aria-labelledby="lg-' + i + '"><h2 id="lg-' + i + '">' + esc(sec.title) + '</h2><div class="legal-body">' +
          (isP ? (sec.original ? '<div class="legal-cur"><p class="legal-label">Your current wording</p>' + legalBlock(sec.original) + '</div>' : '<div class="legal-cur legal-cur--none"><p class="legal-label">Your current wording</p><p>Your policy does not cover this yet.</p></div>') : '') +
          '<div class="legal-new"><p class="legal-label">My suggested wording</p>' + legalBlock(sec.suggested) + '</div></div></section>';
      }).join('') + '</div>';
  }
  views.privacy = function () { return legalPage('privacy'); };
  views.cookies = function () { return legalPage('cookies'); };

  /* ----- Cookie notice and settings ----- */
  function cookieCard() {
    if (!window.WerkConsent || WerkConsent.get() || $('#cookie')) return;
    var el = doc.createElement('section'); el.id = 'cookie'; el.className = 'cookie'; el.setAttribute('aria-labelledby', 'ck-h'); el.setAttribute('role', 'region');
    el.innerHTML = '<div class="cookie__in"><div class="cookie__txt"><h2 id="ck-h">Cookies</h2><p>This site uses cookies.</p></div><div class="cookie__acts"><button type="button" class="tlink is-on tlink--btn" data-cookie-settings>Find out more</button><button type="button" class="btn btn--sm" data-cookie-ok><span class="btn__label">OK</span></button></div></div>';
    var top = $('#top'); top.insertBefore(el, $('#menu'));
  }
  function cookieDone() { var el = $('#cookie'); if (!el) return; el.classList.add('is-leaving'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced ? 0 : 300); }
  function cookiePanel() {
    var c = (window.WerkConsent && WerkConsent.get()) || { analytics: false };
    sheet('<div class="cpanel"><h2>Cookie settings</h2><p>Choose which cookies this site may use. You can change this any time from “Cookie settings” at the foot of every page.</p>' +
      '<div class="cpanel__row"><div><h3>Essential</h3><p>Always on. They remember your bookings, your sound choice and this cookie choice so the site works.</p></div><span class="cpanel__on">Always on</span></div>' +
      '<div class="cpanel__row"><div><h3>Analytics</h3><p>PostHog, to see how the site is used and where booking gets stuck. Off until you accept.</p></div><label class="switch"><input type="checkbox" id="ckAnalytics"' + (c.analytics ? ' checked' : '') + '><span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span><span class="vh">Allow analytics cookies</span></label></div>' +
      '<div class="cpanel__acts"><button type="button" class="btn btn--accent" data-ck="all"><span class="btn__label">Accept all</span></button><button type="button" class="btn btn--ghost" data-ck="none"><span class="btn__label">Reject non-essential</span></button><button type="button" class="btn btn--ghost" data-ck="save"><span class="btn__label">Save my choices</span></button></div>' +
      '<p><a class="tlink is-on" href="#/cookies" data-close>Read the cookie policy</a></p></div>', function (el, close) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ck]'); if (!b) return;
        var a = b.dataset.ck === 'all' ? true : b.dataset.ck === 'none' ? false : $('#ckAnalytics', el).checked;
        WerkConsent.set(a); cookieDone(); close();
        toast(a ? 'Saved: essential and analytics cookies' : 'Saved: essential cookies only');
      });
    });
  }

  /* ----- Private hire ----- */
  views['private-hire'] = function () {
    return '<header class="phead phead--split"><h1>Private hire</h1><p class="lead">Hen parties, birthdays and work socials: a private twerk class for your group, led by Millie.</p></header>' +
      '<section class="wrap band" style="padding-top:0" aria-labelledby="ph-h"><div class="grid contact"><div class="contact__form"><h2 id="ph-h" style="font-size:2rem;margin-bottom:24px">Tell us about your group</h2><form id="hireForm" novalidate>' +
        '<label class="f rv"><span>Your name</span><input type="text" name="name" autocomplete="name" required></label>' +
        '<label class="f rv"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>' +
        '<label class="f rv"><span>What is the occasion?</span><select name="occasion"><option>Hen party</option><option>Birthday</option><option>Work social</option><option>Something else</option></select></label>' +
        '<label class="f rv"><span>Preferred date</span><input type="date" name="date" min="2026-12-01"></label>' +
        '<label class="f rv"><span>Group size</span><input type="number" name="size" min="4" max="30" inputmode="numeric" aria-describedby="sz-h"><small class="f-hint" id="sz-h">Up to 15 fits the studio comfortably.</small></label>' +
        '<label class="f rv"><span>Budget</span><select name="budget"><option>Up to £200</option><option>£200 to £400</option><option>£400 or more</option><option>Not sure yet</option></select></label>' +
        '<label class="f rv"><span>Anything else (optional)</span><textarea name="note"></textarea></label><p class="err" id="hErr"></p>' +
        arrowBtn('Send enquiry', null, 'btn--accent') + '<p class="small" style="margin-top:12px">Demo only. Nothing is sent.</p></form></div>' +
        '<div class="contact__info">' + pic('group-laughing', 'A group of women laughing with their arms up', 'pic--hover', { sizes: '(max-width: 767px) 100vw, 40vw' }) +
        '<h2 class="lead rv" style="margin:32px 0 12px">How it works</h2><p class="rv">Women only, as with every class. Everyone in the group books a place and fills in the wellness check, so Millie knows who is in the room.</p><p class="rv">Prefer one-to-one? <a class="tlink is-on" href="#/classes#private">Private 1:1 is £70 an hour</a>.</p></div></div></section>' +
      '<div class="strip" aria-hidden="true">' + pic('two-women-dancing', '', '', { sizes: '34vw' }) + pic('dancer-reach', '', '', { sizes: '34vw' }) + pic('social-high-five', '', '', { sizes: '34vw' }) + '</div>';
  };

  /* ----- Me ----- */
  views.me = function () {
    var mine = S.bookings.slice().reverse();
    var used = S.bookings.filter(function (b) { return b.pay === 'wallet' && !b.waitlist; }).length;
    var credits = creditsLeft();
    var attended = 7 + S.bookings.filter(function (b) { return !b.waitlist; }).length;
    var sample = { id: 'sample', title: 'Pelvic Pilates', date: '2026-12-09', time: '19:15', sample: true };
    var list = mine.concat([sample]);
    function ms(n) { var got = attended >= n; return '<div class="' + (got ? 'is-got' : '') + '"><b>' + n + '</b><span class="small" style="color:inherit">' + (got ? 'Reached' : (n - attended) + ' to go') + '</span><div class="bar"><i style="transform:scaleX(' + Math.min(1, attended / n) + ')"></i></div></div>'; }
    var wallet = isMember() ?
      '<section class="card wallet rv" aria-labelledby="wal-h"><div><h2 id="wal-h" style="font-family:var(--sans);font-size:1rem;font-weight:500;letter-spacing:0">The Werk Club, founding member</h2><p class="small">£79 a month, renews 1 December</p></div><div><p class="wallet__n">All</p><p class="small" style="margin:0">weekly classes included</p><p class="small" style="margin:14px 0 0">Booking opens four weeks ahead for you, 10% off events, and one guest place a month.</p></div><a class="btn btn--paper btn--sm" href="#/book?ahead=1"><span class="btn__label">Book ahead</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></a></section>' :
      '<section class="card wallet rv" aria-labelledby="wal-h"><div><h2 id="wal-h" style="font-family:var(--sans);font-size:1rem;font-weight:500;letter-spacing:0">5 class pass</h2><p class="small">Expires 13 January 2027</p></div><div><p class="wallet__n">' + credits + '</p><p class="small" style="margin:0">of 5 credits left</p><p class="small" style="margin:14px 0 0">Your oldest pass is used first. Top up any time from The Werk Club page, and unused credits stay until the expiry date.</p></div><a class="btn btn--paper btn--sm" href="#/book?ahead=1"><span class="btn__label">Book ahead</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></a></section>';
    return '<div class="app"><div class="app__top"><h1>Me</h1><div class="plan-switch" role="group" aria-label="Demo member plan"><span class="small">Demo member has:</span><button type="button" class="btn btn--sm ' + (isMember() ? 'btn--ghost' : '') + '" data-plan="pass" aria-pressed="' + !isMember() + '"><span class="btn__label">5 class pass</span></button><button type="button" class="btn btn--sm ' + (isMember() ? '' : 'btn--ghost') + '" data-plan="member" aria-pressed="' + isMember() + '"><span class="btn__label">Werk Club member</span></button></div></div>' +
      '<div class="me">' +
        wallet +
        '<section class="card upcoming rv" style="--d:1" aria-labelledby="up-h"><h2 id="up-h">Upcoming</h2>' + list.map(function (b, i) {
          var d = D(b.date);
          return '<div class="bk' + (i === 0 && !b.sample && Date.now() - b.at < 600000 ? ' is-new' : '') + '"><div class="bk__date"><b>' + d.getDate() + '</b><small>' + MONTHS[d.getMonth()] + '</small></div><div><b style="font-weight:500">' + esc(b.title) + '</b>' + (i === 0 && !b.sample && Date.now() - b.at < 600000 ? '<span class="new-tag">New</span>' : '') + '<br><span class="small">' + fmtDate(b.date, true) + ', ' + time12(b.time) + (b.waitlist ? ' &middot; waitlist' : '') + (b.sample ? ' &middot; sample' : '') + '</span></div>' + (b.sample ? '' : '<button type="button" class="btn btn--ghost btn--sm" data-ics="' + b.id + '" aria-label="Add ' + esc(b.title) + ' to calendar"><span class="btn__label">Calendar</span></button>') + '</div>';
        }).join('') + '</section>' +
        '<section class="card milestones rv" aria-labelledby="ms-h"><h2 id="ms-h">Milestones</h2><p class="small">' + attended + ' classes so far (7 sample classes plus your demo bookings).</p><div class="ms">' + ms(5) + ms(10) + ms(25) + '</div></section>' +
        '<section class="card friend rv" style="--d:1" aria-labelledby="fr-h"><h2 id="fr-h">Bring a friend</h2><p>Her first class is £5 with your link. She books and fills in the wellness check like everyone else.</p><button type="button" class="btn btn--sm" data-share><span class="btn__label">Copy my link</span><span class="btn__arrow" aria-hidden="true">&rarr;</span></button></section>' +
      '</div></div>';
  };

  /* ----- Studio view (her side) ----- */
  var SAMPLE_PEOPLE = ['Ama O.', 'Bisi K.', 'Chloe T.', 'Dami A.', 'Esi M.', 'Grace P.', 'Hana S.', 'Ife B.', 'Jade W.', 'Kemi L.', 'Lola R.'];
  var TINTS = ['#f3dccb', '#e6dcc9', '#dfe3d3', '#e9d6d6', '#dcd9e6', '#d7e4e2'];
  views.studio = function () {
    var next = slots()[0], c = cls(next.id);
    var mine = S.bookings.filter(function (b) { return b.item === next.id && b.date === next.date && !b.waitlist; });
    var tk = taken(next.id, next.date), base = TAKEN[next.id + '|' + next.date] || 0;
    var latest = S.bookings[S.bookings.length - 1];
    var people = mine.slice().reverse().map(function (b) { return { name: b.name, pay: payLabel(b.pay), isNew: true, knee: b.knee, injury: b.injury === 'yes', photo: b.photo }; })
      .concat(SAMPLE_PEOPLE.slice(0, base).map(function (n, i) { return { name: n, pay: ['Intro pass', 'Werk Club', '10 class pass', 'Single class', '5 class pass'][i % 5], photo: i % 3 ? 'yes' : 'no', injury: i === 4 }; }));
    function av(n, i) { return '<span class="avatar" style="background:' + TINTS[i % TINTS.length] + '">' + esc(n.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2)) + '</span>'; }
    var L = latest || { name: 'Ama O.', title: c.name, date: next.date, time: c.timetable.time, pay: 'intro', id: 'WW-SAMPLE' };
    var when = fmtDate(L.date, true) + ', ' + time12(L.time);
    return '<div class="studio"><div class="studio__bar"><h1>Studio</h1><p class="small" style="margin:0">Millie’s view. Sample members plus anything booked in this demo.</p><a class="btn btn--ghost btn--sm" href="#/"><span class="btn__label">Back to the site</span></a></div>' +
      '<div class="studio__grid">' +
        '<section class="panel tonight" aria-labelledby="tn-h"><h2 id="tn-h">Next class: ' + esc(c.name) + ', ' + fmtDate(next.date, true) + ', ' + time12(next.time) + '</h2>' +
          '<div class="kpis"><div><b>' + tk + '</b><span>booked</span></div><div><b>' + (c.capacity - tk) + '</b><span>places left</span></div><div><b>' + people.filter(function (p) { return p.photo === 'no'; }).length + '</b><span>no photos of face</span></div><div><b>' + people.filter(function (p) { return p.injury; }).length + '</b><span>health note to read</span></div></div>' +
          '<div class="fill"><i style="transform:scaleX(' + (tk / c.capacity) + ')"></i></div>' +
          '<table class="t"><thead><tr><th>Name</th><th>Paid with</th><th class="t-hide">Photos</th><th>Notes</th></tr></thead><tbody>' + people.map(function (p, i) {
            return '<tr' + (p.isNew ? ' class="is-new"' : '') + '><td>' + av(p.name, i) + esc(p.name) + (p.isNew ? ' <span class="new-tag">New</span>' : '') + '</td><td>' + esc(p.pay) + '</td><td class="t-hide">' + (p.photo === 'no' ? '<span class="pill pill--warn">Hide face</span>' : 'OK') + '</td><td>' + (p.injury ? '<span class="pill pill--warn">Health note</span>' : '') + (p.knee ? ' <span class="pill">Knee pads</span>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></section>' +
        '<section class="panel notify" aria-labelledby="nt-h"><h2 id="nt-h">New booking, as it reaches you</h2><div class="phones">' +
          '<div class="phone"><div class="phone__screen mail"><div class="mail__bar">Mail &middot; now</div><div class="mail__body ping"><p class="small" style="margin:0 0 4px;font-size:.75rem">From: Werk Well bookings</p><h4>New booking: ' + esc(L.name) + ', ' + esc(L.title) + '</h4><p>' + esc(when) + '</p><p>Paid with: ' + esc(L.waitlist ? 'Waitlist' : payLabel(L.pay)) + '</p><p>' + (c.capacity - tk) + ' places left in this class.</p><p style="color:#a14a12;font-weight:500">Open the class list</p></div></div></div>' +
          '<div class="phone"><div class="phone__screen wa"><div class="wa__bar"><i>W</i>Werk Well bookings</div><div class="wa__msgs"><div class="wa__msg">New booking for ' + esc(L.title) + ', ' + esc(when) + ': <b>' + esc(L.name) + '</b>.<time>18:02</time></div><div class="wa__msg">' + (c.capacity - tk) + ' places left. Reply LIST for the full class list.<time>18:02</time></div></div></div></div>' +
        '</div><p class="small" style="margin-top:12px">' + (latest ? 'Showing your latest demo booking.' : 'Make a booking in the demo and it appears here.') + '</p></section>' +
        '<section class="panel members" aria-labelledby="mb-h"><h2 id="mb-h">Members</h2><table class="t"><thead><tr><th>Name</th><th>Plan</th><th class="t-hide">Since</th><th>Classes</th></tr></thead><tbody>' +
          [['Bisi K.', 'The Werk Club, founding', 'Sep 2026', 22], ['Kemi L.', 'The Werk Club, founding', 'Oct 2026', 14], ['Grace P.', 'Werk Club Four', 'Oct 2026', 9], ['Hana S.', '10 class pass', 'Nov 2026', 4]].concat(S.requests.map(function (r) { return [r.name, 'Requested a place', 'Today', 0, true]; })).map(function (m, i) {
            return '<tr' + (m[4] ? ' class="is-new"' : '') + '><td>' + av(m[0], i + 2) + esc(m[0]) + '</td><td>' + esc(m[1]) + (m[4] ? ' <span class="new-tag">New</span>' : '') + '</td><td class="t-hide">' + m[2] + '</td><td>' + m[3] + '</td></tr>';
          }).join('') + '</tbody></table><p class="small" style="margin-top:10px">Sample members for the demo.</p></section>' +
      '</div></div>';
  };

  /* ---------- footer ---------- */
  function renderFooter() {
    var F = W.footer;
    $('#foot').innerHTML = '<div class="foot__name">' + window.WW_LOGO + '<span class="vh">Werk Well Studio</span></div>' +
      '<p class="foot__sign">See you on Wednesday.</p>' +
      '<div class="foot__row">' +
        '<div class="foot__places">' +
          '<a class="flink" href="mailto:' + W.meta.email + '">' + W.meta.email + '</a>' +
          '<a class="flink flink--addr" href="' + GMAPS + '" target="_blank" rel="noopener"><span>31 Wharfside, Fenny Stratford,</span> <span>Milton Keynes MK2 2AZ</span></a>' +
          '<a class="flink" href="' + GMAPS + '" target="_blank" rel="noopener">5.0 on Google, 38 reviews</a>' +
        '</div>' +
        '<div class="foot__cols">' +
          '<div><h2>Follow</h2><a class="flink" href="' + IG + '" target="_blank" rel="noopener">Instagram</a><a class="flink" href="' + TT + '" target="_blank" rel="noopener">TikTok</a><a class="flink" href="' + FB + '" target="_blank" rel="noopener">Facebook</a></div>' +
          '<div><h2>More</h2><a class="flink" href="#/about">About</a><a class="flink" href="#/private-hire">Private hire</a><a class="flink" href="#/contact">Contact</a></div>' +
          '<div><h2>' + v(F.newsletter_heading) + '</h2><form class="foot__news" data-form="news" novalidate><label class="vh" for="newsF">Email address</label><input id="newsF" type="email" placeholder="' + esc(F.newsletter_placeholder) + '" autocomplete="email"><button type="submit" class="btn btn--paper btn--sm"><span class="btn__label">' + esc(F.newsletter_button) + '</span></button></form></div>' +
        '</div></div>' +
      '<div class="foot__legal"><span>' + esc(F.bottom) + '</span><span class="foot__legal-links"><a class="flink" href="#/privacy">Privacy policy</a><a class="flink" href="#/cookies">Cookie policy</a><button type="button" class="flink flink--btn" data-cookie-settings>Cookie settings</button><a class="flink" href="#/studio">' + esc(F.studio_login_link) + '</a><a class="flink" href="#top" data-top>Back to top</a></span></div>' +
      '<div class="appear" role="group" aria-label="Appearance"><p class="appear__lab">Appearance</p><div class="appear__seg" data-theme-seg><i class="appear__thumb" aria-hidden="true"></i><button type="button" data-theme-set="auto" aria-pressed="false">Auto</button><button type="button" data-theme-set="light" aria-pressed="false">Light</button><button type="button" data-theme-set="dark" aria-pressed="false">Dark</button></div></div>';
    if (window.WerkTheme) window.WerkTheme.sync();
  }

  /* ================= ROUTER ================= */
  var current = null;
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), anchor = null;
    var hi = h.indexOf('#'); if (hi >= 0) { anchor = h.slice(hi + 1); h = h.slice(0, hi); }
    var parts = h.split('?'), path = parts[0].split('/').filter(Boolean), q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { name: path[0] || 'home', id: path[1], q: q, anchor: anchor };
  }
  var TITLES = { privacy: 'Privacy policy | WERK WELL Studio', cookies: 'Cookie policy | WERK WELL Studio', home: 'WERK WELL Studio | Women-only twerk and dance fitness, Milton Keynes', classes: 'Classes | WERK WELL Studio', book: 'Book | WERK WELL Studio', club: 'The Werk Club | WERK WELL Studio', events: 'Events | WERK WELL Studio', journal: 'Journal | WERK WELL Studio', about: 'About | WERK WELL Studio', contact: 'Contact | WERK WELL Studio', 'private-hire': 'Private hire | WERK WELL Studio', me: 'Me | WERK WELL Studio', studio: 'Studio | WERK WELL Studio' };
  function render(keepScroll) {
    var r = parse(); if (!views[r.name]) r.name = 'home';
    var view = $('#view'), y = window.scrollY;
    if (P.io) { P.io.disconnect(); P.io = null; } P.frame = null; P.el = null;
    clearInterval(fadeTimer); if (globeStop) { globeStop(); globeStop = null; }
    view.innerHTML = views[r.name](r.q, r.id);
    doc.title = TITLES[r.name] || TITLES.home;
    if (!keepScroll) { view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering'); setTimeout(function () { view.classList.remove('is-entering'); }, 600); }
    current = r;
    root.className = root.className.replace(/\broute-\S+/g, '').trim() + ' route-' + r.name;
    // nav state
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === r.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var tab = { home: 'home', classes: 'classes', book: 'book', club: 'club', me: 'me' }[r.name];
    $$('#tabs a').forEach(function (a) { a.classList.toggle('is-on', a.dataset.tab === tab); if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    moveTabInd(tab);
    $('.top__book').hidden = r.name === 'book';
    renderFooter();
    footWatch();
    afterRender(r);
    if (keepScroll) window.scrollTo(0, y);
    else if (r.anchor && $('#' + r.anchor)) { setTimeout(function () { $('#' + r.anchor).scrollIntoView({ behavior: 'auto' }); }, 30); }
    else window.scrollTo(0, 0);
    closeMenu();
  }
  function moveTabInd(tab) {
    var ind = $('.tabs__ind'), a = tab && $('#tabs a[data-tab="' + tab + '"]');
    if (!a) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1'; ind.style.transform = 'translateX(' + (a.offsetLeft) + 'px)'; ind.style.width = a.offsetWidth + 'px';
  }
  var fadeTimer = 0;
  function afterRender(r) {
    reveal();
    if (r.name === 'home') { setupPlayer(); setupGuest(); setupFade(); setupRise(); }
    if (r.name === 'classes') { renderDays($('#view')); setupCards(); }
    if (r.name === 'book') bookRender(1);
    if (r.name === 'club') setupGlobe();
    if (r.name === 'me' || r.name === 'studio') { $$('.bar i, .fill i').forEach(function (i) { var t = i.style.transform; i.style.transform = 'scaleX(0)'; requestAnimationFrame(function () { requestAnimationFrame(function () { i.style.transform = t; }); }); }); }
  }

  var fio = null;
  function footWatch() {
    if (!('IntersectionObserver' in window)) return;
    if (!fio) fio = new IntersectionObserver(function (es) { es.forEach(function (e) { root.classList.toggle('at-foot', e.isIntersecting); }); }, { threshold: 0 });
    fio.disconnect(); fio.observe($('#foot'));
  }
  /* ---------- reveals ---------- */
  var rio = null;
  function reveal() {
    if (rio) rio.disconnect();
    var els = $$('.rv, .rv-pic, .pic--hover, .reel');
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        // On touch screens, the caption rises as the picture enters view.
        if (!finePointer.matches && (e.target.classList.contains('pic--hover') || e.target.hasAttribute('data-reel'))) setTimeout(function () { e.target.classList.add('is-seen'); }, 500);
        rio.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    els.forEach(function (e) { rio.observe(e); });
  }

  /* ---------- home: guest list (the live thing) ---------- */
  function setupGuest() {
    var g = $('#guest'); if (!g) return;
    var input = $('#guestName'), you = $('#guestYou'), places = $$('.place', g), tk = +g.dataset.taken, cap = +g.dataset.cap;
    function upd() {
      var n = input.value.trim().replace(/[<>]/g, '');
      places.forEach(function (p) { p.classList.remove('is-you'); });
      if (!n) { you.textContent = tk >= cap ? 'This one is full. Type your name to join the waitlist.' : 'Type your first name to hold a place.'; return; }
      if (tk >= cap) { you.innerHTML = '<em>' + esc(n) + '</em>, you would be first on the waitlist.'; return; }
      places[tk].classList.add('is-you');
      you.innerHTML = '<em>' + esc(n) + '</em>, place ' + (tk + 1) + ' of ' + cap + ' is yours to hold.';
    }
    input.addEventListener('input', upd);
    $('#guestForm').addEventListener('submit', function (e) {
      e.preventDefault(); var n = input.value.trim(), next = slots()[0];
      if (!n) { input.focus(); you.textContent = 'Add your first name first.'; return; }
      location.hash = '#/book?c=' + next.id + '&d=' + next.date + '&name=' + encodeURIComponent(n);
    });
  }
  /* ---------- home: slow crossfade ---------- */
  function setupFade() {
    var f = $('#fade'); if (!f) return;
    var imgs = $$('img', f), i = 0; imgs[0].classList.add('is-on');
    if (reduced) return;
    fadeTimer = setInterval(function () { if (doc.hidden) return; imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on'); }, 5600);
  }
  /* ---------- home: rising triptych ---------- */
  var riseRaf = 0;
  function setupRise() {
    var r = $('#rise'); if (!r || reduced) return;
    var reels = $$('.reel', r), row = $('.rise__row', r);
    function tick() {
      riseRaf = 0; if (!doc.body.contains(r)) return;
      var rect = r.getBoundingClientRect(), vh = innerHeight, span = rect.height - vh * 0.9;
      var p = Math.max(0, Math.min(1, -rect.top / Math.max(1, span)));
      var stageH = $('.rise__stage', r).offsetHeight;
      var head = $('.rise__stage > p', r); var limit = head.offsetTop + head.offsetHeight + 40;
      var travelC = stageH - limit; // centre rises from below to 40px under the sentence
      var e = 1 - Math.pow(1 - p, 3);
      reels.forEach(function (el, k) {
        var mult = k === 1 ? 1 : 0.92, extra = k === 1 ? 0 : 55;
        var y = -(Math.max(stageH * 0.5, travelC * (0.55 + 0.45 * e) * mult)) + extra;
        var s = k === 1 ? 1 + 0.18 * e : 1;
        el.style.transform = 'translateY(' + (y) + 'px) scale(' + s + ')';
      });
    }
    function on() { if (!riseRaf) riseRaf = requestAnimationFrame(tick); }
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    tick();
  }
  /* ---------- classes: tap-to-expand on phones ---------- */
  function setupCards() {
    $$('.xcard').forEach(function (card) {
      var btn = $('.xcard__btn', card);
      function toggle() {
        if (finePointer.matches) return;
        var open = !card.classList.contains('is-open');
        $$('.xcard.is-open').forEach(function (c) { if (c !== card) { c.classList.remove('is-open'); $('.xcard__btn', c).setAttribute('aria-expanded', 'false'); } });
        card.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
      }
      btn.addEventListener('click', toggle);
      $('.xcard__meta', card).addEventListener('click', toggle);
    });
    doc.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { var a = doc.activeElement; if (a && a.closest && a.closest('.xcard')) a.blur(); } });
  }

  /* ---------- voice switch ---------- */
  function setVoice(vv, animate) {
    S.voice = vv; save();
    $$('#voice button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.voice === vv); });
    $('#voice').setAttribute('data-on', vv);
    if (animate) {
      if (current && current.name === 'book' && B) { bookRender(0); }
      else { var bs = B; render(true); B = bs; }
      $('#view').classList.add('voice-swap'); setTimeout(function () { $('#view').classList.remove('voice-swap'); }, 500);
      toast(vv === 'original' ? 'Showing your words, exactly as on your site' : 'Showing my suggested rewrite');
    }
  }

  /* ---------- menu ---------- */
  function closeMenu() { var m = $('#menu'); if (!m.hidden) { m.classList.remove('is-open'); m.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); $('#menuBtn').textContent = 'Menu'; } }

  /* ---------- sound ---------- */
  function syncSound() {
    var b = $('#sound'), on = window.WerkIntro && !WerkIntro.isMuted();
    b.setAttribute('aria-pressed', String(!!on)); $('.sound__txt', b).textContent = on ? 'Sound on' : 'Sound off';
    b.setAttribute('aria-label', on ? 'Music is playing. Turn it off' : 'Music is off. Turn it on');
  }

  /* ---------- global events ---------- */
  doc.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-next]')) { e.preventDefault(); bookNext(); return; }
    if (t.closest('[data-back]')) { bookBack(); return; }
    if (t.closest('#confirmBtn')) { bookConfirm(t.closest('#confirmBtn')); return; }
    if (t.closest('#useDemo')) { var st = $('#stage'); $('[name=name]', st).value = 'Demo member'; $('[name=email]', st).value = 'demo.member@example.com'; $('[name=mobile]', st).value = '07700 900123'; return; }
    if (t.closest('[data-cookie-ok]')) { WerkConsent.set(true); cookieDone(); toast('Thanks. Cookies accepted.'); return; }
    if (t.closest('[data-cookie-settings]')) { e.preventDefault(); cookiePanel(); return; }
    var gb = t.closest('[data-gallery]'); if (gb && !t.closest('.gtile')) { openLightbox(+gb.dataset.gallery); return; }
    var ia = t.closest('[data-ics-all]'); if (ia) { var ids = ia.dataset.icsAll.split(','); icsMany(S.bookings.filter(function (b) { return ids.indexOf(b.id) >= 0; }), 'werk-well-bookings.ics'); return; }
    var pl = t.closest('[data-plan]'); if (pl) { S.plan = pl.dataset.plan; save(); render(true); toast(S.plan === 'member' ? 'Demo member is now a Werk Club member' : 'Demo member now has a 5 class pass'); return; }
    var ic = t.closest('[data-ics]'); if (ic) { var rec = S.bookings.filter(function (b) { return b.id === ic.dataset.ics; })[0]; if (rec) ics(rec); return; }
    if (t.closest('[data-request]')) { requestSheet(); return; }
    var buy = t.closest('[data-buy]'); if (buy) { buySheet(buy.dataset.buy); return; }
    var tell = t.closest('[data-tell]'); if (tell) { tellSheet(tell.dataset.tell); return; }
    var wait = t.closest('[data-wait]'); if (wait) { var p = wait.dataset.wait.split('|'); location.hash = '#/book?c=' + p[0] + '&d=' + p[1]; return; }
    if (t.closest('[data-share]')) { var link = location.href.split('#')[0] + '#/book?pay=friend'; try { navigator.clipboard.writeText(link); } catch (x) {} var sb = t.closest('[data-share]'); sb.classList.add('is-done'); $('.btn__label', sb).textContent = 'Link copied'; toast('Link copied. Her first class is £5.'); return; }
    if (t.closest('[data-top]')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    var vb = t.closest('[data-voice]'); if (vb) { if (vb.dataset.voice !== S.voice) setVoice(vb.dataset.voice, true); else setVoice(S.voice === 'original' ? 'suggested' : 'original', true); return; }
    if (t.closest('#menuBtn')) {
      var m = $('#menu'), open = m.hidden; m.hidden = !open; $('#menuBtn').setAttribute('aria-expanded', String(open)); $('#menuBtn').textContent = open ? 'Close' : 'Menu';
      if (open) requestAnimationFrame(function () { m.classList.add('is-open'); }); return;
    }
    if (t.closest('#sound')) { if (window.WerkIntro) { WerkIntro.toggle(); syncSound(); } return; }
    if (t.closest('.offer__x')) { var o = $('#offer'); o.classList.add('is-leaving'); S.offerGone = true; save(); setTimeout(function () { o.hidden = true; root.classList.remove('has-offer'); }, 300); return; }
  });
  doc.addEventListener('change', function (e) {
    if (e.target.name === 'pick') { var n = $$('[name="pick"]:checked').length, c = $('#aheadCount'); if (c) c.textContent = n ? (isMember() ? n + (n === 1 ? ' class' : ' classes') + ', included in your membership' : 'Uses ' + n + ' of your 5 credits' + (n > creditsLeft() ? ' (you have ' + creditsLeft() + ' left)' : '')) : ''; }
    if (e.target.name === 'injury') { var d = $('#injDet'); if (d) d.hidden = e.target.value !== 'yes'; }
  });
  doc.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-form="news"]')) {
      e.preventDefault(); var inp = $('input', f), btn = $('button', f);
      if (!/^\S+@\S+\.\S+$/.test(inp.value)) { inp.focus(); toast('Add a working email address'); return; }
      btn.classList.add('is-loading');
      setTimeout(function () { btn.classList.remove('is-loading'); btn.classList.add('is-done'); $('.btn__label', btn).textContent = 'Subscribed'; inp.value = ''; toast('You are on the newsletter list (demo)'); }, 700);
      return;
    }
    if (f.id === 'contactForm' || f.id === 'hireForm') {
      e.preventDefault(); var errEl = $('.err', f);
      if (!f.name.value.trim() || !/^\S+@\S+\.\S+$/.test(f.email.value)) { errEl.textContent = 'Add your name and a working email.'; return; }
      var b2 = $('button[type=submit]', f); b2.classList.add('is-loading');
      setTimeout(function () { f.outerHTML = '<div class="done-screen"><h3>Thank you</h3><p>' + (f.id === 'hireForm' ? 'Millie will reply about dates and prices for your group within a few days.' : 'Millie will reply by email, usually within two days.') + '</p></div>'; }, 800);
    }
  });
  window.addEventListener('hashchange', function () { render(false); });
  window.addEventListener('resize', function () { if (current) moveTabInd({ home: 'home', classes: 'classes', book: 'book', club: 'club', me: 'me' }[current.name]); setVoice(S.voice, false); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { S = Object.assign(S, load()); if (current && (current.name === 'studio' || current.name === 'me')) render(true); } });

  var lastY = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY, top = $('#top');
    if (y > 120 && y > lastY + 4 && $('#menu').hidden) { top.classList.add('is-tucked'); root.classList.add('bars-tucked'); }
    else if (y < lastY - 4 || y <= 120) { top.classList.remove('is-tucked'); root.classList.remove('bars-tucked'); }
    lastY = y;
  }, { passive: true });
  /* ---------- boot ---------- */
  function boot() {
    $('.brand__mark').innerHTML = window.WW_LOGO;
    render(false);
    setVoice(S.voice, false);
    syncSound();
    if (!S.offerGone) setTimeout(function () { $('#offer').hidden = false; root.classList.add('has-offer'); }, 600);
    doc.addEventListener('werkwell:enter', function () { syncSound(); setTimeout(cookieCard, 700); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
