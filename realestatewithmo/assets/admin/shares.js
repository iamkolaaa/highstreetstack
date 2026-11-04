/* Share links: list and the builder. One link with Mo's main pick plus recommendations. */
import * as T from './templates.js?v=202611040820';

function expiryText(s, f) {
  if (s.status === 'expired') return 'Expired';
  if (s.status === 'deleted') return 'Removed';
  if (!s.expires) return 'No expiry';
  const left = f.nights(f.todayLagos(), s.expires);
  if (left < 0) return 'Expired';
  if (left === 0) return 'Expires today';
  return 'Expires in ' + left + (left === 1 ? ' day' : ' days');
}

export async function render(root, ctx, param) {
  if (param === 'new') return builder(root, ctx);
  return list(root, ctx);
}

/* ---------------- list ---------------- */
async function list(root, ctx) {
  const { esc, f, icons } = ctx;
  let props = [];
  try { props = await ctx.props(); } catch (e) { props = []; }
  const title = id => (props.find(p => p.id === id) || {}).title || 'A property';
  let shares = (await ctx.api('shares')).shares || [];

  function row(s) {
    const live = s.status === 'active' && !/^Expired/.test(expiryText(s, f));
    const n = (s.pick_ids || []).length;
    return '<li class="sh' + (live ? '' : ' off') + '" data-code="' + esc(s.code) + '">' +
      '<div class="sh-top"><b>' + esc(s.client_name || 'No name') + '</b><span class="a-pill ' + (live ? 's-confirmed' : 's-expired') + '">' + esc(expiryText(s, f)) + '</span></div>' +
      '<div class="sh-main">' + esc(title(s.featured_id)) + (n ? ' <span class="a-muted">+ ' + n + (n === 1 ? ' pick' : ' picks') + '</span>' : '') + '</div>' +
      (s.check_in && s.check_out ? '<div class="a-muted">' + esc(f.fmtRange(s.check_in, s.check_out)) + '</div>' : '') +
      '<div class="a-muted sh-meta">' + icons.eye.replace('width="24" height="24"', 'width="16" height="16"') + ' ' + esc(s.views || 0) + (Number(s.views) === 1 ? ' view' : ' views') +
      (s.last_viewed ? ' · last ' + esc(s.last_viewed) : ' · not opened yet') + '</div>' +
      (s.note ? '<p class="sh-note">' + esc(s.note) + '</p>' : '') +
      '<div class="bk-acts sec">' +
      '<button type="button" class="btn btn-outline" data-a="copy">' + icons.copy + '<span>Copy</span></button>' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(T.waPick(T.shareLink(s, {}))) + '">' + icons.wa + '<span>WhatsApp</span></a>' +
      (live ? '<button type="button" class="btn btn-outline btn-warn" data-a="expire">Expire</button>' : '') + '</div></li>';
  }

  function paint() {
    root.innerHTML =
      '<div class="a-head"><h1>Links</h1><a class="btn btn-primary a-sm" href="#shares/new">' + icons.plus + '<span>New link</span></a></div>' +
      '<p class="a-muted a-lead">Send one link with your main pick and a few more. Your client sees photos, prices and what is free, and can book from it.</p>' +
      (shares.length ? '<ul class="shl">' + shares.map(row).join('') + '</ul>' :
        '<div class="a-empty"><h3>No links yet</h3><p>Make your first link and send it on WhatsApp.</p><a class="btn btn-primary" href="#shares/new">Make a link</a></div>');
  }
  paint();

  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const code = b.closest('[data-code]').dataset.code;
    const s = shares.find(x => x.code === code);
    if (!s) return;
    if (b.dataset.a === 'copy') ctx.copy(s.url || ctx.SITE_URL + 'share.html?s=' + s.code, 'Link copied.');
    if (b.dataset.a === 'expire') {
      if (!(await ctx.confirm('Expire this link? ' + (s.client_name || 'Your client') + ' will see that it has expired.', { ok: 'Expire link', danger: true, title: 'Expire link?' }))) return;
      try {
        const r = await ctx.api('update_share', { code, status: 'expired' });
        shares = shares.map(x => (x.code === code ? Object.assign({}, x, r.share || { status: 'expired' }) : x));
        paint();
        ctx.toast('Link expired.', 'ok');
      } catch (er) { ctx.toast(er.message || 'Could not expire it.', 'bad'); }
    }
  });
  return null;
}

