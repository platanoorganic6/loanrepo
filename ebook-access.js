/* LoanRepo personalised ebook access gate.
   Paid links contain only a random bearer token. The loan particulars stay in
   Supabase until this function exchanges the token for the stored edition data. */
(function () {
  var q = new URLSearchParams(location.search);
  var token = q.get("access");
  if (!token) return;

  var style = document.createElement("style");
  style.textContent = "body{visibility:hidden!important}#lr-access-error{visibility:visible!important;font-family:system-ui,sans-serif;max-width:620px;margin:80px auto;padding:24px;line-height:1.6;color:#1d2d3d}";
  document.head.appendChild(style);

  function fail(message) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.innerHTML = "<div id='lr-access-error'><h1>Your book link could not be opened.</h1><p>" + message + "</p><p>Please contact <a href='mailto:hello@loanrepo.in'>hello@loanrepo.in</a> and we will help.</p></div>";
    }, { once: true });
  }

  var cfg = window.LOANREPO_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) {
    fail("The secure access service is not configured on this page.");
    return;
  }

  fetch(cfg.url.replace(/\/$/, "") + "/functions/v1/ebook-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.anonKey },
    body: JSON.stringify({ token: token })
  }).then(function (r) {
    return r.json().then(function (data) { return { ok: r.ok, data: data }; });
  }).then(function (r) {
    if (!r.ok || !r.data || !r.data.ok) {
      fail("This secure link may have expired. Ebook links are valid for 14 days.");
      return;
    }
    var params = r.data.loanQuery || {};
    var clean = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && String(params[key]) !== "") clean.set(key, String(params[key]));
    });
    history.replaceState(null, "", location.pathname + (clean.toString() ? "?" + clean.toString() : ""));
    location.reload();
  }).catch(function () {
    fail("We could not reach the secure delivery service. Please try the link again in a moment.");
  });
})();
