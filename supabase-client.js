/* LoanRepo — Supabase data layer. */
(function () {
  var CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  var cfg=window.LOANREPO_SUPABASE||{},lib=window.supabase;
  var enabled=!!(cfg.url&&cfg.anonKey&&lib&&lib.createClient),client=enabled?lib.createClient(cfg.url,cfg.anonKey):null;
  function connectLater(){
    if(enabled)return;
    var tries=0;
    function attach(){
      cfg=window.LOANREPO_SUPABASE||cfg;lib=window.supabase;
      if(cfg.url&&cfg.anonKey&&lib&&lib.createClient){client=lib.createClient(cfg.url,cfg.anonKey);enabled=true;if(window.LoanRepoDB){window.LoanRepoDB.enabled=true;window.LoanRepoDB.client=client}return true}
      return false;
    }
    function tick(){if(attach()||tries++>60)return;setTimeout(tick,100)}
    if(!window.supabase&&!document.getElementById("loanrepo-supabase-lib")){var s=document.createElement("script");s.id="loanrepo-supabase-lib";s.src=CDN;document.head.appendChild(s)}
    tick();
  }
  function sessionId(){try{var k="loanrepo.sid",v=localStorage.getItem(k);if(!v){v=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());localStorage.setItem(k,v)}return v}catch(e){return null}}
  function safeAnalyticsProps(props){props=props||{};var allowed=["source","stage","variant","benchmark","diagnosis_type","outcome","entry_point"],out={};allowed.forEach(function(k){if(props[k]!==undefined&&props[k]!==null)out[k]=String(props[k]).slice(0,80)});return out}
  var DB={
    enabled:enabled,client:client,
    onAuth:function(cb){if(!enabled){cb(null);return function(){}}client.auth.getSession().then(function(r){cb((r.data&&r.data.session&&r.data.session.user)||null)});var sub=client.auth.onAuthStateChange(function(_e,session){cb((session&&session.user)||null)});return function(){sub.data.subscription.unsubscribe()}},
    signInEmail:function(email){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.auth.signInWithOtp({email:email,options:{emailRedirectTo:window.location.href}}).then(function(r){return{ok:!r.error,error:r.error&&r.error.message}})},
    signInGoogle:function(){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.href}}).then(function(r){return{ok:!r.error,error:r.error&&r.error.message}})},
    signOut:function(){if(!enabled)return Promise.resolve({ok:false});return client.auth.signOut().then(function(){return{ok:true}})},
    fetchRepoHistory:function(){if(!enabled)return Promise.resolve(null);return client.from("repo_rates").select("effective_date, rate").order("effective_date").then(function(r){if(r.error||!r.data||!r.data.length)return null;return r.data.map(function(row){return{d:row.effective_date,r:Number(row.rate)}})}).catch(function(){return null})},
    fetchExamples:function(){if(!enabled)return Promise.resolve(null);return client.from("examples").select("start_month, city, amount, tenure_years, note").eq("published",true).order("sort_order").then(function(r){if(r.error||!r.data||!r.data.length)return null;return r.data.map(function(row){return{date:row.start_month,city:row.city,amt:Number(row.amount),ten:row.tenure_years,note:row.note}})}).catch(function(){return null})},
    saveRun:function(run){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.auth.getUser().then(function(u){var user=u.data&&u.data.user;if(!user)return{ok:false,reason:"signed-out"};return client.from("tracked_loans").insert({user_id:user.id,name:run.name||run.label||null,label:run.label||null,start_month:run.start_month,amount:run.amount,tenure_years:run.tenure_years,benchmark:run.benchmark,result:run.result||{}}).then(function(r){var msg=r.error&&r.error.message;if(msg&&msg.indexOf("free_tier_loan_limit")>-1)return{ok:false,reason:"loan-limit"};return{ok:!r.error,error:msg}})})},
    listRuns:function(){if(!enabled)return Promise.resolve([]);return client.from("tracked_loans").select("id, name, label, start_month, amount, tenure_years, benchmark, result, created_at").eq("archived",false).order("created_at",{ascending:false}).limit(50).then(function(r){return r.error?[]:r.data}).catch(function(){return[]})},
    deleteRun:function(id){if(!enabled)return Promise.resolve({ok:false});return client.from("tracked_loans").delete().eq("id",id).then(function(r){return{ok:!r.error}})},
    renameLoan:function(id,name){if(!enabled)return Promise.resolve({ok:false});return client.from("tracked_loans").update({name:name}).eq("id",id).then(function(r){return{ok:!r.error,error:r.error&&r.error.message}})},
    /* Kept as compatibility no-ops until Stage 2 is intentionally activated. */
    logCheckIn:function(){return Promise.resolve({ok:false,reason:"stage2-disabled"})},
    listCheckIns:function(){return Promise.resolve([])},
    deleteCheckIn:function(){return Promise.resolve({ok:false,reason:"stage2-disabled"})},
    fetchSubscription:function(){return Promise.resolve(null)},
    startCheckout:function(){return Promise.resolve({ok:false,reason:"stage2-disabled"})},
    startEbookOrder:function(email,loanQuery){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.functions.invoke("ebook-order",{body:{email:email,loanQuery:loanQuery||null}}).then(function(r){if(r.error||!r.data||!r.data.order_id)return{ok:false,error:(r.error&&r.error.message)||"no-response"};return{ok:true,orderId:r.data.order_id,amount:r.data.amount,keyId:r.data.key_id}}).catch(function(e){return{ok:false,error:String(e)}})},
    joinWaitlist:function(email,source){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.from("waitlist").insert({email:email,source:source||"app"}).then(function(r){if(r.error&&r.error.code==="23505")return{ok:true,duplicate:true};return{ok:!r.error,error:r.error&&r.error.message}})},
    track:function(event,props){if(!enabled)return;client.from("usage_events").insert({event:event,props:safeAnalyticsProps(props),session_id:sessionId()}).then(function(){},function(){})},
    logAnonymousDiagnosis:function(props){if(!enabled)return Promise.resolve({ok:false,reason:"not-configured"});return client.from("usage_events").insert({event:"diagnosis_completed",props:safeAnalyticsProps(props),session_id:sessionId()}).then(function(r){return{ok:!r.error,error:r.error&&r.error.message}}).catch(function(e){return{ok:false,error:String(e)}})}
  };
  window.LoanRepoDB=DB;connectLater();
})();

/* Stage 1: keep the free diagnosis actions ahead of the paid tracking action. */
(function(){
  function reorderOnce(){
    var buttons=Array.prototype.slice.call(document.querySelectorAll("button"));
    var pdf=buttons.find(function(b){return(b.textContent||"").trim()==="Save this result as PDF"}),method=buttons.find(function(b){return(b.textContent||"").trim()==="Read the method and assumptions"}),track=buttons.find(function(b){return/^Track this loan/.test((b.textContent||"").trim())});
    if(!pdf||!method||!track)return false;
    var parent=pdf.parentElement;if(!parent||method.parentElement!==parent||track.parentElement!==parent)return false;
    parent.appendChild(pdf);parent.appendChild(method);parent.appendChild(track);return true;
  }
  function start(){if(reorderOnce())return;if(!window.MutationObserver)return;var observer=new MutationObserver(function(){if(reorderOnce())observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});setTimeout(function(){observer.disconnect()},10000)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
