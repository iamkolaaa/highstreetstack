/* WERK WELL Studio, demo A. One file, no build step. */
(function () {
  'use strict';
  var C = window.WW, B = window.WW_BRAND;
  var main = document.getElementById('main');
  var mql = window.matchMedia('(min-width: 900px)');
  var fineMQ = window.matchMedia('(pointer: fine)'), sawMouse = false;
  window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') sawMouse = true; }, { passive: true });
  var fine = { get matches() { return (fineMQ.matches || sawMouse) && window.innerWidth >= 768; } };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TODAY = '2026-11-26';

  var LOGO = '<svg viewBox="100 800 4310 735" aria-hidden="true" fill="currentColor">' + B.line + '</svg>';
  function logos(root) { (root || document).querySelectorAll('[data-logo]').forEach(function (el) { if (!el.firstChild) el.innerHTML = LOGO; }); }
  logos();

  /* ---------- storage, with an in-memory fallback ---------- */
  var mem = {};
  function get(k, d) { try { var v = localStorage.getItem('wwA.' + k); return v ? JSON.parse(v) : (k in mem ? mem[k] : d); } catch (e) { return k in mem ? mem[k] : d; } }
  function set(k, v) { mem[k] = v; try { localStorage.setItem('wwA.' + k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- copy helpers ---------- */
  var mode = get('mode', 'original');
  var WALLET0 = { name: '5 class pass', total: 5, left: 3, expires: '2027-01-07' };
  var EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
  function T(v) { if (v == null) return ''; var t = typeof v === 'string' ? v : (mode === 'suggested' ? v.suggested : v.original); return t.replace(EMO, '').replace(/ {2,}/g, ' ').replace(/^ /gm, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function E(v) { return esc(T(v)); }
  function paras(s) { return String(s).split('\n').map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(''); }

  var DIM = { 'millie-portrait': [1067, 1600], 'millie-squat': [1067, 1600], 'two-women-dancing': [1600, 1068], 'dancer-balance': [1068, 1600], 'dancer-reach': [1068, 1600], 'dancer-forward-bend': [1068, 1600], 'dancer-arm-pose': [1067, 1600], 'group-laughing': [1600, 1067], 'social-brand-graphic': [756, 1326], 'social-high-five': [742, 1334], 'social-twerk-sweat-repeat': [1600, 879], 'twerkmas-poster': [1080, 1080], 'love-to-wine-still': [1600, 1115] };
  function pic(name, alt, o) {
    o = o || {}; var d = DIM[name] || [1600, 1067];
    return '<picture><source type="image/webp" srcset="img/' + name + '-800.webp 800w, img/' + name + '-1600.webp 1600w" sizes="' + (o.sizes || '100vw') + '">' +
      '<img src="img/' + name + '-1600.jpg" alt="' + esc(alt) + '" width="' + d[0] + '" height="' + d[1] + '"' + (o.eager ? ' fetchpriority="high"' : ' loading="lazy"') + (o.pos ? ' style="object-position:' + o.pos + '"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') + '></picture>';
  }
  var ALT = {
    'millie-portrait': 'Millie, the founder, sitting cross-legged on the wood studio floor in her orange WERKWELL tee',
    'millie-squat': 'Millie crouched low on the wood floor in her orange WERKWELL tee',
    'two-women-dancing': 'Two women dancing close in a Wednesday class, arms up',
    'dancer-balance': 'A dancer in a red top balancing on one leg on the wood floor',
    'dancer-reach': 'A dancer in a red top reaching one arm high, back arched',
    'dancer-forward-bend': 'A dancer in an orange tee bent forward, hands on knees',
    'dancer-arm-pose': 'A dancer in a red top holding an arm pose, one foot lifted',
    'group-laughing': 'About ten women laughing with their arms in the air',
    'social-brand-graphic': 'WERKWELL on a rolled sleeve: a dance community built by women, for women',
    'social-high-five': 'Two women high-fiving in class',
    'social-twerk-sweat-repeat': 'Twerk, sweat, repeat: a still from a class video',
    'twerkmas-poster': 'Twerkmas at WerkWell poster: Friday 18 December, 6 to 9pm, Fearless Fit Hub',
    'love-to-wine-still': 'Love to Wine workshop: a dancer in a mirrored studio'
  };
  function P(name, o) { return pic(name, ALT[name], o); }

  /* ---------- dates and places ---------- */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dt(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(s, long) { var d = dt(s); return (long ? DAYL : DAY)[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (long ? ' ' + d.getFullYear() : ''); }
  function t12(hm) { var h = +hm.slice(0, 2), m = hm.slice(3); return (h % 12 || 12) + (m === '00' ? '' : ':' + m) + (h < 12 ? 'am' : 'pm'); }

  var CLASSES = C.classes.items;
  var LIVE = CLASSES.filter(function (c) { return c.status === 'live'; });
  LIVE.forEach(function (c) { c.dates = c.dates.filter(function (d) { return d !== '2026-12-23' && d !== '2026-12-30'; }); });
  var EVENTS = C.events.items;
  var WEDS = LIVE[0].dates;
  /* sample demo data: places already taken */
  var TAKEN = {
    'dancehall-twerk': { '2026-12-02': 11, '2026-12-09': 8, '2026-12-16': 7, '2027-01-06': 6, '2027-01-13': 4, '2027-01-20': 2 },
    'pelvic-pilates': { '2026-12-02': 5, '2026-12-09': 10, '2026-12-16': 4, '2027-01-06': 3, '2027-01-13': 2, '2027-01-20': 1 },
    'twerkmas': { '2026-12-18': 14 }, 'love-to-wine': { '2027-02-28': 3 }
  };
  var PRIVATE = { id: 'private', name: C.classes.private.name, price: 70, length: '1 hour', knee_pads_addon: 10,
    slots: [['2026-12-05', '10:00'], ['2026-12-05', '11:30'], ['2026-12-08', '19:00'], ['2026-12-12', '10:00'], ['2026-12-15', '19:00'], ['2026-12-19', '11:30']] };
  function item(id) {
    if (id === 'private') return PRIVATE;
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].id === id) return CLASSES[i];
    for (var j = 0; j < EVENTS.length; j++) if (EVENTS[j].id === id) return EVENTS[j];
    return null;
  }
  function isEvent(it) { return !!it && EVENTS.indexOf(it) > -1; }
  function timeOf(it, date) {
    if (!it) return '';
    if (it.id === 'private') { for (var i = 0; i < PRIVATE.slots.length; i++) if (PRIVATE.slots[i][0] === date) return PRIVATE.slots[i][1]; return '10:00'; }
    return isEvent(it) ? it.start : it.timetable.time;
  }
  function bookings() { return get('bookings', []); }
  function placesLeft(id, date) {
    var it = item(id); if (!it || !it.capacity) return 99;
    var taken = (TAKEN[id] && TAKEN[id][date]) || 0;
    var mine = bookings().filter(function (b) { return b.item === id && b.date === date; }).length;
    return Math.max(0, it.capacity - taken - mine);
  }
  function placesLabel(n) { return n <= 0 ? 'Full' : n <= 5 ? n + (n === 1 ? ' place left' : ' places left') : 'Places open'; }

  /* ---------- shared bits ---------- */
  var ARR = '<span class="arr" aria-hidden="true">&rarr;</span>';
  var SPIN = '<span class="spin" aria-hidden="true"></span><span class="tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>';
  function btn(label, href, cls) { return '<a class="btn ' + (cls || '') + '" href="' + href + '"><span class="lbl">' + esc(label) + '</span>' + ARR + '</a>'; }
  function wSvg(cls) { return '<svg viewBox="-20 -560 740 600" aria-hidden="true" fill="currentColor"><path class="' + (cls || '') + '" d="' + B.w + '"/></svg>'; }
  var SOC = C.meta.socials;
  var MAP = 'https://www.google.co.uk/maps/place/WERKWELL+STUDIO/@51.9971226,-0.7155432,17z/data=!3m1!4b1!4m6!3m5!1s0x4877ab4086715f49:0xf21b8c4b7f3e3272!8m2!3d51.9971226!4d-0.7155432!16s%2Fg%2F11z2b1jqtl';
  var ADDR = '31 Wharfside, Fenny Stratford, Milton Keynes MK2 2AZ';

  function footer() {
    var f = C.footer;
    return '<footer class="foot" data-chapter="dark"><div class="card-back">' +
      '<a class="stamp" href="#/about" aria-label="Meet Millie">' + P('millie-portrait', { sizes: '88px' }) + '</a>' +
      '<div><h2>See you Wednesday</h2><p>' + E(f.blurb) + '</p><p>Classes run on Wednesday nights at Fearless Fit Hub. Women only, 18 and over.</p>' +
      '<div class="links"><a class="ul" href="#/classes">Classes</a><a class="ul" href="#/club">The Werk Club</a><a class="ul" href="#/events">Events</a><a class="ul" href="#/journal">Journal</a><a class="ul" href="#/about">About</a><a class="ul" href="#/hire">Private hire</a><a class="ul" href="#/contact">Contact</a></div></div>' +
      '<ul class="addr"><li><a class="ul" href="mailto:' + C.meta.email + '">' + C.meta.email + '</a></li>' +
      '<li><a class="ul" href="' + MAP + '" target="_blank" rel="noopener">' + ADDR + '</a></li>' +
      '<li><a class="ul" href="' + MAP + '" target="_blank" rel="noopener">5.0 on Google, 38 reviews</a></li>' +
      '<li><a class="ul" href="' + SOC.instagram.url + '" target="_blank" rel="noopener">Instagram ' + SOC.instagram.handle + '</a></li>' +
      '<li><a class="ul" href="' + SOC.tiktok.url + '" target="_blank" rel="noopener">TikTok ' + SOC.tiktok.handle + '</a></li>' +
      '<li><a class="ul" href="' + SOC.facebook.url + '" target="_blank" rel="noopener">Facebook ' + SOC.facebook.handle + '</a></li></ul>' +
      '<p class="imprint"><span>' + esc(f.bottom) + '</span><a class="ul" href="#/privacy">Privacy policy</a><a class="ul" href="#/studio">Studio login</a></p>' +
      '</div><div class="foot-name" aria-hidden="true" data-logo></div></footer>';
  }

  function timetableRows(date, dark) {
    var rows = LIVE.filter(function (c) { return c.dates.indexOf(date) > -1; }).map(function (c) {
      var n = placesLeft(c.id, date);
      var act = n > 0 ? btn('Book', '#/book?item=' + c.id + '&date=' + date, 'sm') : '<button class="btn sm ghost" type="button" data-waitlist="' + c.id + '|' + date + '"><span class="lbl">Join waitlist</span>' + SPIN + '</button>';
      return '<li class="row"><span class="when soft">' + fmt(date) + ', ' + c.timetable.time_label + ' &middot; ' + c.length + '</span><span class="what">' + esc(c.name) + '</span><span class="meta ' + (n <= 5 ? 'tag-low' : 'soft') + '">' + placesLabel(n) + (n <= 0 ? '. Join the waitlist.' : '') + '</span><span class="act">' + act + '</span></li>';
    });
    return '<ul class="rows" aria-live="polite">' + rows.join('') + '</ul>';
  }
  function dateChips(sel) {
    return '<div class="dates" role="group" aria-label="Choose a Wednesday">' + WEDS.map(function (d) {
      var x = dt(d); return '<button type="button" class="date" data-date="' + d + '" aria-pressed="' + (d === sel) + '"><span>' + DAY[x.getDay()] + '</span><b>' + x.getDate() + '</b><span>' + MON[x.getMonth()] + '</span></button>';
    }).join('') + '</div>';
  }
  function timetable(id, dark) {
    var sel = WEDS[0];
    return '<div class="tt ' + (dark ? 'dark' : '') + '" id="' + id + '" data-sel="' + sel + '">' + dateChips(sel) + '<div class="tt-rows">' + timetableRows(sel) + '</div><p class="note soft">Places shown are sample figures for this demo. No classes on 23 and 30 December.</p></div>';
  }

  function band(names, label) {
    return '<section class="band wrap" data-chapter="dark" aria-label="' + esc(label) + '">' + names.map(function (n, i) { return '<figure class="b' + i + ' zoom" data-rv="rise" style="--d:' + i * 80 + 'ms"><div class="frame">' + P(n, { sizes: '(min-width: 900px) 33vw, 50vw', pos: '50% 30%' }) + '</div><figcaption class="small soft">' + esc(ALT[n].split(',')[0]) + '</figcaption></figure>'; }).join('') + '</section>';
  }
  /* ---------- views ---------- */
  var V = {};

  V.home = function () {
    var h = C.home, tw = EVENTS[0], t = C.testimonials;
    var ways = h.three_ways.map(function (w, i) {
      var href = w.id === 'try' ? '#/book?pay=intro' : w.id === 'passes' ? '#/club#passes' : '#/club';
      var ph = ['millie-squat', 'dancer-arm-pose', 'social-high-five'][i];
      return '<a class="card zoom t' + (i + 1) + '" href="' + href + '"><div class="frame">' + P(ph, { sizes: '(min-width: 900px) 52vw, 100vw', pos: '50% 25%' }) + '</div><div class="panel"><div><h3>' + esc(w.title) + '</h3><span class="price">' + esc(w.price) + '</span></div><p>' + esc(w.text) + '</p></div></a>';
    }).join('');
    ways += '<a class="card zoom t4" href="#/events"><div class="frame">' + P('twerkmas-poster', { sizes: '(min-width: 900px) 52vw, 100vw', pos: '50% 40%' }) + '</div><div class="panel"><div><h3>Twerkmas</h3><span class="price">' + fmt(tw.date) + ', ' + tw.time_label + '</span></div><p>' + E(tw.poster_tagline) + ' The Christmas party, ' + tw.price_label + '.</p></div></a>';

    return '' +
    '<section class="hero" data-chapter="dark" aria-labelledby="h-home">' +
      '<div class="hero-panel">' + P('two-women-dancing', { eager: true, sizes: '(min-width: 900px) 84vw, 100vw' }) + '<div class="hero-scrim"></div>' +
        '<div class="hero-in"><span></span><h1 id="h-home" class="display"><span>' + (mode === 'suggested' ? 'Your Body.' : 'Your Body') + '</span><span>' + (mode === 'suggested' ? 'Your Bounce.' : 'Your Bounce') + '</span></h1>' +
        '<div class="hero-foot"><p>' + E(h.one_line) + '</p>' + btn('Book a Wednesday', '#/book') + '</div></div></div>' +
      '<nav class="swatches" aria-label="On this page">' +
        '<a class="sw1" href="#wednesdays"><span>This Wednesday</span>' + ARR + '</a>' +
        '<a class="sw2" href="#ways"><span>Three ways in</span>' + ARR + '</a>' +
        '<a class="sw3" href="#film"><span>Our story, on film</span>' + ARR + '</a>' +
        '<a class="sw4" href="#socials"><span>Follow us</span>' + ARR + '</a>' +
        '<a class="sw5" href="#news"><span>Be first to hear</span>' + ARR + '</a></nav>' +
    '</section>' +

    '<section class="cross wrap" data-chapter="dark" aria-labelledby="h-moves">' +
      '<h2 id="h-moves" data-rv>Come for the moves</h2>' +
      '<div class="frame big" data-rv="wipe">' + P('millie-squat', { sizes: '(min-width: 900px) 50vw, 75vw' }) + '</div>' +
      '<div class="txt" data-rv style="--d:80ms"><p class="lead">Stay for the mood. ' + E(h.about_heading) + '</p><p>' + E(h.about_body) + '</p>' + btn(T(C.about.cta.primary), '#/book', 'ghost') + '</div>' +
      '<div class="frame smallpic" data-rv="wipe" style="--d:120ms">' + P('dancer-arm-pose', { sizes: '(min-width: 900px) 30vw, 50vw', pos: '50% 30%' }) + '</div>' +
    '</section>' +

    '<section class="film sec wrap" id="film" data-chapter="dark" aria-labelledby="h-film" style="margin-top:var(--gap)">' +
      '<div class="film-grid"><div data-rv><h2 id="h-film" class="head">Our story</h2><p>Millie\'s film about WERK WELL, shot in the studio. ' + C.meta.video.length + '.</p><p class="soft small">Scroll on and it follows you in the corner.</p></div>' +
      '<div class="film-slot" data-rv style="--d:80ms"><img class="still" src="media/our-story-poster.jpg" alt="" width="1280" height="720" loading="lazy"><span class="still-note">Playing in the corner</span><div class="player" id="player">' +
        '<img class="poster" src="media/our-story-poster.jpg" alt="Millie in her orange WERKWELL tee, arms raised, in the studio" width="1280" height="720" loading="lazy">' +
        '<button class="play" type="button" id="playBtn" aria-label="Play the film, Our Story"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg></button>' +
        '<button class="sound" type="button" id="soundBtn" hidden><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>Tap for sound</button>' +
        '<div class="dock-ctrl"><button type="button" id="dockUp" aria-label="Back to the film"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12L12 2M5 2h7v7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><button type="button" id="dockX" aria-label="Close the small player"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5"/></svg></button></div>' +
      '</div></div></div>' +
    '</section>' +

    '<section class="list-sec sec wrap on-paper" id="wednesdays" data-chapter="light" aria-labelledby="h-weds">' +
      '<h2 id="h-weds" data-rv><span class="ind">Wednesday nights</span><br>at Wharfside</h2>' +
      '<div class="list-grid"><div class="frame lp" data-rv="wipe">' + P('dancer-balance', { sizes: '(min-width: 900px) 30vw, 60vw', pos: '50% 30%' }) + '</div><span class="lword small soft hide-sm" data-rv>Timetable</span>' +
      '<div data-rv style="--d:80ms">' + timetable('ttHome') + '</div></div>' +
    '</section>' +

    '<section class="show" id="ways" data-chapter="dark" aria-labelledby="h-ways"><div class="show-stage">' +
      '<div class="show-bg">' + P('dancer-forward-bend', { sizes: '100vw', pos: '50% 80%' }) + '</div>' +
      '<h2 id="h-ways">' + esc(h.three_ways_heading) + '</h2>' +
      '<div class="track" id="track">' + ways + '</div>' +
    '</div></section>' +

    '<section class="quote" data-chapter="dark" aria-labelledby="h-words">' + P('group-laughing', { sizes: '100vw', cls: 'bgimg', pos: '50% 40%' }) +
      '<div class="quote-in"><div><h2 id="h-words" data-rv>' + E(h.testimonials_heading) + '</h2>' +
        '<blockquote data-rv><p>&ldquo;' + esc(t[1].quote) + '&rdquo;</p><cite>' + esc(t[1].name) + ', ' + esc(t[1].place) + '</cite></blockquote><p style="margin-top:32px"><a class="rating ul" href="' + MAP + '" target="_blank" rel="noopener"><b>5.0</b> on Google, 38 reviews</a></p></div>' +
        '<div class="others"><blockquote data-rv style="--d:80ms"><p>&ldquo;' + esc(t[0].quote) + '&rdquo;</p><cite>' + esc(t[0].name) + ', ' + esc(t[0].place) + '</cite></blockquote>' +
        '<blockquote data-rv style="--d:160ms"><p>&ldquo;' + esc(t[2].quote) + '&rdquo;</p><cite>' + esc(t[2].name) + ', ' + esc(t[2].place) + '</cite></blockquote>' +
        '</div></div>' +
    '</section>' +

    '<section class="gal sec wrap" id="socials" data-chapter="dark" aria-labelledby="h-soc">' +
      '<div class="gal-head"><h2 id="h-soc" data-rv>' + E(h.socials_heading) + '</h2><p class="soft" data-rv style="--d:80ms">' + E(h.socials_sub) + '</p></div>' +
      '<div class="stagger">' +
        '<a class="tile zoom s1" data-rv="rise" href="' + SOC.instagram.url + '" target="_blank" rel="noopener"><div class="frame">' + P('social-brand-graphic', { sizes: '(min-width: 900px) 33vw, 66vw' }) + '<span class="reveal"><span>Open Instagram</span>' + ARR + '</span></div><span class="cap"><span>Instagram</span><span class="soft">' + SOC.instagram.handle + '</span></span></a>' +
        '<a class="tile zoom s2" data-rv="rise" href="' + SOC.tiktok.url + '" target="_blank" rel="noopener"><div class="frame">' + P('social-high-five', { sizes: '(min-width: 900px) 50vw, 75vw', pos: '50% 20%' }) + '<span class="reveal"><span>Open TikTok</span>' + ARR + '</span></div><span class="cap"><span>TikTok</span><span class="soft">' + SOC.tiktok.handle + '</span></span></a>' +
        '<a class="tile zoom s3" data-rv="rise" href="' + SOC.facebook.url + '" target="_blank" rel="noopener"><div class="frame">' + P('social-twerk-sweat-repeat', { sizes: '(min-width: 900px) 50vw, 60vw' }) + '<span class="reveal"><span>Open Facebook</span>' + ARR + '</span></div><span class="cap"><span>Facebook</span><span class="soft">' + SOC.facebook.handle + '</span></span></a>' +
        '<a class="tile zoom s4" data-rv="rise" href="#/classes"><div class="frame">' + P('dancer-reach', { sizes: '(min-width: 900px) 25vw, 100vw' }) + '<span class="reveal"><span>See the classes</span>' + ARR + '</span></div><span class="cap"><span>Stretch &amp; Flow, joining the timetable soon</span></span></a>' +
        '<a class="tile zoom s5" data-rv="rise" href="#/events"><div class="frame">' + P('love-to-wine-still', { sizes: '(min-width: 900px) 33vw, 80vw' }) + '<span class="reveal"><span>See the workshop</span>' + ARR + '</span></div><span class="cap"><span>Love to Wine, Sunday 28 February</span></span></a>' +
        '<a class="tile zoom s6" data-rv="rise" href="#/about"><div class="frame">' + P('millie-portrait', { sizes: '(min-width: 900px) 50vw, 66vw', pos: '50% 30%' }) + '<span class="reveal"><span>Meet Millie</span>' + ARR + '</span></div><span class="cap"><span>Millie, founder of WERK WELL</span></span></a>' +
      '</div>' +
    '</section>' +

    '<section class="cta" id="news" data-chapter="dark" aria-labelledby="h-news"><div class="cta-pic">' + P('dancer-balance', { sizes: '100vw' }) + '</div>' +
      '<div class="cta-txt"><div data-rv="rise"><h2 id="h-news">' + esc(h.newsletter.heading) + '</h2><p>' + esc(h.newsletter.text) + '</p>' + newsForm(h.newsletter) + '</div></div>' +
    '</section>' + footer();
  };

  function newsForm(n) {
    return '<form class="inline-form" data-form="news" novalidate><label class="vh" for="nl-' + n.button + '">Email</label><input id="nl-' + n.button + '" type="email" name="email" autocomplete="email" placeholder="' + esc(n.placeholder || 'Enter your email') + '" required>' +
      '<button class="btn" type="submit"><span class="lbl">' + esc(n.button) + '</span>' + SPIN + '</button><p class="err" aria-live="polite"></p></form><p class="small soft">' + esc(C.home.newsletter.consent) + '</p>';
  }

  V.classes = function () {
    var k = C.classes;
    var cards = CLASSES.map(function (c, i) {
      var live = c.status === 'live';
      var drawer = '<p>' + E(c.description) + '</p>' + (live ?
        (function () { var nd = c.dates.filter(function (d) { return d >= TODAY && placesLeft(c.id, d) > 0; })[0] || c.dates[0], n = placesLeft(c.id, nd);
          return '<p class="xprice"><span>' + c.price_label + '</span> a class, or use a pass</p><p class="small">Next: ' + fmt(nd, true) + ', ' + c.timetable.time_label + ' &middot; <span class="' + (n <= 5 ? 'tag-low' : 'soft') + '">' + placesLabel(n) + '</span></p>' + btn('Book ' + fmt(nd), '#/book?item=' + c.id + '&date=' + nd); })() :
        '<p class="small soon">' + esc(c.status_label) + '</p><form class="inline-form" data-form="tell" novalidate><label class="vh" for="tm-' + c.id + '">Email for ' + esc(c.name) + '</label><input id="tm-' + c.id + '" type="email" placeholder="Your email" required><button class="btn sm" type="submit"><span class="lbl">' + esc(k.tell_me_when.button) + '</span>' + SPIN + '</button><p class="err" aria-live="polite"></p></form>');
      return '<li class="xcard" data-rv style="--d:' + (i * 70) + 'ms"><div class="xc" tabindex="0" role="button" aria-expanded="false" aria-label="' + esc(c.name) + ', more about this class">' +
        '<div class="frame">' + P(c.photo, { sizes: '(min-width: 900px) 25vw, 100vw', pos: '50% 30%' }) + '</div>' +
        '<div class="xhead"><h3>' + esc(c.name) + '</h3><span class="xmeta">' + esc(c.intensity_note) + ' &middot; ' + esc(c.length) + (live ? '' : ' &middot; Soon') + '</span></div>' +
        '<div class="drawer"><div><div class="dinner"><p class="xname">' + esc(c.name) + '</p>' + drawer + '</div></div></div></div></li>';
    }).join('');
    var prices = k.prices.map(function (p) { return '<li><span class="pn">' + esc(p.name) + '</span><span class="pp">' + esc(p.price_label) + '</span><span class="pd">' + esc(p.detail) + '</span></li>'; }).join('');
    var faq = C.faq.items.map(function (q, i) { return '<div class="qa"><button type="button" aria-expanded="false" aria-controls="qa' + i + '"><span>' + E(q.q) + '</span><span class="chev" aria-hidden="true"></span></button><div class="ans" id="qa' + i + '"><div><p>' + E(q.a) + '</p></div></div></div>'; }).join('');
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-cl">' + P('millie-squat', { eager: true, pos: '50% 30%' }) +
      '<div class="phead-in"><h1 id="h-cl">' + E(k.heading) + '</h1><p>' + E(k.sub) + '</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-four"><div><h2 id="h-four" class="sec-h" data-rv>' + E(C.home.classes_heading) + '</h2><p class="lead" data-rv style="--d:80ms">Four classes, ' + E(k.all_levels).toLowerCase() + '. Two run every Wednesday now, two are joining the timetable soon.</p></div>' +
        '<ul class="xcards" id="xcards" style="list-style:none;padding:0">' + cards + '</ul></section>' +
      '<section class="sec wrap on-paper" data-chapter="light" aria-labelledby="h-tt"><div class="split"><div><h2 id="h-tt" class="sec-h" data-rv>' + esc(k.timetable_heading) + '</h2><p data-rv>' + esc(k.timetable_note) + ' ' + ADDR + '.</p>' +
        '<div class="frame" style="aspect-ratio:4/3;margin-top:24px" data-rv="wipe">' + P('two-women-dancing', { sizes: '(min-width: 900px) 40vw, 100vw' }) + '</div></div><div data-rv style="--d:80ms">' + timetable('ttClasses') + '</div></div></section>' +
      '<section class="first sec wrap" data-chapter="dark" aria-labelledby="h-first"><div class="split"><div><h2 id="h-first" class="sec-h" data-rv>Your first visit</h2><p class="lead" data-rv>Women only, 18 and over. Everyone in the room has booked, so nobody watches from the side.</p></div>' +
        '<ul><li data-rv><h3>What to wear</h3><p>' + E(C.faq.items[1].a) + '</p></li><li data-rv style="--d:70ms"><h3>What to expect</h3><p>Proper twerk technique and easy combos to Afrobeat, Dancehall, R&amp;B and Reggaeton. Modifications for every fitness level; you go at your own pace.</p></li>' +
        '<li data-rv style="--d:140ms"><h3>Phones off, no filming</h3><p>Nobody films without permission, and your face is never shown unless you say yes when you book.</p></li><li data-rv style="--d:210ms"><h3>Arriving</h3><p>Come 5 to 7 minutes early. More than 10 minutes late and you may not be let in. Questions first? Email <a class="ulr" href="mailto:' + C.meta.email + '">' + C.meta.email + '</a>.</p></li></ul></div></section>' +
      '<section class="sec wrap" id="prices" data-chapter="dark" aria-labelledby="h-pr"><div class="split rev"><div><h2 id="h-pr" class="sec-h" data-rv>' + esc(k.prices_heading) + '</h2><ul class="ptable" data-rv>' + prices + '</ul><p class="small soft" style="margin-top:16px">Knee pads are a ' + k.addons[0].price_label + ' add-on for Dancehall &amp; Twerk, Pelvic Pilates and private sessions.</p></div>' +
        '<div class="sticky-pic"><h2 class="sec-h" data-rv>' + esc(k.private.name) + '</h2><div class="frame" style="aspect-ratio:4/5" data-rv="wipe">' + P('millie-portrait', { sizes: '(min-width: 900px) 40vw, 100vw', pos: '50% 35%' }) + '</div><p style="margin-top:20px">' + E(k.private.description) + '</p><p class="soft">' + k.private.length + ', ' + k.private.price_label + '. Times are agreed with Millie.</p>' + btn('Book a private session', '#/book?item=private') + '</div></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-faq" style="background:var(--bg-2)"><div class="split"><h2 id="h-faq" class="sec-h" data-rv>' + E(C.faq.heading) + '</h2><p data-rv>' + E(C.faq.sub) + '</p></div><div class="faq" style="margin-top:40px">' + faq + '</div></section>' + footer();
  };

  V.club = function () {
    var k = C.club, t0 = k.tiers[0], t1 = k.tiers[1];
    var passes = C.classes.prices.filter(function (p) { return /intro|pass5|pass10/.test(p.id); });
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-club">' + P('group-laughing', { eager: true, pos: '50% 40%' }) +
      '<div class="phead-in"><h1 id="h-club">' + esc(k.heading) + '</h1><p>' + esc(k.tagline) + '</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-tiers"><div class="split"><h2 id="h-tiers" class="sec-h" data-rv>' + E(k.poster_tagline) + '</h2><p class="lead" data-rv style="--d:80ms">' + E(k.poster_line) + ' ' + esc(k.intro) + '</p></div>' +
      '<div class="tiers">' +
        '<article class="tier main" data-rv><h3>' + esc(t0.name) + '</h3><p class="tp">£79<small> a month</small></p><ul><li>' + esc(t0.classes) + '</li><li>Booking opens ' + esc(t0.booking_opens) + '</li><li>' + esc(t0.events_discount) + '</li><li>One guest place a month: your friend books free with your code</li><li>' + esc(t0.extras) + '</li><li>' + esc(t0.minimum) + '</li></ul>' +
          '<button class="btn" type="button" data-request="club"><span class="lbl">Request your place</span>' + ARR + '</button><p class="small" style="margin:0">Places on the full club are offered from the list, in order.</p></article>' +
        '<article class="tier" data-rv style="--d:80ms"><h3>' + esc(t1.name) + '</h3><p class="tp">£44<small> a month</small></p><ul><li>' + esc(t1.classes) + '</li><li>Booking opens ' + esc(t1.booking_opens) + '</li><li>' + esc(t1.events_discount) + '</li><li>' + esc(t1.extras) + '</li><li>' + esc(t1.minimum) + '</li></ul>' +
          '<button class="btn light" type="button" data-buy="four"><span class="lbl">Join Werk Club Four</span>' + ARR + '</button></article>' +
      '</div><div class="founding" data-rv><h3>' + esc(k.founding.heading) + '</h3><p>' + esc(k.founding.text) + '</p></div></section>' +
      '<section class="sec wrap" id="passes" data-chapter="dark" aria-labelledby="h-pass" style="background:var(--bg-2)"><div class="split rev"><div><h2 id="h-pass" class="sec-h" data-rv>' + esc(k.passes_heading) + '</h2><p data-rv>' + esc(k.passes_text) + '</p>' +
        '<ul class="ptable" data-rv>' + passes.map(function (p) { return '<li><span class="pn">' + esc(p.name) + '</span><span class="pp">' + esc(p.price_label) + '</span><span class="pd">' + esc(p.detail) + '</span><span style="grid-column:1/-1;margin-top:8px"><button class="btn sm ghost" type="button" data-buy="' + p.id + '"><span class="lbl">Buy ' + esc(p.name.toLowerCase()) + '</span>' + ARR + '</button></span></li>'; }).join('') + '</ul></div>' +
        '<div class="frame" style="aspect-ratio:4/5" data-rv="wipe">' + P('social-high-five', { sizes: '(min-width: 900px) 40vw, 100vw', pos: '50% 20%' }) + '</div></div></section>' + band(['dancer-reach', 'two-women-dancing', 'millie-squat'], 'Members in the studio') + footer();
  };

  V.events = function () {
    var e = EVENTS;
    function block(ev, i) {
      var n = placesLeft(ev.id, ev.date);
      return '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-ev' + i + '"' + (i ? ' style="background:var(--bg-2)"' : '') + '><div class="ev' + (i ? ' rev' : '') + '"><div class="ev-pic"><div class="frame" data-rv="wipe">' + P(ev.photo, { sizes: '(min-width: 900px) 50vw, 100vw' }) + '</div></div>' +
        '<div><h2 id="h-ev' + i + '" data-rv>' + esc(ev.short_name) + '</h2><p class="facts" data-rv><span><b>' + fmt(ev.date, true) + '</b></span><span>' + t12(ev.start) + ' to ' + t12(ev.end) + '</span><span>' + ev.price_label + '</span><span>' + esc(ev.venue) + '</span></p>' +
        (ev.highlights ? '<ul class="chips" data-rv>' + ev.highlights.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<div data-rv style="--d:80ms">' + paras(T(ev.description)) + '</div><p class="small ' + (n <= 5 ? 'tag-low' : 'soft') + '">' + placesLabel(n) + ' (sample figure). ' + esc(C.events.member_discount_note) + '</p>' + btn('Book ' + ev.short_name, '#/book?item=' + ev.id) + '</div></div></section>';
    }
    return '<section class="phead plain" data-chapter="dark" aria-labelledby="h-evs"><div class="phead-in"><h1 id="h-evs">' + esc(C.events.heading) + '</h1><p>' + esc(C.events.sub) + '</p></div></section>' + e.map(block).join('') + band(['group-laughing', 'social-high-five', 'dancer-arm-pose'], 'Past nights at WERK WELL') + footer();
  };

  V.journal = function (id) {
    var J = C.journal;
    if (id) {
      var a = J.articles.filter(function (x) { return x.id === id; })[0];
      if (!a) return V.journal();
      var extra = ['two-women-dancing', 'dancer-arm-pose', 'group-laughing', 'dancer-reach'].filter(function (n) { return n !== a.photo; }), hn = 0;
      var body = a.body.map(function (b) { if (b.type === 'h') { hn++; var fig = (hn === 2 || hn === 4) ? '<figure class="afig" data-rv="rise"><div class="frame">' + P(extra[hn === 2 ? 0 : 1], { sizes: '(min-width: 900px) 720px, 100vw' }) + '</div></figure>' : ''; return fig + '<h2>' + esc(b.text) + '</h2>'; } return '<p>' + esc(b.text) + '</p>'; }).join('');
      return '<section class="phead" data-chapter="dark" aria-labelledby="h-art">' + P(a.photo, { eager: true, pos: '50% 30%' }) + '<div class="phead-in"><h1 id="h-art" class="long">' + esc(a.title) + '</h1><p>' + esc(a.summary) + ' By ' + esc(a.author) + ', ' + a.read_minutes + ' minute read.</p></div></section>' +
        '<article class="sec wrap" data-chapter="dark"><div class="article">' + body +
        '<div class="panel" style="margin-top:56px"><h2 style="margin:0">' + esc(J.newsletter.text) + '</h2>' + newsForm({ button: J.newsletter.button, placeholder: 'Enter your email' }) + '</div>' +
        '<p style="margin-top:40px"><a class="ul" href="#/journal">&larr; All journal posts</a></p></div></article>' + band([extra[2]], 'Picture') + footer();
    }
    var list = J.articles.map(function (a, i) {
      return '<a class="jcard zoom j' + (i + 1) + '" href="#/journal/' + a.id + '" data-rv style="--d:' + i * 80 + 'ms"><div class="frame">' + P(a.photo, { sizes: '(min-width: 900px) 50vw, 100vw', pos: '50% 30%' }) + '<span class="reveal"><span>Read the article</span>' + ARR + '</span></div><h2>' + esc(a.title) + '</h2><p>' + esc(a.summary) + ' ' + a.read_minutes + ' minute read.</p></a>';
    }).join('');
    return '<section class="phead plain" data-chapter="dark" aria-labelledby="h-jn"><div class="phead-in"><h1 id="h-jn">' + esc(J.heading) + '</h1><p>Notes from Millie, founder of WERK WELL: what happens in class, and why the studio is run the way it is.</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-label="Posts"><div class="jlist">' + list + '</div></section>' + band(['dancer-reach', 'two-women-dancing', 'millie-portrait'], 'From the studio') +
      '<section class="sec wrap on-paper" data-chapter="light" aria-labelledby="h-jnl"><div class="split"><h2 id="h-jnl" class="sec-h" data-rv>Get the next one</h2><div data-rv>' + '<p>' + esc(J.newsletter.text) + '</p>' + newsForm({ button: J.newsletter.button, placeholder: 'Enter your email' }) + '</div></div></section>' + footer();
  };

  V.about = function () {
    var A = C.about;
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-ab">' + P('dancer-balance', { eager: true, pos: '50% 30%' }) + '<div class="phead-in"><h1 id="h-ab">' + E(A.page_header) + '</h1><p>' + E(A.experience[0]) + '</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-mis"><div class="split"><h2 id="h-mis" class="sec-h" data-rv>' + E(A.mission_heading) + '</h2><p class="lead" data-rv>' + E(A.mission) + '</p></div>' +
        '<div class="split" style="margin-top:64px"><div class="frame" style="aspect-ratio:3/2" data-rv="wipe">' + P('two-women-dancing', { sizes: '(min-width: 900px) 40vw, 100vw' }) + '</div><div data-rv><h3 class="head" style="font-size:2rem;margin-bottom:16px">' + E(A.experience_heading) + '</h3>' + A.experience.slice(1).map(function (p) { return '<p>' + E(p) + '</p>'; }).join('') + '</div></div>' +
        '<div class="pillars" style="margin-top:64px">' + A.pillars.map(function (p, i) { return '<div data-rv style="--d:' + i * 80 + 'ms"><h3>' + E(p.title) + '</h3><p>' + E(p.text) + '</p></div>'; }).join('') + '</div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-mm" style="background:var(--f3)"><div class="split"><div class="sticky-pic"><div class="frame" style="aspect-ratio:2/3" data-rv="wipe">' + P('millie-portrait', { sizes: '(min-width: 900px) 40vw, 100vw' }) + '</div></div>' +
        '<div class="millie-text"><h2 id="h-mm" class="sec-h" data-rv>' + E(A.meet_heading) + '</h2>' + A.millie.map(function (p, i) { return '<p' + (i === 0 ? ' class="lead"' : '') + '>' + E(p) + '</p>'; }).join('') + '</div></div></section>' +
      '<section class="sec wrap on-paper" data-chapter="light" aria-labelledby="h-inc"><div class="split"><h2 id="h-inc" class="sec-h" data-rv>' + E(A.inclusivity_heading) + '</h2><div data-rv>' + A.inclusivity.map(function (p) { return '<p class="lead">' + E(p) + '</p>'; }).join('') + '<p><a class="ul" href="#/journal/women-only-safe-space">Read Millie on why the studio is women-only &rarr;</a></p></div></div></section>' +
      band(['group-laughing', 'dancer-reach', 'social-brand-graphic'], 'The community') + '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-go"><div class="split"><h2 id="h-go" class="sec-h" data-rv>' + E(A.cta.heading) + '</h2><div data-rv><p class="lead">' + E(A.cta.text) + '</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + btn(T(A.cta.primary), '#/book') + btn(T(A.cta.secondary), '#/contact', 'ghost') + '</div></div></div></section>' + footer();
  };

  V.contact = function () {
    var K = C.contact, f = K.form;
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-ct">' + P('group-laughing', { eager: true, pos: '50% 45%' }) + '<div class="phead-in"><h1 id="h-ct">' + E(K.heading) + '</h1><p>' + E(K.sub) + '</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-cf"><div class="split rev"><form class="cform" data-form="contact" novalidate style="display:grid;gap:16px"><h2 id="h-cf" class="sec-h">' + E(f.heading) + '</h2>' +
        fld('c-name', f.name, 'text', 'name') + fld('c-email', f.email, 'email', 'email') +
        '<div class="field"><label for="c-sub">' + esc(f.subject) + '</label><select id="c-sub">' + f.subject_options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="c-msg">' + esc(f.message) + '</label><textarea id="c-msg" required></textarea></div>' +
        '<p class="small soft" style="margin:0">' + esc(f.demo_note) + '</p><button class="btn" type="submit"><span class="lbl">' + esc(f.send) + '</span>' + SPIN + '</button><p class="err" aria-live="polite"></p></form>' +
        '<div><h2 class="sec-h">' + E(K.location_heading) + '</h2><ul class="blist" style="font-size:1rem"><li><b>Email</b><a class="ul" href="mailto:' + K.email + '">' + K.email + '</a></li><li><b>Studio</b><a class="ul" href="' + MAP + '" target="_blank" rel="noopener">Fearless Fit Hub, ' + ADDR.replace('31 Wharfside, ', '31 Wharfside, ') + '</a></li><li><b>Classes</b><span>Wednesdays, 6:15pm and 7:15pm</span></li>' +
        '<li><b>Instagram</b><a class="ul" href="' + SOC.instagram.url + '" target="_blank" rel="noopener">' + SOC.instagram.handle + '</a></li><li><b>TikTok</b><a class="ul" href="' + SOC.tiktok.url + '" target="_blank" rel="noopener">' + SOC.tiktok.handle + '</a></li><li><b>Facebook</b><a class="ul" href="' + SOC.facebook.url + '" target="_blank" rel="noopener">' + SOC.facebook.handle + '</a></li></ul>' +
        '<p style="margin-top:24px">' + btn('Open in Google Maps', MAP, 'ghost').replace('<a ', '<a target="_blank" rel="noopener" ') + '</p></div></div></section>' + band(['two-women-dancing', 'millie-portrait', 'dancer-balance'], 'The studio at Fearless Fit Hub') + footer();
  };
  function fld(id, label, type, ac) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + type + '"' + (ac ? ' autocomplete="' + ac + '"' : '') + ' required></div>'; }

  V.hire = function () {
    var pv = C.classes.private;
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-hire">' + P('social-high-five', { eager: true, pos: '50% 25%' }) + '<div class="phead-in"><h1 id="h-hire">Private hire</h1><p>Hen parties, birthdays and nights out: the studio and Millie, just for your group.</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-hf"><div class="split"><div><h2 id="h-hf" class="sec-h" data-rv>Tell us about your group</h2><p data-rv>Send the date, how many of you are coming and your budget. Millie replies by email with what she can put together. Groups are women only, 18 and over, and everyone fills in the same short wellness check.</p></div>' +
        '<form data-form="hire" novalidate style="display:grid;gap:16px">' + fld('h-name', 'Your name', 'text', 'name') + fld('h-email', 'Email', 'email', 'email') +
        '<div class="field"><label for="h-occ">What is it for?</label><select id="h-occ"><option>Hen party</option><option>Birthday</option><option>Night out with friends</option><option>Work or team social</option><option>Something else</option></select></div>' +
        '<div class="field"><label for="h-date">Preferred date</label><input id="h-date" type="date" min="2026-11-27" required></div>' +
        '<div class="field"><label for="h-size">Group size</label><select id="h-size"><option>4 to 8</option><option>9 to 15</option><option>16 to 23</option></select></div>' +
        '<div class="field"><label for="h-bud">Budget for the group</label><select id="h-bud"><option>Under £200</option><option>£200 to £350</option><option>£350 to £500</option><option>Over £500</option></select></div>' +
        '<div class="field"><label for="h-msg">Anything else (optional)</label><textarea id="h-msg"></textarea></div>' +
        '<p class="small soft" style="margin:0">Demo only. Nothing is sent.</p><button class="btn" type="submit"><span class="lbl">Send enquiry</span>' + SPIN + '</button><p class="err" aria-live="polite"></p></form></div></section>' +
      '<section class="sec wrap on-paper" data-chapter="light" aria-labelledby="h-1to1"><div class="split rev"><div><h2 id="h-1to1" class="sec-h" data-rv>' + esc(pv.name) + '</h2><p class="lead" data-rv>' + E(pv.description) + '</p><p>' + pv.length + ', ' + pv.price_label + '. Knee pads +£10.</p>' + btn('Book a private session', '#/book?item=private') + '</div>' +
        '<div class="frame" style="aspect-ratio:4/5" data-rv="wipe">' + P('millie-portrait', { sizes: '(min-width: 900px) 40vw, 100vw' }) + '</div></div></section>' + band(['group-laughing', 'social-high-five', 'dancer-forward-bend'], 'Group nights') + footer();
  };

  V.privacy = function () {
    var p = C.policies;
    return '<section class="phead" data-chapter="dark" aria-labelledby="h-pv">' + P('dancer-forward-bend', { eager: true, pos: '50% 40%' }) + '<div class="phead-in"><h1 id="h-pv">' + esc(p.privacy.link_label) + '</h1><p>' + esc(p.privacy.summary) + '</p></div></section>' +
      '<section class="sec wrap" data-chapter="dark" aria-labelledby="h-pol"><div class="split"><h2 id="h-pol" class="sec-h">' + esc(p.heading) + '</h2><ul class="ptable">' + p.items.map(function (x) { return '<li><span class="pn">' + esc(x.title) + '</span><span class="pd">' + esc(x.text) + '</span></li>'; }).join('') + '</ul></div><p style="margin-top:32px">Questions about your data: <a class="ul" href="mailto:' + p.privacy.contact + '">' + p.privacy.contact + '</a></p></section>' + band(['millie-squat', 'two-women-dancing', 'dancer-reach'], 'In class') + footer();
  };

  /* ---------- BOOK ---------- */
  var bk = null;
  function bookSteps(it) {
    var s = ['Choose', 'Date', 'Pay', 'Your details', 'Wellness check', 'Photos', 'Confirm'];
    if (it && isEvent(it)) s.splice(1, 1);
    return s;
  }
  function priceOf(b) {
    var it = item(b.item); if (!it) return 0;
    var base = { single: it.price, intro: 29, pass5: 58, pass10: 105, wallet: 0, member: 0 }[b.pay];
    if (base == null) base = it.price;
    if (isEvent(it) && b.pay === 'member') base = Math.round(it.price * (1 - planDiscount()) * 100) / 100;
    return base + (b.pads ? 10 : 0);
  }
  function planDiscount() { var p = get('plan', null); return p ? (p.id === 'club' ? 0.10 : 0.05) : 0; }
  function money(n) { return '£' + (n % 1 ? n.toFixed(2) : n); }
  var PAYNAMES = { single: 'Pay as you go', wallet: 'Class pass credit', intro: 'Intro pass, 3 classes', pass5: '5 class pass', pass10: '10 class pass', member: 'Werk Club plan' };

  V.book = function (q) {
    var it = item(q.item);
    if (!bk || q.item || q.pay || q.fresh) {
      var me = get('me', {});
      bk = { item: it ? it.id : null, date: q.date || (it && isEvent(it) ? it.date : null), pay: q.pay === 'intro' ? 'intro' : null, pads: false, step: 0,
        name: me.name || '', email: me.email || '', mobile: me.mobile || '', ec_name: '', ec_phone: '', injury: 'no', injury_detail: '', pregnant: 'no', agree: false, photo: '', marketing: '', terms: false };
      if (it) bk.step = 1;
      if (it && bk.date && isEvent(it)) bk.step = 1;
      if (it && bk.date && !isEvent(it)) bk.step = 2;
    }
    return '<section class="app" data-chapter="dark" aria-labelledby="h-bk"><h1 id="h-bk">' + esc(C.book.heading) + '</h1><p class="app-sub">Classes, events and private sessions at Fearless Fit Hub, Fenny Stratford.</p>' +
      '<div class="book-grid"><div id="bkStep"></div><aside class="summary" id="bkSum" aria-label="Your booking"></aside></div></section>';
  };
  function renderBook(dir) {
    var host = document.getElementById('bkStep'); if (!host) return;
    var it = item(bk.item), steps = bookSteps(it), name = steps[bk.step];
    var h = '<div class="progress" style="--n:' + steps.length + ';--p:' + ((bk.step + 1) / steps.length) + '">' + steps.map(function () { return '<i></i>'; }).join('') + '<span class="fill"></span></div>' +
      '<p class="stepname"><span>' + esc(name) + '</span><span>' + (bk.step + 1) + ' of ' + steps.length + '</span></p><div class="step' + (dir < 0 ? ' back' : '') + '">';
    if (name === 'Choose') {
      var opts = LIVE.map(function (c) { return [c.id, c.name, c.timetable.day + 's ' + c.timetable.time_label + ', ' + c.length, c.price_label]; })
        .concat(EVENTS.map(function (e) { return [e.id, e.short_name, fmt(e.date) + ', ' + t12(e.start) + ', ' + e.length, e.price_label]; }))
        .concat([['private', PRIVATE.name, '1 hour, time agreed with Millie', '£70']]);
      h += '<h2>' + esc(C.book.choose_label) + '</h2><div class="choices" role="radiogroup">' + opts.map(function (o) {
        return '<label class="choice"><input type="radio" name="bkItem" value="' + o[0] + '"' + (bk.item === o[0] ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>' + esc(o[1]) + '</b><span class="small soft">' + esc(o[2]) + '</span></span><span class="c-price">' + o[3] + '</span></label>';
      }).join('') + '</div><p class="small soft" style="margin:0">Bounce &amp; Burn and Stretch &amp; Flow are joining the timetable soon. <a class="ulr" href="#/classes">Tell me when</a>.</p>';
    } else if (name === 'Date') {
      if (it.id === 'private') {
        h += '<h2>Pick a time</h2><div class="choices">' + PRIVATE.slots.map(function (s) { return '<label class="choice"><input type="radio" name="bkDate" value="' + s[0] + '|' + s[1] + '"' + (bk.date === s[0] && bk.time === s[1] ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>' + fmt(s[0], true) + '</b><span class="small soft">' + t12(s[1]) + ', 1 hour</span></span></label>'; }).join('') + '</div><p class="small soft" style="margin:0">Sample times for the demo. Millie confirms every private session by email.</p>';
      } else {
        h += '<h2>Pick your Wednesday</h2><div class="dark">' + '<div class="dates" role="radiogroup" aria-label="Dates">' + it.dates.map(function (d) {
          var x = dt(d), n = placesLeft(it.id, d);
          return '<button type="button" class="date" data-pick="' + d + '" aria-pressed="' + (bk.date === d) + '"><span>' + DAY[x.getDay()] + '</span><b>' + x.getDate() + '</b><span>' + MON[x.getMonth()] + '</span></button>';
        }).join('') + '</div></div>';
        if (bk.date) { var n = placesLeft(it.id, bk.date); h += '<p class="lead" style="margin:0">' + fmt(bk.date, true) + ', ' + it.timetable.time_label + '. <span class="' + (n <= 5 ? 'tag-low' : 'soft') + '">' + placesLabel(n) + (n <= 0 ? '. ' : '.') + '</span></p>' + (n <= 0 ? '<p class="small soft" style="margin:0">This class is full. Join the waitlist and we will email you if a place opens.</p>' : ''); }
        h += '<p class="small soft" style="margin:0">Places shown are sample figures for this demo.</p>';
      }
    } else if (name === 'Pay') {
      var w = get('wallet', WALLET0), plan = get('plan', null), ev = isEvent(it), pr = it.price;
      var po = [['single', ev ? 'Pay for this event' : 'Single ' + (it.id === 'private' ? 'session' : 'class'), money(pr)]];
      if (!ev && it.id !== 'private') {
        if (w && w.left > 0) po.push(['wallet', 'Use a class pass credit', w.left + ' of ' + w.total + ' left']);
        po.push(['intro', 'Intro pass, 3 classes', '£29'], ['pass5', '5 class pass', '£58'], ['pass10', '10 class pass', '£105']);
      }
      if (plan && it.id !== 'private') po.push(['member', 'Book with ' + plan.name, ev ? money(Math.round(pr * (1 - planDiscount()) * 100) / 100) : 'Included']);
      h += '<h2>How would you like to pay?</h2><div class="choices" role="radiogroup">' + po.map(function (o) {
        return '<label class="choice"><input type="radio" name="bkPay" value="' + o[0] + '"' + (bk.pay === o[0] ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>' + esc(o[1]) + '</b>' + (o[0] === 'intro' ? '<span class="small soft">New clients only. Use within 14 days.</span>' : o[0] === 'pass5' ? '<span class="small soft">£11.60 a class. Use within 6 weeks.</span>' : o[0] === 'pass10' ? '<span class="small soft">£10.50 a class. Use within 12 weeks.</span>' : '') + '</span><span class="c-price">' + o[2] + '</span></label>';
      }).join('') + '</div>' + (!plan ? '<p class="small soft" style="margin:0">Werk Club members book with their plan. <a class="ulr" href="#/club">See the club</a>.</p>' : '') +
        (it.knee_pads_addon ? '<label class="choice box"><input type="checkbox" id="bkPads"' + (bk.pads ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>Add knee pads</b></span><span class="c-price">+£10</span></label>' : '') +
        '<div class="paybtns"><button class="paybtn" type="button" data-wallet="apple">Apple Pay</button><button class="paybtn g" type="button" data-wallet="google">Google Pay</button></div>' +
        '<p class="demo-note">' + esc(C.book.demo_note) + '</p>';
    } else if (name === 'Your details') {
      var df = C.book.details_fields;
      h += '<h2>Your details</h2>' + inp('bk-name', df.name, 'text', bk.name, 'name') + inp('bk-email', df.email, 'email', bk.email, 'email') + inp('bk-mobile', df.mobile, 'tel', bk.mobile, 'tel');
    } else if (name === 'Wellness check') {
      var wl = C.book.wellness;
      h += '<h2>' + esc(wl.title) + '</h2><p style="margin:0">' + E(wl.intro) + '</p>' + inp('bk-ecn', wl.questions[0].label, 'text', bk.ec_name) + inp('bk-ecp', wl.questions[1].label, 'tel', bk.ec_phone) +
        yesno('injury', wl.questions[2].label, bk.injury) + '<div class="field" id="injWrap"' + (bk.injury === 'yes' ? '' : ' hidden') + '><label for="bk-injd">' + esc(wl.questions[3].label) + '</label><textarea id="bk-injd">' + esc(bk.injury_detail) + '</textarea></div>' +
        yesno('pregnant', wl.questions[4].label, bk.pregnant) +
        '<div class="panel" style="padding:16px"><p style="margin:0;font-weight:500">' + esc(wl.confirm_heading) + '</p><ul style="margin:0;padding-left:1.1em;font-size:1rem;display:grid;gap:4px">' + wl.confirmations.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<label class="choice box"><input type="checkbox" id="bkAgree"' + (bk.agree ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>I confirm all of the above</b></span></label>';
    } else if (name === 'Photos') {
      var cs = C.book.consent;
      h += '<h2>' + esc(cs.title) + '</h2><p style="margin:0">' + E(cs.lead) + ' ' + esc(cs.optional) + '</p><fieldset style="border:0;padding:0;margin:0;display:grid;gap:6px"><legend class="small soft" style="margin-bottom:8px">Photos and video</legend>' + cs.photo_options.map(function (o) { return radio('bkPhoto', o.id, o.label, bk.photo); }).join('') + '</fieldset>' +
        '<fieldset style="border:0;padding:0;margin:0;display:grid;gap:6px"><legend class="small soft" style="margin-bottom:8px">Emails</legend>' + cs.marketing_options.map(function (o) { return radio('bkMkt', o.id, o.label, bk.marketing); }).join('') + '</fieldset>' +
        '<label class="choice box"><input type="checkbox" id="bkTerms"' + (bk.terms ? ' checked' : '') + '><span class="dot"></span><span class="c-body"><b>' + esc(C.book.terms_check) + '</b><span class="small soft">' + E(C.book.cancellation_policy) + ' <a class="ulr" href="#/privacy">Read the policies</a></span></span></label>';
    } else if (name === 'Confirm') {
      h += '<h2>Check and confirm</h2><p style="margin:0">' + esc(bk.name) + ', you are booking ' + esc(it.short_name || it.name) + ' on ' + fmt(bk.date, true) + ' at ' + t12(timeOf(it, bk.date) && (bk.time || timeOf(it, bk.date))) + '.</p><p class="small soft" style="margin:0">' + E(C.book.cancellation_policy) + '</p>';
    }
    h += '<p class="err" id="bkErr" aria-live="polite"></p><div class="step-nav">' + (bk.step > 0 ? '<button class="btn ghost" type="button" data-bk="back"><span class="lbl">Back</span></button>' : '') +
      (name === 'Confirm' ? '<button class="btn" type="button" data-bk="confirm"><span class="lbl">Confirm booking' + (priceOf(bk) ? ', ' + money(priceOf(bk)) : '') + '</span>' + SPIN + '</button>' :
        (name === 'Date' && it && it.id !== 'private' && bk.date && placesLeft(it.id, bk.date) <= 0) ? '<button class="btn" type="button" data-waitlist="' + it.id + '|' + bk.date + '"><span class="lbl">Join waitlist</span>' + SPIN + '</button>' :
        '<button class="btn" type="button" data-bk="next"><span class="lbl">Continue</span>' + ARR + '</button>') + '</div></div>';
    host.innerHTML = h;
    renderSummary();
  }
  function inp(id, label, type, val, ac) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + type + '" value="' + esc(val) + '"' + (ac ? ' autocomplete="' + ac + '"' : '') + '></div>'; }
  function radio(name, v, label, cur) { return '<label class="choice"><input type="radio" name="' + name + '" value="' + v + '"' + (cur === v ? ' checked' : '') + '><span class="dot"></span><span class="c-body">' + esc(label) + '</span></label>'; }
  function yesno(key, label, cur) { return '<fieldset style="border:0;padding:0;margin:0;display:grid;gap:6px"><legend style="margin-bottom:8px;font-size:1rem">' + esc(label) + '</legend><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' + radio('yn-' + key, 'no', 'No', cur) + radio('yn-' + key, 'yes', 'Yes', cur) + '</div></fieldset>'; }
  function renderSummary() {
    var s = document.getElementById('bkSum'); if (!s) return;
    var it = item(bk.item);
    s.innerHTML = '<h2>Your booking</h2>' + (it ? '<dl><dt>What</dt><dd>' + esc(it.short_name || it.name) + '</dd><dt>When</dt><dd>' + (bk.date ? fmt(bk.date) + ', ' + t12(bk.time || timeOf(it, bk.date)) : 'Not chosen yet') + '</dd><dt>Where</dt><dd>Fearless Fit Hub</dd>' +
      (bk.pay ? '<dt>Paying by</dt><dd>' + PAYNAMES[bk.pay] + '</dd>' : '') + (bk.pads ? '<dt>Knee pads</dt><dd>£10</dd>' : '') + '</dl>' + (bk.pay ? '<p class="tot" style="margin:0">' + money(priceOf(bk)) + '</p>' : '') : '<p class="soft" style="margin:0">Choose a class or event to start.</p>');
  }
  function readStep() {
    var it = item(bk.item), name = bookSteps(it)[bk.step], v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var err = '';
    if (name === 'Choose') { var r = document.querySelector('input[name=bkItem]:checked'); if (!r) err = 'Choose what you are booking.'; else { if (bk.item !== r.value) { bk.date = null; bk.pay = bk.pay === 'intro' ? 'intro' : null; } bk.item = r.value; var ni = item(bk.item); if (isEvent(ni)) bk.date = ni.date; } }
    else if (name === 'Date') { if (it.id === 'private') { var p = document.querySelector('input[name=bkDate]:checked'); if (!p) err = 'Pick a time.'; else { bk.date = p.value.split('|')[0]; bk.time = p.value.split('|')[1]; } } else if (!bk.date) err = 'Pick a date.'; }
    else if (name === 'Pay') { var q = document.querySelector('input[name=bkPay]:checked'); if (!q) err = 'Choose how to pay.'; else bk.pay = q.value; var pd = document.getElementById('bkPads'); bk.pads = !!(pd && pd.checked); }
    else if (name === 'Your details') { bk.name = v('bk-name'); bk.email = v('bk-email'); bk.mobile = v('bk-mobile'); if (!bk.name) err = 'Add your name.'; else if (!/^\S+@\S+\.\S+$/.test(bk.email)) err = 'Add an email address we can reach you on.'; else if (bk.mobile.replace(/\D/g, '').length < 10) err = 'Add your mobile number.'; }
    else if (name === 'Wellness check') { bk.ec_name = v('bk-ecn'); bk.ec_phone = v('bk-ecp'); bk.injury_detail = v('bk-injd'); bk.agree = document.getElementById('bkAgree').checked; if (!bk.ec_name || bk.ec_phone.replace(/\D/g, '').length < 10) err = 'Add an emergency contact name and number.'; else if (!bk.agree) err = 'Tick the box to confirm.'; }
    else if (name === 'Photos') { var ph = document.querySelector('input[name=bkPhoto]:checked'), mk = document.querySelector('input[name=bkMkt]:checked'); bk.photo = ph ? ph.value : ''; bk.marketing = mk ? mk.value : ''; bk.terms = document.getElementById('bkTerms').checked; if (!bk.photo || !bk.marketing) err = 'Choose an answer for photos and for emails.'; else if (!bk.terms) err = 'Tick the box to agree to the studio policies.'; }
    var e = document.getElementById('bkErr'); if (e) e.textContent = err;
    return !err;
  }
  function confirmBooking(b) {
    var it = item(bk.item);
    var rec = { id: 'WW' + Date.now().toString(36).toUpperCase().slice(-6), item: it.id, name: it.short_name || it.name, date: bk.date, time: bk.time || timeOf(it, bk.date), who: bk.name, email: bk.email, mobile: bk.mobile, pay: bk.pay, total: priceOf(bk), photo: bk.photo, created: new Date().toISOString() };
    var list = bookings(); list.push(rec); set('bookings', list);
    set('me', { name: bk.name, email: bk.email, mobile: bk.mobile });
    var w = get('wallet', WALLET0);
    if (bk.pay === 'wallet' && w) { w.left = Math.max(0, w.left - 1); set('wallet', w); }
    if (/intro|pass5|pass10/.test(bk.pay)) { var tot = { intro: 3, pass5: 5, pass10: 10 }[bk.pay]; var days = { intro: 14, pass5: 42, pass10: 84 }[bk.pay]; var ex = new Date(2026, 10, 26 + days); set('wallet', { name: PAYNAMES[bk.pay], total: tot, left: tot - 1, expires: ex.getFullYear() + '-' + ('0' + (ex.getMonth() + 1)).slice(-2) + '-' + ('0' + ex.getDate()).slice(-2) }); }
    set('lastBooking', rec);
    setTimeout(function () { b.classList.remove('is-loading'); b.classList.add('is-done'); setTimeout(function () { showTicket(rec); }, 350); }, 900);
  }
  function showTicket(rec) {
    var host = document.getElementById('bkStep'), it = item(rec.item); if (!host) return;
    document.getElementById('bkSum').innerHTML = '<h2>What happens next</h2><p style="margin:0">' + esc(C.book.confirmation.arrive) + '</p><p style="margin:0">' + esc(C.book.confirmation.cancel) + '</p><p style="margin:0"><a class="ul" href="#/me">See it in Me &rarr;</a></p>';
    var nexts = [];
    if (it.dates) it.dates.forEach(function (d) { if (d > rec.date && nexts.length < 2 && placesLeft(it.id, d) > 0) nexts.push(d); });
    host.innerHTML = '<div class="ticket-wrap"><h2 class="vh">' + esc(C.book.confirmation.heading) + '</h2><div class="ticket" role="group" aria-label="Your ticket">' +
      '<div class="t-top"><div class="t-w">' + wSvg('jiggle') + '</div><p class="small" style="margin:0">' + esc(C.book.confirmation.heading) + '</p><h2>' + esc(rec.name) + '</h2><p style="margin:0">' + fmt(rec.date, true) + ', ' + t12(rec.time) + '</p></div>' +
      '<div class="t-cut" aria-hidden="true"><b></b><b></b></div><div class="t-foot"><span>Name<b>' + esc(rec.who) + '</b></span><span>Ref<b>' + rec.id + '</b></span><span>Where<b>Fearless Fit Hub</b></span><span>Paid<b>' + (rec.total ? money(rec.total) : PAYNAMES[rec.pay]) + '</b></span></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center"><button class="btn" type="button" data-ics="' + rec.id + '"><span class="lbl">' + esc(C.book.confirmation.add_to_calendar) + '</span>' + SPIN + '</button>' + btn('See it in Me', '#/me', 'ghost') + '</div>' +
      (nexts.length ? '<div style="width:100%;max-width:420px"><p style="margin:24px 0 8px;font-weight:500">Book your next class</p><ul class="rows">' + nexts.map(function (d) { return '<li class="row"><span class="when soft">' + fmt(d) + ', ' + it.timetable.time_label + '</span><span class="what">' + esc(it.name) + '</span><span class="act">' + btn('Book', '#/book?item=' + it.id + '&date=' + d, 'sm') + '</span></li>'; }).join('') + '</ul></div>' : '') + '</div>';
    bk = null;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
  function ics(rec) {
    var it = item(rec.item), len = it.length_minutes || (it.id === 'private' ? 60 : (+it.end.slice(0, 2) - +it.start.slice(0, 2)) * 60);
    var d = rec.date.replace(/-/g, ''), st = rec.time.replace(':', '') + '00';
    var e = new Date(dt(rec.date).getTime() + (+rec.time.slice(0, 2) * 60 + +rec.time.slice(3) + len) * 60000);
    var en = ('0' + e.getHours()).slice(-2) + ('0' + e.getMinutes()).slice(-2) + '00';
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WERK WELL Studio//Booking//EN', 'BEGIN:VEVENT', 'UID:' + rec.id + '@werkwell.co.uk', 'DTSTAMP:20261126T120000Z', 'DTSTART;TZID=Europe/London:' + d + 'T' + st, 'DTEND;TZID=Europe/London:' + d + 'T' + en, 'SUMMARY:' + rec.name + ' at WERK WELL', 'LOCATION:Fearless Fit Hub\\, 31 Wharfside\\, Fenny Stratford\\, Milton Keynes MK2 2AZ', 'DESCRIPTION:Please arrive 5 to 7 minutes early. Ref ' + rec.id, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = 'werkwell-' + rec.id + '.ics'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- ME ---------- */
  V.me = function () {
    var w = get('wallet', WALLET0), plan = get('plan', null), me = get('me', {}), list = bookings().filter(function (b) { return b.date >= TODAY; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var attended = 7 + bookings().filter(function (b) { return b.date < TODAY; }).length;
    var seeded = [{ name: 'Dancehall & Twerk', date: '2026-12-16', time: '18:15', id: 'SAMPLE' }];
    var up = list.concat(seeded);
    var cr = w ? Array.apply(null, Array(w.total)).map(function (_, i) { return '<i class="' + (i < w.left ? 'on' : '') + '"></i>'; }).join('') : '';
    var miles = [5, 10, 25].map(function (m) { var got = attended >= m; return '<div class="mile' + (got ? ' got' : '') + '"><b>' + m + '</b><span class="small">' + (got ? 'Done' : (m - attended) + ' to go') + '</span></div>'; }).join('');
    return '<section class="app" data-chapter="dark" aria-labelledby="h-me"><h1 id="h-me">Me</h1><p class="app-sub">Signed in as Demo member' + (me.name ? ' (last booked as ' + esc(me.name) + ')' : '') + '. Sample account for the demo.</p>' +
      '<div class="me-grid">' +
      '<div class="panel wallet"><h2>Wallet</h2>' + (w ? '<p class="big" style="margin:0">' + w.left + '<span style="font-size:var(--step-lead);font-family:var(--text)"> of ' + w.total + ' classes left</span></p><div class="credits" aria-hidden="true">' + cr + '</div><p style="margin:0">' + esc(w.name) + ', use by ' + fmt(w.expires, true) + '.</p>' : '<p style="margin:0">No class pass yet.</p>') +
        (plan ? '<p style="margin:0"><b>' + esc(plan.name) + '</b>, ' + money(plan.price) + ' a month. Booking opens ' + (plan.id === 'club' ? '48' : '24') + ' hours early.</p>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm light" type="button" data-buy="pass10"><span class="lbl">Top up</span>' + ARR + '</button>' + btn('Book a class', '#/book', 'sm') + '</div></div>' +
      '<div class="panel"><h2>Coming up</h2><ul class="blist">' + up.map(function (b, i) { return '<li class="' + (b.id !== 'SAMPLE' && i === 0 ? 'new' : '') + '"><b>' + esc(b.name) + '</b><span>' + (b.id === 'SAMPLE' ? 'Sample' : b.id) + '</span><span class="soft">' + fmt(b.date, true) + ', ' + t12(b.time) + '</span></li>'; }).join('') + '</ul></div>' +
      '<div class="panel"><h2>Milestones</h2><p style="margin:0">' + attended + ' classes so far.</p><div class="miles">' + miles + '</div></div>' +
      '<div class="panel friend"><h2>Bring a friend</h2><p style="margin:0">Her first class is £5 when she books with your link. She still registers and fills in the wellness check, like everyone.</p><p class="code" style="margin:0">WERK-DEMO</p><button class="btn sm" type="button" data-share><span class="lbl">Share my link</span>' + SPIN + '</button></div>' +
      '</div></section>' + footer();
  };

  /* ---------- STUDIO ---------- */
  var SAMPLE_NAMES = ['Amara K.', 'Bisi A.', 'Chloe R.', 'Dami O.', 'Esi M.', 'Funmi T.', 'Grace L.', 'Hana S.', 'Ife B.', 'Jade W.', 'Kemi F.'];
  V.studio = function () {
    var tonight = WEDS[0], all = bookings(), last = get('lastBooking', null);
    var sample = last || { who: 'Amara K.', name: 'Dancehall & Twerk', date: tonight, time: '18:15', mobile: '07700 900123', pay: 'single', total: 13, id: 'SAMPLE' };
    var cls = LIVE.map(function (c) {
      var taken = TAKEN[c.id][tonight], mine = all.filter(function (b) { return b.item === c.id && b.date === tonight; });
      var names = SAMPLE_NAMES.slice(0, taken).map(function (n) { return '<li><span>' + n + '</span><span class="soft">Sample</span></li>'; });
      var news = mine.map(function (b) { return '<li class="new"><span>' + esc(b.who) + '</span><span>New, ' + PAYNAMES[b.pay] + '</span></li>'; });
      var booked = taken + mine.length, left = c.capacity - booked;
      return '<div class="cls"><div class="cls-h"><h3>' + esc(c.name) + '</h3><span>' + c.timetable.time_label + '</span></div><div class="meter" aria-hidden="true"><i style="--v:' + (booked / c.capacity) + '"></i></div><p style="margin:0" class="small">' + booked + ' booked of ' + c.capacity + ', ' + left + ' left</p><ul class="people">' + news.concat(names).join('') + '</ul></div>';
    }).join('');
    var members = [['Demo member', get('plan', null) ? get('plan', null).name : '5 class pass', '7', 'Sep 2026'], ['Amara K.', 'Werk Club Four', '12', 'Oct 2026'], ['Bisi A.', '10 class pass', '9', 'Sep 2026'], ['Chloe R.', 'Intro pass', '2', 'Nov 2026'], ['Dami O.', 'Pay as you go', '4', 'Oct 2026'], ['Esi M.', '5 class pass', '6', 'Oct 2026']];
    var seen = {};
    all.forEach(function (b) { if (!seen[b.who]) { seen[b.who] = 1; members.unshift([b.who + ' (new)', PAYNAMES[b.pay], '1', 'Nov 2026']); } });
    var msg = esc(sample.who) + ' booked ' + esc(sample.name) + ', ' + fmt(sample.date) + ' at ' + t12(sample.time) + '. Paid: ' + (sample.total ? money(sample.total) : PAYNAMES[sample.pay]) + '.';
    return '<section class="app" data-chapter="dark" aria-labelledby="h-st" style="max-width:1320px"><div class="studio-top"><div><h1 id="h-st">Studio</h1><p class="app-sub" style="margin:0">Millie\'s side. Tonight is ' + fmt(tonight, true) + '. Sample data, plus any bookings made in this demo.</p></div>' + btn('Back to the site', '#/', 'ghost sm') + '</div>' +
      '<div class="st-grid"><div style="display:grid;gap:16px;align-content:start"><h2 style="font-size:1.5rem">Tonight\'s classes</h2>' + cls + '</div>' +
      '<div style="display:grid;gap:16px;align-content:start"><h2 style="font-size:1.5rem">New booking, as it reaches you</h2><div class="phones">' +
        '<div class="phone mail" aria-label="Email preview"><div class="scr"><div class="bar"><span>Mail</span><span>18:02</span></div><div class="m"><span class="from">From: WERK WELL bookings</span><h4>New booking: ' + esc(sample.name) + '</h4><p style="margin:0">' + msg + '</p><p style="margin:0">Mobile ' + esc(sample.mobile || '') + '. Wellness check and photo consent are on file' + (sample.photo === 'no' ? '; she has asked for her face not to be shown' : '') + '.</p><p style="margin:0;color:#555">Ref ' + esc(sample.id) + '</p></div></div></div>' +
        '<div class="phone wa" aria-label="WhatsApp preview"><div class="scr"><div class="bar"><span>WhatsApp: WERK WELL</span><span>18:02</span></div><div class="bub">New booking<br>' + msg + '<time>18:02</time></div><div class="bub" style="animation-delay:200ms">' + placesSummary(tonight) + '<time>18:02</time></div></div></div>' +
      '</div><h2 style="font-size:1.5rem;margin-top:16px">Members</h2><div class="panel" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Name</th><th>Plan</th><th class="num">Classes</th><th>Since</th></tr></thead><tbody>' + members.map(function (m) { return '<tr><td>' + esc(m[0]) + '</td><td>' + esc(m[1]) + '</td><td class="num">' + m[2] + '</td><td>' + m[3] + '</td></tr>'; }).join('') + '</tbody></table></div></div></div></section>';
  };
  function placesSummary(d) { return 'Tonight: ' + LIVE.map(function (c) { return esc(c.name) + ' ' + placesLabel(placesLeft(c.id, d)).toLowerCase(); }).join(', ') + '.'; }

  /* ---------- sheets: buy and request ---------- */
  var BUY = { four: ['Werk Club Four', 44, 'a month, 3-month minimum'], intro: ['Intro pass', 29, '3 classes, use within 14 days'], pass5: ['5 class pass', 58, 'use within 6 weeks'], pass10: ['10 class pass', 105, 'use within 12 weeks'] };
  function sheet(html) {
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<button class="icon-btn x" type="button" data-close aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5"/></svg></button>' + html;
    document.body.appendChild(bg); document.body.appendChild(sh);
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); var f = sh.querySelector('input,button:not([data-close])'); if (f) f.focus(); });
    function close() { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(function () { bg.remove(); sh.remove(); }, 460); document.removeEventListener('keydown', esck); }
    function esck(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esck);
    bg.addEventListener('click', close); sh.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    return sh;
  }
  function buySheet(id) {
    var p = BUY[id], me = get('me', {});
    var sh = sheet('<h2>' + p[0] + '</h2><p style="margin:0"><span style="font-family:var(--display);font-size:2rem">£' + p[1] + '</span> ' + p[2] + '.</p>' + inp('by-name', 'Your name', 'text', me.name || '', 'name') + inp('by-email', 'Email', 'email', me.email || '', 'email') +
      '<div class="paybtns"><button class="paybtn" type="button" data-paynow>Apple Pay</button><button class="paybtn g" type="button" data-paynow>Google Pay</button></div><button class="btn full" type="button" data-paynow><span class="lbl">Pay £' + p[1] + '</span>' + SPIN + '</button><p class="err" aria-live="polite"></p><p class="demo-note">' + esc(C.club.join.demo_note) + ' Your purchase stays in this browser.</p>');
    sh.addEventListener('click', function (e) {
      var b = e.target.closest('[data-paynow]'); if (!b) return;
      var n = sh.querySelector('#by-name').value.trim(), em = sh.querySelector('#by-email').value.trim();
      if (!n || !/^\S+@\S+\.\S+$/.test(em)) { sh.querySelector('.err').textContent = 'Add your name and email.'; return; }
      var main = sh.querySelector('.btn.full'); main.classList.add('is-loading');
      setTimeout(function () {
        main.classList.remove('is-loading'); main.classList.add('is-done');
        set('me', Object.assign(get('me', {}), { name: n, email: em }));
        if (id === 'four') set('plan', { id: 'four', name: 'Werk Club Four', price: 44 });
        else { var tot = { intro: 3, pass5: 5, pass10: 10 }[id], days = { intro: 14, pass5: 42, pass10: 84 }[id], ex = new Date(2026, 10, 26 + days); set('wallet', { name: p[0], total: tot, left: tot, expires: ex.getFullYear() + '-' + ('0' + (ex.getMonth() + 1)).slice(-2) + '-' + ('0' + ex.getDate()).slice(-2) }); }
        setTimeout(function () { sh.innerHTML = '<div class="step"><div class="t-w" style="color:var(--accent);width:64px">' + wSvg('jiggle') + '</div><h2>You are in</h2><p style="margin:0">' + p[0] + ' is in your account. Nothing was charged; this is a demo.</p>' + btn('See it in Me', '#/me') + '<button class="btn ghost" type="button" data-close><span class="lbl">Close</span></button></div>'; }, 400);
      }, 900);
    });
  }
  function requestSheet() {
    var me = get('me', {});
    var sh = sheet('<h2>Request your place</h2><p style="margin:0">The Werk Club, £79 a month. Founding places are limited to 30. Leave your details and Millie will be in touch when a place is yours.</p>' +
      inp('rq-name', 'Your name', 'text', me.name || '', 'name') + inp('rq-email', 'Email', 'email', me.email || '', 'email') +
      '<div class="field"><label for="rq-why">Which classes do you come to now? (optional)</label><input id="rq-why" type="text"></div><button class="btn full" type="button" data-req><span class="lbl">Request my place</span>' + SPIN + '</button><p class="err" aria-live="polite"></p><p class="small soft" style="margin:0">Nothing is charged now.</p>');
    sh.addEventListener('click', function (e) {
      var b = e.target.closest('[data-req]'); if (!b) return;
      var n = sh.querySelector('#rq-name').value.trim(), em = sh.querySelector('#rq-email').value.trim();
      if (!n || !/^\S+@\S+\.\S+$/.test(em)) { sh.querySelector('.err').textContent = 'Add your name and email.'; return; }
      b.classList.add('is-loading');
      setTimeout(function () { set('list', { name: n, email: em }); set('me', Object.assign(get('me', {}), { name: n, email: em }));
        sh.innerHTML = '<div class="step"><div class="t-w" style="color:var(--accent);width:64px">' + wSvg('jiggle') + '</div><h2>You\'re on the list</h2><p style="margin:0">Thank you, ' + esc(n) + '. Places on The Werk Club are offered in order. You will hear from Millie at ' + esc(em) + '.</p><p style="margin:0" class="soft">Want to start now? Werk Club Four and the class passes can be bought today.</p><button class="btn" type="button" data-close><span class="lbl">Close</span></button></div>'; }, 900);
    });
  }

  /* ---------- router ---------- */
  var TABS = { '': 0, classes: 1, book: 2, club: 3, me: 4 };
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), qi = h.indexOf('?'), q = {};
    var path = qi > -1 ? h.slice(0, qi) : h;
    if (qi > -1) h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var anchor = null; if (path.indexOf('#') > -1) { anchor = path.split('#')[1]; path = path.split('#')[0]; }
    var parts = path.split('/');
    return { view: parts[0] || '', sub: parts[1] || null, q: q, anchor: anchor };
  }
  var current = null;
  function route(first) {
    var r = parse();
    if (location.hash && location.hash.indexOf('#/') !== 0) { var el = document.getElementById(location.hash.slice(1)); if (el && main.contains(el)) { el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); return; } r = { view: '', q: {}, sub: null, anchor: location.hash.slice(1) }; }
    var fn = V[r.view === '' ? 'home' : r.view] || V.home;
    var html = r.view === 'journal' ? fn(r.sub) : r.view === 'book' ? fn(r.q) : fn();
    var swap = function () {
      teardown();
      main.innerHTML = '<div class="view">' + html + '</div>';
      current = r.view; document.body.classList.toggle('at-home', r.view === ''); document.body.classList.toggle('app-view', /^(book|me|studio)$/.test(r.view)); ['book', 'studio'].forEach(function (k) { document.body.classList.toggle('v-' + k, r.view === k); });
      if (r.view === 'book') renderBook(1);
      mount();
      if (r.anchor) { var a = document.getElementById(r.anchor); if (a) a.scrollIntoView(); } else window.scrollTo(0, 0);
      if (!first) main.focus({ preventScroll: true });
    };
    if (first || reduced) swap();
    else { var v = main.querySelector('.view'); if (v) { v.classList.add('out'); setTimeout(swap, 170); } else swap(); }
    var ti = TABS[r.view]; var nav = document.querySelector('.tabs');
    nav.style.setProperty('--ti', ti == null ? -5 : ti);
    document.querySelectorAll('.tabs a, .hdr nav a').forEach(function (a) { var on = a.getAttribute('href') === '#/' + r.view || (r.view === '' && a.getAttribute('href') === '#/'); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    closeMenu();
    document.title = (r.view ? ({ classes: 'Classes', book: 'Book', club: 'The Werk Club', me: 'Me', events: 'Events', journal: 'Journal', about: 'About', contact: 'Contact', hire: 'Private hire', studio: 'Studio', privacy: 'Privacy' }[r.view] || 'WERK WELL') + ' | ' : '') + 'WERK WELL Studio';
  }
  window.addEventListener('hashchange', function () { document.querySelectorAll('.sheet [data-close]').forEach(function (x) { x.click(); }); route(false); });

  /* ---------- after each render ---------- */
  var io, cleanups = [];
  function teardown() { cleanups.forEach(function (f) { f(); }); cleanups = []; }
  function mount() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    var H0 = window.innerHeight, k = 0;
    main.querySelectorAll('.sec h2, .sec h3, .sec p, .sec li, .sec .frame, .ptable li, .qa, .band figure').forEach(function (el) {
      if (el.hasAttribute('data-rv') || el.closest('[data-rv], .app, .xcard, .tt, .sheet, form')) return;
      if (el.getBoundingClientRect().top < H0) return;
      el.setAttribute('data-rv', ''); el.style.setProperty('--d', ((k++ % 4) * 70) + 'ms');
    });
    main.querySelectorAll('[data-rv]').forEach(function (el) { io.observe(el); });
    logos(main); chapters(); showcase(); player(); xcards();
    if (!fine.matches) tapReveal();
  }

  /* colour by chapter: the header takes the ink of the section under it */
  var hdr = document.getElementById('hdr');
  function chapters() {
    var secs = main.querySelectorAll('[data-chapter]');
    function check() {
      var y = (hdr.offsetHeight || 60) / 2, light = false, solid = window.scrollY > 40;
      for (var i = 0; i < secs.length; i++) { var r = secs[i].getBoundingClientRect(); if (r.top <= y && r.bottom > y) { light = secs[i].getAttribute('data-chapter') === 'light'; break; } }
      document.body.classList.toggle('scrolled', window.scrollY > 160);
      hdr.classList.toggle('on-light', light); hdr.classList.toggle('solid', solid && (current !== '' || window.scrollY > window.innerHeight * 0.6));
    }
    window.addEventListener('scroll', check, { passive: true }); check();
    cleanups.push(function () { window.removeEventListener('scroll', check); });
  }

  /* showcase: cards travel across a held photograph */
  function showcase() {
    var sec = main.querySelector('.show'), track = document.getElementById('track'); if (!sec || !track) return;
    var h2 = sec.querySelector('h2');
    function f() {
      if (!mql.matches || reduced) { track.style.transform = ''; h2.style.transform = ''; return; }
      var r = sec.getBoundingClientRect(), total = sec.offsetHeight - window.innerHeight, p = Math.min(1, Math.max(0, -r.top / total));
      var travel = track.scrollWidth - window.innerWidth + window.innerWidth * 0.08;
      track.style.transform = 'translate3d(' + (-p * travel) + 'px,0,0)';
      h2.style.transform = 'translate3d(' + (-Math.min(1, p * 2.2) * 60) + 'vw,0,0)';
    }
    window.addEventListener('scroll', f, { passive: true }); window.addEventListener('resize', f); f();
    cleanups.push(function () { window.removeEventListener('scroll', f); window.removeEventListener('resize', f); });
  }

  /* founder film: Vimeo if it plays here, poster and play button if not; docks in the corner */
  function player() {
    var pl = document.getElementById('player'); if (!pl) return;
    var slot = pl.parentNode, iframe = null, ready = false, docked = false, closed = false, playing = false;
    function load(autoplay) {
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.src = 'https://player.vimeo.com/video/' + C.meta.video.vimeo_id + '?autoplay=' + (autoplay ? 1 : 0) + '&muted=1&loop=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture'; iframe.title = C.meta.video.title; iframe.setAttribute('loading', 'lazy');
      pl.insertBefore(iframe, pl.firstChild);
    }
    function onMsg(e) {
      if (!/vimeo\.com$/.test((e.origin || '').replace(/^https?:\/\//, ''))) return;
      var d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch (x) { return; }
      if (d && (d.event === 'ready' || d.event === 'play' || d.event === 'playProgress')) {
        if (!ready) { ready = true; post('addEventListener', 'play'); }
        if (d.event === 'play' || d.event === 'playProgress') { pl.classList.add('live'); playing = true; document.getElementById('soundBtn').hidden = false; }
      }
    }
    function post(m, v) { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ method: m, value: v }), 'https://player.vimeo.com'); }
    window.addEventListener('message', onMsg);
    cleanups.push(function () { window.removeEventListener('message', onMsg); });
    if (!reduced) load(true);
    document.getElementById('playBtn').addEventListener('click', function () {
      if (ready) { post('play'); post('setVolume', 1); post('setMuted', false); }
      else { load(true); toast('Starting the film'); setTimeout(function () { if (!ready) { pl.classList.add('blocked'); toast('The film plays on werkwellstudio.com. Showing the still here.'); } }, 6000); }
    });
    document.getElementById('soundBtn').addEventListener('click', function () { post('setMuted', false); post('setVolume', 1); this.hidden = true; });
    /* dock */
    function setDock(on) {
      if (on === docked || closed) return;
      var first = pl.getBoundingClientRect();
      docked = on; pl.classList.toggle('docked', on);
      if (reduced || !pl.animate) return;
      var last = pl.getBoundingClientRect();
      var dx = first.left - last.left, dy = first.top - last.top, s = first.width / last.width;
      pl.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', transformOrigin: '0 0' },
        { transform: 'translate(' + dx * 0.25 + 'px,' + dy * 0.7 + 'px) scale(' + (1 + (s - 1) * 0.4) + ')', transformOrigin: '0 0', offset: 0.55 },
        { transform: 'none', transformOrigin: '0 0' }
      ], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    var dio = new IntersectionObserver(function (es) { es.forEach(function (e) { setDock(!e.isIntersecting && e.boundingClientRect.top < 0); }); }, { threshold: 0 });
    dio.observe(slot);
    cleanups.push(function () { dio.disconnect(); pl.classList.remove('docked'); });
    document.getElementById('dockX').addEventListener('click', function () { setDock(false); closed = true; post('pause'); });
    document.getElementById('dockUp').addEventListener('click', function () { slot.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); });
  }

  /* class cards: hover-expand on desktop, tap-to-expand on phones */
  function xcards() {
    var wrap = document.getElementById('xcards'); if (!wrap) return;
    var cards = [].slice.call(wrap.querySelectorAll('.xcard')), tOpen = null, tClose = null;
    function open(c) {
      if (c && fine.matches) {
        var d = c.querySelector('.drawer'); c.classList.remove('up');
        var card = c.querySelector('.xc').getBoundingClientRect(), need = d.scrollHeight;
        if (card.bottom + need > window.innerHeight - 16) c.classList.add('up');
      }
      cards.forEach(function (o, i) { var on = o === c; o.classList.toggle('open', on); o.classList.remove('closing'); o.querySelector('.xc').setAttribute('aria-expanded', on);
        var ci = cards.indexOf(c); o.classList.toggle('push-l', fine.matches && c && i < ci); o.classList.toggle('push-r', fine.matches && c && i > ci); });
    }
    function close() { cards.forEach(function (o) { if (o.classList.contains('open')) o.classList.add('closing'); o.classList.remove('open', 'push-l', 'push-r'); o.querySelector('.xc').setAttribute('aria-expanded', 'false'); }); }
    cards.forEach(function (c) {
      var xc = c.querySelector('.xc');
      c.addEventListener('mouseenter', function () { if (!fine.matches) return; clearTimeout(tClose); open(c); });
      c.addEventListener('mouseleave', function () { if (!fine.matches) return; tClose = setTimeout(close, 100); });
      c.addEventListener('focusin', function () { if (fine.matches) { clearTimeout(tClose); open(c); } });
      c.addEventListener('focusout', function (e) { if (fine.matches && !c.contains(e.relatedTarget)) tClose = setTimeout(close, 100); });
      xc.addEventListener('click', function (e) { if (e.target.closest('a,button,input,form')) return; if (fine.matches) return; if (c.classList.contains('open')) close(); else open(c); });
      xc.addEventListener('keydown', function (e) { if (e.target !== xc) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (c.classList.contains('open')) close(); else open(c); } if (e.key === 'Escape') close(); });
    });
  }

  /* phones: picture reveal as a card enters view */
  function tapReveal() {
    var t = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('tapped', e.intersectionRatio > 0.7); }); }, { threshold: [0, 0.7, 1] });
    main.querySelectorAll('.tile, .card, .jcard').forEach(function (el) { t.observe(el); });
    cleanups.push(function () { t.disconnect(); });
  }

  function toast(s) { var t = document.getElementById('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  /* ---------- delegated events ---------- */
  document.addEventListener('click', function (e) {
    var an = e.target.closest('a[href^="#"]:not([href^="#/"])');
    if (an && an.getAttribute('href').length > 1) { var tg = document.getElementById(an.getAttribute('href').slice(1)); if (tg) { e.preventDefault(); tg.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); if (tg.id === 'main') main.focus(); } return; }
    var d = e.target.closest('[data-date]');
    if (d && d.closest('.tt')) { var tt = d.closest('.tt'); tt.querySelectorAll('.date').forEach(function (b) { b.setAttribute('aria-pressed', b === d); }); tt.querySelector('.tt-rows').innerHTML = timetableRows(d.getAttribute('data-date')); return; }
    var pk = e.target.closest('[data-pick]');
    if (pk && bk) { bk.date = pk.getAttribute('data-pick'); renderBook(0); var nb = document.querySelector('.step-nav .btn:last-child'); if (nb) nb.focus(); return; }
    var wl = e.target.closest('[data-waitlist]');
    if (wl) { var parts = wl.getAttribute('data-waitlist').split('|'); wl.classList.add('is-loading'); setTimeout(function () { wl.classList.remove('is-loading'); wl.classList.add('is-done'); wl.querySelector('.lbl').textContent = 'On the waitlist'; toast('You are on the waitlist for ' + item(parts[0]).name + ', ' + fmt(parts[1]) + '.'); }, 700); return; }
    var bkb = e.target.closest('[data-bk]');
    if (bkb && bk) {
      var a = bkb.getAttribute('data-bk');
      if (a === 'back') { bk.step = Math.max(0, bk.step - 1); renderBook(-1); }
      else if (a === 'next') { if (readStep()) { bk.step++; renderBook(1); document.getElementById('bkStep').scrollIntoView({ block: 'nearest' }); } }
      else if (a === 'confirm') { bkb.classList.add('is-loading'); confirmBooking(bkb); }
      return;
    }
    var wb = e.target.closest('[data-wallet]');
    if (wb && bk) { var sel = document.querySelector('input[name=bkPay]:checked'); if (!sel) { var f1 = document.querySelector('input[name=bkPay][value=single]'); if (f1) f1.checked = true; } if (readStep()) { toast((wb.getAttribute('data-wallet') === 'apple' ? 'Apple Pay' : 'Google Pay') + ': demo, nothing charged'); bk.step++; renderBook(1); } return; }
    var ic = e.target.closest('[data-ics]');
    if (ic) { var rec = bookings().filter(function (b) { return b.id === ic.getAttribute('data-ics'); })[0]; if (rec) { ics(rec); ic.classList.add('is-done'); toast('Calendar file downloaded'); } return; }
    var by = e.target.closest('[data-buy]'); if (by) { buySheet(by.getAttribute('data-buy')); return; }
    var rq = e.target.closest('[data-request]'); if (rq) { requestSheet(); return; }
    var sh = e.target.closest('[data-share]');
    if (sh) { var url = location.href.split('#')[0] + '#/book?pay=friend&code=WERK-DEMO'; sh.classList.add('is-loading'); var done = function () { sh.classList.remove('is-loading'); sh.classList.add('is-done'); toast('Link copied: send it to your friend'); }; try { navigator.clipboard.writeText(url).then(done, done); } catch (x) { done(); } return; }
    var qa = e.target.closest('.qa > button');
    if (qa) { var q = qa.parentNode, op = !q.classList.contains('open'); q.classList.toggle('open', op); qa.setAttribute('aria-expanded', op); return; }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'yn-injury') { var w = document.getElementById('injWrap'); if (w) w.hidden = e.target.value !== 'yes'; if (bk) bk.injury = e.target.value; }
    if (e.target.name === 'yn-pregnant' && bk) bk.pregnant = e.target.value;
    if (e.target.name === 'bkPay' && bk) { bk.pay = e.target.value; renderSummary(); }
    if (e.target.id === 'bkPads' && bk) { bk.pads = e.target.checked; renderSummary(); }
    if (e.target.name === 'bkItem' && bk) { bk.item = e.target.value; var it = item(bk.item); bk.date = isEvent(it) ? it.date : null; renderSummary(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    var err = f.querySelector('.err'), b = f.querySelector('button[type=submit]'), bad = false;
    f.querySelectorAll('input[required], textarea[required]').forEach(function (i) { if (!i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value))) bad = true; });
    if (bad) { err.textContent = 'Please fill in the highlighted fields with a valid email.'; return; }
    err.textContent = ''; b.classList.add('is-loading');
    setTimeout(function () { b.classList.remove('is-loading'); b.classList.add('is-done');
      var k = f.getAttribute('data-form'); toast(k === 'news' ? 'You are subscribed. Demo only.' : k === 'tell' ? 'We will tell you the day it starts. Demo only.' : k === 'hire' ? 'Enquiry ready for Millie. Demo only, nothing sent.' : 'Message ready. Demo only, nothing sent.');
      b.querySelector('.lbl').textContent = k === 'news' ? 'Subscribed' : 'Sent'; }, 800);
  });

  /* ---------- header: menu, sound, words switch, offer ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var menuT;
  function closeMenu() { if (!document.body.classList.contains('menu-open')) return; document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); clearTimeout(menuT); menuT = setTimeout(function () { document.body.classList.remove('menu-show'); }, 460); }
  menuBtn.addEventListener('click', function () {
    if (document.body.classList.contains('menu-open')) { closeMenu(); return; }
    clearTimeout(menuT); document.body.classList.add('menu-show'); menuBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('menu-open'); var f = document.querySelector('.menu a'); if (f) f.focus({ preventScroll: true }); }); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  var muteBtn = document.getElementById('mute');
  function syncMute() { var on = window.WerkIntro && !WerkIntro.isMuted(); muteBtn.classList.toggle('playing', !!on); muteBtn.setAttribute('aria-pressed', !!on); muteBtn.querySelector('.mute-l').textContent = on ? 'Sound on' : 'Sound off'; }
  muteBtn.addEventListener('click', function () { if (window.WerkIntro) { WerkIntro.toggle(); syncMute(); } });
  document.addEventListener('werkwell:enter', function () { syncMute(); });

  var words = document.getElementById('words'), wordsPill = document.getElementById('wordsPill');
  function syncWords() { words.classList.toggle('sug', mode === 'suggested'); words.querySelectorAll('.words-opts button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode); }); document.getElementById('wordsNow').textContent = mode === 'suggested' ? 'Our suggestion' : 'Her words'; }
  function wordsOpen(on) { words.classList.toggle('open', on); wordsPill.setAttribute('aria-expanded', on); }
  wordsPill.addEventListener('click', function () { wordsOpen(!words.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!words.contains(e.target)) wordsOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') wordsOpen(false); });
  words.querySelector('.words-opts').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.getAttribute('data-mode') === mode) return;
    mode = b.getAttribute('data-mode'); set('mode', mode); syncWords();
    var y = window.scrollY; var keepBk = bk; route(true); bk = keepBk; if (current === 'book' && bk) renderBook(0); window.scrollTo(0, y);
    toast(mode === 'suggested' ? 'Showing our suggested wording' : 'Showing her own words');
    setTimeout(function () { wordsOpen(false); }, 700);
  });
  syncWords();

  var offer = document.getElementById('offer');
  if (!get('offerGone', false)) { offer.hidden = false; document.body.classList.add('has-offer'); }
  document.getElementById('offerX').addEventListener('click', function () { offer.classList.add('gone'); document.body.classList.remove('has-offer'); set('offerGone', true); });

  route(true);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
})();
