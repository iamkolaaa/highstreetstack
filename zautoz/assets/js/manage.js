(function () {
  const { fmt } = ZA, P = ZAP, esc = fmt.esc;
  const form = document.getElementById('find'), refEl = document.getElementById('ref'), phEl = document.getElementById('phone');
  const ferr = document.getElementById('ferr'), btn = document.getElementById('fbtn'), out = document.getElementById('result');
  let cur = null;

  const statusTag = {
    requested: ['orange', 'Requested'], confirmed: ['green', 'Confirmed'], cancelled: ['red', 'Cancelled'],
    completed: ['', 'Completed'], in_progress: ['orange', 'In progress'], no_show: ['red', 'Missed']
  };
  const normRef = r => r.trim().toUpperCase().replace(/\s+/g, '');

  const sp = new URLSearchParams(location.search);
  if (sp.get('ref')) refEl.value = sp.get('ref');
  if (sp.get('phone')) phEl.value = sp.get('phone');
  if (refEl.value && phEl.value) lookup();

  form.addEventListener('submit', e => { e.preventDefault(); lookup(); });

  async function lookup() {
    ferr.hidden = true; out.innerHTML = '';
    const ref = normRef(refEl.value), phone = phEl.value.trim();
    if (!ref || phone.replace(/\D/g, '').length < 6) { ferr.textContent = 'Please enter your booking reference and phone number.'; ferr.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Looking…';
    try {
      const b = await ZA.pub.lookup(ref, phone);
      if (!b) { ferr.textContent = "We couldn't find a booking with those details. Check the reference and the phone number you booked with, or call us."; ferr.hidden = false; }
      else { cur = { b, ref, phone }; show(); }
    } catch (e) {
      ferr.textContent = 'Sorry, something went wrong looking that up. Please try again, or call us.'; ferr.hidden = false;
    }
    btn.disabled = false; btn.textContent = 'Find my booking';
  }

  function show() {
    const b = cur.b, st = statusTag[b.status] || ['', b.status];
    const canCancel = b.status === 'requested' || b.status === 'confirmed';
    const future = new Date(b.starts_at) > new Date();
    const isMot = /pam|mot/i.test(b.location || '');
    const dir = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(b.address || b.location || '');
    const veh = [b.make, b.model].filter(Boolean).join(' ');
    out.innerHTML = `<article class="card bk-card">
      <div class="bk-top"><span class="tag ${st[0]}">${esc(st[1])}</span><span class="muted small">Ref <b>${esc(b.ref)}</b></span></div>
      <div class="bk-when">${esc(fmt.longDay(b.starts_at))}</div>
      <div style="font-weight:600">${esc(fmt.time(b.starts_at))}${b.ends_at ? ' – ' + esc(fmt.time(b.ends_at)) : ''}</div>
      <dl><dt>Service</dt><dd>${esc(b.service || '')}</dd>
        <dt>Where</dt><dd>${esc(b.location || '')}<br><span class="muted">${esc(b.address || '')}</span></dd>
        ${b.phone ? `<dt>Site phone</dt><dd><a href="${fmt.phoneHref(b.phone)}">${esc(fmt.phone(b.phone))}</a></dd>` : ''}
        <dt>Vehicle</dt><dd>${b.reg ? `<span class="plate-badge">${esc(fmt.plate(b.reg))}</span> ` : ''}${esc(veh)}</dd>
        ${b.notes ? `<dt>Notes</dt><dd>${esc(b.notes)}</dd>` : ''}</dl>
      <div class="bk-actions">
        ${b.status !== 'cancelled' ? `<button class="btn btn-dark btn-sm" id="ics" type="button">${P.icons.cal} Add to calendar</button>` : ''}
        <a class="btn btn-ghost btn-sm" href="${dir}" target="_blank" rel="noopener">${P.icons.pin} Directions</a>
        ${canCancel && future ? '<button class="btn btn-ghost btn-sm" id="cancel" type="button" style="color:var(--bad)">Cancel booking</button>' : ''}
      </div>
      <div id="confirm"></div>
      ${canCancel ? '' : `<p class="muted small" style="margin:14px 0 0">${b.status === 'cancelled' ? 'This booking is cancelled. ' : ''}<a href="book.html">Book again</a></p>`}
    </article>`;
    const i = document.getElementById('ics'); if (i) i.onclick = download;
    const c = document.getElementById('cancel'); if (c) c.onclick = askCancel;
  }

  function askCancel() {
    document.getElementById('confirm').innerHTML = `<div class="notice bad confirm" role="alertdialog" aria-label="Confirm cancellation">
      <b>Cancel this booking?</b><p style="margin:6px 0 12px">This frees up the slot. You can rebook any time.</p>
      <div class="bk-actions"><button class="btn btn-sm" id="yes" type="button" style="background:var(--bad);color:#fff">Yes, cancel it</button>
      <button class="btn btn-ghost btn-sm" id="no" type="button">Keep it</button></div></div>`;
    document.getElementById('no').onclick = () => document.getElementById('confirm').innerHTML = '';
    document.getElementById('yes').onclick = async function () {
      this.disabled = true; this.textContent = 'Cancelling…';
      try {
        const ok = await ZA.pub.cancel(cur.ref, cur.phone);
        if (ok) { cur.b.status = 'cancelled'; show(); document.getElementById('confirm').innerHTML = '<div class="notice ok confirm" role="status">Your booking has been cancelled.</div>'; }
        else document.getElementById('confirm').innerHTML = '<div class="notice bad confirm" role="alert">We couldn\'t cancel that online. Please call the site and we\'ll sort it.</div>';
      } catch (e) {
        document.getElementById('confirm').innerHTML = '<div class="notice bad confirm" role="alert">Something went wrong. Please call the site to cancel.</div>';
      }
    };
  }

  function download() {
    const b = cur.b, z = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const esc2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Z Autoz//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + b.ref + '@zautoz', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(b.starts_at), 'DTEND:' + z(b.ends_at || new Date(new Date(b.starts_at).getTime() + 3600e3)),
      'SUMMARY:' + esc2((b.service || 'Booking') + ' - ' + (b.location || 'Z Autoz')),
      'LOCATION:' + esc2([b.location, b.address].filter(Boolean).join(', ')),
      'DESCRIPTION:' + esc2('Booking ref ' + b.ref + (b.reg ? '. Vehicle ' + fmt.plate(b.reg) : '') + (b.phone ? '. Call ' + b.phone : '')),
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Booking reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'zautoz-' + b.ref + '.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
})();
