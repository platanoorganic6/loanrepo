/* LoanRepo — Supabase credentials.
   Anon keys are public by design (RLS is what protects the data), so this file
   is safe to commit. Never put the service_role key here.

   Fill these in from Supabase → Project Settings → API. Until you do, the app
   runs exactly as before: the engine falls back to its bundled rate history,
   auth and saved runs stay hidden. */
window.LOANREPO_SUPABASE = {
  url: "https://ipshimfcquhjkbbypghj.supabase.co",
  anonKey: "sb_publishable_Ytd_Lbk5_5PZ6IjWWzZOBg_qdhBtUJG"
};

(function () {
  var href = "./loanrepo-readable.css?v=20260916";
  if (!document.querySelector('link[data-loanrepo-readable]')) {
    var link = document.createElement("link"); link.rel="stylesheet"; link.href=href; link.setAttribute("data-loanrepo-readable","true"); document.head.appendChild(link);
  }
})();

/* New account-first Stage-1A test flow. It runs before the legacy email flow,
   so the paid guide is now tied to the signed-in borrower account. */
(function () {
  function loadAccountFlow() {
    if (document.querySelector('script[data-loanrepo-ebook-account]')) return;
    var s=document.createElement("script"); s.src="./loanrepo-ebook-account.js?v=20260916-1"; s.setAttribute("data-loanrepo-ebook-account","true"); document.head.appendChild(s);
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",loadAccountFlow,{once:true}); else loadAccountFlow();
})();

(function () {
  function loadBridge() {
    if (document.querySelector('script[data-loanrepo-track-bridge]')) return;
    var s=document.createElement("script"); s.src="./loanrepo-track-bridge.js?v=20260916"; s.setAttribute("data-loanrepo-track-bridge","true"); document.head.appendChild(s);
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",loadBridge,{once:true}); else loadBridge();
})();

(function () {
  function loadStage1() {
    if (document.querySelector('script[data-loanrepo-stage1-flow]')) return;
    var s=document.createElement("script"); s.src="./loanrepo-stage1-flow.js?v=20260916-3"; s.setAttribute("data-loanrepo-stage1-flow","true"); document.head.appendChild(s);
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",loadStage1,{once:true}); else loadStage1();
})();

(function () {
  function loadNameLayer() {
    if (document.querySelector('script[data-loanrepo-ebook-name]')) return;
    var s=document.createElement("script"); s.src="./loanrepo-ebook-name.js?v=20260916-1"; s.setAttribute("data-loanrepo-ebook-name","true"); document.head.appendChild(s);
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",loadNameLayer,{once:true}); else loadNameLayer();
})();
