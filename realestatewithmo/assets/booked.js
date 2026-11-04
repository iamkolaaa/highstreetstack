import { api, errMsg } from './api.js?v=202611040819';
import { esc, href, param, ngn, fmtRange, fmtDay, fmtTime, waUrl } from './format.js?v=202611040819';
import { mountChrome, setWhatsApp, icon, stashedBooking } from './ui.js?v=202611040819';

mountChrome('');
const root = document.getElementById('root');
const ref = param('ref').toUpperCase();
const stash = ref ? stashedBooking(ref) : null;

const STATUS = {
  pending: ['Waiting for Mo to confirm', 'Mo will reply on WhatsApp. Until then your dates are held for you.'],
  confirmed: ['Confirmed', 'You are all set. Mo will send the details on WhatsApp.'],
  declined: ['Mo could not take this one', 'Message her and she will suggest other options.'],
  cancelled: ['Cancelled', 'Message Mo if you would like to rebook.'],
  expired: ['The hold has run out', 'Message Mo to check what is still free.'],
  done: ['Completed', 'Thank you. Mo would love to hear how it went.']
};
const KIND = { stay: 'Stay', inspection: 'Property inspection', consultation: 'Consultation' };

function rows(b) {
  const r = [];
  r.push(['Reference', b.ref]);
  r.push(['Type', KIND[b.kind] || b.kind]);
  if (b.property_title) r.push(['Place', b.property_title]);
  if (b.kind === 'stay') { r.push(['Dates', fmtRange(b.check_in, b.check_out)]); if (b.guests) r.push(['Guests', b.guests]); }
  else if (b.slot_date) r.push(['When', `${fmtDay(b.slot_date)}, ${fmtTime(b.slot_time)}`]);
  if (b.mode) r.push(['How', b.mode === 'online' ? 'Online call' : 'In person']);
  if (b.quote_ngn) r.push(['Total', ngn(b.quote_ngn)]);
  if (b.status === 'pending' && b.hold_until) r.push(['Held until', `${fmtDay(b.hold_until.slice(0, 10))}, ${fmtTime(b.hold_until.slice(11, 16))} (Lagos time)`]);
  return `<div class="summary">${r.map(([k, v]) => `<div><span>${esc(k)}</span><span style="text-align:right">${esc(v)}</span></div>`).join('')}</div>`;
}

function statusBlock(b) {
  const s = STATUS[b.status] || [b.status, ''];
  return `<div class="panel"><span class="badge badge-status-${esc(b.status)}">${esc(b.status)}</span><h3 style="margin:10px 0 4px">${esc(s[0])}</h3><p class="muted" style="margin:0">${esc(s[1])}</p></div>`;
}

function lookupForm(prefill) {
  return `<form class="panel" id="lk" novalidate><h3>Check your request</h3>
    <div class="field"><label for="lr">Reference</label><input class="input" id="lr" value="${esc(prefill)}" placeholder="RM-7K3F2" autocapitalize="characters" maxlength="12"></div>
    <div class="field"><label for="lp">Phone number you used</label><input class="input" id="lp" type="tel" inputmode="tel" autocomplete="tel"></div>
    <div class="form-err" id="le" hidden></div><div id="lres"></div>
    <button class="btn btn-outline btn-block" type="submit">Check status</button></form>`;
}

function wireLookup(settingsLike) {
  const f = document.getElementById('lk');
  if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('le'), res = document.getElementById('lres'), btn = f.querySelector('button');
    err.hidden = true; res.innerHTML = '';
    const rf = document.getElementById('lr').value.trim().toUpperCase(), ph = document.getElementById('lp').value.trim();
    if (!rf || !ph) { err.textContent = 'Add your reference and phone number.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Checking...';
    try {
      const r = await api('booking', { ref: rf, phone: ph });
      const b = r.booking;
      const wa = waUrl({ whatsapp_url: r.whatsapp_url || (settingsLike && settingsLike.whatsapp_url) }, `Hello Mo, about my request ${b.ref}${b.property_title ? ': ' + b.property_title : ''}.`);
      res.innerHTML = `${statusBlock(b)}${rows(b)}<a class="btn btn-wa btn-block" style="margin-bottom:14px" target="_blank" rel="noopener" href="${esc(wa)}">${icon('wa')}Message Mo about it</a>`;
      setWhatsApp({ whatsapp_url: r.whatsapp_url }, `Hello Mo, about my request ${b.ref}.`);
    } catch (x) { err.textContent = errMsg(x); err.hidden = false; }
    btn.disabled = false; btn.textContent = 'Check status';
  });
}

if (stash && stash.booking) {
  const b = stash.booking;
  const wa = waUrl({ whatsapp_url: stash.whatsapp_url }, stash.whatsapp_text || `Hello Mo, I have requested ${b.ref}.`);
  setWhatsApp({ whatsapp_url: stash.whatsapp_url }, `Hello Mo, about my request ${b.ref}.`);
  const next = b.kind === 'stay' ? 'Tap the button to send Mo your request on WhatsApp. She confirms there, usually within minutes.' : 'Tap the button to tell Mo on WhatsApp. She will confirm the time there.';
  root.innerHTML = `<div class="center"><div class="ticks">${icon('check')}</div><p class="eyebrow" style="justify-content:center">Request received</p><h1 style="font-size:clamp(2rem,7vw,2.8rem)">Thank you${stash.booking.name ? ', ' + esc(stash.booking.name) : ''}</h1>
    <p class="muted">Your reference</p><div class="ref">${esc(b.ref)}</div></div>
    <div style="margin:22px 0">${rows(b)}</div>
    <p class="muted">${esc(next)}</p>
    <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${esc(wa)}">${icon('wa')}Send to Mo on WhatsApp</a>
    <p class="hint center" style="margin-top:12px">Need to change or cancel? Message Mo on WhatsApp with your reference.</p>
    <div style="margin-top:34px">${lookupForm(b.ref)}</div>
    <p class="center"><a href="${esc(href('index.html'))}">Back to home</a></p>`;
  const ph = document.getElementById('lp'); if (ph && stash.phone) ph.value = stash.phone;
  wireLookup(stash);
} else {
  root.innerHTML = `<p class="eyebrow">Your request</p><h1 style="font-size:clamp(2rem,7vw,2.8rem)">Check on a <em class="gold">request</em></h1>
    <p class="muted">Enter the reference we gave you and the phone number you used.</p>${lookupForm(ref)}
    <p class="center"><a href="${esc(href('index.html'))}">Back to home</a></p>`;
  wireLookup(null);
}
