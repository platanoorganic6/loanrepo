(() => {
  'use strict';
  const CARD_ID = 'loanrepo-diagnosis-v2-card';
  const STYLE_ID = 'loanrepo-health-refinement-css';
  const css = `
    #${CARD_ID} .lr2-action{display:flex;flex-direction:column;gap:3px}
    #${CARD_ID} .lr2-action b{margin-bottom:0}
  `;
  function run(){
    let style = document.getElementById(STYLE_ID);
    if (!style) { style=document.createElement('style'); style.id=STYLE_ID; document.head.appendChild(style); }
    style.textContent=css;
    const card=document.getElementById(CARD_ID);
    if (!card) return;
    const first=card.querySelector('.lr2-action');
    if (first) {
      const b=first.querySelector('b');
      if (b) b.textContent = b.textContent.replace(/^Tenure has drifted\s*/i,'');
    }
  }
  run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
