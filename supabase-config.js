/* LoanRepo — Supabase credentials. */
window.LOANREPO_SUPABASE={url:"https://ipshimfcquhjkbbypghj.supabase.co",anonKey:"sb_publishable_Ytd_Lbk5_5PZ6IjWZxZOBg_qdhBtUJG"};

/*
   Keep the first paint independent of optional LoanRepo Stage 1 helpers.
   The custom <x-dc> runtime must be allowed to boot before these helpers are
   parsed/executed. This is deliberately ES5-style so the loader itself is
   safe on older mobile Safari/iPad browsers.
*/
(function(){
  var files=[
    "./loanrepo-auth-fallback.js?v=20260916-4",
    "./loanrepo-readable.css?v=20260916-1",
    "./loanrepo-ebook-account-v3.js?v=20260916-9",
    "./loanrepo-stage1-privacy-bridge.js?v=20260916-2",
    "./loanrepo-stage1-flow.js?v=20260916-6",
    "./loanrepo-ebook-name.js?v=20260916-2",
    "./loanrepo-documents.js?v=20260916-3",
    "./loanrepo-conversion-order.js?v=20260916-5",
    "./loanrepo-stage1-pdf-cleanup.js?v=20260916-2"
  ];
  function loadOne(i){
    if(i>=files.length)return;
    var src=files[i];
    if(src.indexOf(".css")>-1){
      if(!document.querySelector('link[data-loanrepo-readable]')){
        var l=document.createElement("link");
        l.rel="stylesheet";l.href=src;l.setAttribute("data-loanrepo-readable","true");
        document.head.appendChild(l);
      }
      loadOne(i+1);return;
    }
    var s=document.createElement("script");
    s.src=src;s.async=false;
    s.onload=function(){loadOne(i+1)};
    s.onerror=function(){loadOne(i+1)};
    document.head.appendChild(s);
  }
  function start(){setTimeout(function(){loadOne(0)},0)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
  else start();
})();
