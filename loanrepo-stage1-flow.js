/* Legacy Stage-1 compatibility shim.
   The personalised Borrower's Guide now uses the account-first flow:
   Diagnose -> Sign in -> ₹299 payment -> private PDF in My LoanRepo.
   This file intentionally contains no legacy email/payment UI. */
(function () {
  var p = (location.pathname || "").toLowerCase();
  if (!(p === "/" || /\/index\.html$/.test(p))) return;

  var loading = false;

  function isGuideButton(b) {
    var t = (b && b.textContent || "").trim();
    return /PERSONALISED BORROWER'S GUIDE/i.test(t) && /299/.test(t);
  }

  function loadAccountFlow(done) {
    if (window.__loanRepoAccountFlow) { done(true); return; }
    if (loading) { setTimeout(function () { loadAccountFlow(done); }, 100); return; }
    loading = true;
    var s = document.createElement("script");
    s.src = "./loanrepo-ebook-account-v2.js?v=20260916-6";
    s.async = false;
    s.onload = function () { loading = false; done(!!window.__loanRepoAccountFlow); };
    s.onerror = function () { loading = false; done(false); };
    document.head.appendChild(s);
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!isGuideButton(b)) return;

    /* If the account flow is already registered, let its capture handler own
       the event. */
    if (window.__loanRepoAccountFlow) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    loadAccountFlow(function (ok) {
      if (!ok) {
        alert("LoanRepo sign-in is still loading. Please try again.");
        return;
      }
      /* Re-dispatch only after the account flow has registered its handler. */
      window.__loanRepoAccountReplay = true;
      b.click();
      setTimeout(function () { window.__loanRepoAccountReplay = false; }, 0);
    });
  }, true);
})();
