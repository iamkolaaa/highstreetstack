/* Per-property calendar: month view, tap two days to block, tap a block to remove, tap a booking to open it. */
import { renderCalendar } from '../calendar.js?v=202611040820';
import { openBooking } from './inbox.js?v=202611040820';

const KEY = 'rm_cal_prop';
const REASONS = ['Owner stay', 'Cleaning', 'Maintenance', 'Booked elsewhere'];

function monthOf(d) { return d.slice(0, 7); }

export async function render(root, ctx, param) {
  const { esc, f } = ctx;
  const list = (await ctx.props()).filter(p => p.status !== 'archived');
  if (!list.length) {
    root.innerHTML = '<div class="a-head"><h1>Calendar</h1></div><div class="a-empty"><h3>No properties yet</h3><p>Add a property first, then its calendar shows here.</p><a class="btn btn-primary" href="#property/new">Add a property</a></div>';
    return null;
  }
  let id = param;
  if (!id) { try { id = sessionStorage.getItem(KEY) || ''; } catch (e) { id = ''; } }
  if (!list.find(p => p.id === id)) id = list[0].id;
  try { sessionStorage.setItem(KEY, id); } catch (e) { /* ignore */ }

  const today = f.todayLagos();
  let month = monthOf(today);
  let data = { ranges: [], bookings: [], blocks: [] };
  let first = ''; // first tapped day while making a block
  let cal = null;
  let alive = true;
  let seq = 0;
  const prop = () => list.find(p => p.id === id);

  root.innerHTML =
    '<div class="a-head"><h1>Calendar</h1></div>' +
    '<label class="field"><span class="a-lbl">Property</span><select class="select a-big" id="cp">' +
    list.map(p => '<option value="' + esc(p.id) + '"' + (p.id === id ? ' selected' : '') + '>' + esc(p.title) + (p.status === 'hidden' ? ' (hidden)' : '') + '</option>').join('') +
    '</select></label>' +
    '<div class="a-card cal-card"><div id="cc"></div></div>' +
    '<p class="cal-hint" id="ch" role="status"></p>' +
    '<ul class="cal-legend" aria-label="Key"><li><i class="lg lg-booked"></i>Booked</li><li><i class="lg lg-pending"></i>Waiting for you</li><li><i class="lg lg-blocked"></i>Blocked</li><li><i class="lg lg-imported"></i>Imported</li></ul>' +
    '<div class="a-row-btns"><button type="button" class="btn btn-outline" id="c-add">' + ctx.icons.plus + '<span>Add a booking</span></button>' +
    '<button type="button" class="btn btn-outline" id="c-ical">' + ctx.icons.copy + '<span>Copy iCal link</span></button></div>' +
    '<h2 class="a-h2">This month</h2><div id="cl" class="cal-list"></div>';
  const hint = root.querySelector('#ch');

  function setHint() {
    if (first) {
      hint.innerHTML = 'Blocking from <b>' + esc(f.fmtDay(first)) + '</b>. Tap the last day to block. <button type="button" class="a-link" id="c-x">Cancel</button>';
      const x = hint.querySelector('#c-x');
      x.addEventListener('click', () => { first = ''; cal.setSelected(null); setHint(); });
    } else {
      hint.textContent = 'Tap a free day, then another day, to block dates. Tap a grey block to remove it. Tap a booking to open it.';
    }
  }

  function rangeOn(date) {
    return (data.ranges || []).find(r => r.from <= date && date < r.to);
  }

  async function load() {
    const my = ++seq;
    const from = month + '-01';
    const to = f.addDays(from, 42);
    try {
      const r = await ctx.api('calendar', { property_id: id, from, to });
      if (!alive || my !== seq) return;
      data = { ranges: r.ranges || [], bookings: r.bookings || [], blocks: r.blocks || [] };
    } catch (e) {
      if (!alive || my !== seq) return;
      ctx.toast(e.message || 'Could not load the calendar.', 'bad');
    }
    if (cal) cal.setRanges(data.ranges);
    paintList();
  }

  function paintList() {
    const host = root.querySelector('#cl');
    if (!host) return;
    const m0 = month + '-01';
    const ym = month.split('-').map(Number);
    const end = ym[1] === 12 ? (ym[0] + 1) + '-01-01' : ym[0] + '-' + String(ym[1] + 1).padStart(2, '0') + '-01';
    const items = (data.ranges || []).filter(r => r.from < end && r.to > m0).sort((a, b) => (a.from < b.from ? -1 : 1));
    if (!items.length) { host.innerHTML = '<p class="a-muted">Nothing booked or blocked this month.</p>'; return; }
    host.innerHTML = items.map(r => {
      const label = r.label || ({ booked: 'Booked', pending: 'Waiting for you', blocked: 'Blocked', imported: 'Imported' }[r.kind] || '');
      return '<button type="button" class="cl-row" data-from="' + esc(r.from) + '"><i class="lg lg-' + esc(r.kind) + '"></i><span class="cl-t"><b>' + esc(label) + '</b>' +
        '<small>' + esc(f.fmtRange(r.from, r.to)) + '</small></span><span class="cl-go" aria-hidden="true">›</span></button>';
    }).join('');
  }

  async function dayTap(date, state) {
    const r = rangeOn(date);
    if (r && (['booked', 'pending', 'blocked', 'imported'].includes(state) || state === undefined)) {
      first = ''; cal.setSelected(null); setHint();
      await openRange(r);
      return;
    }
    if (state === 'past' || date < today) { ctx.toast('That day has passed.', 'bad'); return; }
    if (!first) {
      first = date;
      cal.setSelected({ from: date, to: null });
      setHint();
      return;
    }
    let a = first;
    let b = date;
    if (b < a) [a, b] = [b, a];
    first = ''; cal.setSelected(null); setHint();
    blockSheet(a, b);
  }

  async function openRange(r) {
    if (r.kind === 'blocked' && r.block_id) {
      const blk = (data.blocks || []).find(x => x.id === r.block_id);
      const yes = await ctx.confirm('Remove this block (' + f.fmtRange(r.from, r.to) + (blk && blk.reason ? ', ' + blk.reason : '') + ')? The dates become free again.', { ok: 'Remove block', danger: true, title: 'Remove block?' });
      if (!yes) return;
      try { await ctx.api('delete_block', { id: r.block_id }); ctx.toast('Block removed.', 'ok'); load(); } catch (e) { ctx.toast(e.message, 'bad'); }
    } else if (r.kind === 'imported') {
      ctx.toast('That one comes from the imported calendar. Remove it there.', 'bad');
    } else if (r.ref) {
      const b = (data.bookings || []).find(x => x.ref === r.ref);
      if (b) openBooking(b, ctx, load);
      else ctx.toast('Could not find that booking.', 'bad');
    } else {
      ctx.toast(r.label || 'Already taken.', 'bad');
    }
  }

  function blockSheet(a, b) {
    const to = f.addDays(b, 1);
    const days = f.nights(a, to);
    const s = ctx.sheet({
      title: 'Block these dates?',
      html: '<form id="bf" class="a-form" novalidate><p class="a-p"><b>' + esc(f.fmtDay(a)) + (a === b ? '' : ' to ' + esc(f.fmtDay(b))) + '</b><br><span class="a-muted">' +
        days + (days === 1 ? ' day' : ' days') + ' on ' + esc(prop().title) + '. Guests will not be able to book them.</span></p>' +
        '<label class="field"><span class="a-lbl">Reason (only you see it)</span><input class="input" name="reason" maxlength="80" placeholder="e.g. Owner stay" autocomplete="off"></label>' +
        '<div class="chips a-chips">' + REASONS.map(x => '<button type="button" class="chip" data-r="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' +
        '<p class="a-err" id="bf-err" role="alert"></p>' +
        '<button class="btn btn-primary a-block" type="submit">Block dates</button></form>'
    });
    const form = s.body.querySelector('#bf');
    form.addEventListener('click', e => {
      const c = e.target.closest('[data-r]');
      if (c) form.elements.reason.value = c.dataset.r;
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await ctx.api('add_block', { property_id: id, from: a, to, reason: form.elements.reason.value.trim() });
        ctx.toast('Dates blocked.', 'ok');
        s.close();
        load();
      } catch (er) {
        form.querySelector('#bf-err').textContent = er.message || 'Could not block those dates.';
        btn.disabled = false;
      }
    });
  }

  function bookingSheet() {
    const p = prop();
    const s = ctx.sheet({
      title: 'Add a booking',
      html: '<form id="af" class="a-form" novalidate><p class="a-muted">For a stay you took by phone or on another site. It goes straight to confirmed on ' + esc(p.title) + '.</p>' +
        '<label class="field"><span class="a-lbl">Guest name</span><input class="input" name="name" maxlength="80" autocomplete="off"></label>' +
        '<label class="field"><span class="a-lbl">Phone (optional)</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="off"></label>' +
        '<div class="a-two"><label class="field"><span class="a-lbl">Check-in</span><input class="input" type="date" name="check_in" min="' + esc(today) + '"></label>' +
        '<label class="field"><span class="a-lbl">Check-out</span><input class="input" type="date" name="check_out" min="' + esc(today) + '"></label></div>' +
        '<label class="field"><span class="a-lbl">Guests</span><input class="input" type="number" name="guests" min="1" max="30" value="2" inputmode="numeric"></label>' +
        '<label class="field"><span class="a-lbl">Note (optional)</span><input class="input" name="note" maxlength="300" placeholder="e.g. Airbnb booking"></label>' +
        '<p class="a-err" id="af-err" role="alert"></p><button class="btn btn-primary a-block" type="submit">Add booking</button></form>'
    });
    const form = s.body.querySelector('#af');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = form.elements;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await ctx.api('admin_booking', {
          kind: 'stay', property_id: id, check_in: v.check_in.value, check_out: v.check_out.value,
          guests: Number(v.guests.value) || 1, name: v.name.value.trim(), phone: v.phone.value.trim(), note: v.note.value.trim(), status: 'confirmed'
        });
        ctx.toast('Booking added.', 'ok');
        s.close();
        load();
      } catch (er) {
        form.querySelector('#af-err').textContent = er.message || 'Could not add that booking.';
        btn.disabled = false;
      }
    });
  }

  cal = renderCalendar(root.querySelector('#cc'), {
    month, minDate: today, maxDate: f.addDays(today, 730), ranges: [], mode: 'admin', selected: null, legend: false,
    onSelect: () => { /* selection is handled through onDayTap */ },
    onDayTap: (date, state) => dayTap(date, state),
    onMonth: m => { month = m; first = ''; setHint(); load(); }
  });
  setHint();

  root.querySelector('#cp').addEventListener('change', e => {
    location.hash = '#calendar/' + encodeURIComponent(e.target.value);
  });
  root.querySelector('#c-add').addEventListener('click', bookingSheet);
  root.querySelector('#c-ical').addEventListener('click', () => {
    const url = prop().ical_url;
    if (!url) { ctx.toast('No iCal link for this property yet.', 'bad'); return; }
    ctx.copy(url, 'iCal link copied. Paste it into Airbnb or Google Calendar.');
  });
  root.querySelector('#cl').addEventListener('click', e => {
    const row = e.target.closest('[data-from]');
    if (!row) return;
    const r = rangeOn(row.dataset.from) || (data.ranges || []).find(x => x.from === row.dataset.from);
    if (r) openRange(r);
  });

  load();
  return {
    poll: async () => { await load(); },
    destroy: () => { alive = false; if (cal && cal.destroy) cal.destroy(); }
  };
}
