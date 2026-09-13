/* LoanRepo Diagnosis v2
 * Presentation-layer enhancement. Keeps the existing amortisation engine intact.
 * Adds clearer positioning, a diagnostic health card, confidence language and
 * next-action guidance after a loan run.
 */
(() => {
  'use strict';
  if (window.__LOANREPO_DIAGNOSIS_V2__) return;
  window.__LOANREPO_DIAGNOSIS_V2__ = true;

  const css = `
    .lr2-health{margin:24px 0 0;padding:22px 24px;border:1px solid var(--color-divider);background:var(--color-bg);}
    .lr2-grid{display:grid;grid-template-columns:minmax(180px,.8fr) 1fr;gap:24px;align-items:start}
    .lr2-kicker{font-family:var(--font-heading);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:7px}
    .lr2-title{font-family:var(--font-heading);font-size:28px;font-weight:600;line-height:1.05;margin:0 0 8px}
    .lr2-score{font-family:var(--font-heading);font-size:58px;font-weight:600;line-height:.9;font-variant-numeric:tabular-nums}
    .lr2-muted{font-size:12px;line-height:1.5;color:var(--color-neutral-700)}
    .lr2-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
    .lr2-action{border-top:2px solid var(--color-text);padding-top:9px;font-size:13px;line-height:1.45}
    .lr2-action b{display:block;font-family:var(--font-heading);font-size:14px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
    .lr2-confidence{display:inline-flex;align-items:center;gap:7px;font-size:12px;border:1px solid var(--color-divider);padding:6px 9px;margin-top:10px}
    .lr2-dot{width:7px;height:7px;border-radius:50%;background:var(--color-accent-700);display:inline-block}
    @media(max-width:700px){.lr2-grid{grid-template-columns:1fr}.lr2-actions{grid-template-columns:1fr}}
  `;
  const style = document.createElement('style');
  style.id = 'loanrepo-diagnosis-v2-css';
  style.textContent = css;
  document.head.appendChild(style);

  function text(el){ return (el && el.textContent || '').replace(/\s+/g,' ').trim(); }
  function money(n){
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
  }
  function parseYears(root){
    const s = text(root);
    const m = s.match(/\+(\d+(?:\.\d+)?)\s*years? of tenure/i);
    return m ? Number(m[1]) : 0;
  }
  function parseRates(root){
    const s = text(root);
    const m = s.match(/from\s+(\d+(?:\.\d+)?)%.*?to\s+(\d+(?:\.\d+)?)%/i);
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
  function findResult(){
    const root = document.getElementById('dc-root');
    if (!root) return null;
    const marker = Array.from(root.querySelectorAll('div')).find(el => {
      const s = text(el);
      return s.includes('Added to your loan, unannounced') || s.includes('ahead of schedule');
    });
    if (!marker) return null;
    let parent = marker;
    for(let i=0;i<4 && parent;i++,parent=parent.parentElement){
      if (parent.querySelector && parent.querySelector('table')) return parent;
    }
    return marker.parentElement;
  }
  function enhance(){
    const root = document.getElementById('dc-root');
    if (!root) return;

    const h1 = root.querySelector('h1');
    if (h1 && h1.textContent.includes('Your bank never told you this changed.')) {
      h1.textContent = 'Did your home loan quietly get longer?';
    }

    const lead = Array.from(root.querySelectorAll('p')).find(p => text(p).startsWith('Enter the month you took the loan.'));
    if (lead) lead.textContent = 'See what the rate cycle did to your loan — tenure, balance and estimated interest — and understand what to check next.';

    const result = findResult();
    if (!result) return;
    if (result.querySelector('.lr2-health')) return;

    const years = parseYears(result);
    const rates = parseRates(result);
    const health = score(result);
    const estimated = !root.querySelector('input[type="checkbox"]:checked + span') || text(root).includes('Typical EBLR spreads');
    const rateLine = rates ? `Rate moved from ${rates.start.toFixed(2)}% to ${rates.now.toFixed(2)}% in the model.` : 'Your rate path is based on the selected benchmark and spread.';

    const card = document.createElement('section');
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

    result.parentNode.insertBefore(card,result.nextSibling);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(enhance,500);
  setTimeout(enhance,1500);
})();