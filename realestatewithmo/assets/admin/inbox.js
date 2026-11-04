/* Bookings inbox: Pending / Confirmed / Past tabs, cards with actions. */
import * as T from './templates.js?v=202611040820';

const TABS = [['pending', 'Pending'], ['confirmed', 'Confirmed'], ['past', 'Past']];
let curTab = 'pending';
const KIND = { stay: 'Stay', inspection: 'Inspection', consultation: 'Consultation' };

/* "2026-11-04 15:10" in Lagos time (UTC+1, no daylight saving) to a timestamp. */
function lagosMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 1, +m[5]);
}

export function holdText(until) {
  const ms = lagosMs(until) - Date.now();
  if (isNaN(ms)) return '';
  if (ms <= 0) return 'Hold ended';
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return 'Holding dates for ' + (h ? h + 'h ' : '') + m + 'm';
}

function createdText(s, f) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(String(s || ''));
  return m ? f.fmtDay(m[1]) + ', ' + m[2] : '';
}

function pill(status) {
  const label = { pending: 'Pending', confirmed: 'Confirmed', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', done: 'Done' }[status] || status;
  return '<span class="a-pill s-' + (status || 'x') + '">' + label + '</span>';
}

function textCtx(b, ctx, list) {
  const p = (list || []).find(x => x.id === b.property_id) || null;
  return { settings: ctx.getSettings(), property: p, site_url: ctx.SITE_URL };
}

function whenHtml(b, ctx) {
  const { esc, f } = ctx;
  if (b.kind === 'stay') {
    return '<div class="bk-when">' + esc(f.fmtRange(b.check_in, b.check_out)) + '</div>' +
      '<div class="bk-sub">' + esc(b.guests ? b.guests + (Number(b.guests) === 1 ? ' guest' : ' guests') : '') + '</div>';
  }
  const mode = b.mode === 'online' ? ' · Online' : b.mode === 'in_person' ? ' · In person' : '';
  return '<div class="bk-when">' + esc(f.fmtDay(b.slot_date)) + ' at ' + esc(b.slot_time) + esc(mode) + '</div>';
}

export function cardHtml(b, ctx, list) {
  const { esc, f, icons } = ctx;
  const tc = textCtx(b, ctx, list);
  const wa = T.waClient(b.phone, T.forBooking(b, tc));
  const rem = b.status === 'confirmed' ? T.waClient(b.phone, T.remind(b, tc)) : '';
  const title = b.property_title || (b.kind === 'consultation' ? 'Consultation' : 'Property');
  const src = b.share_code ? '<span class="a-tag">From a share link</span>' : b.source === 'admin' ? '<span class="a-tag">Added by you</span>' : b.source === 'ical' ? '<span class="a-tag">Imported</span>' : '';
  const acts = [];
  if (b.status === 'pending') {
    acts.push('<button type="button" class="btn btn-primary" data-act="confirmed">' + icons.check + '<span>Confirm</span></button>');
    acts.push('<button type="button" class="btn btn-outline btn-warn" data-act="declined">Decline</button>');
  } else if (b.status === 'confirmed') {
    acts.push('<button type="button" class="btn btn-primary" data-act="done">' + icons.check + '<span>Mark done</span></button>');
    acts.push('<button type="button" class="btn btn-outline btn-warn" data-act="cancelled">Cancel</button>');
  }
  const contact = [];
  if (b.phone) {
    contact.push('<a class="btn btn-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icons.wa + '<span>WhatsApp</span></a>');
    contact.push('<a class="btn btn-outline" href="tel:' + esc(b.phone) + '">' + icons.phone + '<span>Call</span></a>');
  }
  if (rem) contact.push('<a class="btn btn-outline" href="' + esc(rem) + '" target="_blank" rel="noopener">Send reminder</a>');
  contact.push('<button type="button" class="btn btn-outline" data-act="edit">Edit note or quote</button>');
  return '<article class="bk k-' + esc(b.kind) + '" data-ref="' + esc(b.ref) + '">' +
    '<div class="bk-top"><span class="a-kind">' + esc(KIND[b.kind] || b.kind) + '</span>' + pill(b.status) + src + '<span class="bk-ref">' + esc(b.ref) + '</span></div>' +
    '<h3 class="bk-title">' + esc(title) + '</h3>' +
    whenHtml(b, ctx) +
    (b.status === 'pending' && b.hold_until ? '<div class="bk-hold" data-hold="' + esc(b.hold_until) + '">' + esc(holdText(b.hold_until)) + '</div>' : '') +
    '<div class="bk-who"><b>' + esc(b.name) + '</b>' + (b.phone ? ' <a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') +
    (b.email ? ' <span class="a-muted">' + esc(b.email) + '</span>' : '') + '</div>' +
    (b.note ? '<p class="bk-note">' + esc(b.note) + '</p>' : '') +
    (b.admin_note ? '<p class="bk-mynote"><span>Your note</span> ' + esc(b.admin_note) + '</p>' : '') +
    (b.quote_ngn ? '<div class="bk-quote">' + esc(f.ngn(b.quote_ngn)) + '<span class="a-muted"> quote</span></div>' : '') +
    '<div class="bk-meta a-muted">Requested ' + esc(createdText(b.created_at, f)) + '</div>' +
    (acts.length ? '<div class="bk-acts">' + acts.join('') + '</div>' : '') +
    '<div class="bk-acts sec">' + contact.join('') + '</div>' +
    '</article>';
}

const VERB = {
  confirmed: ['Confirm', 'Confirm this request?', false],
  declined: ['Decline', 'Decline this request? The dates are freed.', true],
  cancelled: ['Cancel booking', 'Cancel this confirmed booking? The dates are freed.', true],
  done: ['Mark done', 'Mark this as done?', false]
};

export function editSheet(b, ctx, onSaved) {
  const { esc } = ctx;
  const stay = b.kind === 'stay';
  const s = ctx.sheet({
    title: 'Edit ' + b.ref,
    html: '<form id="eb" class="a-form" novalidate>' +
      (stay
        ? '<div class="a-two"><label class="field"><span class="a-lbl">Check-in</span><input class="input" type="date" name="check_in" value="' + esc(b.check_in) + '"></label>' +
          '<label class="field"><span class="a-lbl">Check-out</span><input class="input" type="date" name="check_out" value="' + esc(b.check_out) + '"></label></div>' +
          '<label class="field"><span class="a-lbl">Guests</span><input class="input" type="number" min="1" max="30" inputmode="numeric" name="guests" value="' + esc(b.guests || '') + '"></label>'
        : '<div class="a-two"><label class="field"><span class="a-lbl">Date</span><input class="input" type="date" name="slot_date" value="' + esc(b.slot_date) + '"></label>' +
          '<label class="field"><span class="a-lbl">Time</span><input class="input" type="time" name="slot_time" value="' + esc(b.slot_time) + '"></label></div>') +
      '<label class="field"><span class="a-lbl">Quote (₦)</span><input class="input" name="quote_ngn" inputmode="numeric" value="' + esc(b.quote_ngn || '') + '" placeholder="Leave empty for none"></label>' +
      '<label class="field"><span class="a-lbl">Your note (only you see it)</span><textarea class="textarea" name="admin_note" rows="3" maxlength="500">' + esc(b.admin_note || '') + '</textarea></label>' +
      '<p class="a-err" id="eb-err" role="alert"></p>' +
      '<button class="btn btn-primary a-block" type="submit">Save changes</button></form>'
  });
  const form = s.body.querySelector('#eb');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = { ref: b.ref, admin_note: String(fd.get('admin_note') || '').trim() };
    const q = String(fd.get('quote_ngn') || '').replace(/[^\d]/g, '');
    body.quote_ngn = q === '' ? '' : Number(q);
    if (stay) {
      if (fd.get('check_in') !== b.check_in) body.check_in = fd.get('check_in');
      if (fd.get('check_out') !== b.check_out) body.check_out = fd.get('check_out');
      if (String(fd.get('guests')) !== String(b.guests || '') && fd.get('guests')) body.guests = Number(fd.get('guests'));
    } else {
      if (fd.get('slot_date') !== b.slot_date) body.slot_date = fd.get('slot_date');
      if (fd.get('slot_time') !== b.slot_time) body.slot_time = fd.get('slot_time');
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await ctx.api('update_booking', body);
      ctx.toast('Saved.', 'ok');
      s.close();
      if (onSaved) onSaved(r.booking);
    } catch (er) {
      form.querySelector('#eb-err').textContent = er.message || 'Could not save.';
      btn.disabled = false;
    }
  });
}

