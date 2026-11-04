import { isUp } from './lib/board.js';

export const ENQUIRY_URL = 'https://script.google.com/macros/s/AKfycbzyyZ09tSvfzT12O3PaPwFx92hih4zh2iQ4U_0cxT7oNXhNqJxwRlLOxvtFIePpUCjN/exec';

const $ = id => document.getElementById(id);

// Light the dot on each work card whose site answered the daily uptime check.
export async function markLive() {
  let status;
  try {
    const res = await fetch('data/status.json', { cache: 'no-store' });
    if (!res.ok) return;
    status = await res.json();
  } catch (e) { console.warn('status.json unavailable', e); return; }
  document.querySelectorAll('[data-project]').forEach(card => {
    card.classList.toggle('up', isUp(status, card.dataset.project));
  });
}

function setMsg(text, isError) {
  const m = $('form-msg');
  m.textContent = text;
  m.classList.toggle('err', Boolean(isError));
  m.hidden = false;
}

async function submitEnquiry(e) {
  e.preventDefault();
  const name = $('name'), email = $('email');
  if (!name.value.trim()) { setMsg('Enter your name first.', true); name.focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { setMsg('Enter a valid email address.', true); email.focus(); return; }
  const btn = $('send');
  btn.disabled = true; btn.textContent = 'Sending…';
  const body = {
    name: name.value.trim(), biz: $('biz').value.trim(), email: email.value.trim(),
    phone: $('phone').value.trim(), msg: $('msg').value.trim(), hss_ref: $('hss_ref').value,
    source: location.href
  };
  try {
    if (!ENQUIRY_URL) throw new Error('no endpoint');
    // text/plain avoids a CORS preflight, which the receiver cannot answer.
    const res = await fetch(ENQUIRY_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'rejected');
    btn.textContent = 'Sent';
    setMsg("Received. You'll get a reply within one working day.", false);
  } catch (err) {
    console.warn('enquiry failed', err);
    btn.disabled = false; btn.textContent = 'Send enquiry';
    setMsg("Couldn't send. Email hello@highstreetstack.com instead.", true);
  }
}

$('enquiry').addEventListener('submit', submitEnquiry);
['name', 'email'].forEach(id => $(id).addEventListener('input', () => { $('form-msg').hidden = true; }));
markLive();
