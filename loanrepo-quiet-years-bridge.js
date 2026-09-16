/* LoanRepo — Quiet Years account gate.
   1) Landing-page ebook CTAs require sign-in before opening the book page.
   2) The Quiet Years sales page itself is also gated, so an old/cached sales
      page cannot fall back to the legacy "enter your email" purchase flow.
   3) Once signed in, the purchase email is populated from the authenticated
      account and the user is not asked to enter it again. */
(function(){
  var KEY="loanrepo.quiet_years_context",busy=false,db=null;
  var p=(location.pathname||"").toLowerCase();
  var isLanding=(p==="/"||/\/index\.html$/.test(p));

  function saveContext(){
    try{
      var d=document.getElementById("lr-date"),t=document.getElementById("lr-ten"),a=document.getElementById("lr-amt"),
          bm=document.querySelector('input[name="bm"]:checked'),sp=document.getElementById("lr-spread"),main=document.querySelector("main");
      sessionStorage.setItem(KEY,JSON.stringify({
        date:d&&d.value||"",tenure:t&&t.value||"",amount:a&&a.value||"",benchmark:bm&&bm.value||"EBLR",spread:sp&&sp.value||"",
        resultText:main?(main.innerText||main.textContent||""):"",savedAt:new Date().toISOString()
      }));
    }catch(e){}
  }

  function waitDb(cb,n){
    if(window.LoanRepoDB){db=window.LoanRepoDB;cb(db);return;}
    if((n||0)>120){cb(null);return;}
    setTimeout(function(){waitDb(cb,(n||0)+1)},100);
  }

  function textOf(){return (document.body&&document.body.innerText||"").replace(/\s+/g," ").trim()}

  function isQuietYearsTarget(el){
    if(!el)return false;
    var text=(el.textContent||"").replace(/\s+/g," ").trim();
    return /299/.test(text)&&/PERSONALISED BORROWER'S GUIDE|THE QUIET YEARS/i.test(text);
  }

  function isSalesPage(){
    var txt=textOf();
    return /The Quiet Years/i.test(txt) && /BUY THE BOOK\s*[—-]\s*₹?\s*299/i.test(txt) && /Where should we send it\?/i.test(txt);
  }

  function setPurchaseEmail(user){
    if(!user||!user.email)return;
    var inputs=Array.prototype.slice.call(document.querySelectorAll('input[type="email"]'));
    inputs.forEach(function(input){
      input.value=user.email;
      input.setAttribute("value",user.email);
      input.disabled=true;
      input.readOnly=true;
      input.style.opacity=".75";
      input.style.cursor="not-allowed";
      var label=input.parentElement&&input.parentElement.querySelector("label");
      if(label)label.textContent="Signed in as";
    });
    var txt=document.body&&document.body.innerText||"";
    if(/No account needed\. The download link/i.test(txt)){
      Array.prototype.slice.call(document.querySelectorAll("body *")).forEach(function(el){
        if(el.children.length===0 && /No account needed\. The download link/i.test(el.textContent||"")){
          el.textContent="Your purchase is linked to your LoanRepo account. The personalised guide will be saved in My LoanRepo after payment.";
        }
      });
    }
  }

  function gateModal(onDone){
    var old=document.getElementById("lr-qy-signin");
    if(old){old.style.display="flex";return;}
    var o=document.createElement("div");o.id="lr-qy-signin";
    o.style.cssText="position:fixed;inset:0;z-index:10000;background:rgba(20,35,50,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box";
    var b=document.createElement("div");
    b.style.cssText="background:var(--color-bg,#fff);color:var(--color-text,#1d2d3d);width:min(500px,100%);padding:28px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.28)";
    b.innerHTML="<div style='font-family:var(--font-heading);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:10px'>The Quiet Years · ₹299</div><h2 style='font-family:var(--font-heading);font-size:30px;line-height:1.05;margin:0 0 12px'>Sign in to continue</h2><p style='font-size:14px;line-height:1.55;margin:0 0 18px;color:var(--color-neutral-700)'>Your purchase and personalised Borrower's Guide will belong to your LoanRepo account. Sign in first. You will not need to enter your email again on the purchase page.</p><label style='display:block;font-size:12px;margin-bottom:6px'>Email address</label><input id='lr-qy-email' type='email' autocomplete='email' style='width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--color-divider);font:inherit' placeholder='you@example.com'><div id='lr-qy-code-wrap' style='display:none;margin-top:14px'><label style='display:block;font-size:12px;margin-bottom:6px'>6-digit OTP</label><input id='lr-qy-code' inputmode='numeric' maxlength='6' autocomplete='one-time-code' style='width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--color-divider);font:inherit' placeholder='123456'></div><div id='lr-qy-msg' style='min-height:24px;font-size:12px;color:var(--color-accent-800);margin-top:10px'></div><div style='display:flex;gap:10px;justify-content:flex-end;margin-top:14px'><button id='lr-qy-cancel' type='button' class='btn btn-ghost'>Cancel</button><button id='lr-qy-main' type='button' class='btn btn-primary'>Send sign-in code</button></div>";
    o.appendChild(b);document.body.appendChild(o);
    document.getElementById("lr-qy-cancel").onclick=function(){o.style.display="none"};
    var btn=document.getElementById("lr-qy-main"),msg=document.getElementById("lr-qy-msg");
    btn.onclick=function(){
      var email=document.getElementById("lr-qy-email").value.trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.textContent="Enter a valid email address.";return}
      btn.disabled=true;msg.textContent="Sending your sign-in code…";
      db.client.auth.signInWithOtp({email:email,options:{shouldCreateUser:true}}).then(function(r){
        btn.disabled=false;
        if(r.error){msg.textContent=r.error.message;return}
        document.getElementById("lr-qy-code-wrap").style.display="block";
        btn.textContent="Verify code";
        btn.onclick=function(){
          var code=document.getElementById("lr-qy-code").value.trim();
          if(!/^\d{6}$/.test(code)){msg.textContent="Enter the 6-digit code.";return}
          btn.disabled=true;msg.textContent="Signing you in…";
          db.client.auth.verifyOtp({email:email,token:code,type:"email"}).then(function(v){
            btn.disabled=false;
            if(v.error){msg.textContent=v.error.message;return}
            if(!v.data||!v.data.user){msg.textContent="Sign-in could not be completed. Please try again.";return}
            o.style.display="none";
            onDone(v.data.user);
          });
        };
      });
    };
  }

  function checkSalesPage(){
    if(!isSalesPage())return;
    waitDb(function(d){
      if(!d)return;
      db=d;
      db.client.auth.getUser().then(function(r){
        var user=r.data&&r.data.user;
        if(user){setPurchaseEmail(user);return;}
        gateModal(function(u){setPurchaseEmail(u)});
      });
    });
  }

  function startSalesObserver(){
    var tries=0;
    function tick(){
      tries++;
      checkSalesPage();
      if(tries<80 && !document.getElementById("lr-qy-signin"))setTimeout(tick,250);
    }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);else tick();
    try{new MutationObserver(function(){if(isSalesPage()&&!document.getElementById("lr-qy-signin"))checkSalesPage()}).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}
  }

  if(isLanding){
    document.addEventListener("click",function(e){
      var el=e.target&&e.target.closest?e.target.closest("a,button"):null;
      if(!isQuietYearsTarget(el)||busy)return;
      busy=true;e.preventDefault();e.stopImmediatePropagation();
      waitDb(function(d){
        if(!d){busy=false;alert("LoanRepo is still loading. Please try again in a moment.");return}
        db=d;
        db.client.auth.getUser().then(function(r){
          var user=r.data&&r.data.user;
          if(user){saveContext();location.href="./Ebook.html";return}
          gateModal(function(){saveContext();location.href="./Ebook.html"});
        }).catch(function(){busy=false;alert("We could not check your sign-in. Please try again.")});
      });
    },true);
  }

  startSalesObserver();
})();
