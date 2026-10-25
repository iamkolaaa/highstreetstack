// Shared helpers for the Do It For The Art Studio site. API = Supabase edge function `difta`.
window.DIFTA = (() => {
  const API = "https://rbjyyikzddnjecbnjvey.supabase.co/functions/v1/difta";
  const gbp = (p) => p == null ? "" : "£" + (p / 100).toFixed(p % 100 ? 2 : 0);
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // YYYY-MM-DD in Europe/London for a Date
  const ymd = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayName = (s) => DAYS[new Date(s + "T12:00:00Z").getUTCDay()];
  const niceDate = (s) => { const d = new Date(s + "T12:00:00Z"); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
  const mins = (m) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m} min`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, { method = "GET", body, pin } = {}) {
    const headers = { "content-type": "application/json" };
    if (pin) headers["x-pin"] = pin;
    const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ error: "Network error" }));
    if (!r.ok) { const e = new Error(j.error || "Something went wrong"); e.status = r.status; throw e; }
    return j;
  }
  let cfgP;
  const config = () => (cfgP ||= api("/config"));

  function toast(msg, err) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("err", !!err); t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3800);
  }
  // Fill a message template like "Hi {name}" from an object
  const fill = (tpl, o) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");
  // WhatsApp click-to-chat link for a UK number
  const wa = (phone, text) => {
    let d = String(phone || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "44" + d.slice(1);
    return `https://wa.me/${d}?text=${encodeURIComponent(text || "")}`;
  };
  // ---------- DEMO MODE: nothing is sent or charged; buttons show what would happen ----------
  const DEMO = true;
  let css = false;
  function demoCss() {
    if (css) return; css = true;
    const st = document.createElement("style");
    st.textContent = `.dm{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:grid;place-items:center;padding:18px;animation:dmin .25s ease}
@keyframes dmin{from{opacity:0}}
.dm-card{width:min(380px,100%);border-radius:34px;background:#0b141a;border:8px solid #1d1d1d;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.dm-head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;background:#202c33;color:#e9edef}
.dm-head .av{width:38px;height:38px;border-radius:50%;background:#0a0a0a url(img/favicon.png) center/cover;flex:none}
.dm-head b{font-size:15px;display:block}.dm-head small{font-size:12px;color:#8696a0}
.dm-body{min-height:260px;padding:18px 12px;background:#0b141a radial-gradient(rgba(255,255,255,.035) 1px,transparent 1px) 0 0/16px 16px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px}
.dm-msg{align-self:flex-end;max-width:88%;background:#005c4b;color:#e9edef;padding:8px 10px 6px;border-radius:10px 0 10px 10px;font-size:14.5px;line-height:1.4;white-space:pre-wrap;animation:dmmsg .45s .25s both cubic-bezier(.2,.9,.3,1.3)}
.dm-msg.in{align-self:flex-start;background:#202c33;border-radius:0 10px 10px 10px}
.dm-msg small{display:block;text-align:right;font-size:11px;color:#9fd3c7;margin-top:2px}
@keyframes dmmsg{from{opacity:0;transform:translateY(14px) scale(.96)}}
.dm-foot{padding:14px 16px 18px;background:#111b21;color:#aebac1;font-size:13px;line-height:1.45;text-align:center}
.dm-foot b{color:#e8cf8f;font-weight:600;letter-spacing:.12em;font-size:11px;display:block;margin-bottom:6px}
.dm-btn{margin-top:12px;width:100%;min-height:46px;border-radius:999px;border:0;background:#f4f1ea;color:#0a0a0a;font-weight:600;cursor:pointer;font-size:14px}
.dm-pay{width:min(400px,100%);border-radius:24px;background:#fff;color:#1a1a1a;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.dm-pay .top{padding:22px 22px 6px}.dm-pay .top small{color:#6b7280;font-size:13px}.dm-pay .amt{font-size:34px;font-weight:700;margin:4px 0 2px}
.dm-pay .what{color:#4b5563;font-size:14px}
.dm-pay .body{padding:16px 22px 22px;display:grid;gap:10px}
.dm-pay .apple{min-height:48px;border-radius:10px;background:#000;color:#fff;border:0;font-size:17px;font-weight:600;cursor:pointer}
.dm-pay .or{text-align:center;color:#9ca3af;font-size:12px;margin:2px 0}
.dm-pay .fld{border:1px solid #d1d5db;border-radius:10px;padding:12px 14px;color:#6b7280;font-size:15px;display:flex;justify-content:space-between}
.dm-pay .go{min-height:50px;border-radius:10px;background:#635bff;color:#fff;border:0;font-size:16px;font-weight:600;cursor:pointer}
.dm-pay .note{font-size:12px;color:#6b7280;text-align:center;line-height:1.45}
.dm-pay .x{background:none;border:0;color:#6b7280;font-size:14px;cursor:pointer;padding:6px}
.dm-pay .bar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;font-size:13px;color:#6b7280}
.dm-chip{position:fixed;left:12px;bottom:12px;z-index:90;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(201,165,90,.5);color:#e8cf8f;font:500 10px/1 system-ui;letter-spacing:.18em;pointer-events:none}`;
    document.head.appendChild(st);
  }
  const close = (el) => el.remove();
  // Phone-style WhatsApp preview. to = who it would go to.
  function waPreview(text, to, incoming) {
    demoCss();
    const d = document.createElement("div"); d.className = "dm";
    const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    d.innerHTML = `<div class="dm-card" role="dialog" aria-label="WhatsApp preview"><div class="dm-head"><span class="av"></span><span><b>${esc(to || "WhatsApp")}</b><small>WhatsApp</small></span></div>
      <div class="dm-body"><div class="dm-msg ${incoming ? "in" : ""}">${esc(text)}<small>${now} ✓✓</small></div></div>
      <div class="dm-foot"><b>DEMO PREVIEW</b>In the live version this opens WhatsApp with the message ready to send, or sends it automatically. Nothing was sent.<button class="dm-btn">Got it</button></div></div>`;
    d.onclick = (e) => { if (e.target === d || e.target.classList.contains("dm-btn")) close(d); };
    document.body.appendChild(d);
  }
  // Stripe-style checkout preview. Resolves true when "paid", false when closed.
  function demoPay(pence, label) {
    demoCss();
    return new Promise((res) => {
      const d = document.createElement("div"); d.className = "dm";
      d.innerHTML = `<div class="dm-pay" role="dialog" aria-label="Payment preview"><div class="bar"><span>🔒 Secure checkout · Stripe</span><button class="x">Cancel</button></div>
        <div class="top"><small>Do It For The Art Studio</small><div class="amt">${gbp(pence)}</div><div class="what">${esc(label)}</div></div>
        <div class="body"><button class="apple"> Pay</button><div class="or">or pay with card</div>
        <div class="fld"><span>4242 4242 4242 4242</span><span>VISA</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fld">12 / 28</div><div class="fld">123</div></div>
        <button class="go">Pay ${gbp(pence)}</button>
        <div class="note"><b style="color:#b45309">DEMO</b> · No card is charged. Live, the money goes straight to the studio's own Stripe account (about 1.5% + 20p per payment, no monthly fee).</div></div></div>`;
      const done = (v) => { close(d); res(v); };
      d.querySelector(".x").onclick = () => done(false);
      const pay = (b) => { b.disabled = true; b.textContent = "Processing…"; setTimeout(() => { b.textContent = "✓ Paid"; setTimeout(() => done(true), 500); }, 1100); };
      d.querySelector(".go").onclick = (e) => pay(e.target);
      d.querySelector(".apple").onclick = (e) => pay(e.target);
      document.body.appendChild(d);
    });
  }
  if (DEMO) {
    // Catch every WhatsApp link on every page (public site and staff app) and show the preview instead.
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
      if (!a) return;
      e.preventDefault();
      const u = new URL(a.href), num = u.pathname.slice(1), text = u.searchParams.get("text") || "";
      const studio = num === "447946683376";
      const to = studio ? "Do It For The Art Studio" : (a.dataset.to || "+" + num.replace(/^44/, "44 "));
      waPreview(text || "Hi Do It For The Art Studio 👋", to, false);
    }, true);
    addEventListener("DOMContentLoaded", () => { demoCss(); const c = document.createElement("div"); c.className = "dm-chip"; c.textContent = "DEMO"; document.body.appendChild(c); });
  }
  return { API, api, config, gbp, ymd, addDays, dayName, niceDate, mins, esc, toast, fill, wa, DEMO, waPreview, demoPay };
})();
