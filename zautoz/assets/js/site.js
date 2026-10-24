/* Shared header/footer + small helpers for public pages. Include after config.js and api.js. */
(function () {
  const { fmt } = window.ZA;
  const here = location.pathname.split('/').pop() || 'index.html';
  const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="1" stop-color="#d4213d"/></linearGradient></defs><g transform="translate(32 32)"><g fill="#c9ced8"><circle r="21"/>${[0,45,90,135,180,225,270,315].map(a=>`<rect x="-4" y="-29" width="8" height="10" rx="1.5" transform="rotate(${a})"/>`).join('')}</g><circle r="15" fill="#111318"/><path d="M-9 -9 H9 L-3 5 H9 V9 H-9 L3 -5 H-9 Z" fill="url(#lg)"/></g></svg>`;
  window.ZA_LOGO = LOGO;

  const links = [['index.html', 'Home'], ['services.html', 'Services & prices'], ['index.html#locations', 'Find us'], ['manage.html', 'My booking']];
  const header = `
    ${window.ZA_CONFIG.previewBanner ? '<div class="preview-bar">Preview site. Prices shown are placeholders until the garage confirms them.</div>' : ''}
    <header class="nav"><div class="wrap">
      <a class="brand" href="index.html">${LOGO}<b><span class="grad-text">Z</span> Autoz</b></a>
      <button class="nav-toggle" aria-label="Menu" onclick="document.querySelector('.nav-links').classList.toggle('open')">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <nav class="nav-links">
        ${links.map(([h, t]) => `<a href="${h}" class="${h === here ? 'on' : ''}">${t}</a>`).join('')}
        <a class="btn btn-primary btn-sm" href="book.html" style="margin-left:6px">Book online</a>
      </nav>
    </div></header>`;

  const footer = `
    <footer><div class="wrap">
      <div class="grid g4">
        <div><a class="brand" href="index.html" style="margin-bottom:12px">${LOGO}<b><span class="grad-text">Z</span> Autoz</b></a>
          <p>Independent garage and MOT centre in Bletchley, Milton Keynes. Tyres, tracking, diagnostics, servicing and repairs.</p></div>
        <div><h4>Z Autoz Garage</h4><ul>
          <li>Unit 8 Sinclair Court<br>Bletchley MK1 1RB</li>
          <li><a href="tel:01908365050">01908 365050</a></li>
          <li>Mon–Fri 9–6 · Sat 9–4</li></ul></div>
        <div><h4>Pam's MOT Centre</h4><ul>
          <li>14 Horwood Court<br>Bletchley MK1 1RD</li>
          <li><a href="tel:01908644514">01908 644514</a></li>
          <li>Mon–Fri 8:30–5:30 · Sat 8–3</li></ul></div>
        <div><h4>Quick links</h4><ul>
          <li><a href="book.html">Book online</a></li>
          <li><a href="book.html?service=mot4">Book an MOT</a></li>
          <li><a href="manage.html">Change or cancel a booking</a></li>
          <li><a href="privacy.html">Privacy notice</a></li>
          <li><a href="staff/">Staff login</a></li></ul></div>
      </div>
      <div class="legal">
        Z Autoz Limited, registered in England and Wales, company no. 11765122. Registered office: Unit 8 Sinclair Court, Bletchley, Milton Keynes MK1 1RB.<br>
        Pam's MOT Centre Ltd, registered in England and Wales, company no. 09692862. Registered office: 14 Horwood Court, Bletchley, Milton Keynes MK1 1RD.<br>
        © ${new Date().getFullYear()} Z Autoz. MOT tests are carried out at Pam's MOT Centre, a DVSA-approved test station.
      </div>
    </div></footer>
    <a class="btn btn-primary fab" href="book.html">Book now</a>`;

  document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('site-header'); if (h) h.outerHTML = header;
    const f = document.getElementById('site-footer'); if (f) f.outerHTML = footer;
  });

  // Is a location open right now? hours = {"mon":[["09:00","18:00"]], ...}
  window.ZA.openNow = function (hours) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const g = t => parts.find(p => p.type === t).value;
    const dow = g('weekday').toLowerCase().slice(0, 3);
    const hm = g('hour') + ':' + g('minute');
    const today = (hours && hours[dow]) || [];
    for (const [o, c] of today) if (hm >= o && hm < c) return { open: true, text: 'Open now · closes ' + c };
    const later = today.find(([o]) => hm < o);
    if (later) return { open: false, text: 'Closed · opens ' + later[0] };
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    let i = order.indexOf(dow);
    for (let k = 1; k <= 7; k++) {
      const d = order[(i + k) % 7];
      if ((hours[d] || []).length) return { open: false, text: 'Closed · opens ' + (k === 1 ? 'tomorrow' : d[0].toUpperCase() + d.slice(1)) + ' ' + hours[d][0][0] };
    }
    return { open: false, text: 'Closed' };
  };

  // Hours table helper
  window.ZA.hoursList = function (hours) {
    const names = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    return Object.keys(names).map(d => `<div style="display:flex;justify-content:space-between"><span>${names[d]}</span><span>${(hours[d] || []).map(w => w.join('–')).join(', ') || 'Closed'}</span></div>`).join('');
  };
})();
