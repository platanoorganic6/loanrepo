/* LoanRepo Documents panel for the account workspace. */
(function(){
  if((location.pathname||"").toLowerCase().indexOf("app.html")<0)return;
  function start(){
    var db=window.LoanRepoDB;if(!db||!db.enabled||!db.client)return;
    var last="";
    function render(){
      var nodes=Array.prototype.slice.call(document.querySelectorAll("main .card.empty"));
      var target=nodes.find(function(n){return /Evidence Vault is next/i.test(n.textContent||"")});
      if(!target)return;
      if(target.getAttribute("data-docs-rendered")==="1")return;
      target.setAttribute("data-docs-rendered","1");
      db.client.from("user_documents").select("id,title,document_type,storage_path,created_at,order_id").order("created_at",{ascending:false}).then(function(r){
        if(r.error){target.innerHTML="<h2>Documents unavailable.</h2><p>Please refresh and try again.</p>";return;}
        var docs=r.data||[];
        if(!docs.length){target.innerHTML="<h2>No documents yet.</h2><p>Your personalised Borrower’s Guide will appear here after a successful ₹299 purchase.</p><a class='btn primary' href='index.html'>Get your personalised guide</a>";return;}
        var html="<h2>Your documents</h2><p>Your purchased LoanRepo documents are stored privately in your account.</p><div style='display:grid;gap:10px;text-align:left;margin-top:18px'>";
        docs.forEach(function(d){html+="<div style='border-top:1px solid var(--color-divider);padding:14px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap'><div style='margin-right:auto'><b style='font-family:var(--font-heading);font-size:18px'>"+esc(d.title||"Document")+"</b><div style='font-size:12px;color:var(--color-neutral-600);margin-top:4px'>"+esc(d.document_type||"")+" · "+esc(new Date(d.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}))+"</div></div><button class='btn primary' data-doc-path='"+esc(d.storage_path)+"'>View / download PDF</button></div>"});html+="</div>";target.innerHTML=html;
        target.querySelectorAll("[data-doc-path]").forEach(function(b){b.onclick=function(){var path=b.getAttribute("data-doc-path");b.disabled=true;b.textContent="Opening…";db.client.storage.from("loanrepo-documents").createSignedUrl(path,300).then(function(x){if(x.error||!x.data||!x.data.signedUrl){b.disabled=false;b.textContent="View / download PDF";alert("We could not open this document. Please refresh and try again.");return}window.open(x.data.signedUrl,"_blank","noopener")})}});
      });
    }
    function esc(v){return String(v==null?"":v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
    var mo=new MutationObserver(render);mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},120000);render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();