/* LoanRepo Stage-1A — ebook nudge + return-to-purchase flow. */
(function(){
  window.__loanRepoAccountFlow=true;
  var PENDING="loanrepo.ebook_account_pending",RETURN_PURCHASE="loanrepo.ebook_return_purchase",db=null,user=null,currentNudge="first";
  var path=(location.pathname||"").toLowerCase();
  if(!(path==="/"||/\/index\.html$/.test(path)))return;
  var COPY={
    first:"GET YOUR PERSONALISED BORROWER'S GUIDE — ₹299",
    second:"TURN YOUR DIAGNOSIS INTO A BORROWER'S GUIDE — ₹299"
  };
  function set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
  function get(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
  function del(k){try{sessionStorage.removeItem(k)}catch(e){}}
  function wait(cb,n){if(window.LoanRepoDB){db=window.LoanRepoDB;cb(db);return}if((n||0)>100){cb(null);return}setTimeout(function(){wait(cb,(n||0)+1)},100)}
  function text(){var m=document.querySelector("main");return m?(m.innerText||m.textContent||"").replace(/\s+/g," "):""}
  function match(t,r){var m=t.match(r);return m?m[1]:""}
  function money(x){if(!x)return null;var s=String(x).replace(/₹/g,"").replace(/,/g,"").trim(),m=s.match(/^([0-9.]+)\s*(Cr|L|K)?$/i);if(!m)return null;var n=Number(m[1]),u=(m[2]||"").toLowerCase();if(u==="cr")n*=1e7;else if(u==="l")n*=1e5;else if(u==="k")n*=1e3;return isFinite(n)?Math.round(n):null}
  function resetDates(start,bm){var a=String(start||"").split("-").map(Number);if(a.length!==2||!a[0]||!a[1])return[];var step=bm==="MCLR"?12:3,now=new Date(),base=new Date(a[0],a[1]-1,1),n=(now.getFullYear()-base.getFullYear())*12+now.getMonth()-base.getMonth(),k=Math.floor(n/step)+1,out=[];for(var i=0;i<4;i++){var d=new Date(a[0],a[1]-1+(k+i)*step,1);out.push(d.toLocaleDateString("en-IN",{month:"short",year:"numeric"}))}return out}
  function snapshot(){var d=document.getElementById("lr-date"),t=document.getElementById("lr-ten"),a=document.getElementById("lr-amt");if(!d||!t||!a)return null;var bm=document.querySelector('input[name="bm"]:checked'),sp=document.getElementById("lr-spread"),tx=text();return{date:d.value,tenure:Number(t.value),amount:Number(a.value),benchmark:bm?bm.value:"EBLR",spread:sp?sp.value:"",actualYears:Number(match(tx,/Actual,?\s*after every rate reset\s+([0-9]+(?:\.[0-9]+)?)\s+years/i))||Number(t.value),startRate:Number(match(tx,/from\s+([0-9]+(?:\.[0-9]+)?)%\s+at disbursal/i))||null,nowRate:Number(match(tx,/to\s+([0-9]+(?:\.[0-9]+)?)%\s+today/i))||Number(match(tx,/Effective rate today\s+([0-9]+(?:\.[0-9]+)?)%/i))||null,emi:money(match(tx,/EMI, then and now\s+₹?\s*([0-9.,]+(?:\s*(?:L|Cr|K))?)/i)),balance:money(match(tx,/Outstanding now\s+₹?\s*([0-9.,]+(?:\s*(?:L|Cr|K))?)/i)),verdict:match(tx,/(Added to your loan, unannounced.{0,600})/i),resets:resetDates(d.value,bm?bm.value:"EBLR")}}
  function loanQuery(d){var name=(user&&user.user_metadata&&user.user_metadata.full_name)||((user&&user.email||"").split("@")[0])||"Borrower";return{name:name,amount:String(d.amount),start:new Date(Number(d.date.slice(0,4)),Number(d.date.slice(5,7))-1,1).toLocaleDateString("en-IN",{month:"short",year:"numeric"}),tenure:String(d.tenure),actual:Number(d.actualYears||d.tenure).toFixed(1),rate0:d.startRate==null?"":Number(d.startRate).toFixed(2),rate1:d.nowRate==null?"":Number(d.nowRate).toFixed(2),emi:d.emi==null?"":String(d.emi),bal:d.balance==null?"":String(d.balance),bm:d.benchmark,resets:(d.resets||[]).join(","),verdict:d.verdict||"",personal:"true",edition:"Personalised Borrower's Guide"}}
  function wireNudges(){var b=Array.prototype.slice.call(document.querySelectorAll("button")).filter(function(x){return /BORROWER'S GUIDE|THE QUIET YEARS/i.test(x.textContent||"")&&/299/.test(x.textContent||"")});b.slice(0,2).forEach(function(x,i){x.setAttribute("data-loanrepo-ebook-nudge",i?"second":"first");x.textContent=COPY[i?"second":"first"];x.setAttribute("aria-label",x.textContent)})}
  function beginGuide(){var d=snapshot();if(!d){alert("Please complete the diagnosis first.");return}set(PENDING,JSON.stringify({loanQuery:loanQuery(d),createdAt:new Date().toISOString()}));location.href="./quiet-years.html"}
  function goAfterAuth(){if(!user)return;var target=null;if(get(PENDING)){del(PENDING);target="./quiet-years.html"}else if(get(RETURN_PURCHASE)){del(RETURN_PURCHASE);target="./quiet-years.html"}if(target)location.href=target}
  function clickNativeSignIn(){var tries=0;function find(){var b=Array.prototype.slice.call(document.querySelectorAll("button")).find(function(x){return /^sign in$/i.test((x.textContent||"").trim())});if(b){b.click();return}if(tries++<30)setTimeout(find,200)}find()}
  function init(){
    wireNudges();
    document.addEventListener("click",function(e){var el=e.target&&e.target.closest?e.target.closest("button"):null;if(!el)return;var t=(el.textContent||"").trim();if(/BORROWER'S GUIDE|THE QUIET YEARS/i.test(t)&&/299/.test(t)){currentNudge=el.getAttribute("data-loanrepo-ebook-nudge")||"first";e.preventDefault();e.stopImmediatePropagation();beginGuide()}},true);
    var mo=new MutationObserver(wireNudges);mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},60000);
    wait(function(d){db=d;if(!d)return;d.onAuth(function(u){user=u||null;goAfterAuth()});d.client.auth.getUser().then(function(r){user=r.data&&r.data.user||null;if(!user&&get(RETURN_PURCHASE))setTimeout(clickNativeSignIn,400);goAfterAuth()})});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();