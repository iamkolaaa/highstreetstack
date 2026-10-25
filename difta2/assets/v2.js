// DIFTA v2 extras: WhatsApp booking bot demo, account (local), confetti, haptics, bottom nav.
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

  // ---------- WhatsApp booking bot (demo runs in the browser against the live diary) ----------
  let chatEl;
  function chat() {
    buzz(12);
    if (chatEl) chatEl.remove();
    const el = (chatEl = document.createElement("div")); el.className = "wa";
    el.innerHTML = `<div class="wa-top"><button class="wa-x" aria-label="Close">‹</button><span class="wa-av"></span><span><b>Do It For The Art Studio</b><small id="waStat">online</small></span><span class="wa-badge">DEMO</span></div>
      <div class="wa-log" id="waLog"><div class="wa-sys">This is how booking on WhatsApp would feel. Real times from the studio diary, nothing is sent.</div></div>
      <div class="wa-quick" id="waQuick"></div>
      <form class="wa-in" id="waForm"><input id="waText" placeholder="Message" autocomplete="off"><button aria-label="Send">➤</button></form>`;
    document.body.appendChild(el); document.body.style.overflow = "hidden";
    requestAnimationFrame(() => el.classList.add("on"));
    const log = el.querySelector("#waLog"), quick = el.querySelector("#waQuick"), stat = el.querySelector("#waStat");
    el.querySelector(".wa-x").onclick = () => { el.classList.remove("on"); document.body.style.overflow = ""; setTimeout(() => el.remove(), 300); };
    const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const scroll = () => (log.scrollTop = log.scrollHeight);
    const me = (t) => { log.insertAdjacentHTML("beforeend", `<div class="wa-m me">${D.esc(t)}<small>${now()} ✓✓</small></div>`); scroll(); };
    const bot = (t, delay = 650) => new Promise((ok) => {
      stat.textContent = "typing…"; const ty = document.createElement("div"); ty.className = "wa-m typing"; ty.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(ty); scroll();
      setTimeout(() => { ty.remove(); stat.textContent = "online"; log.insertAdjacentHTML("beforeend", `<div class="wa-m">${t}<small>${now()}</small></div>`); scroll(); buzz(5); ok(); }, delay);
    });
    let waiter = null;
    const ask = (opts) => new Promise((ok) => {
      quick.innerHTML = opts.map((o, i) => `<button data-i="${i}">${D.esc(o.label)}</button>`).join("");
      waiter = (txt) => { const hit = opts.find((o) => o.label.toLowerCase() === txt.toLowerCase()) || opts.find((o) => o.match && o.match.test(txt)); if (hit) { quick.innerHTML = ""; waiter = null; ok(hit); return true; } return false; };
      quick.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const o = opts[+b.dataset.i]; me(o.label); quick.innerHTML = ""; waiter = null; buzz(); ok(o); };
    });
    const askText = (ph) => new Promise((ok) => { quick.innerHTML = ""; const inp = el.querySelector("#waText"); inp.placeholder = ph; inp.focus(); waiter = (t) => { waiter = null; inp.placeholder = "Message"; ok(t); return true; }; });
    el.querySelector("#waForm").onsubmit = (e) => {
      e.preventDefault(); const inp = el.querySelector("#waText"), t = inp.value.trim(); if (!t) return; inp.value = ""; me(t); buzz();
      if (waiter && waiter(t)) return;
      freeText(t);
    };
    async function freeText(t) {
      const s = t.toLowerCase();
      if (/hour|open|close|time/.test(s)) await bot("We're open <b>Mon 12–7</b>, <b>Tue–Sat 9–7</b> and <b>Sun 12–4</b> 🕘");
      else if (/where|address|locat|park/.test(s)) await bot("12 Wetherburn Court, Brunel Shopping Centre, Bletchley MK2 2UW 📍 Parking right outside the centre.");
      else if (/price|cost|how much|£/.test(s)) await bot("Cuts start from <b>£15</b>, skin fades from <b>£23</b>, haircut & beard from <b>£23</b>. Locs & braids from <b>£40</b>.");
      else if (/cancel|change|resched/.test(s)) await bot("No problem. In the live version I'd show your booking here with <b>Change</b> and <b>Cancel</b> buttons ✂️");
      else await bot("I can book you in, show prices or opening hours. Try <i>“book a skin fade Saturday”</i> 👇");
      menu();
    }
    let cfg;
    async function menu() {
      const o = await ask([{ label: "✂️ Book an appointment", k: "book", match: /book|appoint|cut|trim|fade|slot/i }, { label: "💷 Prices", k: "price", match: /price|cost/i }, { label: "🕘 Opening hours", k: "hours", match: /hour|open/i }]);
      if (o.k === "price") { await bot("Cuts from <b>£15</b>, skin fades from <b>£23</b>, haircut & beard from <b>£23</b>, locs & braids from <b>£40</b>. Want to book?"); return menu(); }
      if (o.k === "hours") { await bot("Mon 12–7 · Tue–Sat 9–7 · Sun 12–4 🕘"); return menu(); }
      book();
    }
    async function book() {
      cfg = cfg || await D.config();
      await bot("Lovely 🙌 Who would you like?");
      const b = await ask(cfg.staff.map((s) => ({ label: s.name, s, match: new RegExp(s.name, "i") })));
      const svs = cfg.services.filter((x) => !x.staff_ids?.length || x.staff_ids.includes(b.s.id));
      await bot(`<b>${D.esc(b.s.name)}</b> it is. What are we doing?`);
      const sv = await ask(svs.slice(0, 8).map((x) => ({ label: `${x.name} · ${D.gbp(x.price_pence)}`, x })));
      await bot("Checking the diary… 📖", 500);
      const days = (await D.api(`/days?service=${sv.x.id}&staff=${b.s.id}&from=${D.ymd()}&n=10`)).days;
      const free = Object.keys(days).sort().filter((d) => days[d] > 0).slice(0, 6);
      if (!free.length) { await bot("Fully booked for the next 10 days, sorry! Want to try another barber?"); return book(); }
      await bot("Which day suits you?");
      const d = await ask(free.map((x) => ({ label: x === D.ymd() ? "Today" : D.niceDate(x), x })));
      const sl = (await D.api(`/availability?service=${sv.x.id}&staff=${b.s.id}&date=${d.x}`)).slots;
      await bot(`Here's what ${D.esc(b.s.name)} has free:`);
      const t = await ask(sl.slice(0, 9).map((x) => ({ label: fmtT(x.t), x })));
      const saved = acct.get();
      let name = saved?.name, phone = saved?.phone;
      if (!name) { await bot("Last bit. What name is the booking under?"); name = await askText("Your name"); }
      if (!phone) { await bot("And your mobile? (In the live bot I'd already know it from WhatsApp 😉)"); phone = await askText("07…"); }
      await bot(`Just to confirm:<br><b>${D.esc(sv.x.name)}</b> with <b>${D.esc(b.s.name)}</b><br>${D.niceDate(d.x)} at <b>${fmtT(t.x.t)}</b><br>£${(sv.x.price_pence / 100).toFixed(2)}`);
      const pay = await ask([{ label: `💳 Pay £${(sv.x.price_pence / 100).toFixed(0)} now`, k: "pay" }, { label: "Pay in the studio", k: "studio" }, { label: "Start again", k: "again" }]);
      if (pay.k === "again") return book();
      if (pay.k === "pay") { await bot("Here's your secure Stripe link 🔒 (demo)", 400); const ok = await D.demoPay(sv.x.price_pence, `${sv.x.name} with ${b.s.name}`); if (!ok) { await bot("No worries, cancelled. Want to try again?"); return menu(); } }
      try {
        const r = await D.api("/book", { method: "POST", body: { service_id: sv.x.id, staff_id: b.s.id, date: d.x, time: t.x.t, name, phone, pay: pay.k === "pay" ? "demo" : "studio", notes: "Booked on WhatsApp (demo)" } });
        const isNew = acct.addBooking({ id: r.booking.id, barber_id: b.s.id, service_id: sv.x.id }, name, phone);
        confetti(90);
        await bot(`✅ <b>You're booked!</b><br>Ref <b>${r.booking.ref}</b>. I'll send a reminder the day before. Reply <b>CHANGE</b> or <b>CANCEL</b> any time.`);
        if (isNew) await bot(`🎉 I've also set up your Do It For The Art account, ${D.esc(String(name).split(" ")[0])}. Every 10th cut is on us. <a href="account.html">View my account</a>`);
        menu();
      } catch (e) { await bot("Ah, that time has just gone 😬 Let's pick another."); book(); }
    }
    (async () => { await bot("Hey 👋 Welcome to <b>Do It For The Art Studio</b>. I can book you in 24/7, no app needed."); await bot("What can I do for you?", 500); menu(); })();
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
