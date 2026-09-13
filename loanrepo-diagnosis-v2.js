/* LoanRepo Diagnosis v2
 * Presentation-layer enhancement. Keeps the existing amortisation engine intact.
 * Adds clearer positioning, a diagnostic health card, confidence language and
 * next-action guidance after a loan run.
 *
 * Robust rendering: the diagnosis card is a singleton, refreshes with the
 * current result DOM, and carries critical layout styles inline so app-level
 * CSS/layout changes cannot collapse it into unstyled text.
 */
(() => {
  'use strict';
  if (window.__LOANREPO_DIAGNOSIS_V2__) return;
  window.__LOANREPO_DIAGNOSIS_V2__ = true;

  const CARD_ID = 'loanrepo-diagnosis-v2-card';
  const STYLE_ID = 'loanrepo-diagnosis-v2-css';

  const css = `
    #${CARD_ID}{
      display:block !important;
      width:100% !important;
      max-width:100% !important;
      box-sizing:border-box !important;
      clear:both !important;
      position:relative !important;
      z-index:2 !important;
      margin:24px 0 !important;
      padding:22px 24px !important;
      border:1px solid var(--color-divider,#d7d7d7) !important;
      background:var(--color-bg,#fff) !important;
      color:var(--color-text,#111) !important;
      grid-column:1 / -1 !important;
    }
    #${CARD_ID} .lr2-grid{display:grid !important;grid-template-columns:minmax(180px,.8fr) 1fr !important;gap:24px !important;align-items:start !important}
    #${CARD_ID} .lr2-kicker{font-family:var(--font-heading,inherit);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700,#315b7d);margin-bottom:7px}
    #${CARD_ID} .lr2-title{font-family:var(--font-heading,inherit);font-size:28px;font-weight:600;line-height:1.05;margin:0 0 8px}
    #${CARD_ID} .lr2-score{font-family:var(--font-heading,inherit);font-size:58px;font-weight:600;line-height:.9;font-variant-numeric:tabular-nums}
    #${CARD_ID} .lr2-muted{font-size:12px;line-height:1.5;color:var(--color-neutral-700,#555)}
    #${CARD_ID} .lr2-actions{display:grid !important;grid-template-columns:repeat(3,1fr) !important;gap:10px !important;margin-top:14px !important}
    #${CARD_ID} .lr2-action{border-top:2px solid var(--color-text,#111);padding-top:9px;font-size:13px;line-height:1.45}
    #${CARD_ID} .lr2-action b{display:block;font-family:var(--font-heading,inherit);font-size:14px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
    #${CARD_ID} .lr2-confidence{display:inline-flex !important;align-items:center;gap:7px;font-size:12px;border:1px solid var(--color-divider,#d7d7d7);padding:6px 9px;margin-top:10px}
    #${CARD_ID} .lr2-dot{width:7px;height:7px;border-radius:50%;background:var(--color-accent-700,#315b7d);display:inline-block}
    @media(max-width:700px){
      #${CARD_ID}{padding:18px 16px !important}
      #${CARD_ID} .lr2-grid{grid-template-columns:1fr !important}
      #${CARD_ID} .lr2-actions{grid-template-columns:1fr !important}
    }
  `;

  function ensureStyles(){
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }
  ensureStyles();

  function text(el){ return (el && el.textContent || '').replace(/\s+/g,' ').trim(); }

  function parseYears(root){
    const m = text(root).match(/\+(\d+(?:\.\d+)?)\s*years? of tenure/i);
    return m ? Number(m[1]) : 0;
  }

  function parseRates(root){
    const m = text(root).match(/from\s+(\d+(?:\.\d+)?)%.*?to\s+(\d+(?:\.\d+)?)%/i);
    return m ? {start:Number(m[1]),now:Number(m[2])} : null;
  }

  function score(root){
    const years = parseYears(root);
    const rates = parseRates(root);
    let value = 88;
    value -= Math.min(30, years * 7);
    if (rates && rates.now > rates.start) value -= Math.min(12,(rates.now-rates.start)*6);
    return Math.max(35,Math.min(95,Math.round(value)));
  }

  /* Find the stable result anchor used by the page itself. Do not depend on
     the verdict wording: a healthy loan says "ahead of your original schedule"
     while a leakage case says "Added to your loan, unannounced". Both share the
     same result container with scroll-margin-top. */
  function findResult(root){
    const marked = root.querySelector('[style*="scroll-margin-top"]');
    if (marked) return marked;

    const marker = Array.from(root.querySelectorAll('div')).find(el => {
      if (el.closest && el.closest('.lr2-health')) return false;
      const s = text(el);
      return /added to your loan|ahead of your original schedule|ahead of schedule/i.test(s);
    });
    if (!marker) return null;

    let parent = marker;
    for(let i=0;i<8 && parent;i++,parent=parent.parentElement){
      if (parent.querySelector && parent.querySelector('table')) return parent;
    }
    return marker.parentElement;
  }

  function removeDuplicateCards(root){
    const cards = Array.from(root.querySelectorAll('.lr2-health'));
    if (!cards.length) return null;
    const keeper = cards.find(card => card.id === CARD_ID) || cards[0];
    cards.forEach(card => { if (card !== keeper) card.remove(); });
    keeper.id = CARD_ID;
    return keeper;
  }

  function renderCard(card,result){
    const years = parseYears(result);
    const rates = parseRates(result);
    const health = score(result);
    const estimated = !document.querySelector('#dc-root input[type="checkbox"]:checked + span') || text(document.getElementById('dc-root')).includes('Typical EBLR spreads');
    const rateLine = rates
      ? `Rate moved from ${rates.start.toFixed(2)}% to ${rates.now.toFixed(2)}% in the model.`
      : 'Your rate path is based on the selected benchmark and spread.';

    card.className = 'lr2-health';
    card.innerHTML = `
      <div class="lr2-grid">
        <div>
          <div class="lr2-kicker">Loan diagnosis</div>
          <div class="lr2-score">${health}</div>
          <div class="lr2-title">Loan Health</div>
          <div class="lr2-muted">A diagnostic score for the modelled impact of the rate cycle. It is not a credit score or lender rating.</div>
          <div class="lr2-confidence"><span class="lr2-dot"></span>${estimated ? 'Estimated model' : 'Modelled from your inputs'}</div>
        </div>
        <div>
          <div class="lr2-kicker">What matters now</div>
          <div class="lr2-actions">
            <div class="lr2-action"><b>${years > 0 ? `+${years} years` : 'No tenure leakage'}</b>${years > 0 ? 'Estimated additional tenure in this model.' : 'The current model does not show tenure leakage.'}</div>
            <div class="lr2-action"><b>Verify the spread</b>Check the sanction letter and latest statement. Your actual spread is more reliable than a default assumption.</div>
            <div class="lr2-action"><b>Log the next reset</b>Record the actual rate, EMI, outstanding and remaining months so LoanRepo can reconcile the model with your statement.</div>
          </div>
          <div class="lr2-muted" style="margin-top:15px">${rateLine}</div>
        </div>
      </div>`;
  }

  function enhance(){
    const root = document.getElementById('dc-root');
    if (!root) return;
    ensureStyles();

    const h1 = root.querySelector('h1');
    if (h1 && h1.textContent.includes('Your bank never told you this changed.')) {
      h1.textContent = 'Did your home loan quietly get longer?';
    }

    const lead = Array.from(root.querySelectorAll('p')).find(p => text(p).startsWith('Enter the month you took the loan.'));
    if (lead) lead.textContent = 'See what the rate cycle did to your loan — tenure, balance and estimated interest — and understand what to check next.';

    /* Remove/move our presentation layer first so the result is always located
       in the app's original DOM position. */
    const existingCard = removeDuplicateCards(root);
    const result = findResult(root);

    if (!result) {
      if (existingCard) existingCard.remove();
      return;
    }

    const card = existingCard || document.createElement('section');
    card.id = CARD_ID;
    card.className = 'lr2-health';
    renderCard(card,result);

    /* IMPORTANT: keep the original loan result completely intact. The health
       card is a sibling placed immediately before it, never inside its verdict
       grid or one of its metric rows. */
    if (card.parentNode !== result.parentNode || card.nextElementSibling !== result) {
      result.parentNode.insertBefore(card,result);
    }
  }

  let scheduled = false;
  let appObserver = null;

  function scheduleEnhance(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  }

  function observeApp(){
    const root = document.getElementById('dc-root');
    if (!root) return false;
    if (appObserver) return true;

    appObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some(mutation => {
        if (mutation.type !== 'childList') return false;
        if (!mutation.addedNodes.length && !mutation.removedNodes.length) return false;
        return !Array.from(mutation.addedNodes).every(node => node.nodeType === 1 && (node.matches?.('#'+CARD_ID) || node.closest?.('#'+CARD_ID)));
      });
      if (relevant) scheduleEnhance();
    });
    appObserver.observe(root,{childList:true,subtree:true});
    scheduleEnhance();
    return true;
  }

  const bootstrapObserver = new MutationObserver(() => {
    if (observeApp()) bootstrapObserver.disconnect();
  });

  if (!observeApp()) bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(() => { observeApp(); enhance(); },500);
  setTimeout(() => enhance(),1500);
})();
