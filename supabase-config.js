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
