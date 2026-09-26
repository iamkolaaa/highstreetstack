import { progress, pickNow, groupRows, isUp, fmtDate, STATUS_ORDER } from './lib/board.js';

export const ENQUIRY_URL = '';

const GROUP_LABEL = { in_progress: 'In progress', live: 'Live', in_talks: 'In talks' };
const $ = id => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function cell(label, value) {
  const c = el('div', 'c');
  if (!value) return c;
  c.textContent = label;
  c.appendChild(el('b', null, value));
  return c;
}

function link(href, text, cls) {
  const a = el('a', cls, text + ' ↗');
  a.href = href; a.rel = 'noopener'; a.target = '_blank';
  return a;
}

function renderNow(rows, today) {
  const row = pickNow(rows);
  const panel = $('now');
  if (!row) { panel.classList.add('idle'); return; }
  panel.classList.remove('idle');
  const p = progress(row, today);
  $('now-name').textContent = row.name;
  $('now-note').textContent = row.now_note || row.type || '';
  $('now-days').textContent = p.total > 0 ? `day ${p.day} of ${p.total}` : `day ${p.day}`;
  $('now-bar').style.width = p.pct + '%';
  $('now-start').textContent = row.start ? 'Started ' + fmtDate(row.start) : '';
  $('now-target').textContent = row.target ? 'Target ' + fmtDate(row.target) : '';
}

function renderRow(row, status, today) {
  const up = row.status === 'live' && isUp(status, row.id);
  const r = el('div', 'row ' + (row.status === 'in_progress' ? 'prog' : up ? 'live' : ''));
  r.appendChild(el('span', 'd'));
  const name = el('div', 'name', row.name);
  if (row.client_line) name.appendChild(el('small', null, row.client_line));
  r.appendChild(name);
  if (row.status === 'in_progress') {
    const p = progress(row, today);
    r.appendChild(cell('Started', fmtDate(row.start)));
    r.appendChild(cell('Target', fmtDate(row.target)));
    r.appendChild(cell('Progress', p.total > 0 ? `Day ${p.day} of ${p.total}` : `Day ${p.day}`));
  } else if (row.status === 'live') {
    r.appendChild(cell('Type', row.type));
    r.appendChild(cell('Went live', fmtDate(row.went_live)));
    r.appendChild(cell('Stack', row.stack));
  } else {
    r.appendChild(cell('Type', row.type));
    r.appendChild(cell('Stage', row.stage));
    r.appendChild(cell('Estimate', row.estimate));
  }
  const links = el('div', 'links');
  if (row.live_url) links.appendChild(link(row.live_url, row.live_url.replace(/^https?:\/\//, ''), up ? 'on' : ''));
  if (row.repo_url) links.appendChild(link(row.repo_url, 'Code'));
  if (row.link_url) links.appendChild(link(row.link_url, row.link_label || 'Link'));
  r.appendChild(links);
  return r;
}

function renderBoard(rows, status, today) {
  const box = $('board-list');
  box.innerHTML = '';
  const groups = groupRows(rows, m => console.warn(m));
  for (const key of STATUS_ORDER) {
    const list = groups[key];
    if (!list.length) continue;
    const h = el('div', 'grp', GROUP_LABEL[key]);
    h.appendChild(el('span', 'n', String(list.length)));
    box.appendChild(h);
    list.forEach(row => box.appendChild(renderRow(row, status, today)));
  }
  if (!box.children.length) box.appendChild(el('div', 'empty', 'Nothing on the board yet.'));
  box.setAttribute('aria-busy', 'false');
  $('board-updated').textContent = status && status.checked_at ? 'Checked ' + fmtDate(status.checked_at.slice(0, 10)) : '';
}

function boardUnavailable() {
  const box = $('board-list');
  box.innerHTML = '';
  box.appendChild(el('div', 'empty', 'Board unavailable, try again shortly.'));
  box.setAttribute('aria-busy', 'false');
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function render(today = new Date()) {
  let rows;
  try { rows = await loadJSON('data/projects.json'); }
  catch (e) { console.error(e); boardUnavailable(); return; }
  let status = null;
  try { status = await loadJSON('data/status.json'); } catch (e) { console.warn('status.json unavailable', e); }
  renderNow(rows, today);
  renderBoard(rows, status, today);
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
window.HSS = { render };
render();
