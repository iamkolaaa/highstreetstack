/* Settings: grouped sections, one sticky save bar, PIN change, demo listings, iCal import. */

const DAY_NAMES = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

const toList = v => {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v === null || v === undefined ? '' : v).split(',').map(x => x.trim()).filter(Boolean);
};
const sortTimes = a => Array.from(new Set(a)).sort();

export async function render(root, ctx) {
  const { esc, f, icons } = ctx;
  const raw = (await ctx.api('settings_get')).settings || {};
  const S = {};
  Object.keys(raw).forEach(k => { S[k.toLowerCase()] = raw[k]; });
  ctx.mergeSettings(raw);
  const v = k => (S[k] === null || S[k] === undefined ? '' : S[k]);

  const state = {
    inspection_days: toList(v('inspection_days')).map(Number).sort((a, b) => a - b),
    consult_days: toList(v('consult_days')).map(Number).sort((a, b) => a - b),
    inspection_slots: sortTimes(toList(v('inspection_slots'))),
    consult_slots: sortTimes(toList(v('consult_slots'))),
    ical_import: String(v('ical_import')).toLowerCase() === 'yes'
  };
  const orig = JSON.stringify(state);
  let alive = true;

  const text = (key, label, o = {}) =>
    '<label class="field"><span class="a-lbl">' + label + '</span><input class="input" name="' + key + '" value="' + esc(v(key)) + '" ' + (o.attrs || '') + '>' +
    (o.help ? '<small class="a-help">' + o.help + '</small>' : '') + '</label>';

  const days = key => '<div class="chips a-chips" data-days="' + key + '">' + DAY_NAMES.map(d =>
    '<button type="button" class="chip' + (state[key].includes(d[0]) ? ' on' : '') + '" aria-pressed="' + state[key].includes(d[0]) + '" data-d="' + d[0] + '">' + d[1] + '</button>').join('') + '</div>';

  const slots = key => '<div class="slots" data-slots="' + key + '"></div>' +
    '<div class="pm-link"><input class="input" type="time" aria-label="Add a time" data-new="' + key + '"><button type="button" class="btn btn-outline" data-add="' + key + '">Add time</button></div>';

  root.innerHTML =
    '<div class="a-head"><h1>Settings</h1></div>' +
    '<form id="sf" class="a-form" novalidate autocomplete="off">' +

    '<section class="a-card"><h2 class="a-h2">Contact</h2>' +
    text('whatsapp_number', 'Your WhatsApp number', { attrs: 'type="tel" inputmode="tel" placeholder="2348012345678"', help: 'With the country code, no plus sign. Guests who tap WhatsApp on the site reach this number.' }) +
    text('whatsapp_link', 'Backup WhatsApp link', { attrs: 'inputmode="url"', help: 'Used only while the number above is empty.' }) +
    text('notify_email', 'Email for new requests', { attrs: 'type="email" inputmode="email"' }) +
    text('alert_email', 'Email if something breaks', { attrs: 'type="email" inputmode="email"' }) +
    '</section>' +

    '<section class="a-card"><h2 class="a-h2">Stays</h2>' +
    '<div class="a-two">' + text('check_in', 'Usual check-in', { attrs: 'type="time"' }) + text('check_out', 'Usual check-out', { attrs: 'type="time"' }) + '</div>' +
    '<div class="a-two">' + text('min_nights', 'Fewest nights', { attrs: 'inputmode="numeric"' }) + text('max_nights', 'Most nights online', { attrs: 'inputmode="numeric"', help: 'Longer stays go to WhatsApp.' }) + '</div>' +
    '<div class="a-two">' + text('cleaning_buffer_days', 'Cleaning days between stays', { attrs: 'inputmode="numeric"' }) + text('hold_hours', 'Hold a request for (hours)', { attrs: 'inputmode="numeric"', help: 'How long dates stay held while you decide.' }) + '</div>' +
    text('max_advance_days', 'How far ahead guests can book (days)', { attrs: 'inputmode="numeric"' }) +
    '</section>' +

    '<section class="a-card"><h2 class="a-h2">Inspections</h2>' +
    '<div class="field"><span class="a-lbl">Days you do inspections</span>' + days('inspection_days') + '</div>' +
    '<div class="field"><span class="a-lbl">Times</span>' + slots('inspection_slots') + '</div></section>' +

    '<section class="a-card"><h2 class="a-h2">Consultations</h2>' +
    '<div class="field"><span class="a-lbl">Days you take consultations</span>' + days('consult_days') + '</div>' +
    '<div class="field"><span class="a-lbl">Times</span>' + slots('consult_slots') + '</div></section>' +

    '<section class="a-card"><h2 class="a-h2">Share links</h2>' +
    text('share_expiry_days', 'New links last (days)', { attrs: 'inputmode="numeric"' }) +
    text('site_url', 'Website address', { attrs: 'inputmode="url"', help: 'Used to build the links you send. Only change it if the website moves.' }) +
    '</section>' +

    '<section class="a-card"><h2 class="a-h2">Calendar sync</h2>' +
    '<label class="a-switch"><input type="checkbox" id="st-ical"' + (state.ical_import ? ' checked' : '') + '><span class="a-sw"></span><span>Import Airbnb and Booking.com calendars<small>Checks the links you pasted on each property every hour.</small></span></label>' +
    '<p class="a-muted" id="st-sync">' + (v('last_ical_sync') ? 'Last sync: ' + esc(v('last_ical_sync')) : 'Not synced yet.') + '</p>' +
    (v('last_ical_error') ? '<p class="a-err">' + esc(v('last_ical_error')) + '</p>' : '') +
    '<button type="button" class="btn btn-outline" id="st-syncnow">' + icons.refresh + '<span>Sync now</span></button></section>' +

    '<p class="a-err" id="st-err" role="alert"></p>' +
    '<div class="a-savebar"><button type="submit" class="btn btn-primary a-block" id="st-save" disabled>Save settings</button></div>' +
    '</form>' +

    '<section class="a-card"><h2 class="a-h2">Change your PIN</h2>' +
    '<form id="pf" class="a-form" novalidate autocomplete="off">' +
    '<label class="field"><span class="a-lbl">New PIN (6 to 12 digits)</span><input class="input a-pin" type="password" name="p1" inputmode="numeric" maxlength="12" autocomplete="new-password"></label>' +
    '<label class="field"><span class="a-lbl">Type it again</span><input class="input a-pin" type="password" name="p2" inputmode="numeric" maxlength="12" autocomplete="new-password"></label>' +
    '<p class="a-err" id="pin-err" role="alert"></p><button class="btn btn-outline a-block" type="submit">Change PIN</button></form></section>' +

    '<section class="a-card"><h2 class="a-h2">Demo listings</h2>' +
    '<p class="a-muted">Example places with sample photos so you can try things out. Remove them before you go live.</p>' +
    '<div class="a-row-btns"><button type="button" class="btn btn-outline" id="st-demo-on">Load demo listings</button>' +
    '<button type="button" class="btn btn-outline btn-warn" id="st-demo-off">Remove demo listings</button></div></section>' +

    '<section class="a-card"><button type="button" class="btn btn-outline a-block" id="st-out">Sign out</button></section>';

  const form = root.querySelector('#sf');
  const saveBtn = root.querySelector('#st-save');
  const err = root.querySelector('#st-err');

  const textKeys = ['whatsapp_number', 'whatsapp_link', 'notify_email', 'alert_email', 'check_in', 'check_out', 'min_nights', 'max_nights', 'cleaning_buffer_days', 'hold_hours', 'max_advance_days', 'share_expiry_days', 'site_url'];
  const origText = {};
  textKeys.forEach(k => { origText[k] = String(v(k)); });

  function isDirty() {
    if (JSON.stringify(state) !== orig) return true;
    return textKeys.some(k => form.elements[k].value.trim() !== origText[k].trim());
  }
  const refresh = () => { saveBtn.disabled = !isDirty(); };

  function paintSlots(key) {
    const host = root.querySelector('[data-slots="' + key + '"]');
    host.innerHTML = state[key].length ? state[key].map(t => '<span class="slot">' + esc(t) + '<button type="button" data-rm="' + key + '" data-t="' + esc(t) + '" aria-label="Remove ' + esc(t) + '">' + icons.x.replace('width="24" height="24"', 'width="14" height="14"') + '</button></span>').join('') :
      '<span class="a-muted">No times yet.</span>';
  }
  paintSlots('inspection_slots'); paintSlots('consult_slots');

  form.addEventListener('input', refresh);
  root.addEventListener('click', e => {
    const d = e.target.closest('[data-d]');
    if (d) {
      const key = d.parentNode.dataset.days;
      const n = Number(d.dataset.d);
      const i = state[key].indexOf(n);
      if (i >= 0) state[key].splice(i, 1); else state[key].push(n);
      state[key].sort((a, b) => a - b);
      d.classList.toggle('on', i < 0);
      d.setAttribute('aria-pressed', String(i < 0));
      refresh();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const key = add.dataset.add;
      const inp = root.querySelector('[data-new="' + key + '"]');
      if (!/^\d{2}:\d{2}$/.test(inp.value)) { ctx.toast('Pick a time first.', 'bad'); return; }
      state[key] = sortTimes(state[key].concat(inp.value));
      inp.value = '';
      paintSlots(key); refresh();
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const key = rm.dataset.rm;
      state[key] = state[key].filter(t => t !== rm.dataset.t);
      paintSlots(key); refresh();
    }
  });
  root.querySelector('#st-ical').addEventListener('change', e => { state.ical_import = e.target.checked; refresh(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const out = {};
    const val = k => form.elements[k].value.trim();
    textKeys.forEach(k => { if (val(k) !== origText[k].trim()) out[k.toUpperCase()] = val(k); });
    if ('WHATSAPP_NUMBER' in out) {
      out.WHATSAPP_NUMBER = out.WHATSAPP_NUMBER.replace(/[\s+()-]/g, '');
      if (out.WHATSAPP_NUMBER && !/^\d{10,15}$/.test(out.WHATSAPP_NUMBER)) { err.textContent = 'Your WhatsApp number should be 10 to 15 digits with the country code, like 2348012345678.'; form.elements.whatsapp_number.focus(); return; }
    }
    ['MIN_NIGHTS', 'MAX_NIGHTS', 'CLEANING_BUFFER_DAYS', 'HOLD_HOURS', 'MAX_ADVANCE_DAYS', 'SHARE_EXPIRY_DAYS'].forEach(k => {
      if (k in out && out[k] !== '') out[k] = Number(out[k]);
    });
    for (const k of ['MIN_NIGHTS', 'MAX_NIGHTS', 'CLEANING_BUFFER_DAYS', 'HOLD_HOURS', 'MAX_ADVANCE_DAYS', 'SHARE_EXPIRY_DAYS']) {
      if (k in out && (out[k] === '' || isNaN(out[k]))) { err.textContent = 'Numbers only, please.'; return; }
    }
    const o = JSON.parse(orig);
    if (JSON.stringify(state.inspection_days) !== JSON.stringify(o.inspection_days)) out.INSPECTION_DAYS = state.inspection_days.join(',');
    if (JSON.stringify(state.consult_days) !== JSON.stringify(o.consult_days)) out.CONSULT_DAYS = state.consult_days.join(',');
    if (JSON.stringify(state.inspection_slots) !== JSON.stringify(o.inspection_slots)) out.INSPECTION_SLOTS = state.inspection_slots.join(',');
    if (JSON.stringify(state.consult_slots) !== JSON.stringify(o.consult_slots)) out.CONSULT_SLOTS = state.consult_slots.join(',');
    if (state.ical_import !== o.ical_import) out.ICAL_IMPORT = state.ical_import ? 'yes' : 'no';
    if (!Object.keys(out).length) { refresh(); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
    try {
      const r = await ctx.api('settings_set', { settings: out });
      if (r.settings) ctx.mergeSettings(r.settings);
      ctx.toast('Settings saved.', 'ok');
      if (alive) { const fresh = root.cloneNode(false); root.replaceWith(fresh); render(fresh, ctx); }
    } catch (er) {
      err.textContent = er.message || 'Could not save.';
      saveBtn.textContent = 'Save settings';
      saveBtn.disabled = false;
    }
  });

  root.querySelector('#st-syncnow').addEventListener('click', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const r = await ctx.api('ical_sync_now');
      root.querySelector('#st-sync').textContent = 'Last sync: ' + (r.last_sync || 'just now') + '. Added ' + (r.added || 0) + ', removed ' + (r.removed || 0) + '.';
      ctx.toast('Calendars synced.', 'ok');
    } catch (er) { ctx.toast(er.message || 'Sync failed.', 'bad'); }
    b.disabled = false;
  });

  /* PIN */
  const pf = root.querySelector('#pf');
  pf.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12); });
  pf.addEventListener('submit', async e => {
    e.preventDefault();
    const out = root.querySelector('#pin-err');
    out.textContent = '';
    const a = pf.elements.p1.value;
    const b = pf.elements.p2.value;
    if (!/^\d{6,12}$/.test(a)) { out.textContent = 'Your PIN must be 6 to 12 digits.'; return; }
    if (a !== b) { out.textContent = 'The two PINs do not match.'; return; }
    try {
      await ctx.api('set_pin', { new_pin: a });
      ctx.setPassword(a);
      pf.reset();
      ctx.toast('PIN changed.', 'ok');
    } catch (er) { out.textContent = er.message || 'Could not change the PIN.'; }
  });

  /* demo listings */
  root.querySelector('#st-demo-on').addEventListener('click', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const seed = await import('../seed.js?v=202611040819');
      const all = seed.DEMO_PROPERTIES || [];
      if (!all.length) throw new Error('No demo listings found.');
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < all.length; i += 4) {
        const r = await ctx.api('import_properties', { properties: all.slice(i, i + 4) });
        added += r.added || 0; skipped += r.skipped || 0;
      }
      ctx.dropPropCache();
      ctx.toast('Demo listings loaded: ' + added + ' added' + (skipped ? ', ' + skipped + ' skipped' : '') + '.', 'ok');
    } catch (er) { ctx.toast(er.message || 'Could not load demo listings.', 'bad'); }
    b.disabled = false;
  });
  root.querySelector('#st-demo-off').addEventListener('click', async e => {
    const b = e.currentTarget;
    if (!(await ctx.confirm('Remove every demo listing, and any bookings, blocks and links that point at them? Your own properties are not touched.', { ok: 'Remove demo listings', danger: true, title: 'Remove demo listings?' }))) return;
    b.disabled = true;
    try {
      const r = await ctx.api('purge_demo');
      ctx.dropPropCache();
      const x = r.removed || {};
      ctx.toast('Removed ' + (x.properties || 0) + ' demo ' + ((x.properties || 0) === 1 ? 'listing' : 'listings') + '.', 'ok');
    } catch (er) { ctx.toast(er.message || 'Could not remove them.', 'bad'); }
    b.disabled = false;
  });
  root.querySelector('#st-out').addEventListener('click', () => {
    try { sessionStorage.removeItem('rm_pin'); } catch (e) { /* ignore */ }
    location.hash = '';
    location.reload();
  });

  void f;
  return { destroy: () => { alive = false; } };
}
