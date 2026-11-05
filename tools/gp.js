/* Menu price and gross profit maths. Prices are per portion. */
(function (root) {
  var VAT = 0.20;
  function gpPrice(cost, gpPct, vatOn) {
    if (!(cost >= 0) || !(gpPct > 0) || gpPct >= 100) return null;
    var net = cost / (1 - gpPct / 100);
    var gross = vatOn ? net * (1 + VAT) : net;
    var vat = gross - net;
    var gp = net - cost;
    return { cost: cost, net: net, gross: gross, vat: vat, gp: gp, gpPct: gp / net * 100, cashMarginPct: gp / gross * 100 };
  }
  // Same sums starting from a price you already charge (price on the menu, inc VAT if vatOn).
  function checkPrice(cost, menuPrice, vatOn) {
    if (!(menuPrice > 0) || !(cost >= 0)) return null;
    var net = vatOn ? menuPrice / (1 + VAT) : menuPrice;
    var gp = net - cost;
    return { net: net, vat: menuPrice - net, gp: gp, gpPct: gp / net * 100, cashMarginPct: gp / menuPrice * 100 };
  }
  var api = { gpPrice: gpPrice, checkPrice: checkPrice, VAT: VAT };
  if (typeof module !== 'undefined') module.exports = api; else root.GP = api;
})(this);
