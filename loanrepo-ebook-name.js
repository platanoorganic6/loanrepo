/* LoanRepo Stage-1A name capture.
   Adds an explicit borrower name to the ₹299 personalised-guide checkout.
   The existing Stage-1 flow remains the owner of the checkout; this layer
   only enriches the loanQuery sent to the backend. */
(function () {
  var db = window.LoanRepoDB;
  if (!db || window.__loanRepoEbookNameLoaded) return;
  window.__loanRepoEbookNameLoaded = true;

  var originalStart = db.startEbookOrder;
  if (typeof originalStart === "function") {
    db.startEbookOrder = function (email, loanQuery) {
      var input = document.getElementById("lr-ebook-name");
      var name = input ? String(input.value || "").trim() : "";
      if (loanQuery && name) loanQuery.name = name;
      return originalStart.call(db, email, loanQuery);
    };
  }

  function enhance() {
    var email = document.getElementById("lr-ebook-email");
    if (!email || document.getElementById("lr-ebook-name")) return;

    var label = document.createElement("label");
    label.setAttribute("for", "lr-ebook-name");
    label.textContent = "Your name";
    label.style.cssText = "display:block;font-size:12px;color:var(--color-neutral-700);margin:14px 0 6px";

    var input = document.createElement("input");
    input.id = "lr-ebook-name";
    input.type = "text";
    input.autocomplete = "name";
    input.maxLength = 120;
    input.placeholder = "Your full name";
    input.style.cssText = "width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--color-divider);font:inherit";

    email.parentNode.insertBefore(label, email);
    email.parentNode.insertBefore(input, email);
  }

  var observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
