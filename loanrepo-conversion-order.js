/* LoanRepo — diagnosis conversion ladder.
   Keeps the existing mid-page book nudge, then presents the result-page journey
   in the user's intended order: Diagnosis/PDF -> Guide -> Journey.
   This is a presentation bridge only; existing payment/auth/track handlers remain owners of their actions. */
(function(){
  var p=(location.pathname||"").toLowerCase();
  var isLanding=(p==="/"||/\/index\.html$/.test(p));
  if(!isLanding)return;
  var applied=false;

  function clean(s){return (s||"").replace(/\s+/g," ").trim()}
  function buttons(){return Array.prototype.slice.call(document.querySelectorAll("button,a"))}
  function findButton(re){
    return buttons().find(function(el){return re.test(clean(el.textContent||""))});
  }
  function findText(re){
    var all=Array.prototype.slice.call(document.querySelectorAll("body *"));
    return all.find(function(el){
      return el.children.length===0 && re.test(clean(el.textContent||""));
    });
  }
  function cardForText(re){
    var leaf=findText(re);
    if(!leaf)return null;
    var el=leaf;
    for(var i=0;i<5&&el;i++,el=el.parentElement){
      var txt=clean(el.innerText||el.textContent||"");
      if(/The PDF above/i.test(txt)&&/The book/i.test(txt)&&el.querySelectorAll("div").length>3)return el;
    }
    return leaf.parentElement&&leaf.parentElement.parentElement||null;
  }
  function makeStep(title,kicker,body,accent){
    var d=document.createElement("div");
    d.className="lr-conv-step";
    d.style.cssText="padding:22px 24px;border:1px solid var(--color-divider);background:"+(accent?"var(--color-accent-100)":"var(--color-bg)")+";box-sizing:border-box";
    var k=document.createElement("div");
    k.style.cssText="font-family:var(--font-heading);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:7px";
    k.textContent=kicker;
    var h=document.createElement("div");
    h.style.cssText="font-family:var(--font-heading);font-size:24px;line-height:1.05;font-weight:600;margin-bottom:8px";
    h.textContent=title;
    var b=document.createElement("div");
    b.style.cssText="font-size:14px;line-height:1.55;color:var(--color-neutral-800);margin-bottom:14px;max-width:62ch";
    b.textContent=body;
    d.appendChild(k);d.appendChild(h);d.appendChild(b);
    return d;
  }
  function makeGuideCta(){
    var cta=document.createElement("button");
    cta.type="button";
    cta.className="btn btn-primary";
    cta.textContent="GET YOUR PERSONALISED BORROWER'S GUIDE — ₹299";
    cta.style.cssText="display:inline-block!important;width:auto!important;margin-top:10px;padding:13px 20px;font-size:14px;letter-spacing:.06em;text-transform:uppercase";
    return cta;
  }
  function removeFooterBookNudge(){
    buttons().forEach(function(el){
      var t=clean(el.textContent||"");
      if(/^(?:THE QUIET YEARS|THE QUIET YEARS — OUR GUIDE FOR BORROWERS),?\s*₹299$/i.test(t) || /THE QUIET YEARS.*OUR GUIDE FOR BORROWERS.*₹299/i.test(t)){
        var footer=el.closest("footer");
        if(footer)el.remove();
      }
    });
  }
  function removeOldChapterFreeLink(){
    buttons().forEach(function(el){
      var t=clean(el.textContent||"");
      if(/^(?:READ TWO CHAPTERS FREE|READ THE FIRST TWO CHAPTERS FREE)$/i.test(t)){
        el.remove();
      }
    });
  }
  function apply(){
    removeFooterBookNudge();
    removeOldChapterFreeLink();
    if(applied)return;
    var pdf=findButton(/^save this result as pdf$/i);
    var track=findButton(/^track this loan(?:\s*[—-].*)?$/i);
    var book=findButton(/^(?:the book|the book\s*[—-]|get your personalised borrower)/i);
    var freeLeaf=findText(/^the pdf above\s*[—-]\s*free, always$/i);
    if(!pdf||!track||!freeLeaf)return;

    var actionRow=track.parentElement;
    var bookPanel=cardForText(/^the pdf above\s*[—-]\s*free, always$/i);
    if(!actionRow||!bookPanel)return;
    if(!/The PDF above/i.test(clean(bookPanel.innerText||"")))return;

    var method=findButton(/read the method and assumptions/i);
    var confidence=Array.prototype.slice.call(actionRow.children).find(function(x){
      return /confidence/i.test(clean(x.textContent||"")) || (x.tagName==="SPAN"&&clean(x.textContent||"").length>20);
    });

    var freeCol=freeLeaf.parentElement;
    var grid=freeCol&&freeCol.parentElement;
    if(!freeCol||!grid)return;

    var wrap=document.createElement("div");
    wrap.id="loanrepo-conversion-ladder";
    wrap.style.cssText="margin-top:34px;display:flex;flex-direction:column;gap:0;border-top:2px solid var(--color-text)";

    var intro=document.createElement("div");
    intro.style.cssText="padding:18px 0 12px";
    intro.innerHTML="<div style=\"font-family:var(--font-heading);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:6px\">What happens next</div><div style=\"font-family:var(--font-heading);font-size:28px;line-height:1.05;font-weight:600\">Diagnosis → Guide → Journey</div>";
    wrap.appendChild(intro);

    var freeStep=makeStep("FREE PDF — your complete diagnosis","01 · Diagnosis","Your verdict, spec sheet, chart and rate-reset history are yours for free. Save the complete diagnosis as a PDF.",false);
    pdf.textContent="SAVE MY FREE DIAGNOSIS PDF";
    pdf.className="btn btn-primary";
    pdf.style.cssText="display:inline-block!important;width:auto!important;margin-top:2px;padding:13px 20px;font-size:14px;letter-spacing:.06em;text-transform:uppercase";
    freeStep.appendChild(pdf);
    wrap.appendChild(freeStep);

    var guideStep=makeStep("BORROWER'S GUIDE — ₹299","02 · Guide","The diagnosis tells you what happened. Your personalised guide explains what to look for next and carries your loan numbers into the worked examples.",true);
    var bookChild=null;
    Array.prototype.slice.call(grid.children).forEach(function(ch){
      var t=clean(ch.innerText||ch.textContent||"");
      if(/The book\s*[—-]\s*₹299/i.test(t))bookChild=ch;
    });
    if(bookChild){
      guideStep.appendChild(bookChild);
    }else if(book){
      guideStep.appendChild(book);
    }
    guideStep.appendChild(makeGuideCta());
    wrap.appendChild(guideStep);

    var journeyStep=makeStep("TRACK THIS LOAN — ₹149/month","03 · Journey","Keep LoanRepo watching your loan after the diagnosis: future resets, impact on your loan, and the actions that follow.",false);
    track.textContent="TRACK THIS LOAN — ₹149/MONTH";
    track.className="btn btn-primary";
    track.style.cssText="display:inline-block!important;width:auto!important;margin-top:2px;padding:13px 20px;font-size:14px;letter-spacing:.06em;text-transform:uppercase";
    journeyStep.appendChild(track);
    wrap.appendChild(journeyStep);

    if(method){
      var methodWrap=document.createElement("div");
      methodWrap.style.cssText="padding:16px 0 0;display:flex;gap:14px;align-items:center;flex-wrap:wrap";
      methodWrap.appendChild(method);
      if(confidence)methodWrap.appendChild(confidence);
      wrap.appendChild(methodWrap);
    }

    actionRow.style.display="none";
    bookPanel.style.display="none";
    bookPanel.parentElement.insertBefore(wrap,bookPanel.nextSibling);
    applied=true;
  }

  function watch(){
    apply();
    try{
      var mo=new MutationObserver(function(){apply()});
      mo.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(function(){mo.disconnect()},120000);
    }catch(e){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch();
})();
