/* NLB join page: ad parameters, form, Meta Pixel (only with consent), post to the sign-ups sheet. */
(function () {
  'use strict';
  var AD_KEYS = ['utm_source', 'utm_campaign', 'utm_content', 'fbclid'];
  var form = document.getElementById('form');
  var thanks = document.getElementById('thanks');
  var errBox = document.getElementById('err');
  var go = document.getElementById('go');
  var shownAt = Date.now();

  /* ---- Ad parameters: keep what came in on the link, in case the visitor reloads or comes back to the tab ---- */
  function store(get, set) { try { return get(); } catch (e) { return set; } }
  var fromUrl = new URLSearchParams(location.search);
  var ad = {};
  AD_KEYS.forEach(function (k) {
    var v = (fromUrl.get(k) || '').slice(0, 200);
    if (v) ad[k] = v;
  });
  if (Object.keys(ad).length) {
    store(function () { sessionStorage.setItem('nlb_ad', JSON.stringify(ad)); }, null);
  } else {
    ad = store(function () { return JSON.parse(sessionStorage.getItem('nlb_ad') || '{}') || {}; }, {});
  }
  AD_KEYS.forEach(function (k) { form.elements[k].value = ad[k] || ''; });

  /* ---- Meta Pixel: loads only when PIXEL_ID is set and the visitor said yes ---- */
  var pixelOn = false;
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function newEventId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'e' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function loadPixel() {
    if (pixelOn || !PIXEL_ID) return;
    pixelOn = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }
  if (PIXEL_ID) {
    var choice = store(function () { return localStorage.getItem('nlb_pixel'); }, null);
    var bar = document.getElementById('consent');
    if (choice === 'yes') loadPixel();
    else if (choice !== 'no') {
      bar.hidden = false;
      document.getElementById('c-yes').onclick = function () {
        store(function () { localStorage.setItem('nlb_pixel', 'yes'); }, null);
        bar.hidden = true; loadPixel();
      };
      document.getElementById('c-no').onclick = function () {
        store(function () { localStorage.setItem('nlb_pixel', 'no'); }, null);
        bar.hidden = true;
      };
    }
  }

  /* ---- Form ---- */
  var MESSAGES = {
    name: 'Add your first name.',
    mobile: 'That mobile number looks too short. Check it and try again.',
    goal: 'Pick what you want to do.',
    session: 'Pick the session you want to try first.',
    busy: 'We are getting a lot of sign-ups right now. Try again in a few minutes.',
    fallback: 'That did not send. Check your connection and try again, or message us on Instagram @nlb.uk.'
  };
  function showError(msg, field) {
    errBox.textContent = msg; errBox.hidden = false;
    Array.prototype.forEach.call(form.querySelectorAll('.invalid'), function (el) { el.classList.remove('invalid'); });
    if (field) {
      var el = form.elements[field];
      if (el && el.nodeType === 1) { el.classList.add('invalid'); el.focus(); }
      else if (el && el.length) { el[0].focus(); }
    }
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function localCheck(d) {
    if (!d.first_name) return ['name', 'first_name'];
    var n = digits(d.mobile).replace(/^44/, '0');
    if (n.length < 10 || n.length > 13) return ['mobile', 'mobile'];
    if (!d.goal) return ['goal', 'goal'];
    if (!d.session) return ['session', 'session'];
    return null;
  }
  function showThanks(name) {
    document.getElementById('thanks-title').textContent = name ? "You're in, " + name + '.' : "You're in.";
    form.hidden = true; thanks.hidden = false; thanks.focus();
    try { window.scrollTo({ top: document.getElementById('join').offsetTop - 12, behavior: 'smooth' }); } catch (e) {}
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var data = {
      first_name: f.first_name.value.trim(),
      mobile: f.mobile.value.trim(),
      goal: (form.querySelector('input[name=goal]:checked') || {}).value || '',
      session: f.session.value || '',
      utm_source: f.utm_source.value, utm_campaign: f.utm_campaign.value,
      utm_content: f.utm_content.value, fbclid: f.fbclid.value,
      website: f.website.value,
      t: Date.now() - shownAt,
      event_id: newEventId(),
      fbp: cookie('_fbp'), fbc: cookie('_fbc'),
      ua: navigator.userAgent,
      page_url: location.origin + location.pathname,
      consent: pixelOn && window.fbq ? 'yes' : 'no'
    };
    var bad = localCheck(data);
    if (bad) return showError(MESSAGES[bad[0]], bad[1]);
    errBox.hidden = true;
    go.disabled = true; go.textContent = 'Sending';

    function done(res) {
      if (pixelOn && !res.duplicate && window.fbq) fbq('track', 'Lead', {}, { eventID: data.event_id });
      showThanks(data.first_name);
    }
    if (!API_URL) { setTimeout(function () { done({}); }, 400); return; } // demo mode

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) return done(res);
        var e = res && res.error;
        if (e === 'name' || e === 'mobile' || e === 'goal' || e === 'session') {
          go.disabled = false; go.textContent = 'Join for free';
          return showError(MESSAGES[e], e === 'name' ? 'first_name' : e);
        }
        throw new Error(e || 'failed');
      })
      .catch(function (err) {
        go.disabled = false; go.textContent = 'Join for free';
        showError(err && err.message === 'busy' ? MESSAGES.busy : MESSAGES.fallback);
      });
  });
})();
