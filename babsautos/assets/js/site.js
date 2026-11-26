(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // navigation turns solid once the hero has scrolled under it
  const nav = document.querySelector('[data-nav]');
  if (nav && !document.body.className) {
    const set = () => nav.classList.toggle('solid', scrollY > innerHeight * 0.6);
    set();
    addEventListener('scroll', set, { passive: true });
  }

  // showroom: one car at a time, the section takes the colour of the chosen car
  const showroom = document.querySelector('.showroom');
  if (showroom) {
    root.classList.add('has-picker');
    const tabs = [...showroom.querySelectorAll('[role=tab]')];
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    panels.forEach((p, i) => { if (i) p.inert = true; });
    const pick = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('is-on', on);
        panels[k].inert = !on;
      });
      showroom.style.setProperty('--field', panels[i].dataset.field);
      if (focus) tabs[i].focus();
      tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(i));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); pick((i + d + tabs.length) % tabs.length, true); }
      });
    });
    // fetch every showroom photo early so switching cars is instant
    const warm = () => panels.forEach(p => { const im = p.querySelector('img'); if (im) im.loading = 'eager'; });
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { near.disconnect(); warm(); } }, { rootMargin: '800px 0px' });
      near.observe(showroom);
    } else warm();
  }

  // stock filters
  const tiles = document.querySelector('[data-tiles]');
  if (tiles) {
    const form = document.querySelector('.filters');
    const items = [...tiles.children];
    const count = document.querySelector('[data-count]');
    const empty = document.querySelector('[data-empty]');
    const run = () => {
      const f = Object.fromEntries(new FormData(form));
      let n = 0;
      items.forEach(li => {
        const show = ['where', 'body', 'budget'].every(k => f[k] === 'all' || li.dataset[k] === f[k]);
        li.hidden = !show;
        if (show) n++;
      });
      count.textContent = n === items.length ? `Showing all ${n} cars` : `Showing ${n} of ${items.length} cars`;
      empty.hidden = n > 0;
    };
    form.addEventListener('change', run);
  }

  // entrances: each part of a section rises in turn as the section arrives
  if (!reduce && 'IntersectionObserver' in window) {
    const els = [...document.querySelectorAll('[data-rise]')];
    root.classList.add('rise');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const sibs = [...e.target.parentElement.querySelectorAll(':scope > [data-rise]')];
        e.target.style.setProperty('--d', `${Math.max(0, sibs.indexOf(e.target)) * 80}ms`);
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }
})();
