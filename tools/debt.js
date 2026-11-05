/* Debt payoff: avalanche (highest APR first) vs snowball (smallest balance first). */
(function (root) {
  var MAX = 1200; // 100 years
  function validate(debts, budget) {
    var errs = [];
    if (!debts.length) errs.push('Add at least one debt with a balance.');
    var mins = 0;
    debts.forEach(function (d) { mins += d.min; });
    if (!(budget > 0)) errs.push('Enter a monthly budget.');
    else if (debts.length && budget < mins - 0.005)
      errs.push('Your budget of £' + budget.toFixed(2) + ' is below the minimum payments, which add up to £' + mins.toFixed(2) + '. Raise the budget by at least £' + (mins - budget).toFixed(2) + ' or the minimums will not be covered.');
    return errs;
  }
  function simulate(debtsIn, budget, method) {
    var d = debtsIn.map(function (x, i) { return { i: i, name: x.name, bal: x.balance, apr: x.apr, min: x.min }; });
    var totalInterest = 0, month = 0, order = [], series = [d.reduce(function (s, x) { return s + x.bal; }, 0)];
    while (d.some(function (x) { return x.bal > 0.005; }) && month < MAX) {
      month++;
      d.forEach(function (x) {
        if (x.bal > 0.005) { var int = x.bal * x.apr / 100 / 12; x.bal += int; totalInterest += int; }
      });
      var pool = budget;
      d.forEach(function (x) {
        if (x.bal > 0.005) { var p = Math.min(x.min, x.bal); x.bal -= p; pool -= p; }
      });
      var live = d.filter(function (x) { return x.bal > 0.005; });
      live.sort(method === 'avalanche'
        ? function (a, b) { return b.apr - a.apr || a.bal - b.bal; }
        : function (a, b) { return a.bal - b.bal || b.apr - a.apr; });
      for (var k = 0; k < live.length && pool > 0.005; k++) {
        var p2 = Math.min(pool, live[k].bal); live[k].bal -= p2; pool -= p2;
      }
      d.forEach(function (x) {
        if (x.bal <= 0.005 && !x.done) { x.bal = 0; x.done = month; order.push({ name: x.name, month: month }); }
      });
      series.push(d.reduce(function (s, x) { return s + x.bal; }, 0));
    }
    var finished = !d.some(function (x) { return x.bal > 0.005; });
    return { method: method, months: month, finished: finished, totalInterest: totalInterest, order: order, series: series };
  }
  var api = { validate: validate, simulate: simulate, MAX: MAX };
  if (typeof module !== 'undefined') module.exports = api; else root.DEBT = api;
})(this);
