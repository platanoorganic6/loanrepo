/* LoanRepo — landing-page ebook links.
   Both ebook CTAs now lead to the Quiet Years product page (Ebook.html).
   Keep the current diagnosis in sessionStorage so the product page can use
   the same figures for the later sign-in -> payment -> PDF flow. */
(function(){
  var p=(location.pathname||"").toLowerCase();
  if(!(p==="/"||/\/index\.html$/.test(p)))return;
  var KEY="loanrepo.quiet_years_context";

  function saveContext(){
    try{
      var d=document.getElementById("lr-date"),
          t=document.getElementById("lr-ten"),
          a=document.getElementById("lr-amt"),
          bm=document.querySelector('input[name="bm"]:checked'),
          sp=document.getElementById("lr-spread"),
          main=document.querySelector("main");
      var context={
        date:d&&d.value||"",
        tenure:t&&t.value||"",
        amount:a&&a.value||"",
        benchmark:bm&&bm.value||"EBLR",
        spread:sp&&sp.value||"",
        resultText:main?(main.innerText||main.textContent||""):"",
        savedAt:new Date().toISOString()
      };
      sessionStorage.setItem(KEY,JSON.stringify(context));
    }catch(e){}
  }

  function isQuietYearsTarget(el){
    if(!el)return false;
    var text=(el.textContent||"").replace(/\s+/g," ").trim();
    if(!/299/.test(text))return false;
    return /PERSONALISED BORROWER'S GUIDE|THE QUIET YEARS/i.test(text);
  }

  document.addEventListener("click",function(e){
    var el=e.target&&e.target.closest?e.target.closest("a,button"):null;
    if(!isQuietYearsTarget(el))return;
    saveContext();
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href="./Ebook.html";
  },true);
})();
