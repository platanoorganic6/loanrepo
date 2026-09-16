/* LoanRepo Stage 1 — keep the free diagnosis PDF diagnosis-only.
   The on-screen journey/ebook/tracking upsell is intentionally excluded from
   the downloadable free diagnosis PDF. */
(function(){
  var need=["FREE PDF","BORROWER'S GUIDE","TRACK THIS LOAN"];
  function norm(s){return String(s||"").replace(/\s+/g," ").trim().toUpperCase()}
  function findJourney(){
    var all=Array.prototype.slice.call(document.querySelectorAll("body *")),best=null,bestLen=Infinity;
    all.forEach(function(el){
      if(!el||el===document.body||el.tagName==="SCRIPT"||el.tagName==="STYLE")return;
      var t=norm(el.textContent);
      if(!need.every(function(x){return t.indexOf(x)>=0}))return;
      if(t.length<bestLen){best=el;bestLen=t.length;}
    });
    return best;
  }
  function mark(){
    var el=findJourney();
    if(!el)return false;
    el.setAttribute("data-loanrepo-free-pdf-journey","true");
    return true;
  }
  function install(){
    if(document.getElementById("loanrepo-stage1-pdf-cleanup-style"))return;
    var s=document.createElement("style");
    s.id="loanrepo-stage1-pdf-cleanup-style";
    s.textContent="@media print{[data-loanrepo-free-pdf-journey=\"true\"]{display:none!important}}";
    document.head.appendChild(s);
    mark();
    var mo=new MutationObserver(function(){if(mark())mo.disconnect()});
    mo.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(function(){mo.disconnect()},10000);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();