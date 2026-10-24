// Shared helpers for the DIFTA Studio site. API = Supabase edge function `difta`.
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
  return { API, api, config, gbp, ymd, addDays, dayName, niceDate, mins, esc, toast, fill, wa };
})();
