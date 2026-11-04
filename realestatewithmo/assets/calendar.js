import { esc, addDays, todayLagos, monthLabel, weekday, fmtLong } from './format.js?v=202611040820';
import { toast } from './ui.js?v=202611040820';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = n => String(n).padStart(2, '0');
const monthOf = d => d.slice(0, 7);
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + (mo - 1) + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
const daysIn = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };

/*
  renderCalendar(el, { month, minDate, maxDate, ranges, mode, selected, onSelect, onDayTap, onMonth, legend })
  ranges are half-open [from, to). mode: 'select' (tap in, tap out), 'view', 'admin' (every tap goes to onDayTap).
*/
export function renderCalendar(el, opts = {}) {
  const mode = opts.mode || 'view';
  const today = todayLagos();
  const minDate = opts.minDate || today;
  const maxDate = opts.maxDate || '';
  let ranges = (opts.ranges || []).slice();
  let selected = opts.selected || null;
  let anchor = selected && selected.from && !selected.to ? selected.from : null;
  let month = opts.month || monthOf((selected && selected.from) || minDate);
  let alive = true;

  const kindOf = r => (mode === 'admin' ? r.kind || 'booked' : 'booked');
  const occupied = d => ranges.find(r => r.from <= d && d < r.to) || null;

  function stateOf(d) {
    if (d < minDate || (maxDate && d > maxDate)) return { s: 'past' };
    const r = occupied(d);
    if (!r) return { s: 'free' };
    if (mode === 'select' && r.from === d && !occupied(addDays(d, -1))) return { s: 'checkout-only', r };
    return { s: kindOf(r), r };
  }

  function nightsFree(a, b) {
    for (let d = a; d < b; d = addDays(d, 1)) if (occupied(d)) return false;
    return true;
  }

  function render() {
    if (!alive) return;
    const first = `${month}-01`;
    const lead = (weekday(first) + 6) % 7;
    const n = daysIn(month);
    const prevOff = monthOf(minDate) >= month;
    const nextOff = maxDate && monthOf(maxDate) <= month;
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-day pad"></span>';
    const selFrom = selected && selected.from, selTo = selected && selected.to;
    for (let i = 1; i <= n; i++) {
      const d = `${month}-${pad(i)}`;
      const st = stateOf(d);
      let cls = 'cal-day ' + st.s;
      if (mode === 'admin' && st.s === 'booked') cls += ' adm';
      if (d === today) cls += ' today';
      if (selFrom) {
        if (d === selFrom) cls += ' sel-start';
        if (selTo && d === selTo) cls += ' sel-end';
        if (selTo && d > selFrom && d < selTo) cls += ' in-range';
      }
      const dis = st.s === 'past';
      const label = `${fmtLong(d)}${st.s === 'free' ? '' : st.s === 'past' ? ', not available' : st.s === 'checkout-only' ? ', check-out only' : ', ' + (mode === 'admin' ? st.s : 'booked')}`;
      cells += `<button type="button" class="${cls}" data-d="${d}" ${dis ? 'disabled' : ''} aria-label="${esc(label)}">${i}</button>`;
    }
    const legend = opts.legend === false ? '' : mode === 'admin'
      ? '<div class="cal-legend"><span><i style="background:rgba(76,217,138,.5)"></i>Confirmed</span><span><i style="background:rgba(255,207,102,.5)"></i>Pending</span><span><i style="background:rgba(138,138,138,.5)"></i>Blocked</span><span><i style="background:rgba(111,178,255,.5)"></i>Imported</span></div>'
      : '<div class="cal-legend"><span><i style="border:1px solid var(--line)"></i>Free</span><span><i style="background:repeating-linear-gradient(135deg,#2e2144 0 3px,transparent 3px 5px)"></i>Booked</span><span><i style="background:var(--purple-2)"></i>Your dates</span></div>';
    el.innerHTML = `<div class="cal" role="group" aria-label="Calendar, ${esc(monthLabel(month))}">
      <div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Previous month" ${prevOff ? 'disabled' : ''}>&#8249;</button><div class="cal-title" aria-live="polite">${esc(monthLabel(month))}</div><button type="button" class="cal-nav" data-nav="1" aria-label="Next month" ${nextOff ? 'disabled' : ''}>&#8250;</button></div>
      <div class="cal-dow" aria-hidden="true">${DOW.map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>${legend}</div>`;
  }

  function go(n) {
    const m = shiftMonth(month, n);
    if (n < 0 && monthOf(minDate) > m) return;
    if (n > 0 && maxDate && monthOf(maxDate) < m) return;
    month = m;
    render();
    if (opts.onMonth) opts.onMonth(month);
  }

  function tap(d) {
    const st = stateOf(d);
    if (mode === 'admin') { if (opts.onDayTap) opts.onDayTap(d, st.s); return; }
    if (opts.onDayTap) opts.onDayTap(d, st.s);
    if (mode !== 'select') return;
    if (st.s === 'past') return;
    if (!anchor) {
      if (st.s !== 'free') { toast(st.s === 'checkout-only' ? 'Pick your check-in first.' : 'That date is not available.', 'err'); return; }
      anchor = d; selected = { from: d, to: null };
      render();
      return;
    }
    if (d <= anchor) {
      if (st.s !== 'free') { toast('That date is not available.', 'err'); return; }
      anchor = d; selected = { from: d, to: null };
      render();
      return;
    }
    if (st.s !== 'free' && st.s !== 'checkout-only') { toast('That date is not available.', 'err'); return; }
    if (!nightsFree(anchor, d)) { toast('Some of those nights are booked. Pick a shorter stay.', 'err'); return; }
    selected = { from: anchor, to: d };
    anchor = null;
    render();
    if (opts.onSelect) opts.onSelect({ from: selected.from, to: selected.to });
  }

  const onClick = e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { go(Number(nav.dataset.nav)); return; }
    const b = e.target.closest('[data-d]');
    if (b && !b.disabled) tap(b.dataset.d);
  };
  let sx = 0, sy = 0;
  const onStart = e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; };
  const onEnd = e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };
  el.addEventListener('click', onClick);
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  render();

  return {
    setMonth(m) { month = m; render(); },
    setRanges(r) { ranges = (r || []).slice(); render(); },
    setSelected(s) { selected = s || null; anchor = selected && selected.from && !selected.to ? selected.from : null; if (selected && selected.from && !opts.month) month = monthOf(selected.from) === month ? month : month; render(); },
    destroy() { alive = false; el.removeEventListener('click', onClick); el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); el.innerHTML = ''; }
  };
}
