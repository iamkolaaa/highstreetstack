// v2 extras: WhatsApp booking chat demo, account (local), confetti, haptics, bottom nav.
window.V2 = (() => {
  const D = DIFTA;
  const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
  const fmtT = (hm) => { let [h, m] = hm.split(":").map(Number); return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + (h >= 12 ? "pm" : "am"); };

  // ---------- account (demo: kept on this phone; live: linked to their WhatsApp number) ----------
  const acct = {
    get() { try { return JSON.parse(localStorage.getItem("difta_acct") || "null"); } catch (_) { return null; } },
    save(a) { try { localStorage.setItem("difta_acct", JSON.stringify(a)); } catch (_) {} },
    addBooking(b, name, phone) {
      const a = acct.get() || { name, phone, created: new Date().toISOString(), bookings: [] };
      const isNew = !a.bookings.length;
      a.name = name || a.name; a.phone = phone || a.phone;
      if (!a.bookings.some((x) => x.id === b.id)) a.bookings.push({ id: b.id, barber_id: b.barber_id, service_id: b.service_id });
      acct.save(a); return isNew;
    },
    clear() { try { localStorage.removeItem("difta_acct"); } catch (_) {} },
  };

  // ---------- confetti (gold + white) ----------
  function confetti(n = 140) {
    const c = document.createElement("canvas"); c.style.cssText = "position:fixed;inset:0;z-index:500;pointer-events:none";
    document.body.appendChild(c); const x = c.getContext("2d"); const W = (c.width = innerWidth * devicePixelRatio), H = (c.height = innerHeight * devicePixelRatio);
    const cols = ["#e8cf8f", "#c9a55a", "#f4f1ea", "#ffffff", "#a8833b"];
    const ps = [...Array(n)].map(() => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * devicePixelRatio, vy: (-Math.random() * 18 - 6) * devicePixelRatio, r: (Math.random() * 6 + 3) * devicePixelRatio, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, s: Math.random() > .5 }));
    let t = 0; (function f() {
      x.clearRect(0, 0, W, H); t++;
      for (const p of ps) { p.vy += .55 * devicePixelRatio; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; p.s ? x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r) : (x.beginPath(), x.arc(0, 0, p.r / 1.4, 0, 7), x.fill()); x.restore(); }
      if (t < 160) requestAnimationFrame(f); else c.remove();
    })();
  }

  // ---------- WhatsApp booking chat (demo runs in the browser against the live diary) ----------
  // Understands things like "this Saturday at 2", "skin fade tomorrow after work", "same again friday 11am".
  const WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function parseWhen(raw) {
    const s = " " + raw.toLowerCase().replace(/[,!?.]/g, " ") + " ", today = D.ymd(), out = {};
    const dow = new Date(today + "T12:00:00Z").getUTCDay();
    if (/\b(today|tonight|later)\b/.test(s)) out.date = today;
    else if (/\b(tomorrow|tmrw|tmr|tomoz)\b/.test(s)) out.date = D.addDays(today, 1);
    else {
      const w = WD.findIndex((d) => new RegExp("\\b(" + d + "|" + d.slice(0, 3) + (d === "tuesday" ? "|tues" : d === "thursday" ? "|thurs" : "") + ")\\b").test(s));
      if (w >= 0) { let add = (w - dow + 7) % 7; if (add === 0 && /\bnext\b/.test(s)) add = 7; out.date = D.addDays(today, add); }
      let m = s.match(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})\b/);
      if (m && +m[2] <= 12) out.date = dateFor(+m[1], +m[2] - 1);
      m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
      if (m) out.date = dateFor(+m[1], MON.indexOf(m[2]));
      else if ((m = s.match(/\b(\d{1,2})(st|nd|rd|th)\b/))) out.date = dateFor(+m[1], null);
    }
    // time
    let t = s.match(/\b(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?\b/) || s.match(/\b(\d{1,2})\s*(am|pm)\b/) || s.match(/\bat\s+(\d{1,2})\b/);
    if (/\bhalf\s+(\d{1,2})\b/.test(s)) { const h = +s.match(/\bhalf\s+(\d{1,2})\b/)[1]; out.time = fixH(h) + ":30"; }
    else if (/\bnoon|midday\b/.test(s)) out.time = "12:00";
    else if (t) {
      let h = +t[1], mi = t[2] && /^\d{2}$/.test(t[2]) ? +t[2] : 0; const ap = (t[3] || (t[2] && !/^\d/.test(t[2]) ? t[2] : "")) || "";
      if (ap === "pm" && h < 12) h += 12; else if (ap === "am" && h === 12) h = 0; else if (!ap) h = fixH(h);
      if (h >= 6 && h <= 21) out.time = String(h).padStart(2, "0") + ":" + String(Math.round(mi / 15) * 15 % 60).padStart(2, "0");
    }
    if (!out.time) {
      if (/\bmorning\b/.test(s)) out.part = [9, 12];
      else if (/\bafternoon|lunch\b/.test(s)) out.part = [12, 17];
      else if (/\bevening|after work|after school\b/.test(s)) out.part = [16, 19];
      else if (/\basap|soonest|earliest|first available|next available\b/.test(s)) out.asap = true;
    }
    return out;
    function fixH(h) { return h >= 1 && h <= 7 ? h + 12 : h; }
    function dateFor(d, m) {
      const n = new Date(today + "T12:00:00Z"); let y = n.getUTCFullYear(); if (m == null) { m = n.getUTCMonth(); if (d < n.getUTCDate()) m++; }
      let c = new Date(Date.UTC(y, m, d, 12)); if (c < n && (n - c) > 864e5) c = new Date(Date.UTC(y + 1, m, d, 12));
      return c.toISOString().slice(0, 10);
    }
  }
  const SVC_WORDS = [[/skin\s*fade|skinfade|bald fade/, /skin\s*fade|skinfade/i], [/taper/, /taper/i], [/\bfade/, /fade|taper/i], [/beard/, /beard/i], [/kid|son|boy|under 11|child/, /kid|under 11/i], [/shape|line\s*up|edge/, /shape/i], [/retwist/, /retwist/i], [/starter loc/, /starter/i], [/\blocs?\b|dread/, /loc/i], [/cornrow/, /cornrow/i], [/braid|twist/, /braid|twist/i], [/scissor/, /scissor/i], [/wash/, /wash/i], [/oap|pension/, /oap/i], [/haircut|hair cut|trim|\bcut\b/, /haircut|haircut only/i]];
  const BARBER_WORDS = { Charles: /charles|nyam/, Nathan: /nathan|\bns\b|cutz/, Jai: /\bjai\b/, Jayme: /jayme|jaime|\bjm\b/ };

  let chatEl;
  function chat() {
    buzz(12);
    if (chatEl) chatEl.remove();
    const el = (chatEl = document.createElement("div")); el.className = "wa";
    el.innerHTML = `<div class="wa-top"><button class="wa-x" aria-label="Close">‹</button><span class="wa-av"></span><span><b>Do It For The Art Studio</b><small id="waStat">online</small></span><span class="wa-badge">DEMO</span></div>
      <div class="wa-log" id="waLog"><div class="wa-sys">This is how booking on WhatsApp works. Real times from the studio diary. Nothing is sent.</div></div>
      <div class="wa-quick" id="waQuick"></div>
      <form class="wa-in" id="waForm"><input id="waText" placeholder="Message" autocomplete="off"><button aria-label="Send">➤</button></form>`;
    document.body.appendChild(el); document.body.style.overflow = "hidden";
    requestAnimationFrame(() => el.classList.add("on"));
    const log = el.querySelector("#waLog"), quick = el.querySelector("#waQuick"), stat = el.querySelector("#waStat"), inp = el.querySelector("#waText");
    el.querySelector(".wa-x").onclick = () => { el.classList.remove("on"); document.body.style.overflow = ""; setTimeout(() => el.remove(), 300); };
    const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const scroll = () => (log.scrollTop = log.scrollHeight);
    const me = (t) => { log.insertAdjacentHTML("beforeend", `<div class="wa-m me">${D.esc(t)}<small>${now()} ✓✓</small></div>`); scroll(); };
    const sys = (t) => { log.insertAdjacentHTML("beforeend", `<div class="wa-sys">${t}</div>`); scroll(); };
    const reply = (t, delay = 650) => new Promise((ok) => {
      stat.textContent = "typing…"; const ty = document.createElement("div"); ty.className = "wa-m typing"; ty.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(ty); scroll();
      setTimeout(() => { ty.remove(); stat.textContent = "online"; log.insertAdjacentHTML("beforeend", `<div class="wa-m">${t}<small>${now()}</small></div>`); scroll(); buzz(5); ok(); }, delay);
    });
    let waiter = null;
    const ask = (opts) => new Promise((ok) => {
      quick.innerHTML = opts.map((o, i) => `<button data-i="${i}">${D.esc(o.label)}</button>`).join("");
      waiter = (txt) => { const hit = opts.find((o) => o.label.toLowerCase() === txt.toLowerCase()) || opts.find((o) => o.match && o.match.test(txt)); if (hit) { quick.innerHTML = ""; waiter = null; ok(hit); return true; } return false; };
      quick.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const o = opts[+b.dataset.i]; me(o.label); quick.innerHTML = ""; waiter = null; buzz(); ok(o); };
    });
    const askText = (ph) => new Promise((ok) => { quick.innerHTML = ""; inp.placeholder = ph; inp.focus(); waiter = (t) => { waiter = null; inp.placeholder = "Message"; ok(t); return true; }; });
    el.querySelector("#waForm").onsubmit = (e) => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = ""; me(t); buzz();
      if (waiter && waiter(t)) return;
      quick.innerHTML = ""; waiter = null; understand(t);
    };

    let cfg, last = null;
    const acct0 = acct.get();
    const first = acct0?.name ? String(acct0.name).split(" ")[0] : null;
    const svcOf = (bId) => cfg.services.filter((x) => !x.staff_ids?.length || x.staff_ids.includes(bId));
    const barberById = (id) => cfg.staff.find((s) => s.id === id);

    async function understand(t) {
      cfg = cfg || await D.config();
      const s = t.toLowerCase();
      if (/^(hi|hey|hello|yo|alright|hiya)\b/.test(s) && s.length < 12) { await reply(first ? `Hey ${D.esc(first)} 👋 What can I book for you?` : "Hey 👋 What can I book for you?"); return menu(); }
      if (/\bhour|open|clos/.test(s) && !/\bbook\b/.test(s)) { await reply("We're open <b>Mon 12–7</b>, <b>Tue–Sat 9–7</b> and <b>Sun 12–4</b> 🕘"); return menu(); }
      if (/where|address|locat|park/.test(s)) { await reply("12 Wetherburn Court, Brunel Shopping Centre, Bletchley MK2 2UW 📍"); return menu(); }
      if (/price|cost|how much|£/.test(s) && !/\bbook\b/.test(s)) { await reply("Cuts from <b>£15</b>, skin fades from <b>£23</b>, haircut & beard from <b>£23</b>, locs & braids from <b>£40</b>."); return menu(); }
      if (/cancel|resched|change my/.test(s)) { await reply("No problem. In the live version I'd pull up your booking here with <b>Change</b> and <b>Cancel</b> buttons ✂️"); return menu(); }
      const when = parseWhen(t);
      let barber = Object.entries(BARBER_WORDS).map(([n, r]) => r.test(s) && cfg.staff.find((x) => x.name === n)).find(Boolean) || null;
      let svc = null;
      const usual = /usual|same again|same as last|regular|normal/.test(s);
      for (const [w, rx] of SVC_WORDS) if (w.test(s)) { svc = { rx }; break; }
      if (when.date || when.time || when.part || when.asap || svc || barber || usual || /\bbook|appoint|slot|free|available|space|squeeze|fit me\b/.test(s)) return smartBook({ when, barber, svc, usual });
      await reply("I can book you in, show prices or opening hours. Try <i>“book me in Saturday at 2”</i> 👇"); menu();
    }

    async function loadLast() {
      if (!acct0?.bookings?.length) return null;
      const b = acct0.bookings[acct0.bookings.length - 1];
      const barber = barberById(b.barber_id), service = cfg.services.find((x) => x.id === b.service_id);
      return barber && service ? { barber, service } : null;
    }

    async function menu() {
      const opts = [];
      if (last) opts.push({ label: `🔁 My usual with ${last.barber.name}`, k: "usual", match: /usual|same/i });
      opts.push({ label: "✂️ Book an appointment", k: "book", match: /^book/i }, { label: "💷 Prices", k: "price", match: /price/i }, { label: "🕘 Opening hours", k: "hours", match: /hour|open/i });
      const o = await ask(opts);
      if (o.k === "price") return understand("prices");
      if (o.k === "hours") return understand("hours");
      if (o.k === "usual") { await reply("When suits you? Just type it, like <i>“Saturday at 2”</i> or <i>“tomorrow after work”</i>."); waitWhen({ barber: last.barber, svc: { id: last.service.id }, usual: true }); return; }
      smartBook({ when: {}, barber: null, svc: null });
    }
    function waitWhen(ctx) {
      const today = D.ymd();
      ask([{ label: "Today", d: today }, { label: "Tomorrow", d: D.addDays(today, 1) }, { label: "This Saturday", d: D.addDays(today, (6 - new Date(today + "T12:00:00Z").getUTCDay() + 7) % 7) }])
        .then((o) => smartBook({ ...ctx, when: { date: o.d } }));
      waiter = ((prev) => (t) => { const w = parseWhen(t); if (w.date || w.time || w.part || w.asap) { quick.innerHTML = ""; waiter = null; smartBook({ ...ctx, when: w }); return true; } return prev(t); })(waiter);
    }

    async function smartBook({ when, barber, svc, usual, notBarber }) {
      cfg = cfg || await D.config();
      let why = "";
      // barber: named > last time > ask
      if (!barber && last && (usual || !svc || svcOf(last.barber.id).some((x) => svc.rx ? svc.rx.test(x.name) : x.id === svc.id))) { barber = last.barber; why = `Since you had <b>${D.esc(barber.name)}</b> last time, I'll book you in with ${barber.name === "Jai" ? "her" : "him"} again.`; }
      if (!barber && svc?.rx) { const cands = cfg.staff.filter((b) => svcOf(b.id).some((x) => svc.rx.test(x.name))); if (cands.length === 1) barber = cands[0]; }
      if (!barber) {
        let list = cfg.staff.filter((b) => b.id !== notBarber && (!svc?.rx || svcOf(b.id).some((x) => svc.rx.test(x.name))));
        if (!list.length) list = cfg.staff.filter((b) => b.id !== notBarber);
        await reply(notBarber ? "No problem, who else would you like?" : "Who would you like?");
        barber = (await ask(list.map((s) => ({ label: s.name, s, match: BARBER_WORDS[s.name] })))).s;
      }
      if (!why && last && barber.id === last.barber.id) why = `Since you had <b>${D.esc(barber.name)}</b> last time, I've kept you with ${barber.name === "Jai" ? "her" : "him"}.`;
      // service: named (matched in this barber's menu) > their usual > ask
      const menuB = svcOf(barber.id);
      let service = null;
      if (svc?.id) service = menuB.find((x) => x.id === svc.id);
      if (!service && svc?.rx) service = menuB.find((x) => svc.rx.test(x.name));
      if (!service && last && last.barber.id === barber.id && (usual || !svc)) { service = last.service; if (!why) why = `Your usual <b>${D.esc(service.name)}</b> with ${D.esc(barber.name)}?`; }
      if (!service) {
        await reply(`What are we doing with ${D.esc(barber.name)}?`);
        service = (await ask(menuB.slice(0, 8).map((x) => ({ label: `${x.name} · ${D.gbp(x.price_pence)}`, x })))).x;
      }
      // date
      let date = when.date;
      if (!date) {
        const days = (await D.api(`/days?service=${service.id}&staff=${barber.id}&from=${D.ymd()}&n=10`)).days;
        const free = Object.keys(days).sort().filter((d) => days[d] > 0).slice(0, 6);
        if (!free.length) { await reply(`${D.esc(barber.name)} is fully booked for the next 10 days 😬 Want someone else?`); return smartBook({ when, barber: null, svc: { id: null, rx: new RegExp(service.name.split(" ")[0], "i") } }); }
        await reply((why ? why + "<br>" : "") + "Which day suits you?"); why = "";
        date = (await ask(free.map((x) => ({ label: x === D.ymd() ? "Today" : D.niceDate(x), x, match: new RegExp(D.dayName(x), "i") })))).x;
      }
      const slots = (await D.api(`/availability?service=${service.id}&staff=${barber.id}&date=${date}`)).slots;
      const dayTxt = date === D.ymd() ? "today" : date === D.addDays(D.ymd(), 1) ? "tomorrow" : D.niceDate(date);
      if (!slots.length) {
        await reply(`${D.esc(barber.name)} is fully booked ${dayTxt} 😬`);
        const o = await ask([{ label: `Another day with ${barber.name}`, k: "day" }, { label: `Someone else ${dayTxt}`, k: "other" }]);
        if (o.k === "other") return smartBook({ when, barber: null, svc: { rx: new RegExp(service.name.replace(/[^a-z ]/gi, "").split(" ")[0], "i") }, notBarber: barber.id });
        return smartBook({ when: {}, barber, svc: { id: service.id } });
      }
      let pick = null, alts = [];
      const toM = (hm) => +hm.slice(0, 2) * 60 + +hm.slice(3);
      if (when.time) {
        pick = slots.find((x) => x.t === when.time);
        if (!pick) alts = [...slots].sort((a, b) => Math.abs(toM(a.t) - toM(when.time)) - Math.abs(toM(b.t) - toM(when.time))).slice(0, 3).sort((a, b) => a.t.localeCompare(b.t));
      } else if (when.part) alts = slots.filter((x) => +x.t.slice(0, 2) >= when.part[0] && +x.t.slice(0, 2) < when.part[1]).slice(0, 4);
      else if (when.asap) pick = slots[0];
      else alts = slots.filter((_, i) => i % Math.max(1, Math.floor(slots.length / 6)) === 0).slice(0, 6);
      if (!pick) {
        const head = when.time ? `${D.esc(barber.name)}'s not free at ${fmtT(when.time)} ${dayTxt}, but the closest are:` : `Here's what ${D.esc(barber.name)} has ${dayTxt}:`;
        await reply((why ? why + "<br>" : "") + head); why = "";
        const o = await ask((alts.length ? alts : slots.slice(0, 6)).map((x) => ({ label: fmtT(x.t), x })).concat([{ label: "Another day", k: "day" }]));
        if (o.k === "day") return smartBook({ when: {}, barber, svc: { id: service.id } });
        pick = o.x;
      }
      await reply(`${why ? why + "<br>" : ""}I've got you down for <b>${D.esc(service.name)}</b> with <b>${D.esc(barber.name)}</b>, ${dayTxt} at <b>${fmtT(pick.t)}</b> · ${D.gbp(service.price_pence)}.<br>Shall I lock it in?`);
      const c = await ask([{ label: "✅ Yes, book it", k: "yes", match: /^(y|yes|yeah|yep|go|book|lock|sure|ok|okay)/i }, { label: "Another time", k: "time" }, { label: "Another barber", k: "barber" }]);
      if (c.k === "time") return smartBook({ when: { date }, barber, svc: { id: service.id } });
      if (c.k === "barber") return smartBook({ when: { date, time: pick.t }, barber: null, svc: { rx: new RegExp(service.name.split(" ")[0], "i") } });
      // who
      let name = acct0?.name, phone = acct0?.phone;
      if (!name) { await reply("What name is the booking under?"); name = await askText("Your name"); }
      if (!phone) { await reply("And your mobile? (On WhatsApp we'd already have it 😉)"); phone = await askText("07…"); }
      const pay = await ask([{ label: `💳 Pay ${D.gbp(service.price_pence)} now`, k: "pay" }, { label: "Pay in the studio", k: "studio", match: /studio|later|cash/i }]);
      if (pay.k === "pay") { await reply("Here's your secure payment link 🔒", 400); const ok = await D.demoPay(service.price_pence, `${service.name} with ${barber.name}`); if (!ok) { await reply("No worries, nothing's been taken. Want to try again?"); return menu(); } }
      try {
        const r = await D.api("/book", { method: "POST", body: { service_id: service.id, staff_id: barber.id, date, time: pick.t, name, phone, pay: pay.k === "pay" ? "demo" : "studio", notes: "Booked on WhatsApp" } });
        const isNew = acct.addBooking({ id: r.booking.id, barber_id: barber.id, service_id: service.id }, name, phone);
        last = { barber, service };
        confetti(90);
        const [hh, mm] = pick.t.split(":").map(Number), rem = String(Math.floor((hh * 60 + mm - 30) / 60)).padStart(2, "0") + ":" + String((hh * 60 + mm - 30) % 60).padStart(2, "0");
        await reply(`✅ <b>You're booked, ${D.esc(String(name).split(" ")[0])}!</b><br>${D.esc(service.name)} with ${D.esc(barber.name)}<br>${dayTxt[0].toUpperCase() + dayTxt.slice(1)} at ${fmtT(pick.t)} · Ref ${r.booking.ref}<br>I'll message you at <b>${fmtT(rem)}</b>, 30 minutes before. Reply <b>CHANGE</b> or <b>CANCEL</b> any time.`);
        sys(`📲 ${D.esc(barber.name)} just got a WhatsApp: “📅 New booking: ${D.esc(String(name).split(" ")[0])} · ${D.esc(service.name)} · ${dayTxt} ${fmtT(pick.t)} · ${D.gbp(service.price_pence)}${pay.k === "pay" ? " (paid ✓)" : ""}”`);
        if (isNew) await reply(`🎉 I've also set up your Do It For The Art account. Next time just say <i>“same again Saturday”</i>. Every 10th cut is on us. <a href="account.html">View my account</a>`);
        menu();
      } catch (e) { await reply("Ah, that time has just gone 😬 Let's pick another."); smartBook({ when: { date }, barber, svc: { id: service.id } }); }
    }

    (async () => {
      cfg = await D.config();
      last = await loadLast();
      if (last) {
        await reply(`Hey ${D.esc(first)} 👋 Welcome back to <b>Do It For The Art Studio</b>.`);
        await reply(`Fancy your usual <b>${D.esc(last.service.name)}</b> with <b>${D.esc(last.barber.name)}</b>? Just tell me when, like <i>“this Saturday at 2”</i> or <i>“tomorrow after work”</i>.`, 700);
        waitWhen({ barber: last.barber, svc: { id: last.service.id }, usual: true });
      } else {
        await reply("Hey 👋 Welcome to <b>Do It For The Art Studio</b>. I can book you in 24/7, no app needed.");
        await reply("Just tell me what and when, like <i>“skin fade Saturday at 2”</i>, or tap below 👇", 600);
        menu();
      }
    })();
  }

  // ---------- bottom nav + WhatsApp tag wiring ----------
  function wire() {
    document.querySelectorAll("[data-chat]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); chat(); }));
    document.querySelectorAll(".bn a, .btn").forEach((b) => b.addEventListener("pointerdown", () => buzz(6)));
    const a = acct.get(), an = document.querySelector("[data-acct-name]");
    if (a && an) an.textContent = String(a.name || "Account").split(" ")[0];
    if (location.hash === "#whatsapp") chat();
  }
  addEventListener("DOMContentLoaded", wire);
  return { chat, confetti, acct, buzz, fmtT };
})();
