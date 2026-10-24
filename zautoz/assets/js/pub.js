/* Shared helpers for the public marketing pages. Load after site.js. */
(function () {
  const { fmt } = window.ZA;
  const P = {};
  const svg = (d, s) => `<svg width="${s || 24}" height="${s || 24}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  P.svg = svg;
  P.icons = {
    mot: svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
    servicing: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    repairs: svg('<path d="M4 20l8-8"/><path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L7 3 3 7l4 4"/>'),
    tyres: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>'),
    diagnostics: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 21h10M12 17v4M6 11h3l1.5-3 3 6L15 11h3"/>'),
    other: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'),
    phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', 20),
    pin: svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 20),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', 20),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 18),
    car: svg('<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16"/><path d="M3 16h18v3H3zM7 19v1.5M17 19v1.5"/><circle cx="7.5" cy="16" r=".6"/><circle cx="16.5" cy="16" r=".6"/>')
  };
  P.catNames = { mot: 'MOT', servicing: 'Servicing', tyres: 'Tyres', diagnostics: 'Diagnostics', repairs: 'Repairs', other: 'Other' };
  P.catOrder = ['mot', 'servicing', 'tyres', 'diagnostics', 'repairs', 'other'];

  P.duration = function (m) {
    if (!m) return '';
    if (m < 60) return 'about ' + m + ' min';
    const h = m / 60;
    if (h === 1) return 'about 1 hr';
    if (Number.isInteger(h)) return 'about ' + h + ' hrs';
    if (m % 30 === 0) return 'about ' + h.toFixed(1) + ' hrs';
    return 'about ' + Math.floor(m / 60) + ' hr ' + (m % 60) + ' min';
  };
  P.site = function (s) {
    const ids = s.location_ids || [];
    if (ids.includes('garage') && ids.includes('mot')) return { text: 'Both sites', cls: '' };
    if (ids.includes('mot')) return { text: 'MOT centre', cls: 'green' };
    return { text: 'Garage', cls: 'orange' };
  };
  P.price = function (s) {
    if (s.price_label) return s.price_label;
    return s.price_from != null ? 'from ' + fmt.money(s.price_from) : 'Call for a price';
  };
  P.bookHref = s => s.online ? 'book.html?service=' + encodeURIComponent(s.id) : null;
  P.errorBox = function (what) {
    return `<div class="notice bad" role="alert"><b>We couldn't load ${what} just now.</b> Please call us instead: Garage <a href="tel:01908365050">01908 365050</a> · MOT centre <a href="tel:01908644514">01908 644514</a>.</div>`;
  };
  P.skeleton = function (n, h) {
    return Array.from({ length: n }, () => `<div class="skeleton" style="height:${h || 150}px"></div>`).join('');
  };
  P.placeholderNote = async function (el) {
    try {
      const s = await ZA.pub.settings();
      const v = s.prices_are_placeholders;
      if (v === true || v === 'true' || v === 1) el.hidden = false;
    } catch (e) { /* ignore */ }
  };
  window.ZAP = P;
})();
