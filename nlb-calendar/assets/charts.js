/* Plain inline SVG for the dashboard. Colours come from CSS variables (--c1, --c2, --c3), so dark mode just works. */
import { esc, MONTHS, money } from './util.js?v=202611061900';

const W = 600, H = 280, ML = 46, MR = 8, MT = 12, MB = 30;
const label = ym => MONTHS[+ym.slice(5, 7) - 1];
const tick = p => (p === 0 ? '£0' : p >= 100000 ? '£' + p / 100000 + 'k' : '£' + Math.round(p / 100));
function niceMax(v) {
  if (v <= 0) return 10000;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

export function chartSvg(months, selected) {
  const max = niceMax(Math.max(...months.map(m => m.pt_card + m.pt_cash + m.other))), pw = W - ML - MR, ph = H - MT - MB, slot = pw / months.length, bw = Math.min(34, slot * 0.64);
  const y = v => MT + ph - (v / max) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    g += `<line class="grid" x1="${ML}" x2="${W - MR}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${ML - 6}" y="${y(v) + 4}" text-anchor="end">${tick(v)}</text>`;
  }
  const bars = months.map((m, i) => {
    const x = ML + slot * i + (slot - bw) / 2;
    let top = MT + ph, out = '';
    [['c1', m.pt_card, 'PT by card'], ['c2', m.pt_cash, 'PT cash'], ['c3', m.other, 'Other Stripe income']].forEach(([c, v]) => {
      if (v <= 0) return;
      const h = (v / max) * ph; top -= h;
      out += `<rect class="seg ${c}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="2"/>`;
    });
    const total = m.pt_card + m.pt_cash + m.other;
    const tip = `${label(m.month)} ${m.month.slice(0, 4)}: PT by card ${money(m.pt_card)}, PT cash ${money(m.pt_cash)}, other Stripe income ${money(m.other)}, total ${money(total)}`;
    return `<g${m.month === selected ? ' class="sel"' : ''}><title>${esc(tip)}</title>${m.month === selected ? `<rect class="selbg" x="${(ML + slot * i).toFixed(1)}" y="${MT}" width="${slot.toFixed(1)}" height="${ph}" rx="4"/>` : ''}${out}` +
      `<text class="ax mon" x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">${label(m.month)}</text></g>`;
  }).join('');
  const first = months[0].month, last = months[months.length - 1].month;
  return `<div class="chartwrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ct cd"><title id="ct">Monthly income, ${label(first)} ${first.slice(0, 4)} to ${label(last)} ${last.slice(0, 4)}</title>` +
    `<desc id="cd">Stacked bars for each month: PT by card, PT cash and other Stripe income. The numbers are in the table below.</desc>${g}${bars}</svg></div>`;
}

export function tableHtml(months) {
  return `<div class="tablewrap"><table class="nums"><thead><tr><th>Month</th><th>PT by card</th><th>PT cash</th><th>Other</th><th>Total</th></tr></thead><tbody>` +
    months.slice().reverse().map(m => `<tr><th scope="row">${label(m.month)} ${m.month.slice(0, 4)}</th><td>${money(m.pt_card)}</td><td>${money(m.pt_cash)}</td><td>${money(m.other)}</td><td>${money(m.pt_card + m.pt_cash + m.other)}</td></tr>`).join('') +
    '</tbody></table></div>';
}