/* ---------------- builder ---------------- */
async function builder(root, ctx) {
  const { esc, f, icons } = ctx;
  const S = ctx.getSettings();
  const today = f.todayLagos();
  let items = [];
  let featured = '';
  const picks = [];
  let q = '';
  let alive = true;
  let seq = 0;
  let dates = { in: '', out: '' };

  root.innerHTML =
    '<div class="a-head"><a class="icon-btn" href="#shares" aria-label="Back to links">' + icons.back + '</a><h1>New link</h1></div>' +
    '<div id="sb"><form id="sf" class="a-form" novalidate>' +
    '<section class="a-card"><h2 class="a-h2">Who is it for?</h2>' +
    '<label class="field"><span class="a-lbl">Client name (optional)</span><input class="input" name="client_name" maxlength="60" autocomplete="off" placeholder="e.g. Tunde"></label>' +
    '<div class="a-two"><label class="field"><span class="a-lbl">Check-in (optional)</span><input class="input" type="date" name="check_in" min="' + esc(today) + '"></label>' +
    '<label class="field"><span class="a-lbl">Check-out (optional)</span><input class="input" type="date" name="check_out" min="' + esc(today) + '"></label></div>' +
    '<p class="a-help" id="sd-h">Add dates and free places come first, with "Free" or "Booked" shown on each.</p></section>' +

    '<section class="a-card"><h2 class="a-h2">Pick the places</h2>' +
    '<label class="field"><span class="a-lbl">Search</span><input class="input" type="search" id="sq" placeholder="Name or area" autocomplete="off"></label>' +
    '<h3 class="a-h3">Main pick <small class="a-muted">choose one</small></h3><div id="sl-f" class="sp-list" role="radiogroup" aria-label="Main pick"></div>' +
    '<h3 class="a-h3">Also recommend <small class="a-muted" id="sl-n">0 of 6</small></h3><div id="sl-p" class="sp-list"></div></section>' +

    '<section class="a-card"><h2 class="a-h2">Message and expiry</h2>' +
    '<label class="field"><span class="a-lbl">Note to your client (optional)</span><textarea class="textarea" name="note" rows="3" maxlength="300" data-count="300" placeholder="e.g. This is the one I would pick for your dates."></textarea><small class="a-help" id="sn-c">0 of 300</small></label>' +
    '<label class="field"><span class="a-lbl">Link works for</span><select class="select" name="expiry_days">' +
    [1, 3, 7, 14, 30, 60, 90].map(n => '<option value="' + n + '"' + (n === (Number(S.share_expiry_days) || 14) ? ' selected' : '') + '>' + n + (n === 1 ? ' day' : ' days') + '</option>').join('') + '</select></label>' +
    '</section>' +
    '<p class="a-err" id="sf-err" role="alert"></p>' +
    '<div class="a-savebar"><button type="submit" class="btn btn-primary a-block" id="sf-go">Make the link</button></div></form></div>';

  const form = root.querySelector('#sf');
  const err = root.querySelector('#sf-err');

  async function loadItems() {
    const my = ++seq;
    const params = {};
    if (dates.in && dates.out && dates.out > dates.in) { params.check_in = dates.in; params.check_out = dates.out; }
    try {
      const r = await ctx.api('properties', params);
      if (!alive || my !== seq) return;
      items = r.properties || [];
    } catch (e) {
      if (!alive || my !== seq) return;
      ctx.toast(e.message || 'Could not load properties.', 'bad');
    }
    paintLists();
  }

  const hasDates = () => !!(dates.in && dates.out && dates.out > dates.in);

  function ordered() {
    const text = q.trim().toLowerCase();
    let list = items.filter(p => !text || (p.title + ' ' + p.area).toLowerCase().includes(text));
    if (hasDates()) list = list.slice().sort((a, b) => (b.available === true) - (a.available === true));
    return list;
  }

  function avail(p) {
    if (!hasDates() || p.available === undefined) return '';
    return p.available ? '<span class="a-pill s-confirmed">Free</span>' : '<span class="a-pill s-declined">Booked</span>';
  }

  function itemHtml(p, type) {
    const cover = p.cover || (p.photos && p.photos[0]);
    const on = type === 'f' ? featured === p.id : picks.includes(p.id);
    const off = type === 'p' && featured === p.id;
    return '<label class="sp' + (on ? ' on' : '') + (off ? ' dis' : '') + '"><input type="' + (type === 'f' ? 'radio' : 'checkbox') + '" name="' + (type === 'f' ? 'main' : 'pick') + '" value="' + esc(p.id) + '"' + (on ? ' checked' : '') + (off ? ' disabled' : '') + '>' +
      '<span class="sp-img">' + (cover ? '<img src="' + esc(f.photoSrc(cover, 160)) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
      '<span class="sp-t"><b>' + esc(p.title) + '</b><small>' + esc(p.area) + ' · ' + esc(f.priceLabel(p)) + '</small></span>' + avail(p) +
      '<span class="sp-tick" aria-hidden="true">' + icons.check + '</span></label>';
  }

  function paintLists() {
    const list = ordered();
    const empty = '<p class="a-muted">' + (items.length ? 'Nothing matches that search.' : 'No live properties yet.') + '</p>';
    root.querySelector('#sl-f').innerHTML = list.length ? list.map(p => itemHtml(p, 'f')).join('') : empty;
    root.querySelector('#sl-p').innerHTML = list.length ? list.map(p => itemHtml(p, 'p')).join('') : empty;
    root.querySelector('#sl-n').textContent = picks.length + ' of 6';
  }

  root.querySelector('#sq').addEventListener('input', e => { q = e.target.value; paintLists(); });
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'main') {
      featured = t.value;
      const i = picks.indexOf(featured);
      if (i >= 0) picks.splice(i, 1);
      paintLists();
    } else if (t.name === 'pick') {
      const i = picks.indexOf(t.value);
      if (t.checked && i < 0) {
        if (picks.length >= 6) { t.checked = false; ctx.toast('Six picks at most.', 'bad'); return; }
        picks.push(t.value);
      } else if (!t.checked && i >= 0) picks.splice(i, 1);
      paintLists();
    } else if (t.name === 'check_in' || t.name === 'check_out') {
      dates = { in: form.elements.check_in.value, out: form.elements.check_out.value };
      const h = root.querySelector('#sd-h');
      if (dates.in && dates.out && dates.out <= dates.in) h.textContent = 'Pick a check-out date after the check-in date.';
      else h.textContent = 'Add dates and free places come first, with "Free" or "Booked" shown on each.';
      loadItems();
    }
  });
  form.elements.note.addEventListener('input', e => { root.querySelector('#sn-c').textContent = e.target.value.length + ' of 300'; });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    if (!featured) { err.textContent = 'Choose your main pick first.'; root.querySelector('#sl-f').scrollIntoView({ block: 'center' }); return; }
    if ((dates.in || dates.out) && !hasDates()) { err.textContent = 'Add both dates, or clear them.'; return; }
    const v = form.elements;
    const params = {
      featured_id: featured, pick_ids: picks.slice(), note: v.note.value.trim(), client_name: v.client_name.value.trim(),
      expiry_days: Number(v.expiry_days.value) || 14
    };
    if (hasDates()) { params.check_in = dates.in; params.check_out = dates.out; }
    const btn = root.querySelector('#sf-go');
    btn.disabled = true; btn.textContent = 'Making your link...';
    try {
      const r = await ctx.api('create_share', params);
      done(r.share, r.whatsapp_text);
    } catch (er) {
      err.textContent = er.message || 'Could not make the link.';
      btn.disabled = false; btn.textContent = 'Make the link';
    }
  });

  function done(share, text) {
    const url = share.url || ctx.SITE_URL + 'share.html?s=' + share.code;
    const msg = text || T.shareLink(Object.assign({}, share, { url }), {});
    const fp = items.find(p => p.id === share.featured_id);
    const sel = share.pick_ids || picks;
    root.querySelector('#sb').innerHTML =
      '<div class="a-done"><div class="a-tick" aria-hidden="true">' + icons.check + '</div>' +
      '<h2>Your link is ready</h2>' +
      '<p class="a-muted">' + (share.client_name ? 'For ' + esc(share.client_name) + '. ' : '') + esc(fp ? fp.title : 'Your main pick') + (sel.length ? ' and ' + sel.length + (sel.length === 1 ? ' more place.' : ' more places.') : '.') + '</p>' +
      '<input class="input a-linkbox" readonly value="' + esc(url) + '" aria-label="Your link" onfocus="this.select()">' +
      '<button type="button" class="btn btn-primary a-block a-huge" id="d-copy">' + icons.copy + '<span>Copy link</span></button>' +
      '<a class="btn btn-wa a-block a-huge" target="_blank" rel="noopener" href="' + esc(T.waPick(msg)) + '">' + icons.wa + '<span>Send on WhatsApp</span></a>' +
      '<details class="a-peek"><summary>See the message</summary><pre class="a-preview">' + esc(msg) + '</pre></details>' +
      '<div class="a-row-btns"><a class="btn btn-outline" href="' + esc(url) + '" target="_blank" rel="noopener">Open the page</a>' +
      '<a class="btn btn-outline" href="#shares">All links</a></div></div>';
    root.querySelector('#d-copy').addEventListener('click', () => ctx.copy(url, 'Link copied.'));
    window.scrollTo(0, 0);
  }

  await loadItems();
  return { destroy: () => { alive = false; } };
}
