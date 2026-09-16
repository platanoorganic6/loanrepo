/* LoanRepo auth presentation.
   Header Sign in is generic account authentication.
   Track this loan gets the Stage-2-specific copy only after the user explicitly clicks Track. */
(function(){
  function pending(){try{return sessionStorage.getItem("loanrepo.pending_track")==="1"}catch(e){return false}}
  function clearPending(){try{
    sessionStorage.removeItem("loanrepo.pending_track");
    sessionStorage.removeItem("loanrepo.pending_diagnosis");
    sessionStorage.removeItem("loanrepo.pending_checkout");
    sessionStorage.removeItem("loanrepo.track_handled");
  }catch(e){}}
  function isHeaderSignIn(el){
    if(!el)return false;
    var t=(el.textContent||"").trim();
    return /^sign in$/i.test(t);
  }
  function patch(){
    var t=document.querySelector(".dialog-title"),b=document.querySelector(".dialog-body");
    if(!t&&!b)return;
    if(pending()){
      if(t)t.textContent="Sign in to track this loan";
      if(b)b.textContent="Sign in with your email. Your diagnosis remains free; the loan is saved to your account only when you choose Track this loan and continue to Loan Watch — ₹149/month.";
    }else{
      if(t)t.textContent="Sign in";
      if(b)b.textContent="Sign in with your email to access your private LoanRepo workspace. Signing in does not track or save your loan details.";
    }
    Array.prototype.slice.call(document.querySelectorAll("button")).forEach(function(x){
      if(/continue with google/i.test(x.textContent||""))x.style.display="none";
    });
  }
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest("button"):null;
    if(!isHeaderSignIn(b))return;
    /* A direct header login is never a Track action. Clear stale Stage-2 intent
       before the existing authentication handler opens its dialog. */
    clearPending();
    setTimeout(patch,0);
    setTimeout(patch,50);
    setTimeout(patch,200);
  },true);
  var mo=new MutationObserver(patch);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect()},60000);
  patch();
})();
