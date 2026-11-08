/* High Street Stack calculators: the maths only, no page code. Rates come from rates.js. */
(function (root) {
"use strict";
var R = (typeof module !== "undefined" && module.exports) ? require("./rates.js") : root.HSS_RATES;
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? "" : v).replace(/[£,\s]/g, ""));
  return isFinite(n) ? n : 0;
}
function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function pos(x) { return Math.max(0, num(x)); }
function gbp(n) {
  var s = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-" : "") + "£" + s;
}
function gbpw(n) { return "£" + Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 2 }); }
function pc(x, d) { return (x * 100).toFixed(d == null ? 1 : d).replace(/\.0+$/, "") + "%"; }
function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function fdate(d) { return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
function fday(d) { return DAY[d.getUTCDay()]; }
function todayUTC(now) { now = now || new Date(); return utc(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
function parseISO(s) { var p = s.split("-"); return utc(+p[0], +p[1], +p[2]); }

/* ---------- Making Tax Digital checker ---------- */
var M = R.making_tax_digital_income_tax;
var TIERS = [M.start_2026_04_06, M.start_2027_04_06, M.start_2028_04_06].map(function (t) {
  return { start: parseISO(t.date), threshold: t.threshold, tested: t.return_tested };
});

function dueDate(due, taxYearStart) {
  // "7 Aug", "7 May following year": Aug and Nov fall in the year the tax year starts, Feb and May in the next.
  var m = /^(\d+)\s+([A-Za-z]{3})/.exec(due);
  var mon = MONTHS[m[2].toLowerCase()];
  return utc(mon >= 7 ? taxYearStart : taxYearStart + 1, mon + 1, +m[1]);
}
function periodText(period, taxYearStart) {
  var parts = period.split(" to "); // "6 Apr to 5 Jul"
  var endMon = MONTHS[parts[1].split(" ")[1].toLowerCase()];
  var endYear = (endMon >= 5 && endMon <= 11) ? taxYearStart : taxYearStart + 1; // Jul, Oct are in the start year; Jan, Apr in the next
  return parts[0] + " " + taxYearStart + " to " + parts[1] + " " + endYear;
}
function deadlines(startDate, today, count) {
  var y0 = startDate.getUTCFullYear(), all = [], i, p, ty;
  for (ty = y0; ty < y0 + 4; ty++) {
    for (i = 0; i < M.quarterly_standard_periods.length; i++) {
      p = M.quarterly_standard_periods[i];
      all.push({ due: dueDate(p.due, ty), period: periodText(p.period, ty), taxYear: ty + "/" + String(ty + 1).slice(2), taxYearStart: ty });
    }
  }
  var upcoming = all.filter(function (d) { return d.due >= today; }).slice(0, count || 4);
  var yearEnd = utc(y0 + 1, 4, 5);
  var missed = today <= yearEnd ? all.filter(function (d) { return d.taxYearStart === y0 && d.due < today; }) : [];
  return { upcoming: upcoming, missed: missed };
}
function mtdCheck(inputs, sharePct, today) {
  today = today || todayUTC();
  var share = Math.min(100, Math.max(0, num(sharePct == null || sharePct === "" ? 100 : sharePct))) / 100;
  var tests = TIERS.map(function (t) {
    var i = inputs[t.tested] || {};
    var se = pos(i.se), pg = pos(i.prop), ps = r2(pg * share), q = r2(se + ps);
    return { start: t.start, threshold: t.threshold, tested: t.tested, se: se, propGross: pg, propShare: ps, qualifying: q, over: q > t.threshold };
  });
  var hit = null, k;
  for (k = 0; k < tests.length; k++) { if (tests[k].over) { hit = tests[k]; break; } }
  var out = { tests: tests, share: share, inScope: !!hit, tier: hit, start: hit ? hit.start : null, started: hit ? hit.start <= today : false };
  if (hit) {
    var d = deadlines(hit.start, today, 4);
    out.upcoming = d.upcoming; out.missed = d.missed;
    out.finalDeclaration = utc(hit.start.getUTCFullYear() + 2, 1, 31);
    out.firstTaxYear = hit.start.getUTCFullYear() + "/" + String(hit.start.getUTCFullYear() + 1).slice(2);
  }
  return out;
}

/* ---------- Income tax, NI, student loan ---------- */
var IT = R.income_tax_rUK_2026_27;
var SC = R.income_tax_scotland_2026_27;

function personalAllowance(income) {
  var pa = IT.personal_allowance;
  if (income > IT.taper_start) pa = Math.max(0, pa - (income - IT.taper_start) / 2);
  return pa;
}
function bandList(region) {
  if (region === "scotland") {
    var s = [SC.starter, SC.basic, SC.intermediate, SC.higher, SC.advanced], pa = SC.personal_allowance, names = ["Starter","Basic","Intermediate","Higher","Advanced"], out = [], prev = 0, i, lim;
    for (i = 0; i < s.length; i++) {
      // gov.uk prints gross ranges; taxable limits are the gross limit less the standard allowance.
      // The advanced band ends at the point the top rate starts (£125,140, where the allowance is nil).
      lim = (i === s.length - 1) ? SC.top.from - 1 : s[i].to - pa;
      out.push({ name: names[i], rate: s[i].rate, width: lim - prev }); prev = lim;
    }
    out.push({ name: "Top", rate: SC.top.rate, width: Infinity });
    return out;
  }
  return [
    { name: "Basic", rate: IT.basic_rate, width: IT.basic_band_width },
    { name: "Higher", rate: IT.higher_rate, width: IT.higher_band_top - IT.basic_band_width },
    { name: "Additional", rate: IT.additional_rate, width: Infinity }
  ];
}
function incomeTax(income, region) {
  income = pos(income);
  var pa = personalAllowance(income), taxable = Math.max(0, income - pa), left = taxable, bands = [], tax = 0, bl = bandList(region), i, amt, t;
  for (i = 0; i < bl.length; i++) {
    amt = Math.min(left, bl[i].width); if (amt < 0) amt = 0;
    t = amt * bl[i].rate; tax += t; left -= amt;
    bands.push({ name: bl[i].name, rate: bl[i].rate, amount: r2(amt), tax: r2(t) });
  }
  return { tax: r2(tax), pa: pa, taxable: r2(taxable), bands: bands };
}
var N = R.national_insurance_self_employed;
function class4(profit) {
  profit = pos(profit);
  var lo = N.class4_lower_profits_limit_2026_27, hi = N.class4_upper_profits_limit_2026_27;
  var main = Math.max(0, Math.min(profit, hi) - lo) * N.class4_main_rate_2026_27;
  var add = Math.max(0, profit - hi) * N.class4_additional_rate_2026_27;
  return { main: r2(main), additional: r2(add), tax: r2(main + add) };
}
function class2Voluntary(profit, wanted) {
  var thr = N.class2_small_profits_threshold_2026_27, weekly = N.class2_voluntary_weekly_rate_2026_27;
  if (!wanted) return { amount: 0, state: "off" };
  if (pos(profit) >= thr) return { amount: 0, state: "treated-as-paid" };
  return { amount: r2(weekly * 52), state: "added" };
}
var SL = R.student_loans_2026_27;
function studentLoanThreshold(plan) {
  return { "1": SL.plan_1_threshold, "2": SL.plan_2_threshold, "4": SL.plan_4_threshold, "5": SL.plan_5_threshold }[plan];
}
function studentLoan(income, plan, postgrad) {
  income = pos(income); var t = 0, thr;
  thr = studentLoanThreshold(plan);
  if (thr != null) t += Math.max(0, income - thr) * SL.plan_rate;
  if (postgrad) t += Math.max(0, income - SL.postgraduate_threshold) * SL.postgraduate_rate;
  return r2(t);
}

function soleTrader(o) {
  var profit = pos(o.profit), other = pos(o.other), region = o.region === "scotland" ? "scotland" : "ruk";
  var all = incomeTax(profit + other, region), oth = incomeTax(other, region);
  var itProfit = r2(all.tax - oth.tax);
  var c4 = class4(profit), c2 = class2Voluntary(profit, o.class2);
  var slAll = studentLoan(profit + other, o.plan, o.postgrad), slOth = studentLoan(other, o.plan, o.postgrad);
  var sl = r2(slAll - slOth);
  var total = r2(itProfit + c4.tax + c2.amount + sl);
  var res = { profit: profit, other: other, region: region, incomeTax: itProfit, incomeTaxAll: all, class4: c4, class2: c2, studentLoan: sl, total: total,
    takeHome: r2(profit - total), setAsidePct: profit > 0 ? total / profit : 0, monthly: r2(total / 12), takeHomeMonthly: r2((profit - total) / 12) };
  var steps = [], i, b;
  steps.push("Total income " + gbp(profit + other) + (other ? " (profit " + gbp(profit) + " plus other income " + gbp(other) + ")" : "") + ".");
  steps.push("Personal allowance " + gbp(all.pa) + (all.pa < IT.personal_allowance ? " (cut back because income is over " + gbpw(IT.taper_start) + ")" : "") + ", so taxable income is " + gbp(all.taxable) + ".");
  for (i = 0; i < all.bands.length; i++) { b = all.bands[i]; if (b.amount > 0) steps.push(b.name + " rate: " + gbp(b.amount) + " at " + pc(b.rate, 0) + " = " + gbp(b.tax) + "."); }
  if (other) steps.push("Tax on your other income alone is " + gbp(oth.tax) + ", so the tax caused by your profit is " + gbp(all.tax) + " - " + gbp(oth.tax) + " = " + gbp(itProfit) + ".");
  steps.push("Class 4 National Insurance: " + pc(N.class4_main_rate_2026_27, 0) + " on profit between " + gbpw(N.class4_lower_profits_limit_2026_27) + " and " + gbpw(N.class4_upper_profits_limit_2026_27) + " = " + gbp(c4.main) + (c4.additional ? ", plus " + pc(N.class4_additional_rate_2026_27, 0) + " on the rest = " + gbp(c4.additional) : "") + ".");
  if (c2.state === "added") steps.push("Voluntary Class 2: " + gbp(N.class2_voluntary_weekly_rate_2026_27) + " a week for 52 weeks = " + gbp(c2.amount) + ".");
  if (c2.state === "treated-as-paid") steps.push("Class 2: profit is at or over " + gbpw(N.class2_small_profits_threshold_2026_27) + ", so it is treated as paid and nothing is added.");
  if (sl) steps.push("Student loan: repayment on income over the threshold for your plan = " + gbp(sl) + ".");
  steps.push("Total set aside " + gbp(total) + ", which is " + pc(res.setAsidePct, 1) + " of profit. Take-home " + gbp(res.takeHome) + ".");
  res.steps = steps;
  return res;
}

/* ---------- Mileage ---------- */
var S = R.simplified_expenses;
var CAR_BAND = 10000; // the "first 10,000 miles" band named in simplified_expenses.car_van_first_10000_miles_*
function mileage(o) {
  var miles = pos(o.miles), before = pos(o.before), year = o.year === "2025-26" ? "2025-26" : "2026-27";
  var r1 = year === "2025-26" ? S.car_van_first_10000_miles_2025_26 : S.car_van_first_10000_miles_2026_27;
  var r = { miles: miles, before: before, year: year, vehicle: o.vehicle === "moto" ? "moto" : "car" };
  if (r.vehicle === "moto") {
    r.parts = [{ miles: miles, rate: S.motorcycle }]; r.amount = r2(miles * S.motorcycle); r.remaining = null;
  } else {
    var first = Math.max(0, Math.min(CAR_BAND, before + miles) - before), rest = miles - first;
    r.parts = [{ miles: first, rate: r1 }, { miles: rest, rate: S.car_van_after_10000_miles }];
    r.amount = r2(first * r1 + rest * S.car_van_after_10000_miles);
    r.remaining = Math.max(0, CAR_BAND - (before + miles));
  }
  return r;
}
function mileageRunning(trips, o) {
  var prevClaim = 0, rows = [], sum = 0, i, m, c;
  for (i = 0; i < trips.length; i++) {
    m = pos(trips[i]); sum += m;
    c = mileage({ miles: sum, before: o.before, vehicle: o.vehicle, year: o.year });
    rows.push({ miles: m, totalMiles: r2(pos(o.before) + sum), claim: r2(c.amount - prevClaim), runningClaim: c.amount });
    prevClaim = c.amount;
  }
  return { rows: rows, total: mileage({ miles: sum, before: o.before, vehicle: o.vehicle, year: o.year }), miles: sum };
}

/* ---------- Landlord with Section 24 ---------- */
var LL = R.landlords;
function landlord(o) {
  var sh = Math.min(100, Math.max(0, num(o.share == null || o.share === "" ? 100 : o.share))) / 100;
  var rent = r2(pos(o.rent) * sh), exp = r2(pos(o.expenses) * sh), fin = r2(pos(o.interest) * sh), other = pos(o.other);
  var profitBefore = r2(rent - exp);
  var s24Profit = Math.max(0, profitBefore);
  var oldProfit = Math.max(0, r2(profitBefore - fin));
  var base = incomeTax(other, "ruk");
  var s24 = incomeTax(other + s24Profit, "ruk");
  var old = incomeTax(other + oldProfit, "ruk");
  var aboveAllowance = Math.max(0, other + s24Profit - s24.pa);
  var limit = Math.min(fin, s24Profit, aboveAllowance);
  var credit = r2(limit * LL.section_24_reduction_rate);
  var beforeRed = r2(s24.tax - base.tax);
  var after = r2(Math.max(0, s24.tax - credit) - base.tax);
  var oldTax = r2(old.tax - base.tax);
  var res = { share: sh, rent: rent, expenses: exp, finance: fin, other: other, profitBefore: profitBefore, s24Profit: s24Profit, oldProfit: oldProfit,
    taxBeforeReduction: beforeRed, limit: limit, reduction: credit, taxAfterReduction: after, taxOldRules: oldTax,
    cost: r2(after - oldTax), carriedForward: r2(fin - limit), loss: profitBefore < 0 };
  var steps = [];
  if (sh < 1) steps.push("Your " + pc(sh, 0) + " share: rent " + gbp(rent) + ", expenses " + gbp(exp) + ", finance costs " + gbp(fin) + ".");
  steps.push("Profit before finance costs = rent " + gbp(rent) + " - expenses " + gbp(exp) + " = " + gbp(profitBefore) + ".");
  steps.push("Section 24 rules: you are taxed on " + gbp(s24Profit) + " (mortgage interest is not deducted). With other income of " + gbp(other) + ", the extra tax is " + gbp(beforeRed) + ".");
  steps.push("Reduction = " + pc(LL.section_24_reduction_rate, 0) + " of the lowest of finance costs " + gbp(fin) + ", property profit " + gbp(s24Profit) + " and income above your allowance " + gbp(aboveAllowance) + ", which is " + pc(LL.section_24_reduction_rate, 0) + " of " + gbp(limit) + " = " + gbp(credit) + ".");
  steps.push("Tax after the reduction " + gbp(beforeRed) + " - " + gbp(credit) + " = " + gbp(after) + ".");
  steps.push("Rules before 2017 let you deduct the interest: taxable profit " + gbp(oldProfit) + ", extra tax " + gbp(oldTax) + ".");
  steps.push("Section 24 costs you " + gbp(after) + " - " + gbp(oldTax) + " = " + gbp(res.cost) + " this year.");
  if (res.carriedForward > 0) steps.push("Finance costs not used this year, " + gbp(res.carriedForward) + ", carry forward to later years of the same property business.");
  res.steps = steps;
  return res;
}

/* ---------- Payments on account ---------- */
var P = R.payments_on_account;
function monthsBetween(today, due) { return Math.max(1, Math.round((due - today) / 86400000 / 30.4375)); }
function paymentsOnAccount(o) {
  var bill = pos(o.bill), src = pos(o.atSource), last = pos(o.lastBill);
  var hasOverride = o.paid != null && o.paid !== "";
  var totalTax = bill + src, share = totalTax > 0 ? src / totalTax : 0;
  var passesSource = share <= P.paid_elsewhere_rule;
  var applies = bill >= P.threshold && passesSource;
  var each = applies ? r2(bill / 2) : 0;
  var priorPaid = hasOverride ? pos(o.paid) : (last >= P.threshold ? last : 0);
  var balancing = r2(bill - priorPaid);
  var janTotal = r2(balancing + each);
  var today = o.today || todayUTC();
  var janYear = +/(\d{4})$/.exec(R.self_assessment_deadlines.online_return)[1];
  var janDue = utc(janYear, 1, 31), julDue = utc(janYear, 7, 31);
  var res = { bill: bill, atSource: src, atSourceShare: share, passesThreshold: bill >= P.threshold, passesSource: passesSource, applies: applies, each: each,
    priorPaid: priorPaid, priorAssumed: !hasOverride, balancing: balancing, janTotal: janTotal, janPay: Math.max(0, janTotal), jul: each,
    janDue: janDue, julDue: julDue, monthsToJan: monthsBetween(today, janDue) };
  res.perMonth = r2(res.janPay / res.monthsToJan);
  var steps = [];
  steps.push("Test 1: your " + R.tax_year.previous.replace("-", "/") + " bill is " + gbp(bill) + ". Under " + gbpw(P.threshold) + " means no payments on account. " + (res.passesThreshold ? "Yours is not under, so this test is passed." : "Yours is under, so none apply."));
  steps.push("Test 2: tax collected at source is " + gbp(src) + ", which is " + pc(share, 1) + " of the total tax of " + gbp(totalTax) + ". More than " + pc(P.paid_elsewhere_rule, 0) + " means none apply. " + (passesSource ? "Yours is not over, so this test is passed." : "Yours is over, so none apply."));
  if (applies) steps.push("Each payment on account is half the bill: " + gbp(bill) + " / 2 = " + gbp(each) + ".");
  steps.push("Balancing payment for " + R.tax_year.previous.replace("-", "/") + " = bill " + gbp(bill) + " - payments on account already made " + gbp(priorPaid) + (res.priorAssumed ? " (assumed to be last year's bill, paid in two halves)" : "") + " = " + gbp(balancing) + ".");
  steps.push("Due " + fdate(janDue) + ": " + gbp(balancing) + " + first payment on account " + gbp(each) + " = " + gbp(janTotal) + ".");
  steps.push("Due " + fdate(julDue) + ": second payment on account " + gbp(each) + ".");
  res.steps = steps;
  return res;
}

/* ---------- Café and takeaway GP calculator ---------- */
var V = R.vat_catering;
function foodCost(o) {
  o = o || {};
  var vatOn = !!o.vat, rate = V.standard_rate, k = vatOn ? 1 + rate : 1;
  var price = pos(o.price), commission = Math.min(0.99, pos(o.commission) / 100), target = o.target == null ? 0.7 : Math.min(0.99, pos(o.target) / 100);
  var lines = [], cost = 0;
  (o.lines || []).forEach(function (l, i) {
    var pack = pos(l.pack), size = pos(l.size), used = pos(l.used);
    if (pack > 0 && size > 0 && used > 0) { var c = pack / size * used; lines.push({ n: i + 1, pack: pack, size: size, used: used, cost: c }); cost += c; }
  });
  var extra = pos(o.extra); cost += extra; cost = r2(cost);
  var net = price / k, vat = price - net;
  var gp = net - cost, gpPct = net > 0 ? gp / net : 0, foodPct = net > 0 ? cost / net : 0;
  var comm = price * commission, gpAfter = gp - comm, gpAfterPct = net > 0 ? gpAfter / net : 0;
  // price needed: net x (1 - target) = cost, so net = cost / (1 - target); with commission on the VAT-inclusive price,
  // net x (1 - target) - commission x net x k = cost, so net = cost / (1 - target - commission x k)
  var netNeed = cost > 0 && target < 1 ? cost / (1 - target) : 0;
  var needBefore = r2(Math.ceil(netNeed * k * 100 - 1e-9) / 100);
  var den = 1 - target - commission * k, needAfter = null;
  if (cost > 0 && den > 0.005) needAfter = r2(Math.ceil(cost / den * k * 100 - 1e-9) / 100);
  var res = { vatOn: vatOn, vatRate: rate, price: price, net: net, vat: vat, cost: cost, lines: lines, extra: extra, gp: gp, gpPct: gpPct, foodPct: foodPct,
    commissionPct: commission, commission: comm, gpAfter: gpAfter, gpAfterPct: gpAfterPct, target: target, needBefore: needBefore, needAfter: needAfter,
    hasCommission: commission > 0, unreachable: commission > 0 && cost > 0 && den <= 0.005 };
  var shown = commission > 0 ? gpAfterPct : gpPct;
  res.shownPct = shown; res.meets = shown + 1e-9 >= target;
  var steps = [];
  lines.forEach(function (l) { steps.push("Ingredient " + l.n + ": " + gbp(l.pack) + " / " + l.size + " x " + l.used + " used = " + gbp(r2(l.cost)) + "."); });
  if (extra) steps.push("Other costs per portion: " + gbp(extra) + ".");
  steps.push("Ingredient cost per portion: " + gbp(cost) + ".");
  if (vatOn) steps.push("VAT-exclusive price: " + gbp(price) + " / " + (1 + rate).toFixed(2) + " = " + gbp(net) + " (VAT " + gbp(vat) + ").");
  else steps.push("No VAT on this dish, so the price you charge is the price that counts: " + gbp(net) + ".");
  steps.push("Gross profit: " + gbp(net) + " - " + gbp(cost) + " = " + gbp(gp) + ". GP % = " + gbp(gp) + " / " + gbp(net) + " = " + pc(gpPct, 1) + ".");
  steps.push("Food cost % = " + gbp(cost) + " / " + gbp(net) + " = " + pc(foodPct, 1) + ".");
  if (commission > 0) steps.push("Delivery commission: " + pc(commission, 1) + " of the VAT-inclusive price " + gbp(price) + " = " + gbp(comm) + ". GP after commission = " + gbp(gp) + " - " + gbp(comm) + " = " + gbp(gpAfter) + ", which is " + pc(gpAfterPct, 1) + " of " + gbp(net) + ".");
  if (cost > 0) {
    steps.push("Price for " + pc(target, 0) + " GP: " + gbp(cost) + " / (1 - " + target.toFixed(2) + ") = " + gbp(r2(netNeed)) + " before VAT" + (vatOn ? ", x " + (1 + rate).toFixed(2) + " = " + gbp(needBefore) + " with VAT." : "."));
    if (commission > 0) steps.push(needAfter == null ? "With " + pc(commission, 1) + " commission taken on the VAT-inclusive price, no menu price reaches " + pc(target, 0) + " GP: the commission and the target leave nothing for the food." :
      "With commission: " + gbp(cost) + " / (1 - " + target.toFixed(2) + " - " + commission.toFixed(2) + (vatOn ? " x " + k.toFixed(2) : "") + ") = " + gbp(r2(cost / den)) + " before VAT" + (vatOn ? ", x " + k.toFixed(2) + " = " + gbp(needAfter) + " with VAT." : "."));
  }
  res.steps = steps;
  return res;
}

/* ---------- CIS deduction calculator ---------- */
var C = R.cis;
var CIS_STATUS = { registered: { rate: C.registered, label: "registered" }, unregistered: { rate: C.unregistered, label: "not registered" }, gross: { rate: C.gross_payment_status, label: "gross payment status" } };
function cisDeduction(o) {
  o = o || {};
  var st = CIS_STATUS[o.status] || CIS_STATUS.registered;
  var labour = pos(o.labour), materials = pos(o.materials), vat = pos(o.vat);
  var total = r2(labour + materials + vat), deduction = r2(labour * st.rate), net = r2(total - deduction);
  var steps = [];
  steps.push("Invoice total: " + gbp(labour) + " labour + " + gbp(materials) + " materials + " + gbp(vat) + " VAT = " + gbp(total) + ".");
  steps.push("Materials and VAT are taken out before the CIS rate is applied, so the deduction is worked out on the " + gbp(labour) + " labour only.");
  steps.push(st.rate > 0 ? "CIS rate for " + st.label + " subcontractors: " + pc(st.rate, 0) + ". " + gbp(labour) + " x " + pc(st.rate, 0) + " = " + gbp(deduction) + " deducted." : "With gross payment status the rate is 0%, so nothing is deducted.");
  steps.push("Net payment: " + gbp(total) + " - " + gbp(deduction) + " = " + gbp(net) + ".");
  return { status: o.status in CIS_STATUS ? o.status : "registered", rate: st.rate, label: st.label, labour: labour, materials: materials, vat: vat, total: total, deduction: deduction, net: net, steps: steps };
}
function cisYearToDate(list) {
  var t = 0; (list || []).forEach(function (x) { t += pos(x); }); return r2(t);
}

/* ---------- Cake pricing calculator (same maths as products/cake-pricing-calculator) ---------- */
function cakePrice(o) {
  o = o || {};
  var ing = pos(o.ingredients), pack = pos(o.packaging), hrs = pos(o.hours), rate = pos(o.rate), oven = pos(o.ovenHours), ovr = pos(o.overhead);
  var target = Math.min(0.99, pos(o.target) / 100), servings = pos(o.servings), mine = pos(o.myPrice);
  var labour = hrs * rate, overhead = oven * ovr, cost = ing + pack + labour + overhead;
  var minimum = cost, price = cost / (1 - target);
  var res = { ingredients: ing, packaging: pack, labour: labour, overhead: overhead, cost: cost, minimum: minimum, target: target, price: price, profit: price - cost,
    servings: servings, perServing: servings > 0 ? price / servings : null, costPerServing: servings > 0 ? cost / servings : null, myPrice: mine, flag: "" };
  if (mine > 0) res.flag = mine < cost - 0.005 ? "below" : (mine < price - 0.005 ? "under" : "ok");
  if (mine > 0) { res.myProfit = mine - cost; res.myPct = (mine - cost) / mine; }
  var steps = [];
  steps.push("Labour: " + hrs + " hours x " + gbp(rate) + " = " + gbp(r2(labour)) + ". Overhead: " + oven + " oven hours x " + gbp(ovr) + " = " + gbp(r2(overhead)) + ".");
  steps.push("Total cost: " + gbp(r2(ing)) + " ingredients + " + gbp(r2(pack)) + " packaging + " + gbp(r2(labour)) + " labour + " + gbp(r2(overhead)) + " overhead = " + gbp(r2(cost)) + ".");
  steps.push("Minimum price: the total cost, " + gbp(r2(minimum)) + ". Charge less than that and you lose money.");
  steps.push("Price at " + pc(target, 0) + " profit: " + gbp(r2(cost)) + " / (1 - " + target.toFixed(2) + ") = " + gbp(r2(price)) + ". Profit is " + gbp(r2(price - cost)) + ", which is " + pc(target, 0) + " of the price.");
  if (servings > 0) steps.push("Price per serving: " + gbp(r2(price)) + " / " + servings + " = " + gbp(r2(price / servings)) + ".");
  res.steps = steps;
  return res;
}

/* ---------- Selling fee calculator (fee figures from rates.json selling_fees; blank fees are left out) ---------- */
var SF = R.selling_fees;
var SF_KEYS = ["ebay_private", "ebay_business", "etsy", "depop", "vinted"];
var SF_REQ = { fvf: "selling fee", other: "regulatory fee", fixed_lo: "per-order fee", proc_pct: "payment processing", proc_fixed: "payment processing (fixed)", listing: "listing fee" };
function sellingFees(o) {
  o = o || {};
  var price = pos(o.price), pin = pos(o.postageIn), pout = pos(o.postageOut), pack = pos(o.packaging), cost = pos(o.cost);
  var total = price + pin;
  var rows = SF_KEYS.map(function (k) {
    var p = SF[k], g = function (f) { return p[f] || 0; };
    var base = p.postage === "Yes" ? total : price;
    var fixed = (g("limit") > 0 && total > g("limit")) ? g("fixed_hi") : g("fixed_lo");
    var fvfFee = g("fvf") * base, reg = g("other") * base, proc = g("proc_pct") * total + g("proc_fixed"), listing = g("listing");
    var fees = fvfFee + reg + fixed + proc + listing;
    var blanks = Object.keys(SF_REQ).filter(function (f) { return p[f] === null || p[f] === undefined; }).map(function (f) { return SF_REQ[f]; });
    var steps = [];
    if (g("fvf")) steps.push("selling fee " + pc(g("fvf"), 1) + " x " + gbp(base) + " = " + gbp(r2(fvfFee)));
    if (g("other")) steps.push("regulatory fee " + pc(g("other"), 2) + " x " + gbp(base) + " = " + gbp(r2(reg)));
    if (fixed) steps.push("per-order fee " + gbp(fixed));
    if (g("proc_pct") || g("proc_fixed")) steps.push("payment processing " + pc(g("proc_pct"), 1) + " x " + gbp(total) + " + " + gbp(g("proc_fixed")) + " = " + gbp(r2(proc)));
    if (listing) steps.push("listing fee " + gbp(listing));
    return { key: k, name: p.name, fees: r2(fees), profit: r2(total - fees - pout - pack - cost), blanks: blanks, steps: steps, postageInBase: p.postage === "Yes" };
  });
  return { price: price, postageIn: pin, postageOut: pout, packaging: pack, cost: cost, revenue: r2(total), rows: rows, checked: SF.checked };
}

/* ---------- Cleaning quote calculator (same maths as products/cleaning-quote-calculator) ---------- */
var CLEAN_ROOM_MIN = [20, 30, 40, 25, 15, 15];
var CLEAN_ROOM_NAMES = ["Bedroom", "Bathroom", "Kitchen", "Living room", "Hall and stairs", "Other room"];
function cleaningQuote(o) {
  o = o || {};
  var method = o.method || "hours", rate = pos(o.rate), prodRate = pos(o.prod), minCharge = pos(o.minCharge);
  var mins = o.roomMin || CLEAN_ROOM_MIN, hours = 0, cleaning = 0, steps = [];
  if (o.eot) {
    var bedMin = o.bedMin == null ? 60 : pos(o.bedMin), bathMin = o.bathMin == null ? 75 : pos(o.bathMin), baseMin = o.baseMin == null ? 150 : pos(o.baseMin);
    var beds = pos(o.beds), baths = pos(o.baths), uplift = pos(o.uplift) / 100;
    var tm = beds * bedMin + baths * bathMin + baseMin;
    hours = tm / 60 * (1 + uplift); cleaning = hours * rate;
    steps.push("End of tenancy time: " + beds + " x " + bedMin + " + " + baths + " x " + bathMin + " + " + baseMin + " = " + tm + " minutes" + (uplift ? ", x " + (1 + uplift).toFixed(2) + " deep-clean uplift" : "") + " = " + (Math.round(hours * 100) / 100) + " hours. Cleaning: " + (Math.round(hours * 100) / 100) + " x " + gbp(rate) + " = " + gbp(r2(cleaning)) + ".");
  } else if (method === "rooms") {
    var tmr = 0; (o.rooms || []).forEach(function (n, i) { tmr += pos(n) * (mins[i] || 0); });
    hours = tmr / 60; cleaning = hours * rate;
    steps.push("Room time: " + tmr + " minutes = " + (Math.round(hours * 100) / 100) + " hours x " + gbp(rate) + " = " + gbp(r2(cleaning)) + ".");
  } else if (method === "area") {
    hours = pos(o.hours); cleaning = pos(o.area) * pos(o.perM2);
    steps.push("Cleaning by area: " + pos(o.area) + " m2 x " + gbp(pos(o.perM2)) + " = " + gbp(r2(cleaning)) + ". Your hours (" + hours + ") are used for products and your hourly rate.");
  } else {
    hours = pos(o.hours); cleaning = hours * rate;
    steps.push("Cleaning: " + hours + " hours x " + gbp(rate) + " = " + gbp(r2(cleaning)) + ".");
  }
  var products = hours * prodRate;
  var travel = o.travelMode === "flat" ? pos(o.flat) : pos(o.miles) * pos(o.perMile);
  var pre = cleaning + products + travel, net = Math.max(pre, minCharge), top = net - pre;
  var eqHours = (method === "rooms" && !o.eot && pos(o.hours) > 0) ? pos(o.hours) : hours;
  var eq = eqHours > 0 ? (net - travel - products) / eqHours : null;
  steps.push("Products: " + (Math.round(hours * 100) / 100) + " hours x " + gbp(prodRate) + " = " + gbp(r2(products)) + ". Travel " + gbp(r2(travel)) + ".");
  steps.push("Price before any minimum: " + gbp(r2(cleaning)) + " + " + gbp(r2(products)) + " + " + gbp(r2(travel)) + " = " + gbp(r2(pre)) + ".");
  if (top > 0.005) steps.push("Your minimum charge is " + gbp(minCharge) + ", so the price rises by " + gbp(r2(top)) + " to " + gbp(r2(net)) + ".");
  if (eq != null) steps.push("Equivalent hourly rate: (" + gbp(r2(net)) + " - " + gbp(r2(travel)) + " travel - " + gbp(r2(products)) + " products) / " + (Math.round(eqHours * 100) / 100) + " hours = " + gbp(r2(eq)) + ".");
  var disc = o.disc || [0, 0, 0], vpm = [52 / 12, 26 / 12, 13 / 12], names = ["Weekly", "Fortnightly", "Every 4 weeks"];
  var monthly = names.map(function (n, i) {
    var d = Math.min(0.99, pos(disc[i]) / 100), visit = r2(Math.max(net * (1 - d), minCharge));
    return { name: n, discount: d, visit: visit, month: r2(visit * vpm[i]), visits: vpm[i] };
  });
  return { hours: hours, cleaning: cleaning, products: products, travel: travel, pre: pre, minCharge: minCharge, top: top, price: net, equivalent: eq, monthly: monthly, steps: steps };
}

var API = { R: R, num: num, r2: r2, gbp: gbp, gbpw: gbpw, pc: pc, fdate: fdate, fday: fday, utc: utc, todayUTC: todayUTC,
  mtdCheck: mtdCheck, deadlines: deadlines, incomeTax: incomeTax, class4: class4, class2Voluntary: class2Voluntary, studentLoan: studentLoan,
  soleTrader: soleTrader, mileage: mileage, mileageRunning: mileageRunning, landlord: landlord, paymentsOnAccount: paymentsOnAccount, foodCost: foodCost, cisDeduction: cisDeduction, cakePrice: cakePrice, cleaningQuote: cleaningQuote, CLEAN_ROOM_NAMES: CLEAN_ROOM_NAMES, CLEAN_ROOM_MIN: CLEAN_ROOM_MIN, sellingFees: sellingFees, cisYearToDate: cisYearToDate, personalAllowance: personalAllowance };
if (typeof module !== "undefined" && module.exports) { module.exports = API; } else { root.HSS = API; }
})(typeof self !== "undefined" ? self : this);
