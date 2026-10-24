(function () {
  const { fmt } = ZA, P = ZAP, esc = fmt.esc;
  const tick = P.svg('<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>', 22);
  ['t1', 't2', 't3', 't4', 't5'].forEach(id => document.getElementById(id).innerHTML = tick);
  P.placeholderNote(document.getElementById('price-note'));

  const listEl = document.getElementById('list'), tabsEl = document.getElementById('tabs'), q = document.getElementById('q');
  let all = [], cat = 'all';
  const initial = new URLSearchParams(location.search).get('category');
  if (initial && P.catNames[initial]) cat = initial;

  ZA.pub.services().then(list => {
    all = list;
    const present = P.catOrder.filter(c => list.some(s => s.category === c));
    tabsEl.innerHTML = [['all', 'All']].concat(present.map(c => [c, P.catNames[c]]))
      .map(([v, t]) => `<button type="button" data-c="${v}" class="${v === cat ? 'on' : ''}" aria-pressed="${v === cat}">${t}</button>`).join('');
    render();
  }).catch(() => { listEl.innerHTML = P.errorBox('our services'); });

  tabsEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.c;
    tabsEl.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    render();
  });
  q.addEventListener('input', render);

  function row(s) {
    const site = P.site(s), href = P.bookHref(s);
    return `<div class="svc-row"><div><h3>${esc(s.name)}</h3><p>${esc(s.description || '')}</p>
      <div class="meta">${s.duration_min ? `<span>${P.icons.clock} ${P.duration(s.duration_min)}</span>` : ''}
      <span class="tag ${site.cls}">${site.text}</span>${s.walk_in ? '<span class="tag green">Walk-ins welcome</span>' : ''}</div></div>
      <div class="side"><span class="price">${esc(P.price(s))}</span>
      ${href ? `<a class="btn btn-primary btn-sm" href="${href}" aria-label="Book ${esc(s.name)}">Book</a>`
        : `<span class="muted small">Call to book</span>`}</div></div>`;
  }
  function render() {
    const term = q.value.trim().toLowerCase();
    const items = all.filter(s => (cat === 'all' || s.category === cat) &&
      (!term || (s.name + ' ' + (s.description || '')).toLowerCase().includes(term)));
    if (!items.length) { listEl.innerHTML = `<div class="notice">No services match${term ? ' "' + esc(q.value.trim()) + '"' : ''}. Try another word, or call us: <a href="tel:01908365050">01908 365050</a>.</div>`; return; }
    const by = {}; items.forEach(s => (by[s.category] = by[s.category] || []).push(s));
    listEl.innerHTML = P.catOrder.filter(c => by[c]).map(c =>
      `<h2 class="cat-head"><span class="ico ${c === 'mot' ? 'mot' : ''}">${P.icons[c] || P.icons.other}</span>${esc(P.catNames[c] || c)}</h2>${by[c].map(row).join('')}`).join('');
  }
})();
