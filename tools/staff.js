/* True cost of a member of staff, UK tax year 2026/27 (6 April 2026 to 5 April 2027). */
(function (root) {
  var T = {
    niRate: 0.15,            // employer secondary Class 1 rate
    niThreshold: 5000,       // secondary threshold, per year
    holidayPct: 0.1207,      // 12.07% of hours worked
    holidayWeeks: 5.6,       // statutory leave
    pensionRate: 0.03,       // minimum employer contribution
    qeLower: 6240,           // qualifying earnings band
    qeUpper: 50270,
    trigger: 10000,          // auto-enrolment earnings trigger
    allowance: 10500         // Employment Allowance
  };
  function calc(o) {
    var rate = o.rate, hpw = o.hours, weeks = o.weeks;
    if (!(rate > 0) || !(hpw > 0) || !(weeks > 0) || weeks > 52 || hpw > 168) return null;
    var hoursWorked = hpw * weeks;
    var wages = rate * hoursWorked;
    var holiday = o.holidayMode === 'weeks' ? T.holidayWeeks * hpw * rate : wages * T.holidayPct;
    var pay = wages + holiday;
    var ni = Math.max(0, pay - T.niThreshold) * T.niRate;
    var pension = 0;
    if (o.pension && pay > T.trigger) {
      var qe = Math.min(Math.max(pay, T.qeLower), T.qeUpper) - T.qeLower;
      pension = qe * T.pensionRate;
    }
    var allowanceUsed = o.allowance ? Math.min(ni, T.allowance) : 0;
    var niAfter = ni - allowanceUsed;
    var total = pay + niAfter + pension;
    return {
      hoursWorked: hoursWorked, wages: wages, holiday: holiday, pay: pay, ni: ni,
      allowanceUsed: allowanceUsed, niAfter: niAfter, pension: pension, total: total,
      perHour: total / hoursWorked, onCostPct: (total / wages - 1) * 100
    };
  }
  var api = { calc: calc, T: T };
  if (typeof module !== 'undefined') module.exports = api; else root.STAFF = api;
})(this);
