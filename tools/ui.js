/* Page helpers shared by the calculators. */
(function () {
var H = window.HSS;
function $(id) { return document.getElementById(id); }
window.UI = {
  $: $,
  num: function (id) { var e = $(id); return e ? H.num(e.value) : 0; },
  raw: function (id) { var e = $(id); return e ? e.value : ""; },
  checked: function (id) { var e = $(id); return !!(e && e.checked); },
  radio: function (name) { var e = document.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ""; },
  filled: function (ids) { return ids.some(function (id) { var v = UI.raw(id); return v !== "" && H.num(v) !== 0; }); },
  watch: function (fn) {
    var f = document.getElementById("calc");
    f.addEventListener("input", fn); f.addEventListener("change", fn);
    f.addEventListener("submit", function (e) { e.preventDefault(); fn(); });
    fn();
  },
  lines: function (rows) {
    return '<dl class="lines">' + rows.map(function (r) {
      return '<div' + (r[2] ? ' class="' + r[2] + '"' : '') + '><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join("") + '</dl>';
  },
  steps: function (arr) {
    return '<div class="maths"><h3>The working</h3><ol>' + arr.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol></div>";
  },
  put: function (id, html) { $(id).innerHTML = html; }
};
})();
