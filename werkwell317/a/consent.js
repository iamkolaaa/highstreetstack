/* Cookie consent store. window.WerkConsent.get() returns { essential: true, analytics: bool, date } or null.
   The choice is kept in localStorage for 12 months, then the visitor is asked again. */
(function () {
  'use strict';
  var KEY = 'werkwell-consent', YEAR = 365 * 24 * 60 * 60 * 1000, fns = [];
  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (!c || !c.date || Date.now() - new Date(c.date).getTime() > YEAR) return null;
      return c;
    } catch (e) { return null; }
  }
  function write(analytics) {
    var c = { essential: true, analytics: !!analytics, date: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    fns.forEach(function (f) { try { f(c); } catch (e) {} });
    loadAnalytics(c);
    return c;
  }
  /* Analytics loader. Disabled in the demo: there is no key and nothing is fetched.
     To switch on for the live site, set POSTHOG_KEY and remove the early return.
  function loadPosthog(key) {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},o="capture identify alias people.set opt_out_capturing opt_in_capturing reset".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(key, { api_host: 'https://eu.i.posthog.com', persistence: 'localStorage+cookie' });
  }
  */
  var POSTHOG_KEY = '';
  function loadAnalytics(c) {
    if (!c || !c.analytics || !POSTHOG_KEY) return; // demo: never loads
    // loadPosthog(POSTHOG_KEY);
  }
  window.WerkConsent = {
    get: read,
    set: write,
    onChange: function (fn) { fns.push(fn); }
  };
  loadAnalytics(read());
})();