function tellClientSheet(b, ctx, list) {
  if (!b.phone) return;
  const text = T.forBooking(b, textCtx(b, ctx, list));
  const label = { confirmed: 'Tell ' + (b.name || 'the client') + ' it is confirmed', declined: 'Let ' + (b.name || 'the client') + ' know', cancelled: 'Let ' + (b.name || 'the client') + ' know', done: 'Say thank you to ' + (b.name || 'the client') }[b.status];
  if (!label) return;
  const s = ctx.sheet({
    title: b.status === 'confirmed' ? 'Confirmed' : b.status === 'done' ? 'Marked done' : b.status === 'declined' ? 'Declined' : 'Cancelled',
    html: '<p class="a-p">' + ctx.esc(label) + ' on WhatsApp? The message is ready to send.</p>' +
      '<pre class="a-preview">' + ctx.esc(text) + '</pre>' +
      '<a class="btn btn-wa a-block" target="_blank" rel="noopener" href="' + ctx.esc(T.waClient(b.phone, text)) + '" data-close>' + ctx.icons.wa + '<span>Open WhatsApp</span></a>' +
      '<button type="button" class="btn btn-outline a-block" data-close>Not now</button>'
  });
  return s;
}

/* Runs a status change with a confirm sheet. onDone(booking) after success. */
export async function changeStatus(b, status, ctx, onDone) {
  const [okLabel, text, danger] = VERB[status];
  const yes = await ctx.confirm(text, { ok: okLabel, danger, title: okLabel + ' ' + b.ref + '?' });
  if (!yes) return;
  try {
    const r = await ctx.api('update_booking', { ref: b.ref, status });
    ctx.toast(status === 'confirmed' ? 'Confirmed.' : status === 'declined' ? 'Declined.' : status === 'cancelled' ? 'Cancelled.' : 'Marked done.', 'ok');
    let list = [];
    try { list = await ctx.props(); } catch (e) { list = []; }
    const nb = r.booking || Object.assign({}, b, { status });
    if (onDone) onDone(nb);
    tellClientSheet(nb, ctx, list);
  } catch (e) {
    ctx.toast(e.message || 'That did not work.', 'bad');
  }
}

