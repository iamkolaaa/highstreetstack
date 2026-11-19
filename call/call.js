import { ENQUIRY_URL } from '../lib/config.js';
import { londonNow, bookableDays, openSlots } from '../lib/slots.js';

const $ = id => document.getElementById(id);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const state = { date: null, time: null, taken: new Set() };

const parts = date => { const [y, m, d] = date.split('-').map(Number); return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() }; };
const label = (date, time) => { const p = parts(date); return `${DAY_NAMES[p.wd]} ${p.d} ${MONTHS[p.m - 1]} at ${time}`; };

async function loadTaken() {
  try {
    const res = await fetch(ENQUIRY_URL + '?action=slots', { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data.taken)) state.taken = new Set(data.taken);
  } catch (e) { console.warn('could not load booked times', e); }
}

function radio(btn, on) { btn.setAttribute('aria-checked', String(on)); btn.tabIndex = on ? 0 : -1; }

function renderDays() {
  const days = bookableDays(londonNow(), state.taken);
  const box = $('days');
  box.textContent = '';
  if (!state.date || !days.some(d => d.date === state.date && d.open)) state.date = (days.find(d => d.open) || {}).date || null;
  for (const d of days) {
    const p = parts(d.date);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'day'; b.setAttribute('role', 'radio');
    b.disabled = !d.open;
    b.innerHTML = `<i>${DAY_NAMES[p.wd]}</i><b>${p.d}</b><i>${MONTHS[p.m - 1]}</i>`;
    b.setAttribute('aria-label', `${DAY_NAMES[p.wd]} ${p.d} ${MONTHS[p.m - 1]}${d.open ? '' : ', fully booked'}`);
    radio(b, d.date === state.date);
    b.addEventListener('click', () => { state.date = d.date; state.time = null; renderDays(); });
    box.append(b);
  }
  renderTimes();
}

function renderTimes() {
  const box = $('times');
  box.textContent = '';
  const slots = state.date ? openSlots(state.date, londonNow(), state.taken) : [];
  if (!slots.length) { box.innerHTML = '<p class="empty">No times left. Email hello@highstreetstack.com and I\'ll fit you in.</p>'; }
  for (const t of slots) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'time'; b.textContent = t; b.setAttribute('role', 'radio');
    radio(b, t === state.time);
    b.addEventListener('click', () => {
      state.time = t; renderTimes(); $('form-msg').hidden = true;
      if (matchMedia('(max-width: 859px)').matches) $('chosen').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    box.append(b);
  }
  const c = $('chosen');
  c.textContent = state.time ? label(state.date, state.time) + ' (20 minutes)' : 'No time picked yet';
  c.classList.toggle('none', !state.time);
}

function setMsg(text) { const m = $('form-msg'); m.textContent = text; m.classList.add('err'); m.hidden = false; }

const ERRORS = {
  'time taken': 'Someone just booked that time. Pick another.',
  'time not available': 'That time has gone. Pick another.',
  'valid phone required': 'Enter a phone number I can ring.',
  'valid email required': 'Enter a valid email address.',
  'too many requests': 'Too many bookings from this email. Email hello@highstreetstack.com instead.'
};

async function submit(e) {
  e.preventDefault();
  const v = id => $(id).value.trim();
  if (!state.time) return setMsg('Pick a day and time first.');
  if (!v('name')) { $('name').focus(); return setMsg('Enter your name.'); }
  if ((v('phone').match(/\d/g) || []).length < 7) { $('phone').focus(); return setMsg('Enter a phone number I can ring.'); }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) { $('email').focus(); return setMsg('Enter a valid email address.'); }
  const btn = $('send');
  btn.disabled = true; btn.textContent = 'Booking…';
  const when = label(state.date, state.time);
  const body = {
    type: 'call', date: state.date, time: state.time,
    name: v('name'), phone: v('phone'), email: v('email'), biz: v('biz'), topic: v('topic'), hss_ref: $('hss_ref').value,
    // Older receivers without call support file this as an ordinary enquiry.
    msg: `Call booking: ${when} (20 min). ${v('topic')}`, source: location.href
  };
  try {
    const res = await fetch(ENQUIRY_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'time taken' || data.error === 'time not available') { state.taken.add(state.date + ' ' + state.time); state.time = null; renderDays(); }
      throw new Error(data.error || 'rejected');
    }
    $('done-when').textContent = when;
    $('book').reset(); state.taken.add(state.date + ' ' + state.time); state.time = null; renderDays();
    $('done').showModal();
  } catch (err) {
    console.warn('booking failed', err);
    setMsg(ERRORS[err.message] || "Couldn't book. Email hello@highstreetstack.com or try again.");
  } finally {
    btn.disabled = false; btn.textContent = 'Book my call';
  }
}

$('book').addEventListener('submit', submit);
renderDays();
loadTaken().then(renderDays);
