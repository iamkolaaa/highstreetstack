/* Holding mode. While ZA_CONFIG.paused is true, booking and the workshop screen are switched off:
   database calls never go out and the page shows a "call us to book" notice instead.
   To switch back on, set paused: false in config.js (and point it at the new database). */
(function () {
  if (!window.ZA_CONFIG || !window.ZA_CONFIG.paused) return;
  window.ZA_PAUSED = true;
  window.ZA_CONFIG.previewBanner = false;

  // Any database call waits forever: no network traffic, no error messages.
  const hang = new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? function () {} : hang),
    apply: () => hang
  });
  if (window.supabase) window.supabase = { createClient: () => hang };

  const staff = /\/staff\//.test(location.pathname);
  const sites = `
    <div class="za-hold-sites">
      <div class="card">
        <h3>Z Autoz Garage</h3>
        <p class="muted">Repairs, servicing, tyres and diagnostics</p>
        <p>Unit 8 Sinclair Court, Bletchley MK1 1RB<br>Mon–Fri 9–6, Sat 9–4</p>
        <a class="btn btn-primary" href="tel:01908365050">Call 01908 365050</a>
      </div>
      <div class="card">
        <h3>Pam's MOT Centre</h3>
        <p class="muted">MOT tests</p>
        <p>14 Horwood Court, Bletchley MK1 1RD<br>Mon–Fri 8:30–5:30, Sat 8–3</p>
        <a class="btn btn-primary" href="tel:01908644514">Call 01908 644514</a>
      </div>
    </div>`;

  const css = `
    .za-hold { padding: 56px 0 72px; }
    .za-hold .wrap { max-width: 860px; }
    .za-hold h1 { font: 700 clamp(2rem, 6vw, 3rem)/1.05 var(--display, 'Barlow Condensed', sans-serif); margin: 0 0 12px; }
    .za-hold .lead { font-size: 1.1rem; color: var(--muted); max-width: 620px; margin: 0 0 28px; }
    .za-hold-sites { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 18px; }
    .za-hold-sites h3 { margin: 0 0 4px; }
    .za-hold-sites .btn { margin-top: 6px; }
    .za-hold .fine { margin-top: 26px; font-size: .92rem; color: var(--muted); }
    .fab { display: none !important; }`;

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    if (staff) {
      document.body.className = '';
      document.body.innerHTML = `<section class="za-hold"><div class="wrap">
        <h1>Workshop screen offline</h1>
        <p class="lead">The workshop system is switched off while it moves to a new server. Bookings and customer records are not being taken here for now.</p>
        <p><a class="btn btn-primary" href="../index.html">Back to the website</a></p>
      </div></section>`;
      return;
    }

    // Public pages: keep the header and footer, swap the page content for the notice.
    Array.from(document.body.children).forEach(el => {
      if (el.id === 'site-header' || el.id === 'site-footer' || el.tagName === 'SCRIPT') return;
      el.remove();
    });
    const main = document.createElement('section');
    main.className = 'za-hold';
    main.innerHTML = `<div class="wrap">
      <h1>Online booking is <span class="grad-text">closed for now</span></h1>
      <p class="lead">To book an MOT, tyres or a repair, give the site a call. Walk-ins are welcome during opening hours.</p>
      ${sites}
    </div>`;
    const footer = document.getElementById('site-footer');
    document.body.insertBefore(main, footer || null);
  });
})();