/* A booking opened from elsewhere (the calendar). */
export async function openBooking(b, ctx, onChanged) {
  let list = [];
  try { list = await ctx.props(); } catch (e) { list = []; }
  let cur = b;
  const s = ctx.sheet({ title: b.ref, html: '<div id="ob"></div>', tall: true });
  const host = s.body.querySelector('#ob');
  const draw = () => {
    host.innerHTML = cardHtml(cur, ctx, list);
  };
  draw();
  host.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'edit') {
      editSheet(cur, ctx, nb => { cur = nb; draw(); if (onChanged) onChanged(); });
    } else {
      changeStatus(cur, act, ctx, nb => { cur = nb; draw(); if (onChanged) onChanged(); });
    }
  });
}

export async function render(root, ctx, param) {
  const { esc, f } = ctx;
  if (['pending', 'confirmed', 'past'].includes(param)) curTab = param;
  let list = [];
  let props = [];
  let sig = '';
  let counts = { pending: ctx.getPending() };
  let alive = true;
  let loading = false;

  root.innerHTML =
    '<div class="a-head"><h1>Inbox</h1><button type="button" class="icon-btn" id="ib-r" aria-label="Refresh">' + ctx.icons.refresh + '</button></div>' +
    '<div class="a-seg" role="tablist">' + TABS.map(t => '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === curTab) + '">' + t[1] +
      (t[0] === 'pending' ? ' <b class="a-count" id="ib-c" ' + (counts.pending ? '' : 'hidden') + '>' + counts.pending + '</b>' : '') + '</button>').join('') + '</div>' +
    '<div id="ib-list" class="bk-list" aria-live="polite"></div>';
  const host = root.querySelector('#ib-list');
  const segs = root.querySelectorAll('.a-seg button');

  function paintTabs() {
    segs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === curTab)));
    const c = root.querySelector('#ib-c');
    if (c) { c.textContent = counts.pending; c.hidden = !counts.pending; }
  }

  function empty() {
    const msg = { pending: ['Nothing waiting', 'New requests from the site land here. You will see a red number on Inbox when one arrives.'],
      confirmed: ['No confirmed bookings', 'Bookings you confirm show up here.'],
      past: ['Nothing here yet', 'Done, declined, cancelled and expired requests are kept here.'] }[curTab];
    return '<div class="a-empty"><h3>' + msg[0] + '</h3><p>' + msg[1] + '</p></div>';
  }

  function paint() {
    host.innerHTML = list.length ? list.map(b => cardHtml(b, ctx, props)).join('') : empty();
    paintTabs();
  }

  async function load(silent, force) {
    if (loading) return;
    loading = true;
    const tab = curTab;
    if (!silent) host.innerHTML = '<div class="a-skel"><div></div><div></div><div></div></div>';
    try {
      const [r, pc] = await Promise.all([
        ctx.api('bookings', { status: tab }),
        tab === 'pending' ? Promise.resolve(null) : ctx.api('bookings', { status: 'pending' })
      ]);
      if (!alive || tab !== curTab) return;
      if (!props.length) { try { props = await ctx.props(); } catch (e) { props = []; } }
      const next = r.bookings || [];
      const nextSig = JSON.stringify(next);
      const pendingN = tab === 'pending' ? next.length : (pc.bookings || []).length;
      const grew = silent && pendingN > counts.pending;
      counts.pending = pendingN;
      ctx.setBadge(pendingN);
      if (grew) ctx.toast('New request in your inbox.', 'ok');
      if (nextSig !== sig || !silent) {
        sig = nextSig;
        list = next;
        if (force || !silent || !document.querySelector('dialog[open]')) paint();
      } else paintTabs();
    } catch (e) {
      if (!silent && alive) host.innerHTML = '<div class="a-state"><h2>Could not load</h2><p>' + esc(e.message || '') + '</p><button class="btn btn-primary" id="ib-retry">Try again</button></div>';
      if (!silent) { const rt = host.querySelector('#ib-retry'); if (rt) rt.addEventListener('click', () => load(false)); }
    } finally {
      loading = false;
    }
  }

  root.querySelector('.a-seg').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b || b.dataset.tab === curTab) return;
    curTab = b.dataset.tab;
    sig = '';
    paintTabs();
    load(false);
  });
  root.querySelector('#ib-r').addEventListener('click', () => load(false));

  host.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const card = a.closest('[data-ref]');
    const b = list.find(x => x.ref === card.dataset.ref);
    if (!b) return;
    const act = a.dataset.act;
    const after = () => { sig = ''; load(true, true); };
    if (act === 'edit') editSheet(b, ctx, after);
    else changeStatus(b, act, ctx, after);
  });

  const ticker = setInterval(() => {
    host.querySelectorAll('[data-hold]').forEach(el => { el.textContent = holdText(el.dataset.hold); });
  }, 30000);

  await load(false);
  return {
    badge: true,
    poll: () => load(true),
    destroy: () => { alive = false; clearInterval(ticker); }
  };
}
