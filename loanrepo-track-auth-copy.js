/* LoanRepo — Stage-2 auth presentation. Keep Track this loan on the same
   magic-link account flow; authentication does not itself create a loan. */
(function(){
  function pending(){try{return sessionStorage.getItem("loanrepo.pending_track")==="1"}catch(e){return false}}
  function patch(){
    if(!pending())return;
    var t=document.querySelector(".dialog-title"),b=document.querySelector(".dialog-body");
    if(t)t.textContent="Sign in to track this loan";
    if(b)b.textContent="Sign in with your email. Your diagnosis remains free; the loan is saved to your account only when you choose Track this loan and continue to Loan Watch — ₹149/month.";
    Array.prototype.slice.call(document.querySelectorAll("button")).forEach(function(x){if(/continue with google/i.test(x.textContent||""))x.style.display="none"});
  }
  var mo=new MutationObserver(patch);mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},60000);patch();
})();