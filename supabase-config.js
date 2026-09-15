/* LoanRepo — Supabase credentials.
   Anon keys are public by design (RLS is what protects the data), so this file
   is safe to commit. Never put the service_role key here.

   Fill these in from Supabase → Project Settings → API. Until you do, the app
   runs exactly as before: the engine falls back to its bundled rate history,
   auth and saved runs stay hidden. */
window.LOANREPO_SUPABASE = {
  url: "https://ipshimfcquhjkbbypghj.supabase.co",
  anonKey: "sb_publishable_Ytd_Lbk5_5PZ6IjWZxZOBg_qdhBtUJG"
};

/* Load the readability layer without touching the generated app bundle.
   It is scoped to the calculator page by its #lr-date marker, so app.html is unaffected. */
(function () {
  var href = "./loanrepo-readable.css?v=20260916";
  if (!document.querySelector('link[data-loanrepo-readable]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-loanrepo-readable", "true");
    document.head.appendChild(link);
  }
})();

/* Load the Stage-2 tracking bridge after supabase-client.js has created
   window.LoanRepoDB. This keeps index.html generated/static and app.html
   untouched while making Track this loan deterministic. */
(function () {
  function loadBridge() {
    if (document.querySelector('script[data-loanrepo-track-bridge]')) return;
    var s = document.createElement("script");
    s.src = "./loanrepo-track-bridge.js?v=20260916";
    s.setAttribute("data-loanrepo-track-bridge", "true");
    document.head.appendChild(s);
  }
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", loadBridge, { once: true });
  } else {
    loadBridge();
  }
})();
